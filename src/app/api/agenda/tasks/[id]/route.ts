import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeWeightedTaskPoints } from "@/lib/agenda/points";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const allowed = ["title", "description", "date", "start_time", "end_time", "duration_minutes",
      "importance", "status", "objective_id", "parent_task_id", "recurrence", "recurrence_end", "tags"];
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of allowed) {
      if (k in body) updates[k] = body[k];
    }

    const { data, error } = await supabase
      .from("agenda_tasks")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    // If completing a task → compute weighted points
    if (body.status === "done" && data) {
      const taskDate = data.date ?? new Date().toISOString().split("T")[0];

      // Fetch all tasks for that day to compute relative weight
      const { data: dayTasks } = await supabase
        .from("agenda_tasks")
        .select("importance")
        .eq("user_id", user.id)
        .eq("date", taskDate);

      // Fetch daily pool from settings
      const { data: settingsData } = await supabase
        .from("agenda_settings")
        .select("daily_points_pool")
        .eq("user_id", user.id)
        .maybeSingle();

      const pool = (settingsData as { daily_points_pool?: number } | null)?.daily_points_pool ?? 100;
      const allImportances = (dayTasks ?? []).map((t: { importance: number }) => t.importance);
      const pts = computeWeightedTaskPoints(data.importance, allImportances, pool);

      await supabase.from("agenda_points_log").insert({
        user_id: user.id,
        points: pts,
        reason: `Tâche complétée: ${data.title}`,
        entity_type: "task",
        entity_id: data.id,
      });
    }

    return NextResponse.json({ task: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("agenda_tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
