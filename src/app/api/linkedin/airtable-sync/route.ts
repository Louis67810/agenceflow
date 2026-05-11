import { NextRequest, NextResponse } from "next/server";
import { pushLinkedInProspectsToAirtable } from "@/lib/linkedin/airtable-prospects";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";

interface ProspectRecord {
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

interface AirtableSyncRequest {
  mode?: "push" | "pull";
  prospects?: ProspectRecord[];
  airtableKey?: string;
  baseId?: string;
  tableName?: string;
  pruneMissing?: boolean;
}

function cleanAirtableToken(value: unknown) {
  return String(value ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^authorization:\s*/i, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

function cleanAirtableText(value: unknown) {
  return String(value ?? "").trim();
}

async function resolveAirtableConfig(req: NextRequest, body: AirtableSyncRequest) {
  const bodyConfig = {
    airtableKey: cleanAirtableToken(body.airtableKey),
    baseId: cleanAirtableText(body.baseId),
    tableName: cleanAirtableText(body.tableName),
  };

  const { supabase, user } = await getRouteAuthenticatedUser(req);
  if (!user) return bodyConfig;

  const { data } = await supabase
    .from("linkedin_user_settings")
    .select("settings")
    .eq("user_id", user.id)
    .maybeSingle();

  const settings = (data?.settings ?? {}) as Record<string, unknown>;

  return {
    airtableKey: cleanAirtableToken(settings.airtableKey) || bodyConfig.airtableKey,
    baseId: cleanAirtableText(settings.airtableBaseId) || bodyConfig.baseId,
    tableName: cleanAirtableText(settings.airtableTableName) || bodyConfig.tableName,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AirtableSyncRequest;
    const { prospects = [], mode = "push" } = body;
    const { airtableKey, baseId, tableName } = await resolveAirtableConfig(req, body);

    if (mode === "pull") {
      return NextResponse.json({
        imported: 0,
        prospects: [],
        disabled: true,
        message:
          "Import Airtable desactive pour proteger les conversations LinkedIn. AgenceFlow reste la source de verite; Airtable est uniquement mis a jour depuis AgenceFlow.",
      });
    }

    if (!airtableKey || !baseId || !tableName) {
      return NextResponse.json(
        { error: "Configuration Airtable incomplete (cle, base ID, nom de table)." },
        { status: 400 }
      );
    }

    if (!prospects.length) {
      return NextResponse.json({
        synced: 0,
        created: 0,
        updated: 0,
        deleted: 0,
        message: "Aucune donnee a pousser. Aucune suppression Airtable effectuee.",
      });
    }

    const result = await pushLinkedInProspectsToAirtable(prospects, { airtableKey, baseId, tableName });
    return NextResponse.json({
      synced: result.synced,
      created: result.created,
      updated: result.updated,
      deleted: 0,
      message: result.message,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
