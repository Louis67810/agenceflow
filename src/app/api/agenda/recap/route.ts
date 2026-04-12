import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recapBonusPoints } from "@/lib/agenda/points";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("agenda_daily_recap")
      .select("*")
      .eq("user_id", user.id)
      .eq("recap_date", date)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ recap: data });
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
    const recapDate = body.recap_date ?? new Date().toISOString().split("T")[0];

    const bonus = recapBonusPoints({ day_score: body.day_score });

    const { data, error } = await supabase
      .from("agenda_daily_recap")
      .upsert({
        ...body,
        recap_date: recapDate,
        user_id: user.id,
        bonus_points: bonus,
      }, { onConflict: "user_id,recap_date" })
      .select()
      .single();

    if (error) throw error;

    // Log bonus points if any
    if (bonus > 0) {
      await supabase.from("agenda_points_log").insert({
        user_id: user.id,
        points: bonus,
        reason: `Bonus récap journalier (score: ${body.day_score}/10)`,
        entity_type: "recap",
        entity_id: data?.id,
      });
    }

    return NextResponse.json({ recap: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
