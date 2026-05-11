import { NextResponse } from "next/server";
import {
  authenticateExtensionRequest,
  findProspect,
  loadWorkspace,
  resolvePendingMessage,
} from "@/lib/linkedin/prospection-extension";
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
    const url = new URL(req.url);
    const profileUrl = url.searchParams.get("profileUrl") ?? undefined;
    const name = url.searchParams.get("name") ?? undefined;
    const workspace = await loadWorkspace(auth.supabase, auth.userId);
    const prospect = findProspect(workspace.prospects, { profileUrl, name });

    if (!prospect) {
      return NextResponse.json({ ok: true, pendingMessage: null }, { headers: corsHeaders });
    }

    return NextResponse.json(
      {
        ok: true,
        prospectId: prospect.id,
        pendingMessage: resolvePendingMessage(prospect),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500, headers: corsHeaders });
  }
}
