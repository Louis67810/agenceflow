import { createClient } from "@supabase/supabase-js";
import { formatSupabaseError } from "@/lib/supabase/format-error";

type LeadMagnetField = {
  id: string;
  type: "text" | "email" | "phone";
  label: string;
  placeholder: string;
  required: boolean;
  key: string;
};

type LeadMagnetStep = {
  id: string;
  fields: LeadMagnetField[];
};

export type LeadMagnetAirtableSettings = {
  airtableKey: string;
  airtableBaseId: string;
};

export type LeadMagnetSyncConfig = {
  id: string;
  owner_user_id?: string | null;
  title: string;
  steps: LeadMagnetStep[];
  airtable_auto_sync?: boolean | null;
  airtable_table_name?: string | null;
};

export type LeadMagnetLeadSyncRecord = {
  data: Record<string, unknown>;
  email: string;
  email_sent: boolean;
  created_at: string;
};

export type LeadMagnetAirtableValidationResult =
  | {
      ok: true;
      message: string;
      logs: string[];
    }
  | {
      ok: false;
      reason: "missing_settings" | "validation_failed";
      message: string;
      logs: string[];
    };

type AirtableRecordsResponse = {
  records?: Array<{ id: string }>;
};

const DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS: LeadMagnetAirtableSettings = {
  airtableKey: "",
  airtableBaseId: "",
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getAirtableHeaders(airtableKey: string) {
  return {
    Authorization: `Bearer ${airtableKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function normalizeSettings(
  settings?: Partial<LeadMagnetAirtableSettings> | null
): LeadMagnetAirtableSettings {
  return {
    ...DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS,
    airtableKey: typeof settings?.airtableKey === "string" ? settings.airtableKey.trim() : "",
    airtableBaseId: typeof settings?.airtableBaseId === "string" ? settings.airtableBaseId.trim() : "",
  };
}

function sanitizeAirtableName(value: string, fallback: string) {
  const sanitized = value.replace(/\s+/g, " ").trim();
  return (sanitized || fallback).slice(0, 100);
}

function getLeadValue(data: Record<string, unknown>, key: string) {
  const value = data[key];
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

async function airtableFetch<T>(url: string, init: RequestInit, fallbackError: string): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(formatLeadMagnetAirtableError(fallbackError, errText, url, res.status));
  }
  return res.json() as Promise<T>;
}

async function airtableFetchRaw(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const body = (await res.text()).replace(/\s+/g, " ").trim();
  return {
    ok: res.ok,
    status: res.status,
    body,
  };
}

function describeInputValue(label: string, value: string) {
  const invisibleChars = Array.from(value)
    .filter((char) => /[\u200B-\u200D\uFEFF]/u.test(char))
    .map((char) => `U+${char.codePointAt(0)?.toString(16).toUpperCase()}`);

  return `${label}: "${value}" (len=${value.length}${invisibleChars.length ? `, hidden=${invisibleChars.join(",")}` : ""})`;
}

function maskToken(token: string) {
  if (!token) return "vide";
  if (token.length <= 8) return `${token.slice(0, 2)}***`;
  return `${token.slice(0, 4)}***${token.slice(-4)} (len=${token.length})`;
}

function formatLeadMagnetAirtableError(fallbackError: string, errText: string, url: string, status?: number) {
  const compact = errText.replace(/\s+/g, " ").trim();
  const statusLabel = typeof status === "number" ? `HTTP ${status}. ` : "";

  if (compact.includes('"error":"NOT_FOUND"') || compact.includes('"error": "NOT_FOUND"')) {
    return `${fallbackError}: ${statusLabel}Airtable introuvable. Verifie le Base ID, le nom exact de la table et l'acces du token a cette base. Detail Airtable: ${compact}`;
  }

  if (
    compact.includes("INVALID_PERMISSIONS")
    || compact.includes("INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND")
  ) {
    return `${fallbackError}: ${statusLabel}permissions Airtable insuffisantes ou table/base introuvable pour ce token. Verifie les droits data.records:read et data.records:write ainsi que l'acces a la base. Detail Airtable: ${compact}`;
  }

  if (compact.includes('"type":"INVALID_REQUEST"') || compact.includes('"type": "INVALID_REQUEST"')) {
    return `${fallbackError}: ${statusLabel}requete Airtable invalide. Verifie surtout le Base ID, le nom exact de table et le token. Detail Airtable: ${compact}`;
  }

  if (compact.includes("INVALID_VALUE_FOR_COLUMN")) {
    return `${fallbackError}: ${statusLabel}valeur invalide pour une colonne Airtable. Verifie la structure de la table cible et les types de colonnes attendus. Detail Airtable: ${compact}`;
  }

  return `${fallbackError}: ${statusLabel}${compact}`;
}

export function getLeadMagnetAirtableTableName(magnet: Pick<LeadMagnetSyncConfig, "title" | "airtable_table_name">) {
  return sanitizeAirtableName(
    magnet.airtable_table_name?.trim() || `LM - ${magnet.title}`,
    "Lead Magnet"
  );
}

async function checkTableAccess(
  airtableKey: string,
  baseId: string,
  tableName: string
) {
  const normalizedBaseId = baseId.trim();
  const url = `https://api.airtable.com/v0/${normalizedBaseId}/${encodeURIComponent(tableName)}?maxRecords=1`;
  return airtableFetch<AirtableRecordsResponse>(
    url,
    {
      method: "GET",
      headers: getAirtableHeaders(airtableKey),
    },
    "Impossible d'acceder a la table Airtable"
  );
}

export async function validateLeadMagnetAirtableConfig(input: {
  settings: LeadMagnetAirtableSettings;
  magnet: Pick<LeadMagnetSyncConfig, "title" | "airtable_table_name">;
}): Promise<LeadMagnetAirtableValidationResult> {
  const settings = normalizeSettings(input.settings);
  const tableName = getLeadMagnetAirtableTableName(input.magnet);
  const logs = [
    describeInputValue("Base ID utilise", settings.airtableBaseId),
    describeInputValue("Nom de table utilise", tableName),
    `Token Airtable utilise: ${maskToken(settings.airtableKey)}`,
  ];

  if (!settings.airtableKey || !settings.airtableBaseId) {
    return {
      ok: false,
      reason: "missing_settings",
      message: "Validation Airtable impossible: renseignez d'abord le token Airtable et le Base ID.",
      logs,
    };
  }

  if (!input.magnet.airtable_table_name?.trim()) {
    return {
      ok: false,
      reason: "missing_settings",
      message: "Validation Airtable impossible: renseignez le nom exact de la table Airtable existante.",
      logs,
    };
  }

  const recordsUrl = `https://api.airtable.com/v0/${settings.airtableBaseId}/${encodeURIComponent(tableName)}?maxRecords=1`;
  const headers = getAirtableHeaders(settings.airtableKey);

  try {
    logs.push(`Appel 1 - records GET ${recordsUrl}`);
    const recordsRes = await airtableFetchRaw(recordsUrl, {
      method: "GET",
      headers,
    });
    logs.push(`Resultat records: HTTP ${recordsRes.status} | ${recordsRes.body || "<vide>"}`);

    if (recordsRes.ok) {
      try {
        const parsed = JSON.parse(recordsRes.body) as AirtableRecordsResponse;
        logs.push(`Lecture records OK: ${parsed.records?.length ?? 0} ligne(s) retournee(s) sur le test.`);
      } catch {
        logs.push("Lecture records OK mais le JSON n'a pas pu etre parse proprement.");
      }

      return {
        ok: true,
        message: `Validation Airtable OK: la table "${tableName}" est accessible via l'API records.`,
        logs,
      };
    }

    const recordsMessage = formatLeadMagnetAirtableError(
      "Impossible d'acceder a la table Airtable",
      recordsRes.body,
      recordsUrl,
      recordsRes.status
    );
    logs.push(`Erreur records interpretee: ${recordsMessage}`);

    return {
      ok: false,
      reason: "validation_failed",
      message: `${recordsMessage} Conclusion: la table Airtable attendue n'est pas accessible via l'API records. Verifie le nom exact de la table, le Base ID et les droits data.records:read/data.records:write du token.`,
      logs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation Airtable impossible.";
    logs.push(`Exception inattendue pendant la validation: ${message}`);
    return {
      ok: false,
      reason: "validation_failed",
      message,
      logs,
    };
  }
}

export async function readLeadMagnetAirtableSettingsByUserId(userId?: string | null) {
  if (!userId) {
    return DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS;
  }

  const { data, error } = await admin()
    .from("lead_magnet_user_settings")
    .select("settings")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError(error, "Impossible de lire la configuration Airtable Lead Magnet."));
  }

  return normalizeSettings((data?.settings as Partial<LeadMagnetAirtableSettings> | null) ?? null);
}

export async function syncLeadMagnetLeadsToAirtable(input: {
  magnet: LeadMagnetSyncConfig;
  leads: LeadMagnetLeadSyncRecord[];
}) {
  const { magnet, leads } = input;
  if (!magnet.airtable_auto_sync) {
    return { synced: false, reason: "auto_sync_disabled" as const };
  }

  const settings = await readLeadMagnetAirtableSettingsByUserId(magnet.owner_user_id);
  if (!settings.airtableKey || !settings.airtableBaseId) {
    return { synced: false, reason: "missing_settings" as const };
  }

  if (!magnet.airtable_table_name?.trim()) {
    throw new Error("Synchronisation Airtable impossible: renseignez le nom exact de la table Airtable existante.");
  }

  const tableName = getLeadMagnetAirtableTableName(magnet);
  await checkTableAccess(settings.airtableKey, settings.airtableBaseId, tableName);

  if (leads.length === 0) {
    return {
      synced: true,
      tableName,
      createdTable: false,
      addedFields: 0,
      recordsCreated: 0,
      message: "Table Airtable accessible · 0 ligne ajoutee",
    };
  }

  const records = leads.map((lead) => ({
    fields: {
      lead_id: `${magnet.id}:${lead.created_at}:${lead.email || "sans-email"}`,
      Lead:
        lead.email
        || magnet.steps.flatMap((step) => step.fields).map((field) => getLeadValue(lead.data, field.key)).find(Boolean)
        || `Lead ${new Date(lead.created_at).toLocaleString("fr-FR")}`,
      Email: lead.email || "",
      "Date de soumission": lead.created_at,
      "Email envoye": lead.email_sent,
      "Lead Magnet": magnet.title,
      "Lead Magnet ID": magnet.id,
      Payload: JSON.stringify(lead.data ?? {}),
    },
  }));

  await airtableFetch(
    `https://api.airtable.com/v0/${settings.airtableBaseId}/${encodeURIComponent(tableName)}`,
    {
      method: "PATCH",
      headers: getAirtableHeaders(settings.airtableKey),
      body: JSON.stringify({
        records,
        performUpsert: { fieldsToMergeOn: ["lead_id"] },
      }),
    },
    "Impossible de synchroniser les leads Airtable"
  );

  return {
    synced: true,
    tableName,
    createdTable: false,
    addedFields: 0,
    recordsCreated: records.length,
    message: `${records.length} ligne${records.length > 1 ? "s" : ""} synchronisee${records.length > 1 ? "s" : ""} dans la table existante "${tableName}"`,
  };
}

export async function syncLeadMagnetLeadToAirtable(input: {
  magnet: LeadMagnetSyncConfig;
  data: Record<string, unknown>;
  email: string;
  emailSent: boolean;
  createdAt: string;
}) {
  return syncLeadMagnetLeadsToAirtable({
    magnet: input.magnet,
    leads: [
      {
        data: input.data,
        email: input.email,
        email_sent: input.emailSent,
        created_at: input.createdAt,
      },
    ],
  });
}
