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
  const firstName = audit.full_name?.trim().split(/\s+/)[0] || "bonjour";
  const auditUrl = audit.audit_url?.trim() || "";
  const accessKey = audit.access_key || "";

  return [
    `Bonjour ${firstName},`,
    "",
    "J'ai prepare l'audit de votre site.",
    auditUrl ? `Voici le lien pour le consulter : ${auditUrl}` : "Je vous envoie le lien de l'audit juste apres validation.",
    accessKey ? `Code d'acces : ${accessKey}` : "",
    "",
    "Dites-moi quand vous l'avez regarde, je vous dirai les 2-3 actions les plus prioritaires a lancer.",
  ].filter(Boolean).join("\n");
}

