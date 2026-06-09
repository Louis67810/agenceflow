import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWebPush, type PushPayload, type PushSubscriptionJSON } from "@/lib/push/web-push";

type NotificationKind = "morning_brief" | "recap_reminder";

type AgendaSettingsRow = {
  user_id: string;
  timezone: string | null;
  pwa_notifications_enabled: boolean | null;
  morning_brief_enabled: boolean | null;
  morning_brief_time: string | null;
  recap_reminder_enabled: boolean | null;
  recap_reminder_time: string | null;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

function getLocalParts(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

function normalizeTime(value?: string | null) {
  if (!value) return null;
  return value.slice(0, 5);
}

async function alreadyDelivered(supabase: NonNullable<ReturnType<typeof createServiceClient>>, userId: string, kind: NotificationKind, date: string) {
  const { data } = await supabase
    .from("agenda_notification_deliveries")
    .select("id")
    .eq("user_id", userId)
    .eq("notification_type", kind)
    .eq("delivery_date", date)
    .maybeSingle();
  return Boolean(data);
}

async function markDelivered(supabase: NonNullable<ReturnType<typeof createServiceClient>>, userId: string, kind: NotificationKind, date: string) {
  await supabase
    .from("agenda_notification_deliveries")
    .upsert({ user_id: userId, notification_type: kind, delivery_date: date }, { onConflict: "user_id,notification_type,delivery_date" });
}

async function buildMorningBrief(supabase: NonNullable<ReturnType<typeof createServiceClient>>, userId: string, date: string): Promise<PushPayload> {
  const [tasksRes, habitsRes, logsRes] = await Promise.all([
    supabase.from("agenda_tasks").select("id, title, status, importance").eq("user_id", userId).eq("date", date),
    supabase.from("agenda_habits").select("id, title").eq("user_id", userId).eq("active", true),
    supabase.from("agenda_habit_logs").select("habit_id").eq("user_id", userId).eq("logged_date", date),
  ]);

  const tasks = tasksRes.data ?? [];
  const todoTasks = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled");
  const topTask = todoTasks.slice().sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))[0];
  const habitsTotal = habitsRes.data?.length ?? 0;
  const habitsDone = new Set((logsRes.data ?? []).map((log) => log.habit_id)).size;

  const bodyParts = [
    `${todoTasks.length} tâche${todoTasks.length !== 1 ? "s" : ""} à faire`,
    `${habitsDone}/${habitsTotal} habitude${habitsTotal !== 1 ? "s" : ""}`,
  ];
  if (topTask?.title) bodyParts.push(`Priorité : ${topTask.title}`);

  return {
    title: "Brief du matin — AgenceFlow",
    body: bodyParts.join(" · "),
    url: "/admin/agenda",
    tag: `morning-brief-${date}`,
  };
}

async function buildRecapReminder(supabase: NonNullable<ReturnType<typeof createServiceClient>>, userId: string, date: string): Promise<PushPayload | null> {
  const { data } = await supabase
    .from("agenda_daily_recap")
    .select("id")
    .eq("user_id", userId)
    .eq("recap_date", date)
    .maybeSingle();

  if (data) return null;

  return {
    title: "Récap du soir à remplir",
    body: "Prends 2 minutes pour noter ton score, tes victoires et ta priorité de demain.",
    url: `/admin/agenda/recap?date=${date}`,
    tag: `recap-reminder-${date}`,
  };
}

async function sendToUserSubscriptions(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload
) {
  let sent = 0;
  let removed = 0;
  let failed = 0;

  for (const row of subscriptions) {
    const subscription: PushSubscriptionJSON = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    const response = await sendWebPush(subscription, payload, { ttl: 60 * 60 * 6 });

    if (response.ok || response.status === 201 || response.status === 202) {
      sent += 1;
    } else if (response.status === 404 || response.status === 410) {
      await supabase.from("agenda_push_subscriptions").delete().eq("id", row.id);
      removed += 1;
    } else {
      failed += 1;
    }
  }

  return { sent, removed, failed };
}

async function run(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 });

  const forcedKind = req.nextUrl.searchParams.get("type") as NotificationKind | null;
  const force = req.nextUrl.searchParams.get("force") === "1";
  const onlyUserId = req.nextUrl.searchParams.get("user_id");

  const { data: settings, error: settingsError } = await supabase
    .from("agenda_settings")
    .select("user_id, timezone, pwa_notifications_enabled, morning_brief_enabled, morning_brief_time, recap_reminder_enabled, recap_reminder_time")
    .eq("pwa_notifications_enabled", true);

  if (settingsError) throw settingsError;

  const rows = ((settings ?? []) as AgendaSettingsRow[]).filter((row) => !onlyUserId || row.user_id === onlyUserId);
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, summary: { usersChecked: 0, notifications: 0, sent: 0, removed: 0, failed: 0 } });
  }

  const { data: subscriptionsData, error: subscriptionsError } = await supabase
    .from("agenda_push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", rows.map((row) => row.user_id));

  if (subscriptionsError) throw subscriptionsError;

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const sub of (subscriptionsData ?? []) as PushSubscriptionRow[]) {
    subscriptionsByUser.set(sub.user_id, [...(subscriptionsByUser.get(sub.user_id) ?? []), sub]);
  }

  const summary = { usersChecked: rows.length, notifications: 0, sent: 0, removed: 0, failed: 0 };

  for (const row of rows) {
    const timezone = row.timezone || "Europe/Paris";
    const local = getLocalParts(timezone);
    const subscriptions = subscriptionsByUser.get(row.user_id) ?? [];
    if (subscriptions.length === 0) continue;

    const jobs: Array<{ kind: NotificationKind; enabled: boolean; due: boolean }> = [
      {
        kind: "morning_brief",
        enabled: row.morning_brief_enabled !== false,
        due: normalizeTime(row.morning_brief_time) === local.time,
      },
      {
        kind: "recap_reminder",
        enabled: row.recap_reminder_enabled !== false,
        due: normalizeTime(row.recap_reminder_time) === local.time,
      },
    ];

    for (const job of jobs) {
      if (forcedKind && job.kind !== forcedKind) continue;
      if (!job.enabled) continue;
      if (!force && !job.due) continue;
      if (!force && await alreadyDelivered(supabase, row.user_id, job.kind, local.date)) continue;

      const payload = job.kind === "morning_brief"
        ? await buildMorningBrief(supabase, row.user_id, local.date)
        : await buildRecapReminder(supabase, row.user_id, local.date);

      if (!payload) continue;
      const result = await sendToUserSubscriptions(supabase, subscriptions, payload);
      await markDelivered(supabase, row.user_id, job.kind, local.date);
      summary.notifications += 1;
      summary.sent += result.sent;
      summary.removed += result.removed;
      summary.failed += result.failed;
    }
  }

  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: NextRequest) {
  try {
    return await run(req);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await run(req);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
