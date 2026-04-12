import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const settingsUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/admin/agenda/settings`;

  if (error || !code) {
    return NextResponse.redirect(`${settingsUrl}?gcal=error`);
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/agenda/google-calendar/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      console.error("Google token error:", tokens);
      return NextResponse.redirect(`${settingsUrl}?gcal=error`);
    }

    // Save tokens to settings
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.redirect(`${settingsUrl}?gcal=error`);

    await supabase.from("agenda_settings").upsert({
      user_id: user.id,
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token,
      google_token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return NextResponse.redirect(`${settingsUrl}?gcal=connected`);
  } catch (e) {
    console.error("Google Calendar callback error:", e);
    return NextResponse.redirect(`${settingsUrl}?gcal=error`);
  }
}
