import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { name, email, password } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
  }

  // Client admin avec la service role key (côté serveur uniquement)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Vérifie qu'il n'y a pas déjà un admin (sécurité)
  const { data: existingAdmins } = await supabaseAdmin
    .from("agency_profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1);

  if (existingAdmins && existingAdmins.length > 0) {
    return NextResponse.json(
      { error: "Un compte admin existe déjà. Connectez-vous sur /login." },
      { status: 403 }
    );
  }

  // Crée le compte sans confirmation email (email_confirm: true = déjà confirmé)
  const { data: authData, error: createError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // ← contourne la confirmation email
      user_metadata: { name, role: "admin" },
    });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const userId = authData.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }

  // Crée le profil admin
  await supabaseAdmin
    .from("agency_profiles")
    .insert({ id: userId, role: "admin", name, email });

  return NextResponse.json({ success: true });
}
