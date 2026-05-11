import type { LinkedInProspect } from "@/types/linkedin";

export interface ProspectAirtableRecord {
  id: string;
  leadId?: string;
  name: string;
  actionType: string;
  status: string;
  generatedMessage: string;
  customMessage?: string;
  isManual?: boolean;
  context?: string;
  profileUrl?: string;
  siteUrl?: string;
  createdAt: string;
  sentAt?: string;
  conversationLength?: number;
  skeletonId?: string;
}

export interface LinkedInAirtableConfig {
  airtableKey: string;
  baseId: string;
  tableName: string;
}

export interface LinkedInAirtablePushResult {
  synced: number;
  created: number;
  updated: number;
  message: string;
}

type AirtablePushResponse = {
  createdRecords?: string[];
  updatedRecords?: string[];
};

export const LINKEDIN_AIRTABLE_FIELDS = {
  prospectId: "prospect_id",
  name: "Nom",
  action: "Action",
  status: "Statut",
  message: "Message",
  context: "Contexte",
  profileUrl: "Profil LinkedIn",
  siteUrl: "Site web",
  createdAt: "Créé le",
  sentAt: "Envoyé le",
  conversationLength: "Nb messages conversation",
  manual: "Manuel",
} as const;

export function cleanAirtableToken(value: unknown) {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^authorization:\s*/i, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

export function cleanAirtableText(value: unknown) {
  return String(value ?? "").trim();
}

export function prospectToAirtableRecord(prospect: ProspectAirtableRecord | LinkedInProspect) {
  const conversationLength =
    "conversationLength" in prospect
      ? prospect.conversationLength
      : (prospect as LinkedInProspect).conversation?.length;

  return {
    fields: {
      [LINKEDIN_AIRTABLE_FIELDS.prospectId]: prospect.id,
      [LINKEDIN_AIRTABLE_FIELDS.name]: prospect.name,
      [LINKEDIN_AIRTABLE_FIELDS.action]:
        prospect.actionType === "liked"
          ? "Like"
          : prospect.actionType === "commented"
            ? "Commentaire"
            : prospect.actionType === "visited_profile"
              ? "Visite profil"
              : "Autre",
      [LINKEDIN_AIRTABLE_FIELDS.status]: prospect.status,
      [LINKEDIN_AIRTABLE_FIELDS.message]: prospect.customMessage || prospect.generatedMessage,
      [LINKEDIN_AIRTABLE_FIELDS.context]: prospect.context || "",
      [LINKEDIN_AIRTABLE_FIELDS.profileUrl]: prospect.profileUrl || "",
      [LINKEDIN_AIRTABLE_FIELDS.siteUrl]: prospect.siteUrl || "",
      [LINKEDIN_AIRTABLE_FIELDS.createdAt]: prospect.createdAt
        ? new Date(prospect.createdAt).toISOString().split("T")[0]
        : null,
      [LINKEDIN_AIRTABLE_FIELDS.sentAt]: prospect.sentAt
        ? new Date(prospect.sentAt).toISOString().split("T")[0]
        : null,
      [LINKEDIN_AIRTABLE_FIELDS.conversationLength]: conversationLength || 0,
      [LINKEDIN_AIRTABLE_FIELDS.manual]: Boolean(prospect.isManual),
    },
  };
}

export function formatAirtableError(errText: string, tableName: string, baseId: string) {
  if (errText.includes('"type":"UNAUTHORIZED"') || errText.includes('"type": "UNAUTHORIZED"')) {
    return "Airtable refuse le token enregistre. Ouvrez Parametres LinkedIn > Airtable, collez un Personal Access Token actif et verifiez qu'il a acces a cette base.";
  }

  if (errText.includes('"error":"NOT_FOUND"') || errText.includes('"error": "NOT_FOUND"')) {
    return `Airtable introuvable. Verifiez le Base ID (${baseId}), le nom exact de la table ("${tableName}") et que le token a bien acces a cette base.`;
  }

  if (errText.includes("INVALID_PERMISSIONS")) {
    return "Permissions Airtable insuffisantes. Verifiez que le token a les droits data.records:read et data.records:write sur cette base.";
  }

  if (errText.includes("INVALID_VALUE_FOR_COLUMN")) {
    return `Valeur Airtable invalide pour une colonne. Verifiez surtout les types des champs Date, URL, Number et Checkbox dans la table "${tableName}". Detail: ${errText}`;
  }

  return `Airtable API: ${errText}`;
}

export async function pushLinkedInProspectsToAirtable(
  prospects: Array<ProspectAirtableRecord | LinkedInProspect>,
  config: LinkedInAirtableConfig
): Promise<LinkedInAirtablePushResult> {
  const airtableKey = cleanAirtableToken(config.airtableKey);
  const baseId = cleanAirtableText(config.baseId);
  const tableName = cleanAirtableText(config.tableName);

  if (!airtableKey || !baseId || !tableName) {
    throw new Error("Configuration Airtable incomplete (cle, base ID, nom de table).");
  }

  if (prospects.length === 0) {
    return { synced: 0, created: 0, updated: 0, message: "Aucun prospect a synchroniser" };
  }

  const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  const headers = {
    Authorization: `Bearer ${airtableKey}`,
    "Content-Type": "application/json",
  };

  const batchSize = 10;
  let created = 0;
  let updated = 0;

  for (let index = 0; index < prospects.length; index += batchSize) {
    const records = prospects.slice(index, index + batchSize).map(prospectToAirtableRecord);
    const res = await fetch(baseUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        records,
        performUpsert: { fieldsToMergeOn: [LINKEDIN_AIRTABLE_FIELDS.prospectId] },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(formatAirtableError(errText, tableName, baseId));
    }

    const data = (await res.json()) as AirtablePushResponse;
    created += data.createdRecords?.length ?? 0;
    updated += data.updatedRecords?.length ?? 0;
  }

  return {
    synced: created + updated,
    created,
    updated,
    message: `${created} crees, ${updated} mis a jour`,
  };
}
