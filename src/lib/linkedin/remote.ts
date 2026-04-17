"use client";

import type { LinkedInPost } from "@/types/linkedin";

export async function fetchRemoteLinkedInPosts(): Promise<LinkedInPost[]> {
  const res = await fetch("/api/linkedin/posts-store", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Impossible de charger les posts LinkedIn.");
  return (data.posts ?? []) as LinkedInPost[];
}

export async function saveRemoteLinkedInPosts(posts: LinkedInPost[], replace = true): Promise<void> {
  const res = await fetch("/api/linkedin/posts-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ posts, replace }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Impossible de sauvegarder les posts LinkedIn.");
}
