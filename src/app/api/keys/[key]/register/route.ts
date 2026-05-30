import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

type AccessRole = "admin" | "client" | "designer" | "developer";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getProfileRole(role?: string | null) {
  if (role === "admin") return "admin";
  if (role === "designer" || role === "developer") return "designer";
  return "client";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  const { data: keyRecord } = await admin()
    .from("access_keys")
    .select("id, role, name")
    .eq("key", key)
    .single();

  if (!keyRecord) {
    return NextResponse.json({ error: "Lien invalide." }, { status: 404 });
  }

  const accessRole = (keyRecord.role ?? "client") as AccessRole;
  const profileRole = getProfileRole(accessRole);
  const name = keyRecord.name ?? email.split("@")[0];

  const { data: authData, error: createError } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: profileRole },
    user_metadata: { name, role: profileRole, access_role: accessRole },
  });

  if (createError) {
    const alreadyExists =
      createError.message.includes("already registered")
      || createError.message.includes("already been registered");

    return NextResponse.json(
      { error: alreadyExists ? "already_exists" : createError.message },
      { status: alreadyExists ? 409 : 400 }
    );
  }

  if (authData.user?.id) {
    const { error: profileError } = await admin()
      .from("agency_profiles")
      .upsert({
        id: authData.user.id,
        email,
        name,
        role: profileRole,
      }, { onConflict: "id" });

    if (profileError) {
      return NextResponse.json(
        { error: `Compte cree, mais profil non cree : ${profileError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
