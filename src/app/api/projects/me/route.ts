import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ projects: [], debug: "no_token" });
    }

    // Validate token and get user
    const { data: { user }, error: authError } = await admin().auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ projects: [], debug: "invalid_token" });
    }

    const { data, error } = await admin()
      .from("projects")
      .select("*")
      .eq("client_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ projects: [], debug: error.message });
    }

    return NextResponse.json({ projects: data ?? [] });
  } catch (e) {
    return NextResponse.json({ projects: [], debug: String(e) });
  }
}
