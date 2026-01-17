import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://zakxolvykcfsonpvqpjv.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha3hvbHZ5a2Nmc29ucHZxcGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjAzNzQsImV4cCI6MjA4MzU5NjM3NH0.eeRvSg8u3FnrRvr0_mbzbpvkxr4f6V05BygvV0pFkWE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Table name for grabbing participants
export const GRABBING_TABLE = "grabbing_participants";

// Type for grabbing participant record
export interface GrabbingParticipant {
  id?: string;
  event_id: string;
  wallet_address: string;
  started_at: string;
  status: "grabbing" | "success" | "failed";
}
