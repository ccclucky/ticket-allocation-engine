"use client";

import { useCallback, useEffect, useState } from "react";
import { GRABBING_TABLE, GrabbingParticipant, supabase } from "~~/services/supabase/client";

/**
 * Hook for real-time sync of grabbing participants across clients
 * - When a user starts grabbing, their address is added to the list
 * - When they succeed or fail, their status is updated
 * - All clients see real-time updates via Supabase Realtime
 */
export const useGrabbingSync = (eventId: string) => {
  const [grabbingList, setGrabbingList] = useState<GrabbingParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    const fetchGrabbing = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from(GRABBING_TABLE)
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "grabbing")
        .order("started_at", { ascending: false });

      if (!error && data) {
        setGrabbingList(data);
      }
      setIsLoading(false);
    };

    fetchGrabbing();
  }, [eventId]);

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel(`grabbing-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: GRABBING_TABLE,
          filter: `event_id=eq.${eventId}`,
        },
        payload => {
          if (payload.eventType === "INSERT") {
            const newRecord = payload.new as GrabbingParticipant;
            if (newRecord.status === "grabbing") {
              setGrabbingList(prev => {
                // Avoid duplicates
                if (prev.some(p => p.wallet_address === newRecord.wallet_address)) {
                  return prev;
                }
                return [newRecord, ...prev];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as GrabbingParticipant;
            if (updated.status !== "grabbing") {
              // Remove from grabbing list when status changes
              setGrabbingList(prev => prev.filter(p => p.wallet_address !== updated.wallet_address));
            }
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as GrabbingParticipant;
            setGrabbingList(prev => prev.filter(p => p.id !== deleted.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // Start grabbing - call when user initiates grab
  const startGrabbing = useCallback(
    async (walletAddress: string) => {
      const { error } = await supabase.from(GRABBING_TABLE).upsert(
        {
          event_id: eventId,
          wallet_address: walletAddress.toLowerCase(),
          started_at: new Date().toISOString(),
          status: "grabbing",
        },
        {
          onConflict: "event_id,wallet_address",
        },
      );

      if (error) {
        console.error("Failed to start grabbing:", error);
      }
    },
    [eventId],
  );

  // End grabbing - call when transaction completes (success or fail)
  const endGrabbing = useCallback(
    async (walletAddress: string, success: boolean) => {
      const { error } = await supabase
        .from(GRABBING_TABLE)
        .update({ status: success ? "success" : "failed" })
        .eq("event_id", eventId)
        .eq("wallet_address", walletAddress.toLowerCase());

      if (error) {
        console.error("Failed to end grabbing:", error);
      }
    },
    [eventId],
  );

  // Get only "grabbing" status participants (exclude winners)
  const activeGrabbing = grabbingList.filter(p => p.status === "grabbing");

  return {
    grabbingList: activeGrabbing,
    isLoading,
    startGrabbing,
    endGrabbing,
  };
};
