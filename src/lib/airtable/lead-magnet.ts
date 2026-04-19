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

type AirtableFieldSchema = {
  id: string;
  name: string;
  type: string;
};

type AirtableTableSchema = {
  id: string;
  name: string;
  fields?: AirtableFieldSchema[];
};

type AirtableMetaTablesResponse = {
  tables?: AirtableTableSchema[];
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
    ...(settings ?? {}),
  };
}

function sanitizeAirtableName(value: string, fallback: string) {
  const sanitized = value.replace(/\s+/g, " ").trim();
  return (sanitized || fallback).slice(0, 100);
}

function dedupeFieldNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const normalized = name.trim().toLowerCase();
    const count = seen.get(normalized) ?? 0;
    seen.set(normalized, count + 1);
    if (count === 0) return name;
    return `${name} (${count + 1})`;
  });
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

function getQuestionSchemas(steps: LeadMagnetStep[]) {
  const rawNames = steps.flatMap((step) =>
    step.fields.map((field) => sanitizeAirtableName(field.label || field.key, field.key || "Champ"))
  );
  const uniqueNames = dedupeFieldNames(rawNames);

  const schemas: Array<{ field: LeadMagnetField; airtableName: string; airtableType: string }> = [];
  let index = 0;

  for (const step of steps) {
    for (const field of step.fields) {
      const airtableName = uniqueNames[index++] ?? sanitizeAirtableName(field.key || "Champ", "Champ");
      const normalizedName = airtableName.trim().toLowerCase();
      if (["lead", "email", "date de soumission", "email envoye", "lead magnet", "lead magnet id"].includes(normalizedName)) {
        continue;
      }

      schemas.push({
        field,
        airtableName,
        airtableType:
          field.type === "email"
            ? "email"
            : field.type === "phone"
              ? "phoneNumber"
              : "singleLineText",
      });
    }
  }

  return schemas;
}

async function airtableFetch<T>(url: string, init: RequestInit, fallbackError: string): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${fallbackError}: ${errText}`);
  }
  return res.json() as Promise<T>;
}

async function getBaseTables(airtableKey: string, baseId: string) {
  return airtableFetch<AirtableMetaTablesResponse>(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    {
      method: "GET",
      headers: getAirtableHeaders(airtableKey),
    },
    "Impossible de lire le schema Airtable"
  );
}

async function createTable(
  airtableKey: string,
  baseId: string,
  tableName: string,
  steps: LeadMagnetStep[]
) {
  const questionSchemas = getQuestionSchemas(steps);
  const fields = [
    { name: "Lead", type: "singleLineText" },
    { name: "Email", type: "email" },
    { name: "Date de soumission", type: "singleLineText" },
    { name: "Email envoye", type: "checkbox" },
    { name: "Lead Magnet", type: "singleLineText" },
    { name: "Lead Magnet ID", type: "singleLineText" },
    ...questionSchemas.map((schema) => ({
      name: schema.airtableName,
      type: schema.airtableType,
    })),
  ];

  return airtableFetch<AirtableTableSchema>(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    {
      method: "POST",
      headers: getAirtableHeaders(airtableKey),
      body: JSON.stringify({
        name: tableName,
        fields,
      }),
    },
    "Impossible de creer la table Airtable"
  );
}

async function createField(
  airtableKey: string,
  baseId: string,
  tableId: string,
  name: string,
  type: string
) {
  return airtableFetch<AirtableFieldSchema>(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${tableId}/fields`,
    {
      method: "POST",
      headers: getAirtableHeaders(airtableKey),
      body: JSON.stringify({ name, type }),
    },
    "Impossible de creer un champ Airtable"
  );
}

async function ensureLeadMagnetTable(
  settings: LeadMagnetAirtableSettings,
  magnet: LeadMagnetSyncConfig
) {
  const tableName = getLeadMagnetAirtableTableName(magnet);
  const schema = await getBaseTables(settings.airtableKey, settings.airtableBaseId);
  let table = (schema.tables ?? []).find((item) => item.name.trim().toLowerCase() === tableName.trim().toLowerCase());

  if (!table) {
    table = await createTable(settings.airtableKey, settings.airtableBaseId, tableName, magnet.steps);
  }

  const existingFieldNames = new Set((table.fields ?? []).map((field) => field.name.trim().toLowerCase()));
  const missingFields = getQuestionSchemas(magnet.steps).filter(
    (schemaItem) => !existingFieldNames.has(schemaItem.airtableName.trim().toLowerCase())
  );

  for (const field of missingFields) {
    await createField(
      settings.airtableKey,
      settings.airtableBaseId,
      table.id,
      field.airtableName,
      field.airtableType
    );
  }

  return tableName;
}

export function getLeadMagnetAirtableTableName(magnet: Pick<LeadMagnetSyncConfig, "title" | "airtable_table_name">) {
  return sanitizeAirtableName(
    magnet.airtable_table_name?.trim() || `LM - ${magnet.title}`,
    "Lead Magnet"
  );
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

export async function syncLeadMagnetLeadToAirtable(input: {
  magnet: LeadMagnetSyncConfig;
  data: Record<string, unknown>;
  email: string;
  emailSent: boolean;
  createdAt: string;
}) {
  const { magnet, data, email, emailSent, createdAt } = input;

  if (!magnet.airtable_auto_sync) {
    return { synced: false, reason: "auto_sync_disabled" as const };
  }

  const settings = await readLeadMagnetAirtableSettingsByUserId(magnet.owner_user_id);
  if (!settings.airtableKey || !settings.airtableBaseId) {
    return { synced: false, reason: "missing_settings" as const };
  }

  const tableName = await ensureLeadMagnetTable(settings, magnet);
  const questionSchemas = getQuestionSchemas(magnet.steps);

  const fields: Record<string, unknown> = {
    Lead:
      email
      || questionSchemas.map((schema) => getLeadValue(data, schema.field.key)).find(Boolean)
      || `Lead ${new Date(createdAt).toLocaleString("fr-FR")}`,
    Email: email || "",
    "Date de soumission": createdAt,
    "Email envoye": emailSent,
    "Lead Magnet": magnet.title,
    "Lead Magnet ID": magnet.id,
  };

  for (const schema of questionSchemas) {
    fields[schema.airtableName] = getLeadValue(data, schema.field.key);
  }

  await airtableFetch(
    `https://api.airtable.com/v0/${settings.airtableBaseId}/${encodeURIComponent(tableName)}`,
    {
      method: "POST",
      headers: getAirtableHeaders(settings.airtableKey),
      body: JSON.stringify({
        records: [{ fields }],
      }),
    },
    "Impossible de creer le lead Airtable"
  );

  return { synced: true, tableName };
}
