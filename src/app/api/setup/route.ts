import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Champs manquants." }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        {
          error:
            "Variable SUPABASE_SERVICE_ROLE_KEY manquante. Ajoute-la dans Vercel → Settings → Environment Variables, puis redéploie.",
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Crée le compte avec email déjà confirmé (bypass total)
    const { data: authData, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: "admin" },
      });

    if (createError) {
      return NextResponse.json(
        {
          error:
            createError.message === "User already registered"
              ? "Un compte existe déjà avec cet email. Supprime-le dans Supabase → Authentication → Users puis réessaie."
              : createError.message,
        },
        { status: 400 }
      );
    }

    // Profil admin (best effort — la table peut ne pas exister encore)
    if (authData.user?.id) {
      await supabaseAdmin
        .from("agency_profiles")
        .insert({ id: authData.user.id, role: "admin", name, email })
        .then(() => null)
        .catch(() => null);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur serveur : " + String(err) },
      { status: 500 }
    );
  }
}
