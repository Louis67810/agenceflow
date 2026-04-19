import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getMissingSchemaColumn } from "@/lib/supabase/postgrest";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function selectAccessKeyByKey(key: string, columns: string[]) {
  let currentColumns = [...columns];

  while (true) {
    const { data, error } = await admin()
      .from("access_keys")
      .select(currentColumns.join(", "))
      .eq("key", key)
      .single();

    if (!error) return { data, error: null, columns: currentColumns };

    const missingColumn = getMissingSchemaColumn(error);
    if (!missingColumn || !currentColumns.includes(missingColumn)) {
      return { data: null, error, columns: currentColumns };
    }

    currentColumns = currentColumns.filter((column) => column !== missingColumn);
  }
}

async function insertProjectWithOptionalBanner(payload: Record<string, unknown>) {
  const insertPayload = { ...payload };

  while (true) {
    const { data, error } = await admin()
      .from("projects")
      .insert(insertPayload)
      .select("id")
      .single();

    if (!error) return { data, error: null };

    const missingColumn = getMissingSchemaColumn(error);
    if (!missingColumn || !(missingColumn in insertPayload)) {
      return { data: null, error };
    }

    delete insertPayload[missingColumn];
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await context.params;
    const { data, error } = await selectAccessKeyByKey(key, [
      "name",
      "role",
      "form_fields",
      "form_pages",
      "used_at",
      "service_type_id",
    ]);

    if (error || !data) return NextResponse.json({ error: "Lien invalide" }, { status: 404 });
    const keyData = data as unknown as Record<string, unknown>;
    return NextResponse.json({
      ...keyData,
      form_pages: "form_pages" in keyData ? keyData.form_pages : [],
      service_type_id: "service_type_id" in keyData ? keyData.service_type_id : null,
    });
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

    // Mark key as used (ignore if already used)
    await admin()
      .from("access_keys")
      .update({ form_data: formData, used_at: new Date().toISOString() })
      .eq("key", key);

    if (!_user_id) {
      return NextResponse.json({ error: "user_id manquant — impossible de créer le projet" }, { status: 400 });
    }

    // Get service type stages and role
    const { data: keyRow } = await selectAccessKeyByKey(key, [
      "service_type_id",
      "name",
      "role",
      "banner_url",
    ]);

    // ── Prestataire role (designer or developer): create designer record ────────
    if (keyRow?.role === "designer" || keyRow?.role === "developer") {
      const { data: existing } = await admin()
        .from("designers")
        .select("id")
        .eq("user_id", _user_id)
        .maybeSingle();

      if (!existing) {
        await admin()
          .from("designers")
          .insert({
            name: _client_name ?? keyRow.name ?? "Prestataire",
            email: _client_email ?? null,
            user_id: _user_id,
            role: keyRow.role, // "designer" or "developer"
          });
      }
      return NextResponse.json({ success: true, role: keyRow.role });
    }

    let stages: object[] = [];
    let serviceTypeName = "";

    if (keyRow?.service_type_id) {
      const { data: serviceType } = await admin()
        .from("service_types")
        .select("stages, name")
        .eq("id", keyRow.service_type_id)
        .single();

      if (serviceType) {
        stages = ((serviceType.stages ?? []) as { id: string; label: string; duration_days: number }[])
          .map((s) => ({ ...s, completed: false, completed_at: null }));
        serviceTypeName = serviceType.name;
      }
    }

    // Project name: from "project_name" field, or from service type + client name
    const projectNameFromForm = (formData.project_name as string | undefined)?.trim();
    const projectName = projectNameFromForm
      || (serviceTypeName ? `${serviceTypeName} — ${_client_name ?? "Client"}` : `Projet de ${_client_name ?? "Client"}`);

    const { data: newProject, error: projError } = await insertProjectWithOptionalBanner({
      name: projectName,
      client_name: _client_name ?? null,
      client_email: _client_email ?? null,
      client_user_id: _user_id,
      status: stages.length > 0 ? "in_progress" : "pending",
      form_data: formData,
      service_type_id: keyRow?.service_type_id ?? null,
      banner_url: keyRow && "banner_url" in keyRow ? keyRow.banner_url : null,
      stages,
      current_stage_index: 0,
      start_date: new Date().toISOString().split("T")[0],
    });

    if (projError) {
      return NextResponse.json({
        error: `Projet non créé : ${projError.message}. Avez-vous exécuté le SQL de migration dans Supabase ?`,
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, project_id: newProject?.id ?? null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
