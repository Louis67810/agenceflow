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
  try {
    const { key } = await context.params;
    const { data, error } = await admin()
      .from("access_keys")
      .select("name, role, form_fields, form_pages, used_at")
      .eq("key", key)
      .single();

    if (error || !data) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await context.params;
    const body = await request.json();

    // Extract meta fields (prefixed with _) from form data
    const { _user_id, _client_email, _client_name, ...formData } = body as {
      _user_id?: string;
      _client_email?: string;
      _client_name?: string;
      [k: string]: unknown;
    };

    // Save form data to access_keys
    const { error } = await admin()
      .from("access_keys")
      .update({ form_data: formData, used_at: new Date().toISOString() })
      .eq("key", key)
      .is("used_at", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-create a project
    if (_user_id) {
      const projectName = _client_name
        ? `Projet de ${_client_name}`
        : "Nouveau projet";

      await admin()
        .from("projects")
        .insert({
          name: projectName,
          client_name: _client_name ?? null,
          client_email: _client_email ?? null,
          client_user_id: _user_id,
          status: "pending",
          form_data: formData,
          access_key: key,
        });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
