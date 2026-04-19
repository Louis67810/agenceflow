import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

type RouteAuthSource = "bearer" | "cookie" | "none";

type RouteAuthResult = {
  supabase: SupabaseClient;
  user: User | null;
  authSource: RouteAuthSource;
};

function getBearerToken(req?: Request) {
  const header = req?.headers.get("Authorization") ?? req?.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

function createBearerClient(token: string) {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}

export async function getRouteAuthenticatedUser(req?: Request): Promise<RouteAuthResult> {
  const token = getBearerToken(req);

  if (token) {
    const supabase = createBearerClient(token);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return { supabase, user, authSource: "bearer" };
    }
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!error && user) {
    return { supabase, user, authSource: "cookie" };
  }

  return { supabase, user: null, authSource: "none" };
}
