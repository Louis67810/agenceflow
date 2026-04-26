import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateDayScore } from "@/lib/agenda/points";

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

    const taskReviewsInput = Array.isArray(body.task_reviews) ? body.task_reviews : [];
    const reviewMap = new Map<string, { task_id: string; outcome?: string; justification?: string }>(
      taskReviewsInput.map((review: { task_id: string; outcome?: string; justification?: string }) => [review.task_id, review])
    );

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
        points_awarded: 0, // deprecated, kept for DB compatibility
      };
    });

    const tasksCompleted = normalizedTaskReviews.filter((review) => review.outcome === "done" || review.outcome === "justified").length;
    const tasksPlanned = tasks?.length ?? 0;
    const habitsDone = body.habits_done ?? 0;
    const habitsTotal = body.habits_total ?? 0;
    const dayScore = calculateDayScore(tasksCompleted, tasksPlanned, habitsDone, habitsTotal);
    const justifiedTasksCount = normalizedTaskReviews.filter((review) => review.outcome === "justified").length;

    const { data: recapData, error: recapError } = await supabase
      .from("agenda_daily_recap")
      .insert({
        ...body,
        recap_date: recapDate,
        user_id: user!.id,
        task_reviews: normalizedTaskReviews,
        points_earned: 0, // deprecated, kept for DB compatibility
        justified_tasks_count: justifiedTasksCount,
        bonus_points: 0, // deprecated, kept for DB compatibility
        day_score: dayScore,
      })
      .select()
      .single();

    if (recapError) throw recapError;

    return NextResponse.json({ recap: recapData });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
