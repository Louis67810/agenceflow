import { NextRequest, NextResponse } from "next/server";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data, error } = await supabase.from("cold_call_scripts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ scripts: data ?? [] });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { data, error } = await supabase.from("cold_call_scripts").insert({ user_id: user.id, name: body.name || "Nouvelle accroche", content: body.content || "Bonjour {{prenom}}, je vous appelle au sujet de {{entreprise}}." }).select().single();
    if (error) throw error;
    return NextResponse.json({ script: data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
