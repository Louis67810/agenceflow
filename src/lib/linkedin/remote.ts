"use client";

import type { LinkedInPost } from "@/types/linkedin";
import { normalizePosts } from "@/lib/linkedin/posts";
import { getAccessToken } from "@/lib/supabase/client";

const PENDING_LINKEDIN_POSTS_SYNC_KEY = "linkedin_posts_pending_remote_sync";

interface PendingPostsSyncPayload {
  posts: LinkedInPost[];
  replace: boolean;
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function persistPendingPayload(payload: PendingPostsSyncPayload) {
  if (!canUseStorage()) return;
  localStorage.setItem(PENDING_LINKEDIN_POSTS_SYNC_KEY, JSON.stringify(payload));
}

function readPendingPayload(): PendingPostsSyncPayload | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(PENDING_LINKEDIN_POSTS_SYNC_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingPostsSyncPayload;
    return {
      posts: normalizePosts(Array.isArray(parsed.posts) ? parsed.posts : []),
      replace: parsed.replace !== false,
    };
  } catch {
    return null;
  }
}

function clearPendingPayload(expectedPayload?: PendingPostsSyncPayload) {
  if (!canUseStorage()) return;
  if (!expectedPayload) {
    localStorage.removeItem(PENDING_LINKEDIN_POSTS_SYNC_KEY);
    return;
  }

  const current = readPendingPayload();
  if (!current) return;
  if (JSON.stringify(current) === JSON.stringify(expectedPayload)) {
    localStorage.removeItem(PENDING_LINKEDIN_POSTS_SYNC_KEY);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function fetchRemoteLinkedInPosts(): Promise<LinkedInPost[]> {
  const res = await fetch("/api/linkedin/posts-store", {
    cache: "no-store",
    headers: await getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Impossible de charger les posts LinkedIn.");
  return normalizePosts((data.posts ?? []) as LinkedInPost[]);
}

export async function saveRemoteLinkedInPosts(posts: LinkedInPost[], replace = true): Promise<void> {
  const normalizedPosts = normalizePosts(posts);
  const res = await fetch("/api/linkedin/posts-store", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify({ posts: normalizedPosts, replace }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Impossible de sauvegarder les posts LinkedIn.");
}

export async function persistRemoteLinkedInPosts(posts: LinkedInPost[], replace = true): Promise<void> {
  const payload = {
    posts: normalizePosts(posts),
    replace,
  };

  persistPendingPayload(payload);

  try {
    await saveRemoteLinkedInPosts(payload.posts, payload.replace);
    clearPendingPayload(payload);
  } catch (error) {
    console.error("LinkedIn posts remote sync failed", error);
    throw error;
  }
}

export async function flushPendingRemoteLinkedInPosts(): Promise<void> {
  const pending = readPendingPayload();
  if (!pending) return;
  await persistRemoteLinkedInPosts(pending.posts, pending.replace);
}

export function clearPendingRemoteLinkedInPosts(): void {
  if (!canUseStorage()) return;
  localStorage.removeItem(PENDING_LINKEDIN_POSTS_SYNC_KEY);
}
