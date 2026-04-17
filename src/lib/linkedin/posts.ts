"use client";

import type { LinkedInPost, LinkedInPostAnalytics } from "@/types/linkedin";

export const LINKEDIN_POSTS_STORAGE_KEY = "linkedin_posts";

export const EMPTY_ANALYTICS: LinkedInPostAnalytics = {
  impressions: 0,
  reach: 0,
  profileViews: 0,
  followersGained: 0,
  socialEngagement: 0,
  reactions: 0,
  comments: 0,
  reposts: 0,
  saves: 0,
  sends: 0,
  linkClicks: 0,
  customButtonClicks: 0,
  engagementRate: 0,
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeAnalytics(analytics?: Partial<LinkedInPostAnalytics>): LinkedInPostAnalytics {
  return {
    ...EMPTY_ANALYTICS,
    ...analytics,
    impressions: toNumber(analytics?.impressions),
    reach: toNumber(analytics?.reach),
    profileViews: toNumber(analytics?.profileViews),
    followersGained: toNumber(analytics?.followersGained),
    socialEngagement: toNumber(analytics?.socialEngagement),
    reactions: toNumber(analytics?.reactions),
    comments: toNumber(analytics?.comments),
    reposts: toNumber(analytics?.reposts),
    saves: toNumber(analytics?.saves),
    sends: toNumber(analytics?.sends),
    linkClicks: toNumber(analytics?.linkClicks),
    customButtonClicks: toNumber(analytics?.customButtonClicks),
    engagementRate: toNumber(analytics?.engagementRate),
  };
}

export function normalizePost(post: LinkedInPost): LinkedInPost {
  const analytics = normalizeAnalytics({
    ...post.analytics,
    postUrl: post.analytics?.postUrl ?? post.postUrl,
    impressions: post.analytics?.impressions ?? post.impressions ?? 0,
    comments: post.analytics?.comments ?? post.comments ?? 0,
    reactions: post.analytics?.reactions ?? post.likes ?? 0,
  });

  const likes = analytics.reactions;
  const comments = analytics.comments;
  const impressions = analytics.impressions;

  return {
    ...post,
    likes,
    comments,
    impressions,
    postUrl: analytics.postUrl ?? post.postUrl,
    analytics,
  };
}

export function normalizePosts(posts: LinkedInPost[]): LinkedInPost[] {
  return posts.map(normalizePost);
}

export function loadLinkedInPosts(): LinkedInPost[] {
  try {
    const raw = localStorage.getItem(LINKEDIN_POSTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LinkedInPost[];
    return normalizePosts(parsed);
  } catch {
    return [];
  }
}

export function saveLinkedInPosts(posts: LinkedInPost[]) {
  localStorage.setItem(LINKEDIN_POSTS_STORAGE_KEY, JSON.stringify(normalizePosts(posts)));
}

export function computeLinkedInPostScore(post: LinkedInPost): number {
  const analytics = normalizeAnalytics(post.analytics);
  const impressionsBase = analytics.impressions > 0 ? analytics.impressions / 100 : post.impressions / 100;
  return (
    impressionsBase +
    analytics.reactions * 2 +
    analytics.comments * 4 +
    analytics.reposts * 5 +
    analytics.saves * 3 +
    analytics.linkClicks * 2 +
    analytics.profileViews * 1.5 +
    analytics.followersGained * 4
  );
}

export function mergePostAnalytics(post: LinkedInPost, analyticsPatch: Partial<LinkedInPostAnalytics>): LinkedInPost {
  const analytics = normalizeAnalytics({
    ...post.analytics,
    ...analyticsPatch,
    importedAt: analyticsPatch.importedAt ?? post.analytics?.importedAt ?? new Date().toISOString(),
  });

  return normalizePost({
    ...post,
    postUrl: analytics.postUrl ?? post.postUrl,
    likes: analytics.reactions,
    comments: analytics.comments,
    impressions: analytics.impressions,
    analytics,
    status: post.status === "draft" ? "published" : post.status,
    publishedAt: post.publishedAt ?? (
      analytics.publishedDate
        ? new Date(`${analytics.publishedDate}T${analytics.publishedTime || "12:00"}:00`).toISOString()
        : new Date().toISOString()
    ),
  });
}

export function findPostByAnalytics(posts: LinkedInPost[], analytics: Partial<LinkedInPostAnalytics>): LinkedInPost | null {
  const normalizedUrl = analytics.postUrl?.trim();
  if (normalizedUrl) {
    const byUrl = posts.find((post) => post.postUrl?.trim() === normalizedUrl || post.analytics?.postUrl?.trim() === normalizedUrl);
    if (byUrl) return byUrl;
  }

  if (analytics.publishedDate && analytics.publishedTime) {
    const targetPrefix = `${analytics.publishedDate}T${analytics.publishedTime}`;
    const byDate = posts.find((post) => post.publishedAt?.startsWith(targetPrefix));
    if (byDate) return byDate;
  }

  return null;
}

export function createImportedAnalyticsPost(analytics: Partial<LinkedInPostAnalytics>): LinkedInPost {
  const normalized = normalizeAnalytics({
    ...analytics,
    importedAt: analytics.importedAt ?? new Date().toISOString(),
  });

  const publishedAt = normalized.publishedDate
    ? new Date(`${normalized.publishedDate}T${normalized.publishedTime || "12:00"}:00`).toISOString()
    : new Date().toISOString();

  return normalizePost({
    id: crypto.randomUUID(),
    content: normalized.postUrl || "Post importé depuis LinkedIn",
    type: "post",
    sourceType: "manual",
    sourceUrl: normalized.postUrl,
    sourceTitle: "Import analytics LinkedIn",
    styleName: "Import LinkedIn",
    scheduledAt: undefined,
    publishedAt,
    likes: normalized.reactions,
    comments: normalized.comments,
    impressions: normalized.impressions,
    postUrl: normalized.postUrl,
    analytics: normalized,
    status: "published",
    tags: ["analytics"],
    createdAt: new Date().toISOString(),
  });
}
