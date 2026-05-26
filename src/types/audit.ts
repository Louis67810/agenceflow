export type AuditRequestStatus =
  | "pending"
  | "accepted"
  | "refused"
  | "audit_ready"
  | "sent";

export type AuditRequest = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  website_url: string;
  business_domain: string;
  business_description: string;
  main_question: string;
  status: AuditRequestStatus;
  access_key: string | null;
  decision_note: string | null;
  audit_url: string | null;
  audit_summary: string | null;
  whatsapp_message: string | null;
  whatsapp_sent_at: string | null;
  raw_answers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

