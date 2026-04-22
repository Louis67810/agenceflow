"use client";

import type { LinkedInPost, LinkedInPostAnalytics } from "@/types/linkedin";

export const LINKEDIN_POSTS_STORAGE_KEY = "linkedin_posts";

export const EMPTY_ANALYTICS: LinkedInPostAnalytics = {
  format: "text",
  topic: "",
  mediaPreviewUrl: undefined,
  mediaPreviewKind: "none",
  mediaFileName: undefined,
  mediaStorageBytes: 0,
  autoRecycleSourcePostId: undefined,
  autoRecycleCreatedAt: undefined,
  videoViews: 0,
  watchTime: "",
  averageWatchTime: "",
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
  demographics: [],
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
    videoViews: toNumber(analytics?.videoViews),
    watchTime: analytics?.watchTime ?? "",
    averageWatchTime: analytics?.averageWatchTime ?? "",
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
    demographics: Array.isArray(analytics?.demographics) ? analytics.demographics : [],
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

export function clearLinkedInPostsLocal() {
  localStorage.removeItem(LINKEDIN_POSTS_STORAGE_KEY);
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

export function getTopQuartilePublishedPosts(posts: LinkedInPost[]): LinkedInPost[] {
  const published = normalizePosts(posts).filter((post) => post.status === "published");
  if (published.length === 0) return [];
  const ranked = [...published].sort(
    (a, b) => computeLinkedInPostScore(b) - computeLinkedInPostScore(a)
  );
  const count = Math.max(1, Math.ceil(ranked.length * 0.25));
  return ranked.slice(0, count);
}

export function ensureAutoRecyclePosts(
  posts: LinkedInPost[],
  options: {
    enabled: boolean;
    delayDays: number;
    spacingDays?: number;
    now?: Date;
  }
): LinkedInPost[] {
  const normalizedPosts = normalizePosts(posts);
  if (!options.enabled) return normalizedPosts;

  const delayDays = Number.isFinite(options.delayDays) && options.delayDays > 0 ? options.delayDays : 120;
  const spacingDays = Number.isFinite(options.spacingDays) && (options.spacingDays ?? 0) > 0 ? options.spacingDays! : 7;
  const now = options.now ?? new Date();
  const getPublishedBaseDate = (post: LinkedInPost): Date | null => {
    if (post.analytics?.publishedDate) {
      const date = new Date(`${post.analytics.publishedDate}T${post.analytics.publishedTime || "12:00"}:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (post.publishedAt) {
      const date = new Date(post.publishedAt);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
  };
  const buildScheduledDate = (post: LinkedInPost, index = 0): Date | null => {
    const baseDate = getPublishedBaseDate(post);
    if (!baseDate) return null;
    const scheduledDate = new Date(baseDate);
    scheduledDate.setDate(scheduledDate.getDate() + delayDays + index * spacingDays);
    return scheduledDate;
  };
  const sourcePostsById = new Map(normalizedPosts.map((post) => [post.id, post]));
  const recalibratedPosts = normalizedPosts.map((post) => {
    const sourceId = post.analytics?.autoRecycleSourcePostId;
    if (!sourceId) return post;
    const sourcePost = sourcePostsById.get(sourceId);
    if (!sourcePost) return post;
    const scheduledDate = buildScheduledDate(sourcePost);
    if (!scheduledDate || scheduledDate <= now) return post;
    const nextScheduledAt = scheduledDate.toISOString();
    if (post.scheduledAt === nextScheduledAt) return post;
    return normalizePost({ ...post, scheduledAt: nextScheduledAt });
  });
  const topPosts = getTopQuartilePublishedPosts(recalibratedPosts);
  const existingSourceIds = new Set(
    recalibratedPosts
      .map((post) => post.analytics?.autoRecycleSourcePostId)
      .filter((value): value is string => Boolean(value))
  );

  const createdPosts: LinkedInPost[] = [];

  for (const [index, post] of topPosts.entries()) {
    if (existingSourceIds.has(post.id)) continue;
    const scheduledDate = buildScheduledDate(post, index);
    if (!scheduledDate) continue;
    if (scheduledDate <= now) continue;

    createdPosts.push(
      normalizePost({
        ...post,
        id: crypto.randomUUID(),
        status: "scheduled",
        scheduledAt: scheduledDate.toISOString(),
        publishedAt: undefined,
        createdAt: now.toISOString(),
        analytics: normalizeAnalytics({
          ...post.analytics,
          autoRecycleSourcePostId: post.id,
          autoRecycleCreatedAt: now.toISOString(),
        }),
        tags: Array.from(new Set([...(post.tags ?? []), "auto-recycle"])),
      })
    );
  }

  if (createdPosts.length === 0) return recalibratedPosts;
  return normalizePosts([...createdPosts, ...recalibratedPosts]);
}

export function mergePostAnalytics(post: LinkedInPost, analyticsPatch: Partial<LinkedInPostAnalytics>): LinkedInPost {
  const analytics = normalizeAnalytics({
    ...post.analytics,
    ...analyticsPatch,
    importedAt: analyticsPatch.importedAt ?? post.analytics?.importedAt ?? new Date().toISOString(),
  });
  const analyticsPublishedAt = analytics.publishedDate
    ? new Date(`${analytics.publishedDate}T${analytics.publishedTime || "12:00"}:00`).toISOString()
    : undefined;

  return normalizePost({
    ...post,
    postUrl: analytics.postUrl ?? post.postUrl,
    likes: analytics.reactions,
    comments: analytics.comments,
    impressions: analytics.impressions,
    analytics,
    status: post.status === "draft" ? "published" : post.status,
    publishedAt: analyticsPublishedAt ?? post.publishedAt ?? new Date().toISOString(),
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

  if (analytics.publishedDate) {
    const byDay = posts.find((post) => post.publishedAt?.startsWith(analytics.publishedDate!));
    if (byDay) return byDay;
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
