import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

type AgentAction =
  | "get_tasks"
  | "create_task"
  | "update_task"
  | "delete_task"
  | "get_habits"
  | "create_habit"
  | "update_habit"
  | "delete_habit"
  | "log_habit"
  | "unlog_habit"
  | "get_calendar"
  | "schedule_block"
  | "update_block"
  | "delete_block"
  | "plan_day"
  | "get_summary";

type AgentBody = {
  userId?: string;
  action?: AgentAction;
  payload?: Record<string, unknown>;
};

type Recurrence = "none" | "daily" | "weekly" | "monthly";

const TASK_FIELDS = [
  "title",
  "description",
  "date",
  "start_time",
  "end_time",
  "duration_minutes",
  "importance",
  "status",
  "objective_id",
  "parent_task_id",
  "recurrence",
  "recurrence_end",
  "tags",
  "color",
] as const;

const HABIT_FIELDS = [
  "title",
  "description",
  "frequency",
  "frequency_days",
  "target_per_period",
  "points",
  "importance",
  "color",
  "icon",
  "active",
] as const;

const BLOCK_FIELDS = [
  "title",
  "date",
  "start_time",
  "end_time",
  "recurrence",
  "recurrence_end",
  "color",
] as const;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function getAgentBearer(req: NextRequest) {
  const header = req.headers.get("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function pickFields(payload: Record<string, unknown>, fields: readonly string[]) {
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in payload) picked[field] = payload[field];
  }
  return picked;
}

function stringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function today() {
  return new Date().toISOString().split("T")[0];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function dateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function normalizeRecurrence(value: unknown): Recurrence {
  return value === "daily" || value === "weekly" || value === "monthly" ? value : "none";
}

function buildOccurrenceDates(payload: Record<string, unknown>) {
  const start = stringValue(payload, "date") ?? today();
  const recurrence = normalizeRecurrence(payload.recurrence);
  const recurrenceEnd = stringValue(payload, "recurrence_end") ?? stringValue(payload, "until");
  const permanent = payload.permanent === true;
  const horizonDays = typeof payload.horizon_days === "number"
    ? Math.min(Math.max(Math.round(payload.horizon_days), 1), 366)
    : 365;

  if (recurrence === "none") return [start];

  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = recurrenceEnd
    ? new Date(`${recurrenceEnd}T12:00:00Z`)
    : addDays(startDate, permanent ? horizonDays : Math.min(horizonDays, 30));

  const dates: string[] = [];
  let cursor = startDate;

  while (cursor <= endDate && dates.length < 366) {
    dates.push(dateKey(cursor));
    if (recurrence === "daily") cursor = addDays(cursor, 1);
    if (recurrence === "weekly") cursor = addDays(cursor, 7);
    if (recurrence === "monthly") cursor = addMonths(cursor, 1);
  }

  return dates;
}

async function planDay(supabase: NonNullable<ReturnType<typeof createServiceClient>>, userId: string, payload: Record<string, unknown>) {
  const targetDate = stringValue(payload, "date") ?? today();

  const { data: settings } = await supabase
    .from("agenda_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const workStart = settings?.work_start ?? "09:00";
  const workEnd = settings?.work_end ?? "18:00";
  const slotDuration = settings?.slot_duration_minutes ?? 30;

  const [{ data: tasks }, { data: slots }] = await Promise.all([
    supabase
      .from("agenda_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("date", targetDate)
      .is("start_time", null)
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("importance", { ascending: false }),
    supabase
      .from("agenda_blocked_slots")
      .select("*")
      .eq("user_id", userId)
      .eq("date", targetDate),
  ]);

  const available = buildAvailableSlots(workStart, workEnd, slotDuration, slots ?? []);
  const assignments: Array<{ id: string; start_time: string; end_time: string }> = [];
  let slotIndex = 0;

  for (const task of tasks ?? []) {
    if (slotIndex >= available.length) break;
    const duration = task.duration_minutes ?? slotDuration;
    const slotsNeeded = Math.ceil(duration / slotDuration);
    if (slotIndex + slotsNeeded > available.length) break;

    const startSlot = available[slotIndex];
    const endSlot = available[slotIndex + slotsNeeded - 1];
    assignments.push({ id: task.id, start_time: startSlot.start, end_time: endSlot.end });
    slotIndex += slotsNeeded;
  }

  for (const assignment of assignments) {
    await supabase
      .from("agenda_tasks")
      .update({ start_time: assignment.start_time, end_time: assignment.end_time, updated_at: new Date().toISOString() })
      .eq("id", assignment.id)
      .eq("user_id", userId);
  }

  return { date: targetDate, scheduled: assignments.length, assignments };
}

function buildAvailableSlots(workStart: string, workEnd: string, slotDuration: number, blockedSlots: { start_time: string; end_time: string }[]) {
  const slots: { start: string; end: string }[] = [];
  const [startH, startM] = workStart.split(":").map(Number);
  const [endH, endM] = workEnd.split(":").map(Number);
  let cursor = startH * 60 + startM;
  const end = endH * 60 + endM;
  const blocked = blockedSlots.map((slot) => ({
    start: timeToMinutes(slot.start_time),
    end: timeToMinutes(slot.end_time),
  }));

  while (cursor + slotDuration <= end) {
    const slotEnd = cursor + slotDuration;
    const isBlocked = blocked.some((block) => cursor < block.end && slotEnd > block.start);
    if (!isBlocked) slots.push({ start: minutesToTime(cursor), end: minutesToTime(slotEnd) });
    cursor += slotDuration;
  }

  return slots;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export async function POST(req: NextRequest) {
  const expectedKey = process.env.AGENDA_AGENT_API_KEY?.trim();
  if (!expectedKey || getAgentBearer(req) !== expectedKey) return unauthorized();

  const supabase = createServiceClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });
  }

  let body: AgentBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const action = body.action;
  const payload = body.payload ?? {};

  if (!userId || !isUuid(userId)) {
    return NextResponse.json({ ok: false, error: "userId must be a valid Supabase user UUID." }, { status: 400 });
  }
  if (!action) {
    return NextResponse.json({ ok: false, error: "action is required." }, { status: 400 });
  }

  try {
    if (action === "get_tasks") {
      let query = supabase.from("agenda_tasks").select("*").eq("user_id", userId).order("date").order("start_time");
      const date = stringValue(payload, "date");
      const weekStart = stringValue(payload, "week_start");
      const weekEnd = stringValue(payload, "week_end");
      const status = stringValue(payload, "status");
      if (date) query = query.eq("date", date);
      if (weekStart && weekEnd) query = query.gte("date", weekStart).lte("date", weekEnd);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ ok: true, tasks: data ?? [] });
    }

    if (action === "create_task") {
      const dates = buildOccurrenceDates(payload);
      const base = pickFields(payload, TASK_FIELDS);
      const rows = dates.map((date) => ({ ...base, date, user_id: userId, recurrence: normalizeRecurrence(payload.recurrence) }));
      const { data, error } = await supabase.from("agenda_tasks").insert(rows).select();
      if (error) throw error;
      return NextResponse.json({ ok: true, created: data?.length ?? 0, tasks: data ?? [] });
    }

    if (action === "update_task") {
      const id = stringValue(payload, "id");
      if (!id) return NextResponse.json({ ok: false, error: "payload.id is required." }, { status: 400 });
      const updates = { ...pickFields(payload, TASK_FIELDS), updated_at: new Date().toISOString() };
      const { data, error } = await supabase.from("agenda_tasks").update(updates).eq("id", id).eq("user_id", userId).select().single();
      if (error) throw error;
      return NextResponse.json({ ok: true, task: data });
    }

    if (action === "delete_task") {
      const id = stringValue(payload, "id");
      if (!id) return NextResponse.json({ ok: false, error: "payload.id is required." }, { status: 400 });
      const { error } = await supabase.from("agenda_tasks").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return NextResponse.json({ ok: true, success: true });
    }

    if (action === "get_habits") {
      const { data, error } = await supabase.from("agenda_habits").select("*").eq("user_id", userId).eq("active", true).order("created_at");
      if (error) throw error;
      return NextResponse.json({ ok: true, habits: data ?? [] });
    }

    if (action === "create_habit") {
      const { data, error } = await supabase.from("agenda_habits").insert({ ...pickFields(payload, HABIT_FIELDS), user_id: userId }).select().single();
      if (error) throw error;
      return NextResponse.json({ ok: true, habit: data });
    }

    if (action === "update_habit") {
      const id = stringValue(payload, "id");
      if (!id) return NextResponse.json({ ok: false, error: "payload.id is required." }, { status: 400 });
      const { data, error } = await supabase.from("agenda_habits").update(pickFields(payload, HABIT_FIELDS)).eq("id", id).eq("user_id", userId).select().single();
      if (error) throw error;
      return NextResponse.json({ ok: true, habit: data });
    }

    if (action === "delete_habit") {
      const id = stringValue(payload, "id");
      if (!id) return NextResponse.json({ ok: false, error: "payload.id is required." }, { status: 400 });
      const { error } = await supabase.from("agenda_habits").update({ active: false }).eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return NextResponse.json({ ok: true, success: true });
    }

    if (action === "log_habit" || action === "unlog_habit") {
      const habitId = stringValue(payload, "habit_id");
      if (!habitId) return NextResponse.json({ ok: false, error: "payload.habit_id is required." }, { status: 400 });
      const loggedDate = stringValue(payload, "date") ?? today();
      if (action === "log_habit") {
        const { data, error } = await supabase
          .from("agenda_habit_logs")
          .upsert({ habit_id: habitId, user_id: userId, logged_date: loggedDate, note: payload.note ?? null }, { onConflict: "habit_id,logged_date" })
          .select()
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, log: data });
      }
      const { error } = await supabase.from("agenda_habit_logs").delete().eq("habit_id", habitId).eq("user_id", userId).eq("logged_date", loggedDate);
      if (error) throw error;
      return NextResponse.json({ ok: true, success: true });
    }

    if (action === "get_calendar") {
      const date = stringValue(payload, "date");
      const weekStart = stringValue(payload, "week_start");
      const weekEnd = stringValue(payload, "week_end");
      let taskQuery = supabase.from("agenda_tasks").select("*").eq("user_id", userId).order("date").order("start_time");
      let slotQuery = supabase.from("agenda_blocked_slots").select("*").eq("user_id", userId).order("date").order("start_time");
      if (date) {
        taskQuery = taskQuery.eq("date", date);
        slotQuery = slotQuery.eq("date", date);
      }
      if (weekStart && weekEnd) {
        taskQuery = taskQuery.gte("date", weekStart).lte("date", weekEnd);
        slotQuery = slotQuery.gte("date", weekStart).lte("date", weekEnd);
      }
      const [{ data: tasks, error: taskError }, { data: blockedSlots, error: slotError }] = await Promise.all([taskQuery, slotQuery]);
      if (taskError) throw taskError;
      if (slotError) throw slotError;
      return NextResponse.json({ ok: true, tasks: tasks ?? [], blocked_slots: blockedSlots ?? [] });
    }

    if (action === "schedule_block") {
      const dates = buildOccurrenceDates(payload);
      const base = pickFields(payload, BLOCK_FIELDS);
      const rows = dates.map((date) => ({ ...base, date, user_id: userId, recurrence: normalizeRecurrence(payload.recurrence) }));
      const { data, error } = await supabase.from("agenda_blocked_slots").insert(rows).select();
      if (error) throw error;
      return NextResponse.json({ ok: true, created: data?.length ?? 0, blocked_slots: data ?? [] });
    }

    if (action === "update_block") {
      const id = stringValue(payload, "id");
      if (!id) return NextResponse.json({ ok: false, error: "payload.id is required." }, { status: 400 });
      const { data, error } = await supabase.from("agenda_blocked_slots").update(pickFields(payload, BLOCK_FIELDS)).eq("id", id).eq("user_id", userId).select().single();
      if (error) throw error;
      return NextResponse.json({ ok: true, blocked_slot: data });
    }

    if (action === "delete_block") {
      const id = stringValue(payload, "id");
      if (!id) return NextResponse.json({ ok: false, error: "payload.id is required." }, { status: 400 });
      const { error } = await supabase.from("agenda_blocked_slots").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return NextResponse.json({ ok: true, success: true });
    }

    if (action === "plan_day") {
      return NextResponse.json({ ok: true, ...(await planDay(supabase, userId, payload)) });
    }

    if (action === "get_summary") {
      const date = stringValue(payload, "date") ?? today();
      const [{ data: tasks }, { data: habits }, { data: recap }, { data: slots }] = await Promise.all([
        supabase.from("agenda_tasks").select("*").eq("user_id", userId).eq("date", date).order("start_time"),
        supabase.from("agenda_habits").select("*").eq("user_id", userId).eq("active", true).order("created_at"),
        supabase.from("agenda_daily_recap").select("*").eq("user_id", userId).eq("recap_date", date).maybeSingle(),
        supabase.from("agenda_blocked_slots").select("*").eq("user_id", userId).eq("date", date).order("start_time"),
      ]);
      return NextResponse.json({ ok: true, date, tasks: tasks ?? [], habits: habits ?? [], recap, blocked_slots: slots ?? [] });
    }

    return NextResponse.json({ ok: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
