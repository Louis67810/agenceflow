import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LinkedInPost } from "@/types/linkedin";

interface StoredLinkedInPostRow {
  client_post_id: string;
  content: string;
  type: "post" | "carousel";
  slides: string[] | null;
  source_type: "manual" | "url" | "youtube" | "idea";
  source_url: string | null;
  source_title: string | null;
  style_id: string | null;
  style_name: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  likes: number;
  comments: number;
  impressions: number;
  post_url: string | null;
  analytics: unknown;
  status: "draft" | "scheduled" | "published";
  tags: string[] | null;
  created_at: string;
  updated_at?: string;
}

function rowToPost(row: StoredLinkedInPostRow): LinkedInPost {
  return {
    id: row.client_post_id,
    content: row.content,
    type: row.type,
    slides: row.slides ?? undefined,
    sourceType: row.source_type,
    sourceUrl: row.source_url ?? undefined,
    sourceTitle: row.source_title ?? undefined,
    styleId: row.style_id ?? undefined,
    styleName: row.style_name ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    impressions: row.impressions ?? 0,
    postUrl: row.post_url ?? undefined,
    analytics: (row.analytics as LinkedInPost["analytics"]) ?? undefined,
    status: row.status,
    tags: row.tags ?? [],
    createdAt: row.created_at,
  };
}

function postToRow(userId: string, post: LinkedInPost) {
  return {
    user_id: userId,
    client_post_id: post.id,
    content: post.content,
    type: post.type,
    slides: post.slides ?? null,
    source_type: post.sourceType,
    source_url: post.sourceUrl ?? null,
    source_title: post.sourceTitle ?? null,
    style_id: post.styleId ?? null,
    style_name: post.styleName ?? null,
    scheduled_at: post.scheduledAt ?? null,
    published_at: post.publishedAt ?? null,
    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
    impressions: post.impressions ?? 0,
    post_url: post.postUrl ?? null,
    analytics: post.analytics ?? null,
    status: post.status,
    tags: post.tags ?? [],
    created_at: post.createdAt,
    updated_at: new Date().toISOString(),
  };
}

async function getAuthenticatedUser() {
  return getAuthenticatedUserFromRequest();
}

async function getAuthenticatedUserFromRequest(req?: NextRequest) {
  const supabase = await createClient();
  const token = req?.headers.get("Authorization")?.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token ?? undefined);
  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("linkedin_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ posts: (data ?? []).map((row) => rowToPost(row as StoredLinkedInPostRow)) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as { posts?: LinkedInPost[]; replace?: boolean };
    const posts = Array.isArray(body.posts) ? body.posts : [];

    if (posts.length > 0) {
      const payload = posts.map((post) => postToRow(user.id, post));
      const { error } = await supabase
        .from("linkedin_posts")
        .upsert(payload, { onConflict: "user_id,client_post_id" });
      if (error) throw error;
    }

    if (body.replace) {
      const ids = posts.map((post) => post.id);
      let query = supabase.from("linkedin_posts").delete().eq("user_id", user.id);
      if (ids.length > 0) query = query.not("client_post_id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`);
      const { error } = await query;
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
