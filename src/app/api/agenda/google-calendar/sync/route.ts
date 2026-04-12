import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { days = 14 } = await req.json().catch(() => ({}));

    // Fetch stored tokens
    const { data: settingsRow } = await supabase
      .from("agenda_settings")
      .select("google_access_token, google_refresh_token, google_token_expiry")
      .eq("user_id", user.id)
      .maybeSingle();

    const s = settingsRow as {
      google_access_token?: string;
      google_refresh_token?: string;
      google_token_expiry?: string;
    } | null;

    if (!s?.google_refresh_token && !s?.google_access_token) {
      return NextResponse.json({ error: "Google Calendar non connecté. Connectez-le dans les paramètres." }, { status: 400 });
    }

    // Check if token is expired, refresh if needed
    let accessToken = s?.google_access_token ?? "";
    const expiry = s?.google_token_expiry ? new Date(s.google_token_expiry) : null;
    if (!accessToken || (expiry && expiry < new Date())) {
      if (s?.google_refresh_token) {
        const newToken = await refreshAccessToken(s.google_refresh_token);
        if (!newToken) return NextResponse.json({ error: "Impossible de rafraîchir le token Google. Reconnectez Google Calendar." }, { status: 401 });
        accessToken = newToken;
        await supabase.from("agenda_settings").update({
          google_access_token: newToken,
          google_token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
        }).eq("user_id", user.id);
      }
    }

    // Fetch Google Calendar events
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + days * 24 * 3600 * 1000).toISOString();

    const gcalRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!gcalRes.ok) {
      const err = await gcalRes.text();
      return NextResponse.json({ error: `Google Calendar API: ${err}` }, { status: 502 });
    }

    const gcalData = await gcalRes.json();
    const events = (gcalData.items ?? []) as {
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }[];

    let imported = 0;
    const skipped = 0;

    for (const event of events) {
      const title = event.summary ?? "Événement";
      const startDT = event.start?.dateTime;
      const endDT = event.end?.dateTime;
      const startDate = event.start?.date;

      // Skip all-day events (no dateTime)
      if (!startDT || !endDT) continue;

      const date = startDT.split("T")[0];
      const startTime = startDT.split("T")[1].slice(0, 5);
      const endTime = endDT.split("T")[1].slice(0, 5);

      // Check if this slot already exists (by title + date + start_time)
      const { data: existing } = await supabase
        .from("agenda_blocked_slots")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", date)
        .eq("start_time", startTime)
        .eq("title", title)
        .maybeSingle();

      if (existing) continue;

      await supabase.from("agenda_blocked_slots").insert({
        user_id: user.id,
        title,
        date,
        start_time: startTime,
        end_time: endTime,
        color: "#4285f4",
        recurrence: "none",
      });
      imported++;
    }

    return NextResponse.json({ imported, skipped, total: events.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
