import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeWeightedTaskPoints, recapBonusPoints } from "@/lib/agenda/points";

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
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const recapDate = body.recap_date ?? new Date().toISOString().split("T")[0];

    const { data: existing } = await supabase
      .from("agenda_daily_recap")
      .select("id")
      .eq("user_id", user.id)
      .eq("recap_date", recapDate)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Le récap du jour a déjà été enregistré." }, { status: 409 });
    }

    const { data: tasks } = await supabase
      .from("agenda_tasks")
      .select("id, importance, status")
      .eq("user_id", user.id)
      .eq("date", recapDate);

    const { data: settingsData } = await supabase
      .from("agenda_settings")
      .select("daily_points_pool")
      .eq("user_id", user.id)
      .maybeSingle();

    const taskReviewsInput = Array.isArray(body.task_reviews) ? body.task_reviews : [];
    const reviewMap = new Map<string, { task_id: string; outcome?: string; justification?: string }>(
      taskReviewsInput.map((review: { task_id: string; outcome?: string; justification?: string }) => [review.task_id, review])
    );
    const allImportances = (tasks ?? []).map((task: { importance: number }) => task.importance ?? 1);
    const dailyPool = (settingsData as { daily_points_pool?: number } | null)?.daily_points_pool ?? 100;
    const normalizedTaskReviews = (tasks ?? []).map((task: { id: string; importance: number; status: string }) => {
      const rawReview = reviewMap.get(task.id);
      const outcome =
        rawReview?.outcome === "done" || rawReview?.outcome === "justified" || rawReview?.outcome === "missed"
          ? rawReview.outcome
          : task.status === "done"
          ? "done"
          : "missed";

      return {
        task_id: task.id,
        outcome,
        justification: rawReview?.justification?.trim() || "",
        points_awarded:
          outcome === "done" || outcome === "justified"
            ? computeWeightedTaskPoints(task.importance ?? 1, allImportances, dailyPool)
            : 0,
      };
    });

    const recapBonus = recapBonusPoints({ day_score: body.day_score });
    const pointsEarned = normalizedTaskReviews.reduce((sum, review) => sum + review.points_awarded, 0);
    const justifiedTasksCount = normalizedTaskReviews.filter((review) => review.outcome === "justified").length;

    const { data: recapData, error: recapError } = await supabase
      .from("agenda_daily_recap")
      .insert({
        ...body,
        recap_date: recapDate,
        user_id: user!.id,
        task_reviews: normalizedTaskReviews,
        points_earned: pointsEarned,
        justified_tasks_count: justifiedTasksCount,
        bonus_points: recapBonus,
      })
      .select()
      .single();

    if (recapError) throw recapError;

    if (pointsEarned > 0) {
      await supabase.from("agenda_points_log").insert({
        user_id: user!.id,
        points: pointsEarned,
        reason: `Récompense des tâches du ${recapDate}`,
        entity_type: "recap",
        entity_id: recapData?.id,
      });
    }

    return NextResponse.json({ recap: recapData });

    const bonus = recapBonusPoints({ day_score: body.day_score });

    const { data, error } = await supabase
      .from("agenda_daily_recap")
      .upsert({
        ...body,
        recap_date: recapDate,
        user_id: user!.id,
        bonus_points: bonus,
      }, { onConflict: "user_id,recap_date" })
      .select()
      .single();

    if (error) throw error;

    // Log bonus points if any
    if (bonus > 0) {
      await supabase.from("agenda_points_log").insert({
        user_id: user!.id,
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
