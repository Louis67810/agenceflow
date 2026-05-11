import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationMessage, LinkedInProspect } from "@/types/linkedin";
import type { LinkedInImportConversationBody } from "@/types/linkedin-extension";
import {
  cleanAirtableText,
  cleanAirtableToken,
  pushLinkedInProspectsToAirtable,
} from "@/lib/linkedin/airtable-prospects";
import {
  authenticateExtensionRequest,
  findProspect,
  loadWorkspace,
  mapImportedMessage,
  markPendingAsSent,
  normalizeProfileUrl,
  saveWorkspace,
  stableMessageHash,
  textMatches,
} from "@/lib/linkedin/prospection-extension";
import { formatSupabaseError } from "@/lib/supabase/format-error";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function syncImportedProspectsToAirtable(input: {
  supabase: SupabaseClient;
  userId: string;
  prospects: LinkedInProspect[];
}) {
  const { data, error } = await input.supabase
    .from("linkedin_user_settings")
    .select("settings")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) throw error;

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const autoSync = Boolean(settings.airtableAutoSync);
  const airtableKey = cleanAirtableToken(settings.airtableKey);
  const baseId = cleanAirtableText(settings.airtableBaseId);
  const tableName = cleanAirtableText(settings.airtableTableName);

  if (!autoSync || !airtableKey || !baseId || !tableName) {
    return { synced: false as const, reason: "not_configured" };
  }

  const result = await pushLinkedInProspectsToAirtable(input.prospects, {
    airtableKey,
    baseId,
    tableName,
  });

  return {
    synced: true as const,
    syncedCount: result.synced,
    created: result.created,
    updated: result.updated,
    message: result.message,
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  const auth = authenticateExtensionRequest(req);
  if (!auth.ok) {
    Object.entries(corsHeaders).forEach(([key, value]) => auth.response.headers.set(key, value));
    return auth.response;
  }

  try {
    const body = (await req.json()) as LinkedInImportConversationBody;
    if (body.source !== "linkedin_chrome_extension") {
      return NextResponse.json({ error: "Source invalide." }, { status: 400, headers: corsHeaders });
    }

    const prospectName = body.prospect?.name?.trim();
    if (!prospectName) {
      return NextResponse.json({ error: "Nom du prospect requis." }, { status: 400, headers: corsHeaders });
    }

    const workspace = await loadWorkspace(auth.supabase, auth.userId);
    const selectedProspect = body.selectedProspectId
      ? workspace.prospects.find((item) => item.id === body.selectedProspectId)
      : null;
    const existingProspect = selectedProspect ?? findProspect(workspace.prospects, body.prospect);
    const now = new Date().toISOString();
    const prospect: LinkedInProspect =
      existingProspect ??
      {
        id: `prospect_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: prospectName,
        profileUrl: body.prospect.profileUrl,
        avatarUrl: body.prospect.avatarUrl,
        headline: body.prospect.headline,
        actionType: "none",
        generatedMessage: "",
        status: "draft",
        createdAt: now,
        conversation: [],
      };

    const existingHashes = new Set((prospect.conversation ?? []).map((message) => message.rawHash).filter(Boolean));
    const existingExternalIds = new Set((prospect.conversation ?? []).map((message) => message.externalId).filter(Boolean));
    const existingContentKeys = new Set(
      (prospect.conversation ?? []).map((message) =>
        stableMessageHash({
          sender: message.sender,
          text: message.content,
          sentAt: message.sentAt,
          links: message.links,
          images: message.images?.map((url) => ({ url })),
        })
      )
    );

    const importedMessages: ConversationMessage[] = [];
    let skippedDuplicates = 0;
    let importedThemCount = 0;
    let detectedPendingText: string | null = null;
    let detectedPendingHash: string | undefined;

    for (const message of body.messages ?? []) {
      if (!message?.text?.trim() && !message.images?.length && !message.links?.length) continue;
      const rawHash = message.rawHash || stableMessageHash(message);
      const contentKey = stableMessageHash(message);
      if (
        existingHashes.has(rawHash) ||
        existingExternalIds.has(message.externalId) ||
        existingContentKeys.has(contentKey)
      ) {
        skippedDuplicates += 1;
        continue;
      }

      const normalized = mapImportedMessage({ ...message, rawHash });
      importedMessages.push(normalized);
      existingHashes.add(rawHash);
      existingExternalIds.add(message.externalId);
      existingContentKeys.add(contentKey);
      if (message.sender === "them") importedThemCount += 1;

      const pendingText = prospect.pendingLinkedInSend?.text || prospect.customMessage || prospect.generatedMessage;
      if (message.sender === "me" && pendingText && textMatches(message.text, pendingText)) {
        detectedPendingText = pendingText;
        detectedPendingHash = rawHash;
      }
    }

    let updatedProspect: LinkedInProspect = {
      ...prospect,
      name: prospect.name || prospectName,
      profileUrl: prospect.profileUrl || body.prospect.profileUrl,
      avatarUrl: prospect.avatarUrl || body.prospect.avatarUrl,
      headline: prospect.headline || body.prospect.headline,
      conversation: [...(prospect.conversation ?? []), ...importedMessages].sort((a, b) =>
        new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      ),
      status: importedThemCount > 0 ? "replied" : prospect.status,
    };

    if (detectedPendingText) {
      updatedProspect = markPendingAsSent(updatedProspect, detectedPendingText, detectedPendingHash);
    }

    const prospects = existingProspect
      ? workspace.prospects.map((item) => (item.id === existingProspect.id ? updatedProspect : item))
      : [updatedProspect, ...workspace.prospects];

    await saveWorkspace(auth.supabase, auth.userId, {
      ...workspace,
      prospects,
    });

    let airtableSync:
      | { synced: false; reason: string; error?: string }
      | { synced: true; syncedCount: number; created: number; updated: number; message: string };

    try {
      const result = await syncImportedProspectsToAirtable({
        supabase: auth.supabase,
        userId: auth.userId,
        prospects,
      });

      airtableSync = result.synced
        ? {
            synced: true,
            syncedCount: result.syncedCount,
            created: result.created,
            updated: result.updated,
            message: result.message,
          }
        : result;
    } catch (error) {
      console.error("LinkedIn extension import Airtable sync failed", error);
      airtableSync = {
        synced: false,
        reason: "airtable_error",
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const pendingMessage =
      updatedProspect.pendingLinkedInSend && !detectedPendingText
        ? {
            id: updatedProspect.pendingLinkedInSend.id,
            text: updatedProspect.pendingLinkedInSend.text,
          }
        : undefined;

    return NextResponse.json(
      {
        ok: true,
        prospectId: updatedProspect.id,
        importedCount: importedMessages.length,
        skippedDuplicates,
        pendingMessage,
        profileUrl: normalizeProfileUrl(updatedProspect.profileUrl) || undefined,
        airtableSync,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500, headers: corsHeaders });
  }
}
