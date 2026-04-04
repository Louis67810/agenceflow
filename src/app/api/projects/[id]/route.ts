import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { data, error } = await admin()
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
    return NextResponse.json({ project: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Handle stage advance: validate current stage and move to next
    if (body.action === "advance_stage") {
      const { data: project, error: fetchErr } = await admin()
        .from("projects")
        .select("stages, current_stage_index, status")
        .eq("id", id)
        .single();

      if (fetchErr || !project) return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });

      const stages = (project.stages ?? []) as { completed: boolean; completed_at: string | null }[];
      const idx = project.current_stage_index ?? 0;

      if (idx >= stages.length) return NextResponse.json({ error: "Toutes les étapes sont terminées" }, { status: 400 });

      // Mark current stage as completed
      stages[idx] = { ...stages[idx], completed: true, completed_at: new Date().toISOString() };
      const nextIdx = idx + 1;
      const isLast = nextIdx >= stages.length;

      const { data, error } = await admin()
        .from("projects")
        .update({
          stages,
          current_stage_index: nextIdx,
          status: isLast ? "completed" : "in_progress",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ project: data });
    }

    // Generic update
    const { action: _action, ...updates } = body;
    const { data, error } = await admin()
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ project: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
