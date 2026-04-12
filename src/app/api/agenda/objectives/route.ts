import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("agenda_objectives")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Build tree structure
    const map = new Map<string, (typeof data)[0] & { children: typeof data }>();
    const roots: ((typeof data)[0] & { children: typeof data })[] = [];

    for (const obj of data ?? []) {
      map.set(obj.id, { ...obj, children: [] });
    }
    for (const obj of map.values()) {
      if (obj.parent_id && map.has(obj.parent_id)) {
        map.get(obj.parent_id)!.children.push(obj);
      } else {
        roots.push(obj);
      }
    }

    return NextResponse.json({ objectives: roots, flat: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { data, error } = await supabase
      .from("agenda_objectives")
      .insert({ ...body, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ objective: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
