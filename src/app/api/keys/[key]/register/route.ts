import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ key: string }> }
) {
  const { key } = await context.params;
  const { email, password } = await request.json();

  if (!email || !password)
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });

  // Vérifie que la clé existe
  const { data: keyRecord } = await admin()
    .from("access_keys")
    .select("id")
    .eq("key", key)
    .single();

  if (!keyRecord)
    return NextResponse.json({ error: "Lien invalide." }, { status: 404 });

  // Crée le compte sans confirmation email
  const { error: createError } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    const alreadyExists =
      createError.message.includes("already registered") ||
      createError.message.includes("already been registered");
    return NextResponse.json(
      { error: alreadyExists ? "already_exists" : createError.message },
      { status: alreadyExists ? 409 : 400 }
    );
  }

  return NextResponse.json({ success: true });
}
