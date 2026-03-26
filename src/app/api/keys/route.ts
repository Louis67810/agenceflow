import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const { data, error } = await admin()
    .from("access_keys")
    .select("id, key, name, role, form_fields, used_at, form_data, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { name, role, formFields } = await request.json();
  if (!name || !role) return NextResponse.json({ error: "Champs manquants" }, { status: 400 });

  const key = crypto.randomUUID().replace(/-/g, "");

  const { data, error } = await admin()
    .from("access_keys")
    .insert({ key, name, role, form_fields: formFields ?? [] })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ key: data });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const { error } = await admin().from("access_keys").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
