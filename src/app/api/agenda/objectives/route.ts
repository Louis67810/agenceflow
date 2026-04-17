import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("agenda_objectives")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const { data: tasks } = await supabase
      .from("agenda_tasks")
      .select("id, objective_id, status")
      .eq("user_id", user.id);

    const objectivesById = new Map((data ?? []).map((objective) => [objective.id, objective]));
    const tasksByObjective = new Map<string, { id: string; status: string }[]>();

    for (const task of tasks ?? []) {
      if (!task.objective_id) continue;
      const existing = tasksByObjective.get(task.objective_id) ?? [];
      existing.push(task);
      tasksByObjective.set(task.objective_id, existing);
    }

    const childrenByParent = new Map<string, (typeof data)>();
    for (const objective of data ?? []) {
      if (!objective.parent_id) continue;
      const existing = childrenByParent.get(objective.parent_id) ?? [];
      existing.push(objective);
      childrenByParent.set(objective.parent_id, existing);
    }

    const memo = new Map<string, number>();
    const computeProgress = (objectiveId: string): number => {
      if (memo.has(objectiveId)) return memo.get(objectiveId)!;

      const objective = objectivesById.get(objectiveId);
      if (!objective) return 0;

      const children = childrenByParent.get(objectiveId) ?? [];
      const progress = children.length > 0
        ? Math.round(children.reduce((sum, child) => sum + computeProgress(child.id), 0) / children.length)
        : (() => {
            const linkedTasks = tasksByObjective.get(objectiveId) ?? [];
            if (linkedTasks.length === 0) return 0;
            const doneCount = linkedTasks.filter((task) => task.status === "done").length;
            return Math.round((doneCount / linkedTasks.length) * 100);
          })();

      memo.set(objectiveId, progress);
      return progress;
    };

    // Build tree structure
    const map = new Map<string, (typeof data)[0] & { children: typeof data }>();
    const roots: ((typeof data)[0] & { children: typeof data })[] = [];

    for (const obj of data ?? []) {
      map.set(obj.id, { ...obj, progress: computeProgress(obj.id), children: [] });
    }
    for (const obj of map.values()) {
      if (obj.parent_id && map.has(obj.parent_id)) {
        map.get(obj.parent_id)!.children.push(obj);
      } else {
        roots.push(obj);
      }
    }

    return NextResponse.json({ objectives: roots, flat: data ?? [] });
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
    const { data, error } = await supabase
      .from("agenda_objectives")
      .insert({ ...body, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ objective: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
