import { createClient } from "@supabase/supabase-js";
import { formatSupabaseError } from "@/lib/supabase/format-error";

type LeadMagnetField = {
  id: string;
  type: "text" | "email" | "phone" | "number" | "url" | "select";
  label: string;
  placeholder: string;
  required: boolean;
  key: string;
  showLabel?: boolean;
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
  id?: string;
  data: Record<string, unknown>;
  email: string;
  email_sent: boolean;
  created_at: string;
};

type AirtableSyncResult =
  | { synced: false; reason: "auto_sync_disabled" | "missing_settings" | "missing_table" }
  | {
      synced: true;
      tableName: string;
      createdTable: false;
      addedFields: 0;
      recordsCreated: number;
      recordsUpdated?: number;
      message: string;
    };

type AirtableRecordFieldMap = {
  lead_id: string;
  Lead: string;
  Email: string;
  "Date de soumission": string | null;
  "Email envoye": boolean;
  "Lead Magnet": string;
  "Lead Magnet ID": string;
  Payload: string;
};

type AirtableListResponse = {
  records?: Array<{
    id: string;
    fields?: Partial<AirtableRecordFieldMap>;
  }>;
  offset?: string;
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

function getAirtableHeaders(airtableKey: string) {
  return {
    Authorization: `Bearer ${airtableKey}`,
    "Content-Type": "application/json",
  };
}

function formatAirtableError(errText: string, tableName: string, baseId: string) {
  if (errText.includes('"error":"NOT_FOUND"') || errText.includes('"error": "NOT_FOUND"')) {
    return `Airtable introuvable. Verifiez le Base ID (${baseId}), le nom exact de la table ("${tableName}") et que le token a bien acces a cette base.`;
  }

  if (errText.includes("INVALID_PERMISSIONS")) {
    return "Permissions Airtable insuffisantes. Verifiez que le token a les droits data.records:read et data.records:write sur cette base.";
  }

  if (errText.includes("INVALID_VALUE_FOR_COLUMN")) {
    return `Valeur Airtable invalide pour une colonne. Verifiez surtout les types de champs dans la table "${tableName}". Detail: ${errText}`;
  }

  if (errText.includes("INVALID_REQUEST")) {
    return `Requete Airtable invalide. Verifiez le Base ID (${baseId}) et le nom exact de la table ("${tableName}"). Detail: ${errText}`;
  }

  return `Airtable API: ${errText}`;
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

export function getLeadMagnetAirtableTableName(
  magnet: Pick<LeadMagnetSyncConfig, "title" | "airtable_table_name">
) {
  return sanitizeAirtableName(
    magnet.airtable_table_name?.trim() || `LM - ${magnet.title}`,
    "Lead Magnet"
  );
}

export async function readLeadMagnetAirtableSettingsByUserId(userId?: string | null) {
  if (!userId) return DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS;

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

async function fetchAirtableTable(
  airtableKey: string,
  baseId: string,
  tableName: string
) {
  const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
  const res = await fetch(`${baseUrl}?maxRecords=1`, {
    method: "GET",
    headers: getAirtableHeaders(airtableKey),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(formatAirtableError(errText, tableName, baseId));
  }

  return baseUrl;
}

export async function testLeadMagnetAirtableConnection(input: {
  settings: LeadMagnetAirtableSettings;
  magnet: Pick<LeadMagnetSyncConfig, "title" | "airtable_table_name">;
}) {
  const settings = normalizeSettings(input.settings);
  const tableName = getLeadMagnetAirtableTableName(input.magnet);

  if (!settings.airtableKey || !settings.airtableBaseId || !input.magnet.airtable_table_name?.trim()) {
    return {
      ok: false as const,
      message: "Configuration Airtable incomplete (cle, Base ID, nom de table).",
    };
  }

  await fetchAirtableTable(settings.airtableKey, settings.airtableBaseId, tableName);

  return {
    ok: true as const,
    message: "Airtable connecte",
  };
}

export async function syncLeadMagnetLeadsToAirtable(input: {
  magnet: LeadMagnetSyncConfig;
  leads: LeadMagnetLeadSyncRecord[];
}): Promise<AirtableSyncResult> {
  const { magnet, leads } = input;
  if (!magnet.airtable_auto_sync) {
    return { synced: false, reason: "auto_sync_disabled" };
  }

  const settings = await readLeadMagnetAirtableSettingsByUserId(magnet.owner_user_id);
  if (!settings.airtableKey || !settings.airtableBaseId) {
    return { synced: false, reason: "missing_settings" };
  }

  if (!magnet.airtable_table_name?.trim()) {
    return { synced: false, reason: "missing_table" };
  }

  const tableName = getLeadMagnetAirtableTableName(magnet);
  const baseUrl = await fetchAirtableTable(settings.airtableKey, settings.airtableBaseId, tableName);

  if (!leads.length) {
    return {
      synced: true,
      tableName,
      createdTable: false,
      addedFields: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      message: "0 crees, 0 mis a jour, 0 supprimes",
    };
  }

  const records = leads.map((lead) => ({
    fields: {
      lead_id: lead.id || `${magnet.id}:${lead.created_at}:${lead.email || "sans-email"}`,
      Lead:
        lead.email
        || magnet.steps.flatMap((step) => step.fields).map((field) => getLeadValue(lead.data, field.key)).find(Boolean)
        || `Lead ${new Date(lead.created_at).toLocaleString("fr-FR")}`,
      Email: lead.email || "",
      "Date de soumission": lead.created_at ? new Date(lead.created_at).toISOString().split("T")[0] : null,
      "Email envoye": !!lead.email_sent,
      "Lead Magnet": magnet.title,
      "Lead Magnet ID": magnet.id,
      Payload: JSON.stringify(lead.data ?? {}),
    } as AirtableRecordFieldMap,
  }));

  const res = await fetch(baseUrl, {
    method: "PATCH",
    headers: getAirtableHeaders(settings.airtableKey),
    body: JSON.stringify({
      records,
      performUpsert: { fieldsToMergeOn: ["lead_id"] },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(formatAirtableError(errText, tableName, settings.airtableBaseId));
  }

  const data = await res.json();
  const created = Array.isArray(data.createdRecords) ? data.createdRecords.length : records.length;
  const updated = Array.isArray(data.updatedRecords) ? data.updatedRecords.length : 0;

  return {
    synced: true,
    tableName,
    createdTable: false,
    addedFields: 0,
    recordsCreated: created,
    recordsUpdated: updated,
    message: `${created} crees, ${updated} mis a jour, 0 supprimes`,
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

export async function pullLeadMagnetAirtableSummary(input: {
  settings: LeadMagnetAirtableSettings;
  magnet: Pick<LeadMagnetSyncConfig, "title" | "airtable_table_name">;
}) {
  const settings = normalizeSettings(input.settings);
  const tableName = getLeadMagnetAirtableTableName(input.magnet);

  if (!settings.airtableKey || !settings.airtableBaseId || !input.magnet.airtable_table_name?.trim()) {
    throw new Error("Configuration Airtable incomplete (cle, Base ID, nom de table).");
  }

  const baseUrl = await fetchAirtableTable(settings.airtableKey, settings.airtableBaseId, tableName);
  let count = 0;
  let offset: string | undefined;

  do {
    const url = new URL(baseUrl);
    url.searchParams.append("fields[]", "lead_id");
    url.searchParams.set("maxRecords", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: getAirtableHeaders(settings.airtableKey),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(formatAirtableError(errText, tableName, settings.airtableBaseId));
    }

    const data = (await res.json()) as AirtableListResponse;
    count += Array.isArray(data.records) ? data.records.length : 0;
    offset = data.offset;
  } while (offset);

  return {
    ok: true as const,
    count,
    message: count > 0 ? `${count} lignes detectees dans Airtable` : "Airtable connecte",
  };
}
