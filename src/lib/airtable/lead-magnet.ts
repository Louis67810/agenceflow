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
      tableName: string;
      tableExists: boolean;
      message: string;
      logs: string[];
    }
  | {
      ok: false;
      reason: "missing_settings" | "validation_failed";
      message: string;
      logs: string[];
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

  if (compact.includes('"type":"INVALID_REQUEST"') || compact.includes('"type": "INVALID_REQUEST"')) {
    if (url.includes("/meta/bases/")) {
      return `${fallbackError}: ${statusLabel}requete de schema Airtable invalide. Cause la plus probable: Base ID incorrect, Base ID copie avec un espace/retour ligne, ou token sans acces schema sur cette base. Verifie un Base ID qui commence par "app" depuis la doc API de la base et un token avec schema.bases:read et schema.bases:write. Detail Airtable: ${compact}`;
    }

    return `${fallbackError}: ${statusLabel}requete Airtable invalide. Detail Airtable: ${compact}`;
  }

  if (
    compact.includes("INVALID_PERMISSIONS")
    || compact.includes("INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND")
  ) {
    return `${fallbackError}: ${statusLabel}permissions Airtable insuffisantes ou base introuvable pour ce token. Verifie que le token a acces a cette base et les scopes schema.bases:read, schema.bases:write, data.records:read et data.records:write. Detail Airtable: ${compact}`;
  }

  if (compact.includes('"error":"NOT_FOUND"') || compact.includes('"error": "NOT_FOUND"')) {
    return `${fallbackError}: ${statusLabel}base ou table Airtable introuvable. Verifie le Base ID et le nom de table. Detail Airtable: ${compact}`;
  }

  return `${fallbackError}: ${statusLabel}${compact}`;
}

async function getBaseTables(airtableKey: string, baseId: string) {
  const normalizedBaseId = baseId.trim();
  return airtableFetch<AirtableMetaTablesResponse>(
    `https://api.airtable.com/v0/meta/bases/${normalizedBaseId}/tables`,
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
  const normalizedBaseId = baseId.trim();
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
    `https://api.airtable.com/v0/meta/bases/${normalizedBaseId}/tables`,
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
  const normalizedBaseId = baseId.trim();
  return airtableFetch<AirtableFieldSchema>(
    `https://api.airtable.com/v0/meta/bases/${normalizedBaseId}/tables/${tableId}/fields`,
    {
      method: "POST",
      headers: getAirtableHeaders(airtableKey),
      body: JSON.stringify({ name, type }),
    },
    "Impossible de creer un champ Airtable"
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

async function ensureLeadMagnetTable(
  settings: LeadMagnetAirtableSettings,
  magnet: LeadMagnetSyncConfig
) {
  const tableName = getLeadMagnetAirtableTableName(magnet);
  let schema: AirtableMetaTablesResponse;

  try {
    schema = await getBaseTables(settings.airtableKey, settings.airtableBaseId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation du schema Airtable impossible.";
    if (message.includes("schema Airtable invalide")) {
      try {
        await checkTableAccess(settings.airtableKey, settings.airtableBaseId, tableName);
        return {
          tableName,
          createdTable: false,
          addedFields: 0,
        };
      } catch (tableAccessError) {
        const tableMessage = tableAccessError instanceof Error
          ? tableAccessError.message
          : "Impossible d'acceder a la table Airtable.";

        throw new Error(
          `${message} Fallback table direct: ${tableMessage} Si la table n'existe pas encore, l'API de schema Airtable doit fonctionner pour la creer automatiquement.`
        );
      }
    }

    throw error;
  }

  let table = (schema.tables ?? []).find((item) => item.name.trim().toLowerCase() === tableName.trim().toLowerCase());

  let createdTable = false;
  if (!table) {
    table = await createTable(settings.airtableKey, settings.airtableBaseId, tableName, magnet.steps);
    createdTable = true;
  }

  const existingFieldNames = new Set((table.fields ?? []).map((field) => field.name.trim().toLowerCase()));
  const missingFields = getQuestionSchemas(magnet.steps).filter(
    (schemaItem) => !existingFieldNames.has(schemaItem.airtableName.trim().toLowerCase())
  );

  let addedFields = 0;
  for (const field of missingFields) {
    await createField(
      settings.airtableKey,
      settings.airtableBaseId,
      table.id,
      field.airtableName,
      field.airtableType
    );
    addedFields += 1;
  }

  return {
    tableName,
    createdTable,
    addedFields,
  };
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

  const headers = getAirtableHeaders(settings.airtableKey);
  const schemaUrl = `https://api.airtable.com/v0/meta/bases/${settings.airtableBaseId}/tables`;
  const recordsUrl = `https://api.airtable.com/v0/${settings.airtableBaseId}/${encodeURIComponent(tableName)}?maxRecords=1`;

  try {
    logs.push(`Appel 1 - schema GET ${schemaUrl}`);
    const schemaRes = await airtableFetchRaw(schemaUrl, {
      method: "GET",
      headers,
    });
    logs.push(`Resultat schema: HTTP ${schemaRes.status} | ${schemaRes.body || "<vide>"}`);

    if (schemaRes.ok) {
      let tableExists = false;
      try {
        const parsed = JSON.parse(schemaRes.body) as AirtableMetaTablesResponse;
        tableExists = (parsed.tables ?? []).some(
          (item) => item.name.trim().toLowerCase() === tableName.trim().toLowerCase()
        );
        logs.push(`Lecture schema OK: ${parsed.tables?.length ?? 0} table(s) detectee(s). Table cible presente=${tableExists ? "oui" : "non"}.`);
      } catch {
        logs.push("Lecture schema OK mais le JSON n'a pas pu etre parse proprement.");
      }

      return {
        ok: true,
        tableName,
        tableExists,
        message: tableExists
          ? `Validation Airtable OK: la base est accessible et la table "${tableName}" existe deja.`
          : `Validation Airtable OK: la base est accessible. La table "${tableName}" n'existe pas encore et sera creee au moment de la synchronisation.`,
        logs,
      };
    }

    const schemaMessage = formatLeadMagnetAirtableError(
      "Impossible de lire le schema Airtable",
      schemaRes.body,
      schemaUrl,
      schemaRes.status
    );
    logs.push(`Erreur schema interpretee: ${schemaMessage}`);

    logs.push(`Appel 2 - records GET ${recordsUrl}`);
    const recordsRes = await airtableFetchRaw(recordsUrl, {
      method: "GET",
      headers,
    });
    logs.push(`Resultat records: HTTP ${recordsRes.status} | ${recordsRes.body || "<vide>"}`);

    if (recordsRes.ok) {
      logs.push(`Acces direct a la table "${tableName}" confirme via l'API records.`);
      return {
        ok: true,
        tableName,
        tableExists: true,
        message: `Validation Airtable partielle OK: l'API schema Airtable est indisponible, mais la table "${tableName}" est accessible via l'API records. La synchronisation des lignes peut continuer.`,
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
      message: `${schemaMessage} Verification directe de la table "${tableName}" echouee aussi: ${recordsMessage} Conclusion: la base n'est pas validable automatiquement et la table ne semble pas accessible en direct.`,
      logs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Validation Airtable impossible.";
    logs.push(`Exception inattendue pendant la validation: ${message}`);
    if (message.includes("schema Airtable invalide")) {
      try {
        await checkTableAccess(settings.airtableKey, settings.airtableBaseId, tableName);
        logs.push(`Fallback reussi: la table "${tableName}" est accessible via l'API records.`);
        return {
          ok: true,
          tableName,
          tableExists: true,
          message: `Validation Airtable partielle OK: l'API schema Airtable est indisponible, mais la table "${tableName}" est accessible via l'API records. La synchronisation des lignes peut continuer.`,
          logs,
        };
      } catch (tableAccessError) {
        const tableMessage = tableAccessError instanceof Error
          ? tableAccessError.message
          : "Impossible d'acceder a la table Airtable.";
        logs.push(`Fallback en exception echoue aussi: ${tableMessage}`);

        return {
          ok: false,
          reason: "validation_failed",
          message: `${message} Verification directe de la table "${tableName}" echouee aussi: ${tableMessage} Conclusion: la base n'est pas validable automatiquement et la table ne semble pas accessible en direct.`,
          logs,
        };
      }
    }

    return {
      ok: false,
      reason: "validation_failed",
      message,
      logs,
    };
  }
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

  const { tableName, createdTable, addedFields } = await ensureLeadMagnetTable(settings, magnet);
  const questionSchemas = getQuestionSchemas(magnet.steps);

  if (leads.length === 0) {
    return {
      synced: true,
      tableName,
      createdTable,
      addedFields,
      recordsCreated: 0,
      message: [
        createdTable ? "1 table creee" : "table deja presente",
        addedFields > 0 ? `${addedFields} champ${addedFields > 1 ? "s" : ""} ajoute${addedFields > 1 ? "s" : ""}` : "0 champ ajoute",
        "0 ligne ajoutee",
      ].join(" · "),
    };
  }

  const records = leads.map((lead) => {
    const fields: Record<string, unknown> = {
      Lead:
        lead.email
        || questionSchemas.map((schema) => getLeadValue(lead.data, schema.field.key)).find(Boolean)
        || `Lead ${new Date(lead.created_at).toLocaleString("fr-FR")}`,
      Email: lead.email || "",
      "Date de soumission": lead.created_at,
      "Email envoye": lead.email_sent,
      "Lead Magnet": magnet.title,
      "Lead Magnet ID": magnet.id,
    };

    for (const schema of questionSchemas) {
      fields[schema.airtableName] = getLeadValue(lead.data, schema.field.key);
    }

    return { fields };
  });

  await airtableFetch(
    `https://api.airtable.com/v0/${settings.airtableBaseId}/${encodeURIComponent(tableName)}`,
    {
      method: "POST",
      headers: getAirtableHeaders(settings.airtableKey),
      body: JSON.stringify({
        records,
      }),
    },
    "Impossible de creer le lead Airtable"
  );

  return {
    synced: true,
    tableName,
    createdTable,
    addedFields,
    recordsCreated: records.length,
    message: [
      createdTable ? "1 table creee" : "table deja presente",
      addedFields > 0 ? `${addedFields} champ${addedFields > 1 ? "s" : ""} ajoute${addedFields > 1 ? "s" : ""}` : "0 champ ajoute",
      `${records.length} ligne${records.length > 1 ? "s" : ""} ajoutee${records.length > 1 ? "s" : ""}`,
    ].join(" · "),
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
