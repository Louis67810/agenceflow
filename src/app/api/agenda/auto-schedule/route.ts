import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { date } = await req.json();
    const targetDate = date ?? new Date().toISOString().split("T")[0];

    // Fetch settings
    const { data: settings } = await supabase
      .from("agenda_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const workStart = settings?.work_start ?? "09:00";
    const workEnd = settings?.work_end ?? "18:00";
    const slotDuration = settings?.slot_duration_minutes ?? 30;

    // Fetch unscheduled tasks for this date
    const { data: tasks } = await supabase
      .from("agenda_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", targetDate)
      .is("start_time", null)
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("importance", { ascending: false });

    // Fetch blocked slots for this date
    const { data: blockedSlots } = await supabase
      .from("agenda_blocked_slots")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", targetDate);

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ scheduled: 0, message: "Aucune tâche à planifier" });
    }

    // Build available time slots
    const available = buildAvailableSlots(workStart, workEnd, slotDuration, blockedSlots ?? []);

    // Schedule tasks
    const updates: { id: string; start_time: string; end_time: string }[] = [];
    let slotIndex = 0;

    for (const task of tasks) {
      if (slotIndex >= available.length) break;

      const taskDuration = task.duration_minutes ?? slotDuration;
      const slotsNeeded = Math.ceil(taskDuration / slotDuration);

      if (slotIndex + slotsNeeded > available.length) break;

      const startSlot = available[slotIndex];
      const endSlot = available[slotIndex + slotsNeeded - 1];

      updates.push({
        id: task.id,
        start_time: startSlot.start,
        end_time: endSlot.end,
      });

      slotIndex += slotsNeeded;
    }

    // Apply updates
    for (const upd of updates) {
      await supabase
        .from("agenda_tasks")
        .update({ start_time: upd.start_time, end_time: upd.end_time })
        .eq("id", upd.id);
    }

    return NextResponse.json({ scheduled: updates.length, assignments: updates });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function buildAvailableSlots(
  workStart: string,
  workEnd: string,
  slotDuration: number,
  blockedSlots: { start_time: string; end_time: string }[]
) {
  const slots: { start: string; end: string }[] = [];
  const [startH, startM] = workStart.split(":").map(Number);
  const [endH, endM] = workEnd.split(":").map(Number);

  let cur = startH * 60 + startM;
  const end = endH * 60 + endM;

  const blocked = blockedSlots.map(s => ({
    start: timeToMinutes(s.start_time),
    end: timeToMinutes(s.end_time),
  }));

  while (cur + slotDuration <= end) {
    const slotEnd = cur + slotDuration;
    const isBlocked = blocked.some(b => cur < b.end && slotEnd > b.start);

    if (!isBlocked) {
      slots.push({ start: minutesToTime(cur), end: minutesToTime(slotEnd) });
    }
    cur += slotDuration;
  }

  return slots;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
