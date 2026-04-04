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
      .select("name, role, form_fields, form_pages, used_at, service_type_id")
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

    // Auto-create a project if user_id provided
    if (_user_id) {
      // Get service type stages if linked
      const { data: keyData } = await admin()
        .from("access_keys")
        .select("service_type_id, name")
        .eq("key", key)
        .single();

      let stages: object[] = [];
      let serviceTypeName = "";

      if (keyData?.service_type_id) {
        const { data: serviceType } = await admin()
          .from("service_types")
          .select("stages, name")
          .eq("id", keyData.service_type_id)
          .single();

        if (serviceType) {
          // Snapshot stages with completed=false
          stages = ((serviceType.stages ?? []) as { id: string; label: string; duration_days: number }[])
            .map((s) => ({ ...s, completed: false, completed_at: null }));
          serviceTypeName = serviceType.name;
        }
      }

      // Use "project_name" form field as project name, fallback to client name
      const projectNameFromForm = formData.project_name as string | undefined;
      const projectName = projectNameFromForm?.trim()
        || (serviceTypeName
          ? `${serviceTypeName} — ${_client_name ?? "Client"}`
          : `Projet de ${_client_name ?? "Client"}`);

      await admin()
        .from("projects")
        .insert({
          name: projectName,
          client_name: _client_name ?? null,
          client_email: _client_email ?? null,
          client_user_id: _user_id,
          status: stages.length > 0 ? "in_progress" : "pending",
          form_data: formData,
          access_key: key,
          service_type_id: keyData?.service_type_id ?? null,
          stages,
          current_stage_index: 0,
          start_date: new Date().toISOString().split("T")[0],
        });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
