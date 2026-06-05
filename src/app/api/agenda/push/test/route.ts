import { NextRequest, NextResponse } from "next/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";
import { sendWebPush, type PushSubscriptionJSON } from "@/lib/push/web-push";

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("agenda_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", user.id);

    if (error) throw error;

    let sent = 0;
    let removed = 0;
    const failures: string[] = [];

    for (const row of data ?? []) {
      const subscription: PushSubscriptionJSON = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };
      const response = await sendWebPush(subscription, {
        title: "AgenceFlow — notification test",
        body: "Les notifications PWA sont bien activées sur cet appareil.",
        url: "/admin/agenda/settings",
        tag: "agenda-test",
      });

      if (response.ok || response.status === 201 || response.status === 202) {
        sent += 1;
      } else if (response.status === 404 || response.status === 410) {
        await supabase.from("agenda_push_subscriptions").delete().eq("id", row.id).eq("user_id", user.id);
        removed += 1;
      } else {
        failures.push(`${response.status} ${await response.text().catch(() => "")}`.trim());
      }
    }

    return NextResponse.json({ sent, removed, failures });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
