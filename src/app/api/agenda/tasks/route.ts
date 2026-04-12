import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const weekStart = searchParams.get("week_start");
    const weekEnd = searchParams.get("week_end");
    const status = searchParams.get("status");
    const objectiveId = searchParams.get("objective_id");

    let query = supabase
      .from("agenda_tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (date) query = query.eq("date", date);
    if (weekStart && weekEnd) query = query.gte("date", weekStart).lte("date", weekEnd);
    if (status) query = query.eq("status", status);
    if (objectiveId) query = query.eq("objective_id", objectiveId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ tasks: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { data, error } = await supabase
      .from("agenda_tasks")
      .insert({ ...body, user_id: user.id })
      .select()
      .single();

    if (error) throw error;

    // Log points
    if (data) {
      await supabase.from("agenda_points_log").insert({
        user_id: user.id,
        points: data.points,
        reason: `Tâche créée: ${data.title}`,
        entity_type: "task",
        entity_id: data.id,
      });
    }

    return NextResponse.json({ task: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
