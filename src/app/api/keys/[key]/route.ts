import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const { data, error } = await admin()
    .from("access_keys")
    .select("name, role, form_fields, form_pages, used_at")
    .eq("key", key)
    .single();

  if (error || !data) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const formData = await request.json();

  const { error } = await admin()
    .from("access_keys")
    .update({ form_data: formData, used_at: new Date().toISOString() })
    .eq("key", key)
    .is("used_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
