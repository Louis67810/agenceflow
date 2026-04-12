import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Accept or reject a submission + send email notification
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; subId: string }> }
) {
  try {
    const { subId } = await params;
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { status, admin_feedback, submission_url, submission_notes } = body;

    const updates: Record<string, unknown> = {};
    if (status) {
      updates.status = status;
      if (status === "accepted" || status === "rejected") {
        updates.evaluated_at = new Date().toISOString();
      }
      if (status === "submitted") {
        updates.submitted_at = new Date().toISOString();
      }
    }
    if (admin_feedback !== undefined) updates.admin_feedback = admin_feedback;
    if (submission_url !== undefined) updates.submission_url = submission_url;
    if (submission_notes !== undefined) updates.submission_notes = submission_notes;

    const { data, error } = await supabase
      .from("test_submissions")
      .update(updates)
      .eq("id", subId)
      .select()
      .single();

    if (error) throw error;

    // Send email notification if accepted or rejected
    if ((status === "accepted" || status === "rejected") && data?.designer_email) {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const subject = status === "accepted"
          ? "✅ Votre test a été accepté !"
          : "❌ Résultat de votre test";
        const html = status === "accepted"
          ? `<h2>Félicitations ! 🎉</h2>
             <p>Votre test a été <strong>accepté</strong>.</p>
             ${admin_feedback ? `<p><strong>Feedback :</strong> ${admin_feedback}</p>` : ""}
             <p>Nous vous contacterons prochainement pour la suite.</p>`
          : `<h2>Résultat de votre test</h2>
             <p>Votre test n'a malheureusement pas été retenu cette fois-ci.</p>
             ${admin_feedback ? `<p><strong>Feedback :</strong> ${admin_feedback}</p>` : ""}
             <p>Merci pour votre participation !</p>`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AgenceFlow <noreply@agenceflow.app>",
            to: [data.designer_email],
            subject,
            html,
          }),
        });
      }
    }

    return NextResponse.json({ submission: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
