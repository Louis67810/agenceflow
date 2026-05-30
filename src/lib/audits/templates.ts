import type { AuditRequest } from "@/types/audit";

export function normalizeWebsiteUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function generateAuditAccessKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parts = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
  );
  return parts.join("-");
}

export function buildAuditMessage(audit: AuditRequest) {
  const firstName = audit.full_name?.trim().split(/\s+/)[0] || "";
  const auditUrl = audit.audit_url?.trim() || "";
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";

  return [
    greeting,
    "",
    auditUrl
      ? `Voici ton audit de ton site : ${auditUrl}`
      : "Voici ton audit de ton site. Je t'envoie le lien juste apres validation.",
    "Dis-moi ce que tu en penses.",
  ].filter(Boolean).join("\n");
}
