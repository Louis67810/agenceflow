import { NextRequest, NextResponse } from "next/server";
import { buildAuditMessage, generateAuditAccessKey, normalizeWebsiteUrl } from "@/lib/audits/templates";
import { createClient } from "@/lib/supabase/server";
import type { AuditRequest, AuditRequestStatus } from "@/types/audit";

type Params = { params: Promise<{ id: string }> };

const STATUS_WITH_KEY: AuditRequestStatus[] = ["accepted", "refused", "audit_ready", "sent"];

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("audit_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Demande d'audit introuvable" }, { status: 404 });
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.status === "string") {
      patch.status = body.status;
      if (STATUS_WITH_KEY.includes(body.status as AuditRequestStatus) && !existing.access_key) {
        patch.access_key = generateAuditAccessKey();
      }
    }

    if (typeof body.decisionNote === "string") patch.decision_note = body.decisionNote;
    if (typeof body.auditUrl === "string") patch.audit_url = normalizeWebsiteUrl(body.auditUrl);
    if (typeof body.auditSummary === "string") patch.audit_summary = body.auditSummary;

    const previewAudit = {
      ...existing,
      ...patch,
      access_key: (patch.access_key as string | undefined) ?? existing.access_key,
      audit_url: (patch.audit_url as string | undefined) ?? existing.audit_url,
    } as AuditRequest;

    if (body.generateMessage || body.status === "audit_ready") {
      patch.whatsapp_message = buildAuditMessage(previewAudit);
    }

    const { data, error } = await supabase
      .from("audit_requests")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ audit: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

