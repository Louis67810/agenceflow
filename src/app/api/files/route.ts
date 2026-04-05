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
  const projectId = req.nextUrl.searchParams.get("project_id");
  if (!projectId) return NextResponse.json({ error: "project_id requis" }, { status: 400 });

  const { data: files, error } = await admin()
    .from("project_files")
    .select("id, name, url, type, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ files: files ?? [] });
}

export async function POST(req: NextRequest) {
  const { project_id, name, url, type } = await req.json();
  if (!project_id || !name || !url) {
    return NextResponse.json({ error: "project_id, name et url requis" }, { status: 400 });
  }

  const { data: file, error } = await admin()
    .from("project_files")
    .insert({ project_id, name, url, type: type ?? "other" })
    .select("id, name, url, type, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ file });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { error } = await admin().from("project_files").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
