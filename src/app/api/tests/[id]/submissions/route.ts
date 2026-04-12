import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("test_submissions")
      .select("*")
      .eq("test_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ submissions: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Assign a test to a designer (admin creates the submission slot)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token ?? undefined);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Get test deadline_days
    const { data: test } = await supabase
      .from("freelancer_tests")
      .select("deadline_days")
      .eq("id", id)
      .single();

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + (test?.deadline_days ?? 7));

    const { data, error } = await supabase
      .from("test_submissions")
      .insert({
        test_id: id,
        designer_id: body.designer_id,
        designer_email: body.designer_email,
        designer_name: body.designer_name,
        status: "pending",
        deadline: deadline.toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ submission: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
