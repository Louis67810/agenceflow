import { createBrowserClient } from "@supabase/ssr";

let browserClient:
  | ReturnType<typeof createBrowserClient>
  | null = null;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return browserClient;
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = createClient();

  const {
    data: { session: currentSession },
  } = await supabase.auth.getSession();

  const expiresSoon =
    currentSession?.expires_at
      ? currentSession.expires_at * 1000 <= Date.now() + 60_000
      : false;

  if (currentSession?.access_token && !expiresSoon) {
    return currentSession.access_token;
  }

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (!error && refreshed.session?.access_token) {
    return refreshed.session.access_token;
  }

  return currentSession?.access_token ?? null;
}
