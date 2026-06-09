export const COLD_CALL_STATUSES = [
  "not_contacted",
  "audit_to_send",
  "audit_sent",
  "call_planned",
  "no_answer",
  "callback",
  "qualified",
  "meeting_booked",
  "refused",
  "won",
] as const;

export type ColdCallStatus = (typeof COLD_CALL_STATUSES)[number];

export type ColdCallLead = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string;
  phone: string | null;
  email: string | null;
  business_description: string | null;
  sector: string | null;
  has_website: boolean;
  website_url: string | null;
  audit_sent: boolean;
  audit_url: string | null;
  status: ColdCallStatus;
  source: string;
  source_ref: string | null;
  notes: string | null;
  next_call_at: string | null;
  last_called_at: string | null;
  selected_script_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  cold_call_attempts?: ColdCallAttempt[];
};

export type ColdCallAttempt = {
  id: string;
  lead_id: string;
  user_id: string;
  script_id: string | null;
  outcome: ColdCallStatus | "connected";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  summary: string | null;
  transcript: string | null;
  recording_url: string | null;
  coaching_notes: string | null;
  external_call_id: string | null;
  created_at: string;
};

export type ColdCallScript = {
  id: string;
  user_id: string;
  name: string;
  content: string;
  active: boolean;
  calls_count: number;
  connected_count: number;
  meetings_count: number;
  created_at: string;
  updated_at: string;
};
