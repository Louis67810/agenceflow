import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface StyleExampleRow {
  id: string;
  style_id: string;
  content: string;
  created_at: string;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function lexicalScore(query: string, text: string): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  const textTokens = tokenize(text);
  let matches = 0;
  for (const token of textTokens) {
    if (queryTokens.has(token)) matches += 1;
  }
  return matches / queryTokens.size;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function rankExamplesBySimilarity(
  examples: StyleExampleRow[],
  query: string
): Promise<StyleExampleRow[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return examples;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return [...examples].sort(
      (a, b) => lexicalScore(trimmedQuery, b.content) - lexicalScore(trimmedQuery, a.content)
    );
  }

  const inputs = [trimmedQuery, ...examples.map((example) => example.content.slice(0, 4000))];
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: inputs,
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    return [...examples].sort(
      (a, b) => lexicalScore(trimmedQuery, b.content) - lexicalScore(trimmedQuery, a.content)
    );
  }

  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const vectors = payload.data?.map((entry) => entry.embedding ?? []) ?? [];
  const queryVector = vectors[0] ?? [];

  return [...examples]
    .map((example, index) => ({
      example,
      score: cosineSimilarity(queryVector, vectors[index + 1] ?? []),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.example);
}

// GET /api/linkedin/style-examples?styleId=xxx
export async function GET(req: NextRequest) {
  try {
    const styleId = req.nextUrl.searchParams.get("styleId");
    const queryText = req.nextUrl.searchParams.get("query") ?? "";
    const supabase = await createClient();

    let query = supabase
      .from("linkedin_style_examples")
      .select("*")
      .order("created_at", { ascending: false });

    if (styleId) {
      query = query.eq("style_id", styleId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const ranked = await rankExamplesBySimilarity((data ?? []) as StyleExampleRow[], queryText);
    return NextResponse.json({ examples: ranked });
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

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("linkedin_style_examples")
      .insert({ style_id: styleId, content: content.trim() })
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
