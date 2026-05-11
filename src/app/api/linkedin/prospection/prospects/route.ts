import { NextResponse } from "next/server";
import {
  authenticateExtensionRequest,
  loadWorkspace,
  normalizeProfileUrl,
  resolvePendingMessage,
} from "@/lib/linkedin/prospection-extension";
import { PROSPECT_STATUS_LABELS } from "@/types/linkedin";
import { formatSupabaseError } from "@/lib/supabase/format-error";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: Request) {
  const auth = authenticateExtensionRequest(req);
  if (!auth.ok) {
    Object.entries(corsHeaders).forEach(([key, value]) => auth.response.headers.set(key, value));
    return auth.response;
  }

  try {
    const workspace = await loadWorkspace(auth.supabase, auth.userId);
    const prospects = workspace.prospects
      .map((prospect) => ({
        id: prospect.id,
        name: prospect.name,
        profileUrl: prospect.profileUrl,
        normalizedProfileUrl: normalizeProfileUrl(prospect.profileUrl) || undefined,
        headline: prospect.headline,
        status: prospect.status,
        statusLabel: PROSPECT_STATUS_LABELS[prospect.status] ?? prospect.status,
        leadId: prospect.leadId,
        pendingMessage: resolvePendingMessage(prospect),
        conversationCount: prospect.conversation?.length ?? 0,
        updatedAt:
          prospect.conversation?.length
            ? [...prospect.conversation].sort(
                (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
              )[0]?.sentAt
            : prospect.sentAt ?? prospect.createdAt,
      }))
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());

    return NextResponse.json({ ok: true, prospects }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500, headers: corsHeaders });
  }
}
