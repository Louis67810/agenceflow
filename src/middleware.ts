import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const path = request.nextUrl.pathname;

  // Routes publiques (pas besoin d'être connecté)
  if (path.startsWith("/setup")) {
    return supabaseResponse;
  }

  if (path.startsWith("/login")) {
    if (user) {
      // Récupère le rôle pour rediriger vers le bon espace
      const { data: profile } = await supabase
        .from("agency_profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = profile?.role ?? "admin";
      return NextResponse.redirect(new URL(`/${role}`, request.url));
    }
    return supabaseResponse;
  }

  // Routes protégées : rediriger vers /login si pas connecté
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
