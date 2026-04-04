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
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");
    if (!projectId) return NextResponse.json({ error: "project_id requis" }, { status: 400 });

    const { data, error } = await admin()
      .from("messages")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { project_id, sender_role, sender_name, content } = await request.json();
    if (!project_id || !sender_role || !content) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    const { data, error } = await admin()
      .from("messages")
      .insert({ project_id, sender_role, sender_name: sender_name ?? "Utilisateur", content })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
