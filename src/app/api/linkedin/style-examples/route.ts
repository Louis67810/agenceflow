import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface StyleExampleRow {
  id: string;
  style_id: string;
  content: string;
  embedding: number[] | null;
  created_at: string;
}

const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIM = 3072;

async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
      encoding_format: "float",
    }),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  return payload.data?.[0]?.embedding ?? null;
}

// GET /api/linkedin/style-examples?styleId=xxx&query=xxx
export async function GET(req: NextRequest) {
  try {
    const styleId = req.nextUrl.searchParams.get("styleId");
    const queryText = req.nextUrl.searchParams.get("query") ?? "";
    const supabase = await createClient();

    // If no query, return all examples for the style (fallback)
    if (!queryText.trim() || !styleId) {
      let query = supabase
        .from("linkedin_style_examples")
        .select("*")
        .order("created_at", { ascending: false });

      if (styleId) {
        query = query.eq("style_id", styleId);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return NextResponse.json({ examples: (data ?? []) as StyleExampleRow[] });
    }

    // Generate embedding for the query
    const queryEmbedding = await getEmbedding(queryText);

    if (!queryEmbedding) {
      // Fallback: lexical search without embedding
      const { data, error } = await supabase
        .from("linkedin_style_examples")
        .select("*")
        .eq("style_id", styleId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return NextResponse.json({ examples: (data ?? []) as StyleExampleRow[] });
    }

    // Vector search using Supabase function
    const { data, error } = await supabase.rpc("search_style_examples", {
      query_embedding: queryEmbedding,
      match_style_id: styleId,
      match_limit: 5,
    });

    if (error) {
      // Fallback if RPC fails
      const { data: fallbackData } = await supabase
        .from("linkedin_style_examples")
        .select("*")
        .eq("style_id", styleId)
        .order("created_at", { ascending: false })
        .limit(10);

      return NextResponse.json({ examples: (fallbackData ?? []) as StyleExampleRow[] });
    }

    return NextResponse.json({ examples: (data ?? []) as StyleExampleRow[] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/linkedin/style-examples
// Body: { styleId, content }
export async function POST(req: NextRequest) {
  try {
    const { styleId, content } = await req.json();

    if (!styleId?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "styleId et content requis" },
        { status: 400 }
      );
    }

    // Generate embedding for the example
    const embedding = await getEmbedding(content.trim());

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("linkedin_style_examples")
      .insert({
        style_id: styleId,
        content: content.trim(),
        embedding: embedding,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ example: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/linkedin/style-examples?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id requis" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("linkedin_style_examples")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
