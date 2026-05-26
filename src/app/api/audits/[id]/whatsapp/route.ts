import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuditMessage } from "@/lib/audits/templates";
import type { AuditRequest } from "@/types/audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const supabase = await createClient();

    const { data: audit, error } = await supabase
      .from("audit_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !audit) {
      return NextResponse.json({ error: "Demande d'audit introuvable" }, { status: 404 });
    }

    const message = String(body.message || audit.whatsapp_message || buildAuditMessage(audit as AuditRequest));
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiToken = process.env.WHATSAPP_API_TOKEN;

    if (!apiUrl || !apiToken) {
      await supabase
        .from("audit_requests")
        .update({ whatsapp_message: message, updated_at: new Date().toISOString() })
        .eq("id", id);

      return NextResponse.json(
        {
          error: "API WhatsApp non configuree",
          message,
          setup: "Ajoute WHATSAPP_API_URL et WHATSAPP_API_TOKEN quand tu auras choisi le fournisseur.",
        },
        { status: 501 }
      );
    }

    const whatsappRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: audit.phone,
        message,
        auditUrl: audit.audit_url,
        accessKey: audit.access_key,
        lead: {
          name: audit.full_name,
          email: audit.email,
          website: audit.website_url,
        },
      }),
    });

    if (!whatsappRes.ok) {
      return NextResponse.json(
        { error: await whatsappRes.text(), message },
        { status: whatsappRes.status }
      );
    }

    const sentAt = new Date().toISOString();
    const { data: updated } = await supabase
      .from("audit_requests")
      .update({
        status: "sent",
        whatsapp_message: message,
        whatsapp_sent_at: sentAt,
        updated_at: sentAt,
      })
      .eq("id", id)
      .select()
      .single();

    return NextResponse.json({ audit: updated, sent: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

