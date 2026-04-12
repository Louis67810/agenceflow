import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLevelFromPoints } from "@/lib/agenda/points";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "50");

    const { data, error } = await supabase
      .from("agenda_points_log")
      .select("*")
      .eq("user_id", user.id)
      .order("earned_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const total = (data ?? []).reduce((s, p) => s + p.points, 0);
    // Fetch all for total
    const { data: allData } = await supabase
      .from("agenda_points_log")
      .select("points")
      .eq("user_id", user.id);

    const totalAll = (allData ?? []).reduce((s: number, p: { points: number }) => s + p.points, 0);
    const levelInfo = getLevelFromPoints(totalAll);

    return NextResponse.json({
      logs: data ?? [],
      totalDisplayed: total,
      totalAll,
      levelInfo,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
