import { NextResponse } from "next/server";
import {
  authenticateExtensionRequest,
  loadWorkspace,
  markPendingAsSent,
  saveWorkspace,
} from "@/lib/linkedin/prospection-extension";
import { formatSupabaseError } from "@/lib/supabase/format-error";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

interface MarkMessageSentBody {
  prospectId: string;
  messageText: string;
  detectedHash?: string;
}

export async function POST(req: Request) {
  const auth = authenticateExtensionRequest(req);
  if (!auth.ok) {
    Object.entries(corsHeaders).forEach(([key, value]) => auth.response.headers.set(key, value));
    return auth.response;
  }

  try {
    const body = (await req.json()) as MarkMessageSentBody;
    if (!body.prospectId || !body.messageText?.trim()) {
      return NextResponse.json({ error: "prospectId et messageText requis." }, { status: 400, headers: corsHeaders });
    }

    const workspace = await loadWorkspace(auth.supabase, auth.userId);
    const prospect = workspace.prospects.find((item) => item.id === body.prospectId);
    if (!prospect) {
      return NextResponse.json({ error: "Prospect introuvable." }, { status: 404, headers: corsHeaders });
    }

    const updatedProspect = markPendingAsSent(prospect, body.messageText, body.detectedHash);
    await saveWorkspace(auth.supabase, auth.userId, {
      ...workspace,
      prospects: workspace.prospects.map((item) =>
        item.id === prospect.id ? updatedProspect : item
      ),
    });

    return NextResponse.json({ ok: true, prospectId: updatedProspect.id }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: formatSupabaseError(error) }, { status: 500, headers: corsHeaders });
  }
}
