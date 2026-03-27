import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const { data, error } = await admin()
      .from("forms")
      .select("id, name, pages, created_at")
      .order("created_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ forms: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    const defaultPage = {
      id: crypto.randomUUID().replace(/-/g, ""),
      title: "Page 1",
      fields: [],
    };
    const { data, error } = await admin()
      .from("forms")
      .insert({ name: name || "Nouveau formulaire", pages: [defaultPage] })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ form: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
