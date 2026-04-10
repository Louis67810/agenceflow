import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { leadMagnetId, data } = await req.json();

    if (!leadMagnetId || !data) {
      return NextResponse.json({ error: "leadMagnetId et data requis" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch lead magnet
    const { data: magnet, error: fetchError } = await supabase
      .from("lead_magnets")
      .select("*")
      .eq("id", leadMagnetId)
      .single();

    if (fetchError || !magnet) {
      return NextResponse.json({ error: "Lead magnet introuvable" }, { status: 404 });
    }

    const email: string = data.email || data.mail || "";
    const firstname: string = data.firstname || data.prenom || data.nom || "";

    // Store lead
    const { error: insertError } = await supabase
      .from("lead_magnet_leads")
      .insert({
        lead_magnet_id: leadMagnetId,
        data,
        email: email || null,
      });

    if (insertError) {
      console.error("Insert lead error:", insertError);
      // Don't fail the request — still try to send email
    }

    // Send email via Resend
    let emailSent = false;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey && email) {
      const rawBody: string = magnet.email_body || "";
      const htmlBody = rawBody
        .replace(/\{\{firstname\}\}/g, firstname || "vous")
        .replace(/\{\{resource_link\}\}/g, magnet.resource_url || "");

      const rawSubject: string = magnet.email_subject || "Votre ressource";
      const subject = rawSubject.replace(/\{\{firstname\}\}/g, firstname || "vous");

      const fromEmail =
        process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
      const fromName = magnet.from_name || "AgenceFlow";

      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: email,
            subject,
            html: htmlBody,
          }),
        });

        if (emailRes.ok) {
          emailSent = true;
          // Mark email as sent on the lead
          await supabase
            .from("lead_magnet_leads")
            .update({ email_sent: true })
            .eq("lead_magnet_id", leadMagnetId)
            .eq("email", email)
            .order("created_at", { ascending: false })
            .limit(1);
        } else {
          const errText = await emailRes.text();
          console.error("Resend error:", errText);
        }
      } catch (emailErr) {
        console.error("Email send failed:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      resourceUrl: magnet.resource_url,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
