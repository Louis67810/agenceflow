import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("message_templates")
      .select("id, source_filter, channel, sector_filter, segment_key, subject, content, variant_label, variant_group, sent_count, open_count, reply_count, score, is_exploration:sent_count, ai_hypothesis, active, deprecated, created_at")
      .eq("active", true)
      .eq("deprecated", false)
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Calculer is_exploration côté serveur (sent_count < min_sample_size)
    const { data: configs } = await supabase.from("leads_config").select("key, value").eq("key", "min_sample_size");
    const minSamples = parseInt(configs?.[0]?.value ?? "5");

    const templates = (data ?? []).map((t) => ({
      ...t,
      is_exploration: (t.sent_count as number) < minSamples,
    }));

    return NextResponse.json({ templates });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
