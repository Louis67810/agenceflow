import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user }, error: authError } = await admin().auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Find designer record linked to this auth user
  const { data: designer } = await admin()
    .from("designers")
    .select("id, name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!designer) return NextResponse.json({ projects: [], designer: null });

  const { data: projects, error } = await admin()
    .from("projects")
    .select("id, name, status, stages, current_stage_index, start_date, created_at, client_name")
    .eq("designer_id", designer.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ projects: projects ?? [], designer });
}
