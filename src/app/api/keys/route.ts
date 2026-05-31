import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getMissingSchemaColumn } from "@/lib/supabase/postgrest";

type AccessKeyListRow = Record<string, unknown> & {
  service_type_id?: string | null;
  banner_url?: string | null;
  whatsapp_group_name?: string | null;
  whatsapp_group_profile_url?: string | null;
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const BASE_KEY_COLUMNS = ["id", "key", "name", "role", "form_fields", "used_at", "form_data", "created_at"] as const;
const OPTIONAL_KEY_COLUMNS = ["service_type_id", "banner_url", "whatsapp_group_name", "whatsapp_group_profile_url"] as const;

async function listAccessKeys() {
  let columns = [...BASE_KEY_COLUMNS, ...OPTIONAL_KEY_COLUMNS];

  while (true) {
    const { data, error } = await admin()
      .from("access_keys")
      .select(columns.join(", "))
      .order("created_at", { ascending: false });

    if (!error) {
      return {
        data: (data ?? []).map((row) => {
          const keyRow = row as unknown as AccessKeyListRow;
          return {
            ...keyRow,
            service_type_id: keyRow.service_type_id ?? null,
            banner_url: keyRow.banner_url ?? null,
            whatsapp_group_name: keyRow.whatsapp_group_name ?? null,
            whatsapp_group_profile_url: keyRow.whatsapp_group_profile_url ?? null,
          };
        }),
        error: null,
      };
    }

    const missingColumn = getMissingSchemaColumn(error);
    if (!missingColumn || !columns.includes(missingColumn as (typeof OPTIONAL_KEY_COLUMNS)[number])) {
      return { data: null, error };
    }

    columns = columns.filter((column) => column !== missingColumn);
  }
}

async function insertAccessKey(payload: Record<string, unknown>) {
  const insertPayload = { ...payload };

  while (true) {
    const { data, error } = await admin()
      .from("access_keys")
      .insert(insertPayload)
      .select()
      .single();

    if (!error) {
      const createdKey = data as unknown as AccessKeyListRow;
      return {
        data: {
          ...createdKey,
          banner_url: createdKey.banner_url ?? null,
          whatsapp_group_name: createdKey.whatsapp_group_name ?? null,
          whatsapp_group_profile_url: createdKey.whatsapp_group_profile_url ?? null,
        },
        error: null,
      };
    }

    const missingColumn = getMissingSchemaColumn(error);
    if (!missingColumn || !(missingColumn in insertPayload)) {
      return { data: null, error };
    }

    delete insertPayload[missingColumn];
  }
}

export async function GET() {
  const { data, error } = await listAccessKeys();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const { name, role, formFields, formPages, serviceTypeId, bannerUrl, whatsappGroupName, whatsappGroupProfileUrl } = await request.json();
    if (!name || !role) return NextResponse.json({ error: "Champs manquants" }, { status: 400 });

    const key = crypto.randomUUID().replace(/-/g, "");

    const flatFields = formPages
      ? (formPages as { fields: object[] }[]).flatMap((p) => p.fields)
      : (formFields ?? []);

    const { data, error } = await insertAccessKey({
      key,
      name,
      role,
      form_fields: flatFields,
      form_pages: formPages ?? [],
      service_type_id: serviceTypeId ?? null,
      banner_url: bannerUrl ?? null,
      whatsapp_group_name: whatsappGroupName ?? null,
      whatsapp_group_profile_url: whatsappGroupProfileUrl ?? null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ key: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();
  const { error } = await admin().from("access_keys").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
