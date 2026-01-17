"use client";

import { useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { useScaffoldEventHistory, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { Attempt, AttemptResult, EventStatus, Ticket, TicketEvent } from "~~/types/ticket-engine";

export const useTicketEngine = () => {
  const { address } = useAccount();

  const { data: allEventsData, refetch: refetchEvents } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getAllEvents",
  });

  const { writeContractAsync: writeTicketEngine, isPending: isMining } = useScaffoldWriteContract("TicketEngine");

  const events: TicketEvent[] = allEventsData
    ? allEventsData[0].map((id: bigint, index: number) => ({
        id,
        title: allEventsData[1][index],
        startTime: allEventsData[2][index],
        totalTickets: allEventsData[3][index],
        remainingTickets: allEventsData[4][index],
        organizer: allEventsData[5][index],
        status: getEventStatusFromData(allEventsData[2][index], allEventsData[4][index]),
      }))
    : [];

  const createEvent = useCallback(
    async (title: string, startTime: bigint, totalTickets: bigint) => {
      const result = await writeTicketEngine({
        functionName: "createEvent",
        args: [title, startTime, totalTickets],
      });
      await refetchEvents();
      return result;
    },
    [writeTicketEngine, refetchEvents],
  );

  const grabTicket = useCallback(
    async (eventId: bigint) => {
      const result = await writeTicketEngine({
        functionName: "grabTicket",
        args: [eventId],
      });
      await refetchEvents();
      return result;
    },
    [writeTicketEngine, refetchEvents],
  );

  return { events, createEvent, grabTicket, isMining, refetchEvents, address };
};

export const useEvent = (eventId: bigint) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getEvent",
    args: [eventId],
  });

  const event: TicketEvent | null = data
    ? {
        id: data[0],
        title: data[1],
        startTime: data[2],
        totalTickets: data[3],
        remainingTickets: data[4],
        organizer: data[5],
        status: data[6] as EventStatus,
      }
    : null;

  return { event, refetch };
};

export const useUserTickets = (userAddress?: string) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getUserTickets",
    args: [userAddress],
    query: { enabled: !!userAddress },
  });

  const tickets: Ticket[] = data
    ? data[0].map((ticketId: bigint, index: number) => ({
        id: ticketId,
        eventId: data[1][index],
        eventTitle: data[2][index],
        acquiredAt: data[3][index],
      }))
    : [];

  return { tickets, refetch };
};

export const useUserAttempts = (userAddress?: string) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getUserAttempts",
    args: [userAddress],
    query: { enabled: !!userAddress },
  });

  const attempts: Attempt[] = data
    ? data.map((attempt: { eventId: bigint; participant: string; timestamp: bigint; result: number }) => ({
        eventId: attempt.eventId,
        participant: attempt.participant,
        timestamp: attempt.timestamp,
        result: attempt.result as AttemptResult,
      }))
    : [];

  return { attempts, refetch };
};

export const useRecentTickets = (eventId: bigint, limit: bigint = 5n) => {
  const { data, refetch } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "getRecentTickets",
    args: [eventId, limit],
  });

  const recentTickets = data
    ? data[0].map((ticketId: bigint, index: number) => ({
        ticketId,
        owner: data[1][index],
        acquiredAt: data[2][index],
      }))
    : [];

  return { recentTickets, refetch };
};

export const useHasTicket = (eventId: bigint, userAddress?: string) => {
  const { data: hasTicket } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "hasTicketForEvent",
    args: [eventId, userAddress],
    query: { enabled: !!userAddress },
  });

  const { data: ticketId } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "userTicketForEvent",
    args: [eventId, userAddress],
    query: { enabled: !!userAddress && !!hasTicket },
  });

  return { hasTicket: !!hasTicket, ticketId };
};

function getEventStatusFromData(startTime: bigint, remainingTickets: bigint): EventStatus {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < startTime) return EventStatus.NotStarted;
  if (remainingTickets === 0n) return EventStatus.SoldOut;
  return EventStatus.InProgress;
}

export const useTokenURI = (tokenId: bigint | undefined) => {
  const { data, isLoading } = useScaffoldReadContract({
    contractName: "TicketEngine",
    functionName: "tokenURI",
    args: [tokenId],
    query: { enabled: tokenId !== undefined && tokenId > 0n },
  });

  // Parse the base64 JSON to extract the image
  const nftData = data ? parseTokenURI(data) : null;

  return { tokenURI: data, nftData, isLoading };
};

export type AttemptEvent = {
  eventId: bigint;
  participant: string;
  result: AttemptResult;
  timestamp: bigint;
  blockNumber: bigint;
};

/**
 * Hook to watch recent grab attempts for an event using AttemptRecorded events
 * Returns unique participants who have attempted but not yet won
 */
export const useRecentAttempts = (eventId: bigint) => {
  const {
    data: attemptEvents,
    isLoading,
    refetch,
  } = useScaffoldEventHistory({
    contractName: "TicketEngine",
    eventName: "AttemptRecorded",
    fromBlock: 0n,
    watch: true,
    filters: { eventId },
  });

  // Get all unique participants who have made attempts
  const allAttempts = useMemo(() => {
    if (!attemptEvents) return [];

    return attemptEvents
      .map(event => ({
        eventId: event.args.eventId as bigint,
        participant: event.args.participant as string,
        result: event.args.result as AttemptResult,
        timestamp: event.args.timestamp as bigint,
        blockNumber: event.blockNumber,
      }))
      .sort((a, b) => Number(b.timestamp - a.timestamp));
  }, [attemptEvents]);

  // Get unique participants (deduplicated by address, keep most recent attempt)
  const uniqueParticipants = useMemo(() => {
    const seen = new Set<string>();
    return allAttempts.filter(a => {
      if (seen.has(a.participant.toLowerCase())) return false;
      seen.add(a.participant.toLowerCase());
      return true;
    });
  }, [allAttempts]);

  return {
    attempts: uniqueParticipants,
    isLoading,
    refetch,
  };
};

function parseTokenURI(uri: string): { name: string; description: string; image: string } | null {
  try {
    const base64Data = uri.replace("data:application/json;base64,", "");
    const jsonStr = atob(base64Data);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
