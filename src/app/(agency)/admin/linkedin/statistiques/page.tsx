"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import { Activity, BarChart3, Calendar, ChevronDown, Eye, GitCompare, Info, Link2, MessageCircle, MousePointerClick, Repeat2, Search, Send, SlidersHorizontal, ThumbsUp, Trash2, Upload, X } from "lucide-react";
import {
  DEFAULT_STYLES,
  type LinkedInPost,
  type LinkedInPostAnalytics,
  type LinkedInStyle,
} from "@/types/linkedin";
import {
  createImportedAnalyticsPost,
  findPostByAnalytics,
  loadLinkedInPosts,
  normalizeAnalytics,
  normalizePost,
  normalizePosts,
  saveLinkedInPosts,
} from "@/lib/linkedin/posts";
import {
  fetchRemoteLinkedInPosts,
  flushPendingRemoteLinkedInPosts,
  persistRemoteLinkedInPosts,
} from "@/lib/linkedin/remote";
import {
  fetchRemoteLinkedInWorkspace,
  loadLinkedInWorkspaceCache,
} from "@/lib/linkedin/workspace";

const jk: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };
const cardShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";
const previewShadow = "0px 30px 12px rgba(0,0,0,0.01), 0px 17px 10px rgba(0,0,0,0.03), 0px 7px 7px rgba(0,0,0,0.04), 0px 2px 4.4px rgba(0,0,0,0.05)";
const sortShadow = "0px 4.71px 3px rgba(0,0,0,0.02), 0px 2.12px 2.12px rgba(0,0,0,0.03), 0px 0.47px 1.18px rgba(0,0,0,0.03)";

type EditableAnalytics = Omit<LinkedInPostAnalytics, "importedAt" | "sourceFileName">;
type PostFormat = NonNullable<LinkedInPostAnalytics["format"]>;
type SortKey = "date" | "impressions" | "reactions" | "comments" | "linkClicks";
type StatsTab = "posts" | "data";
type PeriodKey = "30" | "90" | "365" | "all";
type DataMetricKey = "impressions" | "reactions" | "comments" | "engagement" | "linkClicks" | "saves" | "sends" | "reposts" | "profileViews" | "followersGained";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "date", label: "Plus récent" },
  { key: "impressions", label: "Plus d'impressions" },
  { key: "reactions", label: "Plus de réactions" },
  { key: "comments", label: "Plus de commentaires" },
  { key: "linkClicks", label: "Plus de clics sur le lien" },
];

const DATA_METRICS: Array<{ key: DataMetricKey; label: string; icon: typeof Activity }> = [
  { key: "impressions", label: "Impressions", icon: Eye },
  { key: "reactions", label: "Likes", icon: ThumbsUp },
  { key: "comments", label: "Commentaires", icon: MessageCircle },
  { key: "engagement", label: "Engagement", icon: Activity },
  { key: "linkClicks", label: "Clics lien", icon: MousePointerClick },
  { key: "saves", label: "Enregistrements", icon: BarChart3 },
  { key: "sends", label: "Envois LinkedIn", icon: Send },
  { key: "reposts", label: "Republications", icon: Repeat2 },
  { key: "profileViews", label: "Vues profil", icon: Eye },
  { key: "followersGained", label: "Abonnés gagnés", icon: Activity },
];

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string; days: number | null }> = [
  { key: "30", label: "30 derniers jours", days: 30 },
  { key: "90", label: "90 derniers jours", days: 90 },
  { key: "365", label: "12 derniers mois", days: 365 },
  { key: "all", label: "Toute la periode", days: null },
];

const figmaInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 42,
  border: "1px solid rgba(18,26,46,0.13)",
  borderRadius: 10,
  background: "#fff",
  padding: "0 12px",
  fontFamily: '"Inter", sans-serif',
  fontSize: 13,
  fontWeight: 500,
  color: "#121a2e",
  outline: "none",
  boxSizing: "border-box",
};

const figmaLabelStyle: CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontFamily: '"Inter", sans-serif',
  fontSize: 13,
  fontWeight: 500,
  color: "rgba(18,26,46,0.68)",
};

const loginButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  padding: "14px 24px",
  background: "linear-gradient(146.81deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
  color: "#fff",
  border: "1px solid #2f4d9d",
  borderRadius: 10,
  fontSize: 16,
  fontWeight: 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "inset 0px -3px 0px 0px #0e42c8, inset 0px 2px 6px 4px rgba(0,0,0,0.08), inset 0px 3px 0px 0px rgba(255,255,255,0.5), 0px 4px 12px rgba(1,71,255,0.25)",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

const dataCardStyle: CSSProperties = {
  border: "1px solid #e1e4e8",
  borderRadius: 20,
  background: "#fff",
  boxShadow: cardShadow,
  boxSizing: "border-box",
};

const dataMutedText: CSSProperties = {
  fontFamily: '"Inter", sans-serif',
  fontSize: 13,
  fontWeight: 500,
  color: "rgba(18,26,46,0.58)",
};

const formatChartColors: Record<string, string> = {
  Texte: "#2D6EFD",
  Image: "#BBCCFC",
  Carrousel: "#E1E9FD",
  Video: "#D3D2D2",
  Vidéo: "#D3D2D2",
  Document: "#E1E9FD",
  Sondage: "#BBCCFC",
  Autre: "#D3D2D2",
};

function emptyEditableAnalytics(): EditableAnalytics {
  return {
    postUrl: "",
    publishedDate: "",
    publishedTime: "",
    linkUrl: "",
    format: undefined,
    topic: "",
    mediaPreviewUrl: "",
    mediaPreviewKind: "none",
    mediaFileName: "",
    mediaStorageBytes: 0,
    autoRecycleSourcePostId: "",
    autoRecycleCreatedAt: "",
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
}

function toInputValue(value: string | number | undefined) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function formatNumber(value: number) {
  return value.toLocaleString("fr-FR");
}

function formatPreviewDate(post: LinkedInPost) {
  const analytics = normalizeAnalytics(post.analytics);
  const raw = analytics.publishedDate || post.publishedAt?.slice(0, 10);
  if (!raw) return "Date inconnue";
  try {
    return new Date(`${raw}T12:00:00`)
      .toLocaleDateString("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" })
      .replaceAll("/", " - ");
  } catch {
    return raw;
  }
}

function getPublishedSortDate(post: LinkedInPost) {
  const analytics = normalizeAnalytics(post.analytics);
  if (analytics.publishedDate) return `${analytics.publishedDate}T${analytics.publishedTime || "12:00"}:00`;
  return post.publishedAt || post.createdAt;
}

function buildPostTitle(post: LinkedInPost) {
  const words = post.content.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return "Post LinkedIn importé";
  const title = words.join(" ");
  return title.length > 40 ? `${title.slice(0, 40).trim()}...` : title;
}

function getPostContentFallback(post: LinkedInPost) {
  if (post.content && !post.content.startsWith("http")) return post.content;
  return "";
}

function getMetricTotal(posts: LinkedInPost[], key: "impressions" | "reactions" | "comments" | "linkClicks") {
  return posts.reduce((sum, post) => sum + (normalizeAnalytics(post.analytics)[key] ?? 0), 0);
}

function hasImportedAnalytics(post: LinkedInPost) {
  return Boolean(normalizeAnalytics(post.analytics).importedAt);
}

function getAnalyticsDate(post: LinkedInPost) {
  const analytics = normalizeAnalytics(post.analytics);
  const raw = analytics.publishedDate || post.publishedAt?.slice(0, 10) || post.createdAt?.slice(0, 10);
  const date = new Date(`${raw}T${analytics.publishedTime || "12:00"}:00`);
  return Number.isNaN(date.getTime()) ? new Date(post.createdAt) : date;
}

function getEngagementValue(post: LinkedInPost) {
  const analytics = normalizeAnalytics(post.analytics);
  return analytics.socialEngagement || analytics.reactions + analytics.comments + analytics.reposts + analytics.saves + analytics.sends + analytics.linkClicks;
}

function getDataMetricValue(post: LinkedInPost, key: DataMetricKey) {
  const analytics = normalizeAnalytics(post.analytics);
  if (key === "engagement") return getEngagementValue(post);
  return analytics[key] ?? 0;
}

function getFormatLabel(format?: LinkedInPostAnalytics["format"]) {
  const labels: Record<PostFormat, string> = {
    text: "Texte",
    image: "Image",
    carousel: "Carrousel",
    video: "Vidéo",
    poll: "Sondage",
    document: "Document",
    other: "Autre",
  };
  return format ? labels[format] ?? "Autre" : "Autre";
}

function extractHook(content: string) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const clean = line.trim();
    if (!clean) {
      if (current.length > 0) {
        blocks.push(current.join(" "));
        current = [];
      }
      continue;
    }
    current.push(clean);
    if (current.join(" ").length > 180) break;
  }

  if (current.length > 0) blocks.push(current.join(" "));
  const hook = blocks.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
  if (!hook) return content.replace(/\s+/g, " ").trim().slice(0, 220);
  return hook.length > 260 ? `${hook.slice(0, 260).trim()}...` : hook;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentDelta(value: number, baseline: number) {
  if (!baseline) return 0;
  return ((value - baseline) / baseline) * 100;
}

function formatDelta(value: number) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

function getPeriodRange(days: number | null, offset = 0) {
  if (!days) return null;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() - days * offset);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function buildPdfPreviewDataUrl(fileName: string) {
  const safeName = fileName.replace(/[&<>"']/g, "").slice(0, 28);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="560" height="420" viewBox="0 0 560 420">
      <rect width="560" height="420" rx="28" fill="#f1f5f9"/>
      <rect x="58" y="42" width="444" height="336" rx="24" fill="#ffffff" stroke="#d8dee8" stroke-width="8"/>
      <rect x="92" y="88" width="118" height="148" rx="18" fill="#ef4444"/>
      <text x="151" y="174" text-anchor="middle" font-size="36" font-family="Arial" font-weight="700" fill="#ffffff">PDF</text>
      <rect x="238" y="108" width="210" height="18" rx="9" fill="#d6dce8"/>
      <rect x="238" y="148" width="178" height="16" rx="8" fill="#e5e9f1"/>
      <rect x="238" y="184" width="198" height="16" rx="8" fill="#e5e9f1"/>
      <text x="92" y="300" font-size="22" font-family="Arial" font-weight="700" fill="#121a2e">${safeName}</text>
      <text x="92" y="334" font-size="16" font-family="Arial" fill="#64748b">Aperçu compressé</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function compressImage(file: File): Promise<{ previewUrl: string; bytes: number }> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Impossible de lire l'image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image."));
    img.src = rawDataUrl;
  });

  const ratio = Math.min(420 / image.width, 420 / image.height, 1);
  const width = Math.max(96, Math.round(image.width * ratio));
  const height = Math.max(96, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const previewUrl = canvas.toDataURL("image/jpeg", 0.45);
  return { previewUrl, bytes: Math.round((previewUrl.length * 3) / 4) };
}

async function buildMediaPreview(file: File) {
  if (file.type.startsWith("image/")) {
    const compressed = await compressImage(file);
    return {
      previewUrl: compressed.previewUrl,
      previewKind: "image" as const,
      fileName: file.name,
      bytes: compressed.bytes,
    };
  }

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return {
      previewUrl: buildPdfPreviewDataUrl(file.name),
      previewKind: "pdf" as const,
      fileName: file.name,
      bytes: file.size,
    };
  }

  throw new Error("Seuls les images et les PDF sont supportés.");
}

function ReactionDots() {
  const reactions = [
    "/linkedin-reactions/like.png",
    "/linkedin-reactions/love.png",
    "/linkedin-reactions/support.png",
    "/linkedin-reactions/celebrate.png",
    "/linkedin-reactions/funny.png",
  ];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 8 }}>
      {reactions.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            border: "2px solid #fff",
            marginLeft: index === 0 ? 0 : -7,
            display: "inline-block",
            objectFit: "contain",
            background: "transparent",
          }}
        />
      ))}
    </span>
  );
}

function MediaSquare({ analytics }: { analytics: LinkedInPostAnalytics }) {
  return (
    <div
      style={{
        width: 76,
        height: 84,
        borderRadius: 5.4,
        border: "3px solid #fff",
        background: analytics.mediaPreviewUrl ? `url(${analytics.mediaPreviewUrl}) center / cover` : "#ccc",
        boxShadow: previewShadow,
        transform: "rotate(-1.83deg)",
        flexShrink: 0,
      }}
    />
  );
}

function styleCategoryLabel(style: LinkedInStyle) {
  const labels: Record<LinkedInStyle["category"], string> = {
    storytelling: "Storytelling",
    valeur: "Valeur / Liste",
    educatif: "Éducatif",
    viral: "Opinion forte",
    engagement: "Engagement",
    data: "Data / Chiffres",
    custom: "Personnalisé",
  };
  return labels[style.category] ?? style.category;
}

const STYLE_TAG_STYLES: Record<LinkedInStyle["category"], { bg: string; color: string; border: string }> = {
  storytelling: { bg: "#f1eaff", color: "#6236AA", border: "#d8c3ff" },
  valeur: { bg: "#e8f6ff", color: "#073e63", border: "#bfe2fa" },
  educatif: { bg: "#dcfaf5", color: "#0f766e", border: "#99f6e4" },
  viral: { bg: "#ffecec", color: "#c53030", border: "#fecaca" },
  engagement: { bg: "#fff0df", color: "#663b12", border: "#fed7aa" },
  data: { bg: "#eef2ff", color: "#3730a3", border: "#c7d2fe" },
  custom: { bg: "#f6f6f6", color: "#5f6673", border: "#d9dce2" },
};

function getStyleTagVisual(style?: LinkedInStyle, active = true) {
  if (!style || !active) return { bg: "#f3f4f6", color: "#6f7887", border: "#e1e4e8" };
  return STYLE_TAG_STYLES[style.category] ?? STYLE_TAG_STYLES.custom;
}

export default function LinkedInStatsPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [styles, setStyles] = useState<LinkedInStyle[]>(DEFAULT_STYLES);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditableAnalytics>(emptyEditableAnalytics());
  const [postContent, setPostContent] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortOpen, setSortOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
  const [hoveredSortKey, setHoveredSortKey] = useState<SortKey | null>(null);
  const [importDragActive, setImportDragActive] = useState(false);
  const [mediaDragActive, setMediaDragActive] = useState(false);
  const [pendingImportedAnalytics, setPendingImportedAnalytics] = useState<LinkedInPostAnalytics | null>(null);
  const [linkOverlayOpen, setLinkOverlayOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [showPendingCsvPosts, setShowPendingCsvPosts] = useState(false);
  const [activeTab, setActiveTab] = useState<StatsTab>("posts");
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30");
  const [dataMetric, setDataMetric] = useState<DataMetricKey>("reactions");
  const [dataMetricOpen, setDataMetricOpen] = useState(false);
  const [dataOverlay, setDataOverlay] = useState<{ title: string; body: string } | null>(null);
  const [hookQuery, setHookQuery] = useState("");
  const [compareHookQuery, setCompareHookQuery] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [dataStyleFilter, setDataStyleFilter] = useState("");

  useEffect(() => {
    const loaded = loadLinkedInPosts();
    const workspace = loadLinkedInWorkspaceCache();
    setPosts(loaded);
    setStyles(workspace.styles.length > 0 ? workspace.styles : DEFAULT_STYLES);

    void (async () => {
      try {
        await flushPendingRemoteLinkedInPosts();
        const [remotePosts, remoteWorkspace] = await Promise.all([
          fetchRemoteLinkedInPosts(),
          fetchRemoteLinkedInWorkspace(),
        ]);
        if (remotePosts.length > 0) {
          setPosts(remotePosts);
          saveLinkedInPosts(remotePosts);
        } else if (loaded.length > 0) {
          await persistRemoteLinkedInPosts(loaded, true);
        }
        setStyles(remoteWorkspace.workspace.styles.length > 0 ? remoteWorkspace.workspace.styles : DEFAULT_STYLES);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const postId = new URLSearchParams(window.location.search).get("postId");
    if (!postId || selectedPostId === postId) return;
    const post = posts.find((item) => item.id === postId);
    if (post) selectPost(post);
  }, [posts, selectedPostId]);

  const publishedPosts = useMemo(
    () => posts.filter((post) => post.status === "published" && hasImportedAnalytics(post)),
    [posts]
  );

  const pendingCsvPosts = useMemo(
    () => posts.filter((post) => post.status === "published" && !hasImportedAnalytics(post)),
    [posts]
  );

  const visiblePosts = useMemo(() => {
    const sorted = [...(showPendingCsvPosts ? pendingCsvPosts : publishedPosts)];
    if (sortBy === "date") {
      return sorted.sort((a, b) => {
        const aDate = getPublishedSortDate(a);
        const bDate = getPublishedSortDate(b);
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    }
    return sorted.sort((a, b) => {
      const aValue = normalizeAnalytics(a.analytics)[sortBy] ?? 0;
      const bValue = normalizeAnalytics(b.analytics)[sortBy] ?? 0;
      return bValue - aValue;
    });
  }, [pendingCsvPosts, publishedPosts, showPendingCsvPosts, sortBy]);

  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
  const totalImpressions = getMetricTotal(publishedPosts, "impressions");
  const totalReactions = getMetricTotal(publishedPosts, "reactions");
  const totalComments = getMetricTotal(publishedPosts, "comments");
  const totalLinkClicks = getMetricTotal(publishedPosts, "linkClicks");
  const canSave = Boolean((selectedPostId || pendingImportedAnalytics) && (postContent.trim() || pendingImportedAnalytics) && selectedStyleId && editor.format);
  const selectedPeriod = PERIOD_OPTIONS.find((period) => period.key === periodKey) ?? PERIOD_OPTIONS[0];
  const currentPeriodRange = useMemo(() => getPeriodRange(selectedPeriod.days, 0), [selectedPeriod.days]);
  const previousPeriodRange = useMemo(() => getPeriodRange(selectedPeriod.days, 1), [selectedPeriod.days]);
  const analyticsPeriodPosts = useMemo(() => {
    if (!currentPeriodRange) return publishedPosts;
    return publishedPosts.filter((post) => {
      const date = getAnalyticsDate(post);
      return date >= currentPeriodRange.start && date <= currentPeriodRange.end;
    });
  }, [currentPeriodRange, publishedPosts]);
  const previousAnalyticsPosts = useMemo(() => {
    if (!previousPeriodRange) return [];
    return publishedPosts.filter((post) => {
      const date = getAnalyticsDate(post);
      return date >= previousPeriodRange.start && date <= previousPeriodRange.end;
    });
  }, [previousPeriodRange, publishedPosts]);
  const analyticsPosts = useMemo(() => {
    if (!dataStyleFilter) return analyticsPeriodPosts;
    const style = styles.find((item) => item.id === dataStyleFilter);
    return analyticsPeriodPosts.filter((post) => post.styleId === dataStyleFilter || post.styleName === style?.name);
  }, [analyticsPeriodPosts, dataStyleFilter, styles]);
  const previousFilteredPosts = useMemo(() => {
    if (!dataStyleFilter) return previousAnalyticsPosts;
    const style = styles.find((item) => item.id === dataStyleFilter);
    return previousAnalyticsPosts.filter((post) => post.styleId === dataStyleFilter || post.styleName === style?.name);
  }, [dataStyleFilter, previousAnalyticsPosts, styles]);
  const buildTotals = (sourcePosts: LinkedInPost[]) => ({
    posts: sourcePosts.length,
    impressions: getMetricTotal(sourcePosts, "impressions"),
    reactions: getMetricTotal(sourcePosts, "reactions"),
    comments: getMetricTotal(sourcePosts, "comments"),
    linkClicks: getMetricTotal(sourcePosts, "linkClicks"),
    engagement: sourcePosts.reduce((sum, post) => sum + getEngagementValue(post), 0),
    saves: sourcePosts.reduce((sum, post) => sum + normalizeAnalytics(post.analytics).saves, 0),
    sends: sourcePosts.reduce((sum, post) => sum + normalizeAnalytics(post.analytics).sends, 0),
    reposts: sourcePosts.reduce((sum, post) => sum + normalizeAnalytics(post.analytics).reposts, 0),
    profileViews: sourcePosts.reduce((sum, post) => sum + normalizeAnalytics(post.analytics).profileViews, 0),
    followersGained: sourcePosts.reduce((sum, post) => sum + normalizeAnalytics(post.analytics).followersGained, 0),
    reach: sourcePosts.reduce((sum, post) => sum + normalizeAnalytics(post.analytics).reach, 0),
    engagementRate: average(sourcePosts.map((post) => normalizeAnalytics(post.analytics).engagementRate)),
  });
  const dataTotals = useMemo(() => buildTotals(analyticsPosts), [analyticsPosts]);
  const previousDataTotals = useMemo(() => buildTotals(previousFilteredPosts), [previousFilteredPosts]);
  const timeline = useMemo(() => {
    const byDay = new Map<string, { date: Date; value: number; posts: LinkedInPost[] }>();
    for (const post of analyticsPosts) {
      const date = getAnalyticsDate(post);
      const key = date.toISOString().slice(0, 10);
      const current = byDay.get(key) ?? { date, value: 0, posts: [] };
      current.value += getDataMetricValue(post, dataMetric);
      current.posts.push(post);
      byDay.set(key, current);
    }
    return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [analyticsPosts, dataMetric]);
  const formatDistribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const post of analyticsPosts) {
      const label = getFormatLabel(normalizeAnalytics(post.analytics).format);
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()].map(([label, count]) => ({ label, count, percent: analyticsPosts.length ? Math.round((count / analyticsPosts.length) * 100) : 0 }));
  }, [analyticsPosts]);
  const heatmap = useMemo(() => {
    const slots = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ total: 0, count: 0 })));
    for (const post of analyticsPosts) {
      const date = getAnalyticsDate(post);
      const day = (date.getDay() + 6) % 7;
      const hour = date.getHours();
      slots[day][hour].total += getEngagementValue(post);
      slots[day][hour].count += 1;
    }
    return slots.map((row) => row.map((slot) => slot.count ? slot.total / slot.count : 0));
  }, [analyticsPosts]);
  const bestTime = useMemo(() => {
    const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    let best = { day: 0, hour: 11, value: 0 };
    heatmap.forEach((row, day) => row.forEach((value, hour) => {
      if (value > best.value) best = { day, hour, value };
    }));
    const avgEngagement = average(analyticsPosts.map(getEngagementValue));
    return {
      label: `${String(best.hour).padStart(2, "0")}h00`,
      day: days[best.day],
      delta: percentDelta(best.value, avgEngagement),
    };
  }, [analyticsPosts, heatmap]);
  const hookStats = useMemo(() => {
    const globalImpressions = average(analyticsPosts.map((post) => normalizeAnalytics(post.analytics).impressions));
    const globalEngagement = average(analyticsPosts.map(getEngagementValue));
    const globalComments = average(analyticsPosts.map((post) => normalizeAnalytics(post.analytics).comments));
    const build = (query: string) => {
      const clean = query.trim().toLowerCase();
      const matches = clean
        ? analyticsPosts.filter((post) => extractHook(post.content).toLowerCase().includes(clean))
        : [];
      const impressions = average(matches.map((post) => normalizeAnalytics(post.analytics).impressions));
      const engagement = average(matches.map(getEngagementValue));
      const comments = average(matches.map((post) => normalizeAnalytics(post.analytics).comments));
      const styleCounts = new Map<string, number>();
      matches.forEach((post) => {
        const label = post.styleName || "Sans style";
        styleCounts.set(label, (styleCounts.get(label) ?? 0) + 1);
      });
      const topStyle = [...styleCounts.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        query,
        matches,
        impressions,
        engagement,
        comments,
        impressionDelta: percentDelta(impressions, globalImpressions),
        engagementDelta: percentDelta(engagement, globalEngagement),
        commentDelta: percentDelta(comments, globalComments),
        topStyle: topStyle ? `${topStyle[0]} (${Math.round((topStyle[1] / Math.max(matches.length, 1)) * 100)}%)` : "Aucun",
      };
    };
    return { primary: build(hookQuery), compare: build(compareHookQuery) };
  }, [analyticsPosts, compareHookQuery, hookQuery]);
  const recentActivity = useMemo(() => [...analyticsPosts]
    .sort((a, b) => getAnalyticsDate(b).getTime() - getAnalyticsDate(a).getTime())
    .slice(0, 4), [analyticsPosts]);
  const typeEvolutionPosts = useMemo(() => {
    return [...analyticsPosts].sort((a, b) => getAnalyticsDate(a).getTime() - getAnalyticsDate(b).getTime());
  }, [analyticsPosts]);

  function persist(updatedPosts: LinkedInPost[]) {
    const normalized = normalizePosts(updatedPosts);
    setPosts(normalized);
    saveLinkedInPosts(normalized);
    void persistRemoteLinkedInPosts(normalized, true);
  }

  function deletePost(postId: string) {
    if (!window.confirm("Supprimer ce post des statistiques LinkedIn ?")) return;
    const updated = posts.filter((post) => post.id !== postId);
    persist(updated);
    if (selectedPostId === postId) clearEditorSelection("Post supprimé.");
  }

  function selectPost(post: LinkedInPost) {
    const analytics = normalizeAnalytics(post.analytics);
    setPendingImportedAnalytics(null);
    setLinkOverlayOpen(false);
    setSelectedPostId(post.id);
    setSelectedStyleId(post.styleId ?? "");
    setPostContent(getPostContentFallback(post));
    setEditor({
      postUrl: analytics.postUrl ?? post.postUrl ?? "",
      publishedDate: analytics.publishedDate ?? post.publishedAt?.slice(0, 10) ?? "",
      publishedTime: analytics.publishedTime ?? post.publishedAt?.slice(11, 16) ?? "",
      linkUrl: analytics.linkUrl ?? "",
      format: hasImportedAnalytics(post) ? analytics.format : post.type === "carousel" ? "carousel" : undefined,
      topic: analytics.topic ?? "",
      mediaPreviewUrl: analytics.mediaPreviewUrl ?? "",
      mediaPreviewKind: analytics.mediaPreviewKind ?? "none",
      mediaFileName: analytics.mediaFileName ?? "",
      mediaStorageBytes: analytics.mediaStorageBytes ?? 0,
      autoRecycleSourcePostId: analytics.autoRecycleSourcePostId ?? "",
      autoRecycleCreatedAt: analytics.autoRecycleCreatedAt ?? "",
      videoViews: analytics.videoViews,
      watchTime: analytics.watchTime,
      averageWatchTime: analytics.averageWatchTime,
      impressions: analytics.impressions,
      reach: analytics.reach,
      profileViews: analytics.profileViews,
      followersGained: analytics.followersGained,
      socialEngagement: analytics.socialEngagement,
      reactions: analytics.reactions,
      comments: analytics.comments,
      reposts: analytics.reposts,
      saves: analytics.saves,
      sends: analytics.sends,
      linkClicks: analytics.linkClicks,
      customButtonClicks: analytics.customButtonClicks,
      engagementRate: analytics.engagementRate,
      demographics: analytics.demographics,
    });
  }

  function loadImportedAnalyticsInEditor(analytics: LinkedInPostAnalytics) {
    const normalized = normalizeAnalytics(analytics);
    setSelectedPostId(null);
    setPostContent("");
    setSelectedStyleId("");
    setEditor({
      ...emptyEditableAnalytics(),
      ...normalized,
      format: analytics.format,
      demographics: normalized.demographics ?? [],
    });
    setPendingImportedAnalytics(normalized);
    setLinkSearch("");
    setLinkOverlayOpen(false);
  }

  function clearEditorSelection(message?: string) {
    setSelectedPostId(null);
    setPendingImportedAnalytics(null);
    setLinkOverlayOpen(false);
    setEditor(emptyEditableAnalytics());
    setPostContent("");
    setSelectedStyleId("");
    if (message) setImportMessage(message);
  }

  function handleEditorChange<K extends keyof EditableAnalytics>(key: K, value: EditableAnalytics[K]) {
    setEditor((prev) => ({ ...prev, [key]: value }));
  }

  function mergeAnalyticsIntoExistingPost(post: LinkedInPost, analytics: EditableAnalytics | LinkedInPostAnalytics, styleId = selectedStyleId, content = postContent) {
    const selectedStyle = styles.find((style) => style.id === styleId);
    const normalizedAnalytics = normalizeAnalytics({
      ...post.analytics,
      ...analytics,
      importedAt: post.analytics?.importedAt ?? new Date().toISOString(),
      format: analytics.format,
    });

    return normalizePost({
      ...post,
      content: content.trim() || post.content,
      postUrl: normalizedAnalytics.postUrl,
      type: normalizedAnalytics.format === "carousel" ? "carousel" : "post",
      styleId: selectedStyle?.id,
      styleName: selectedStyle?.name,
      likes: normalizedAnalytics.reactions,
      comments: normalizedAnalytics.comments,
      impressions: normalizedAnalytics.impressions,
      tags: Array.from(new Set([normalizedAnalytics.format ?? "", selectedStyle?.name ?? ""])).filter(Boolean),
      analytics: normalizedAnalytics,
    });
  }

  function saveEditor() {
    if (!canSave) return;
    let updated: LinkedInPost[];

    if (selectedPostId) {
      updated = posts.map((post) => {
        if (post.id !== selectedPostId) return post;
        return mergeAnalyticsIntoExistingPost(post, editor);
      });
    } else {
      const selectedStyle = styles.find((style) => style.id === selectedStyleId);
      const importedPost = createImportedAnalyticsPost({
        ...pendingImportedAnalytics,
        ...editor,
        importedAt: pendingImportedAnalytics?.importedAt ?? new Date().toISOString(),
      });
      updated = [
        normalizePost({
          ...importedPost,
          content: postContent.trim() || editor.postUrl || "Post importé depuis LinkedIn",
          type: editor.format === "carousel" ? "carousel" : "post",
          styleId: selectedStyle?.id,
          styleName: selectedStyle?.name,
          tags: Array.from(new Set([editor.format ?? "", selectedStyle?.name ?? ""])).filter(Boolean),
          analytics: normalizeAnalytics({
            ...importedPost.analytics,
            ...editor,
            importedAt: pendingImportedAnalytics?.importedAt ?? new Date().toISOString(),
            format: editor.format,
          }),
        }),
        ...posts,
      ];
    }

    persist(updated);
    setShowPendingCsvPosts(false);
    clearEditorSelection();
  }

  function linkImportedAnalyticsToPost(post: LinkedInPost) {
    const analyticsToLink = pendingImportedAnalytics ?? normalizeAnalytics({ ...editor, importedAt: new Date().toISOString() });
    const postAnalytics = normalizeAnalytics(post.analytics);
    setSelectedPostId(post.id);
    setPostContent(getPostContentFallback(post) || postContent);
    setSelectedStyleId(post.styleId ?? selectedStyleId);
    setEditor({
      ...emptyEditableAnalytics(),
      ...postAnalytics,
      ...analyticsToLink,
      mediaPreviewUrl: postAnalytics.mediaPreviewUrl || editor.mediaPreviewUrl || analyticsToLink.mediaPreviewUrl,
      mediaPreviewKind: postAnalytics.mediaPreviewKind || editor.mediaPreviewKind || analyticsToLink.mediaPreviewKind,
      mediaFileName: postAnalytics.mediaFileName || editor.mediaFileName || analyticsToLink.mediaFileName,
      mediaStorageBytes: postAnalytics.mediaStorageBytes || editor.mediaStorageBytes || analyticsToLink.mediaStorageBytes,
      format: post.analytics?.format ?? editor.format ?? analyticsToLink.format,
      demographics: analyticsToLink.demographics ?? [],
    });
    setLinkOverlayOpen(false);
    setImportMessage("");
  }

  async function handleImport(file: File) {
    setImporting(true);
    setImportMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/linkedin/import-analytics", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import impossible.");

      const analytics = normalizeAnalytics(data.analytics as LinkedInPostAnalytics);
      if (selectedPost && selectedPost.status === "published" && !hasImportedAnalytics(selectedPost)) {
        if (!selectedStyleId || !editor.format) {
          setImportMessage("Choisis d'abord un style et un format avant de lier le CSV a ce post.");
          return;
        }
        const updated = posts.map((post) => (
          post.id === selectedPost.id
            ? mergeAnalyticsIntoExistingPost(post, { ...analytics, format: editor.format ?? analytics.format }, selectedStyleId, postContent || post.content)
            : post
        ));
        persist(updated);
        const linked = updated.find((post) => post.id === selectedPost.id);
        if (linked) selectPost(linked);
        setShowPendingCsvPosts(false);
        setImportMessage("");
        return;
      }

      const match = findPostByAnalytics(posts, analytics);

      loadImportedAnalyticsInEditor(analytics);
      setImportMessage(match
        ? `Import pret. Correspondance possible : "${buildPostTitle(match)}". Tu peux sauvegarder sans lier, ou cliquer sur "Lier a un post existant".`
        : "Import pret. Tu peux sauvegarder sans lier, ou le lier a un post existant."
      );
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Import impossible.");
    } finally {
      setImporting(false);
    }
  }

  async function handleMediaFile(file: File) {
    try {
      const preview = await buildMediaPreview(file);
      setEditor((prev) => ({
        ...prev,
        mediaPreviewUrl: preview.previewUrl,
        mediaPreviewKind: preview.previewKind,
        mediaFileName: preview.fileName,
        mediaStorageBytes: preview.bytes,
        format: prev.format === "text" && preview.previewKind === "pdf" ? "document" : prev.format,
      }));
      setImportMessage("");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Média impossible à charger.");
    }
  }

  function handleImportDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setImportDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleImport(file);
  }

  function handleMediaDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setMediaDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleMediaFile(file);
  }

  const editorActive = Boolean(selectedPost || pendingImportedAnalytics);
  const selectedPostNeedsCsv = Boolean(selectedPost && selectedPost.status === "published" && !hasImportedAnalytics(selectedPost));
  const uploadIsMedia = editorActive && !selectedPostNeedsCsv;
  const uploadDragActive = uploadIsMedia ? mediaDragActive : importDragActive;
  const selectedStyle = styles.find((style) => style.id === selectedStyleId);
  const linkCandidates = useMemo(() => {
    const query = linkSearch.trim().toLowerCase();
    return posts
      .filter((post) => {
        if (!query) return true;
        return `${buildPostTitle(post)} ${post.content} ${post.styleName ?? ""}`.toLowerCase().includes(query);
      })
      .slice(0, 8);
  }, [linkSearch, posts]);
  const metricCards = [
    { label: "Posts publies", value: publishedPosts.length, icon: <BarChart3 size={17} style={{ color: "#6f7887" }} /> },
    { label: "Impressions", value: formatNumber(totalImpressions), icon: <Eye size={17} style={{ color: "#6f7887" }} /> },
    { label: "Reactions", value: formatNumber(totalReactions), icon: <ThumbsUp size={17} style={{ color: "#6f7887" }} /> },
    { label: "Clics sur le lien", value: formatNumber(totalLinkClicks || totalComments), icon: <MousePointerClick size={17} style={{ color: "#6f7887" }} /> },
  ];
  const formatLabels: Record<PostFormat, string> = {
    text: "Texte",
    image: "Image",
    carousel: "Carrousel",
    video: "Vidéo",
    poll: "Sondage",
    document: "Document",
    other: "Autre",
  };
  const timelineMax = Math.max(...timeline.map((item) => item.value), 1);
  const timelinePoints = timeline.map((item, index) => {
    const x = timeline.length <= 1 ? 58 : 58 + (index / Math.max(timeline.length - 1, 1)) * 820;
    const y = 220 - (item.value / timelineMax) * 170;
    return `${x},${y}`;
  }).join(" ");
  const typeMax = Math.max(...typeEvolutionPosts.map((post) => getDataMetricValue(post, dataMetric)), 1);
  const typePoints = typeEvolutionPosts.map((post, index) => {
    const x = typeEvolutionPosts.length <= 1 ? 58 : 58 + (index / Math.max(typeEvolutionPosts.length - 1, 1)) * 820;
    const y = 210 - (getDataMetricValue(post, dataMetric) / typeMax) * 150;
    return `${x},${y}`;
  }).join(" ");
  const formatConic = (() => {
    if (formatDistribution.length === 0) return "#eef1f5 0deg 360deg";
    let cursor = 0;
    return formatDistribution.map((item, index) => {
      const color = formatChartColors[item.label] ?? formatChartColors.Autre;
      const gap = formatDistribution.length > 1 ? 2 : 0;
      const start = cursor;
      const end = cursor + item.percent * 3.6;
      cursor = end;
      return `${color} ${start}deg ${Math.max(start, end - gap)}deg, #fff ${Math.max(start, end - gap)}deg ${end}deg`;
    }).join(", ");
  })();
  const maxHeatValue = Math.max(...heatmap.flat(), 1);
  const hourLabels = [0, 4, 8, 12, 16, 20];
  const dayLabels = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];
  const selectedMetric = DATA_METRICS.find((metric) => metric.key === dataMetric) ?? DATA_METRICS[0];
  const SelectedMetricIcon = selectedMetric.icon;
  const dataSideCards = [
    { key: "posts", label: "Posts analysés", value: dataTotals.posts, previous: previousDataTotals.posts, icon: BarChart3 },
    { key: "impressions", label: "Impressions", value: dataTotals.impressions, previous: previousDataTotals.impressions, icon: Eye },
    { key: "reactions", label: "Réactions", value: dataTotals.reactions, previous: previousDataTotals.reactions, icon: ThumbsUp },
    { key: "engagement", label: "Engagement", value: dataTotals.engagement, previous: previousDataTotals.engagement, icon: Activity },
    { key: "comments", label: "Commentaires", value: dataTotals.comments, previous: previousDataTotals.comments, icon: MessageCircle },
    { key: "linkClicks", label: "Clics lien", value: dataTotals.linkClicks, previous: previousDataTotals.linkClicks, icon: MousePointerClick },
    { key: "saves", label: "Enregistrements", value: dataTotals.saves, previous: previousDataTotals.saves, icon: BarChart3 },
    { key: "sends", label: "Envois LinkedIn", value: dataTotals.sends, previous: previousDataTotals.sends, icon: Send },
    { key: "reach", label: "Membres touchés", value: dataTotals.reach, previous: previousDataTotals.reach, icon: Eye },
    { key: "profileViews", label: "Vues profil", value: dataTotals.profileViews, previous: previousDataTotals.profileViews, icon: Eye },
  ];

  function renderHookPanel(stats: typeof hookStats.primary, accent: string) {
    const hasQuery = stats.query.trim().length > 0;
    const rows = [
      { label: "Impressions moyennes", value: Math.round(stats.impressions), delta: stats.impressionDelta },
      { label: "Engagement moyen", value: Math.round(stats.engagement), delta: stats.engagementDelta },
      { label: "Commentaires moyens", value: Math.round(stats.comments), delta: stats.commentDelta },
    ];

    return (
      <div style={{ border: "1px solid rgba(18,26,46,0.08)", borderRadius: 16, padding: 14, background: "#fbfcff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <strong style={{ fontSize: 15, fontWeight: 700, color: "#121a2e" }}>{hasQuery ? `"${stats.query.trim()}"` : "Aucune accroche"}</strong>
          <span style={{ ...dataMutedText, color: accent }}>{stats.matches.length} post{stats.matches.length > 1 ? "s" : ""}</span>
        </div>
        {hasQuery && stats.matches.length === 0 ? (
          <p style={{ margin: 0, ...dataMutedText }}>Nous n'avons pas trouvé de post avec ce mot dans les accroches. Essaie un autre terme ou importe plus de posts.</p>
        ) : hasQuery ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {rows.map((row) => (
                <div key={row.label} style={{ borderRadius: 12, background: "#fff", border: "1px solid rgba(18,26,46,0.08)", padding: 12 }}>
                  <p style={{ margin: 0, ...dataMutedText, fontSize: 12 }}>{row.label}</p>
                  <strong style={{ display: "block", marginTop: 7, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>{formatNumber(row.value)}</strong>
                  <span style={{ display: "block", marginTop: 5, fontSize: 12, fontWeight: 700, color: row.delta >= 0 ? "#168b64" : "#c53434" }}>
                    {formatDelta(row.delta)} vs moyenne
                  </span>
                </div>
              ))}
            </div>
            <p style={{ margin: "12px 0 0", ...dataMutedText }}>
              Style le plus fréquent : <strong style={{ color: "#121a2e" }}>{stats.topStyle}</strong>
            </p>
          </>
        ) : (
          <p style={{ margin: 0, ...dataMutedText }}>Tape un mot pour analyser toutes les accroches qui le contiennent.</p>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        setSortOpen(false);
        setDataMetricOpen(false);
      }}
      style={{ display: "flex", height: "100%", minHeight: 0, background: "#fbfbfb", overflow: "hidden", ...jk }}
    >
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <aside
        style={{
          width: 358,
          minWidth: 358,
          height: "100%",
          background: "#fff",
          borderRight: "1px solid rgba(18,26,46,0.18)",
          boxShadow: "11px 0px 25px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "28px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "inline-flex", alignItems: "center", padding: 3, borderRadius: 999, background: "#f0f0f0" }}>
            <button
              type="button"
              onClick={() => setActiveTab("posts")}
              style={{
                border: activeTab === "posts" ? "1px solid rgba(0,0,0,0.12)" : 0,
                borderRadius: 999,
                background: activeTab === "posts" ? "#fff" : "transparent",
                minHeight: 32,
                padding: "0 18px",
                color: "rgba(18,26,46,0.7)",
                fontFamily: '"Inter", sans-serif',
                fontSize: 13,
                fontWeight: 500,
                boxShadow: activeTab === "posts" ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                cursor: "pointer",
              }}
            >
              Posts
            </button>
            <button
              type="button"
              onClick={() => {
                clearEditorSelection();
                setActiveTab("data");
              }}
              style={{
                border: activeTab === "data" ? "1px solid rgba(0,0,0,0.12)" : 0,
                borderRadius: 999,
                background: activeTab === "data" ? "#fff" : "transparent",
                minHeight: 32,
                padding: "0 16px",
                color: activeTab === "data" ? "rgba(18,26,46,0.7)" : "rgba(18,26,46,0.45)",
                fontFamily: '"Inter", sans-serif',
                fontSize: 13,
                fontWeight: 500,
                boxShadow: activeTab === "data" ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                cursor: "pointer",
              }}
            >
              Données
            </button>
          </div>
        </div>

        <div style={{ padding: "22px 26px 0" }}>
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: "25px", fontWeight: 600, color: "#121a2e", letterSpacing: "-0.45px" }}>
            {activeTab === "data" ? "Données LinkedIn" : "Posts LinkedIn"}
          </h1>
        </div>

        {activeTab === "posts" ? (
          <>
        <div style={{ padding: "28px 26px 0" }}>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              if (uploadIsMedia) setMediaDragActive(true);
              else setImportDragActive(true);
            }}
            onDragLeave={() => {
              setImportDragActive(false);
              setMediaDragActive(false);
            }}
            onDrop={uploadIsMedia ? handleMediaDrop : handleImportDrop}
            style={{
              minHeight: 118,
              padding: "20px 12px",
              boxSizing: "border-box",
              borderRadius: 9,
              border: uploadDragActive ? "1px dashed rgba(18,26,46,0.45)" : "1px dashed rgba(0,0,0,0.16)",
              background: uploadDragActive ? "#f1f3f5" : "#f6f6f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              cursor: "pointer",
              transition: "background 0.18s ease, border 0.18s ease",
            }}
          >
            {uploadIsMedia && editor.mediaPreviewUrl ? (
              <span style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, width: "100%" }}>
                <span style={{ width: 58, height: 64, borderRadius: 6, background: `url(${editor.mediaPreviewUrl}) center / cover`, boxShadow: previewShadow, border: "2px solid #fff", transform: "rotate(-1.8deg)", flexShrink: 0 }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 5, textAlign: "left", minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(18,26,46,0.75)" }}>Média importé</span>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.48)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Clique ou glisse un fichier pour remplacer
                  </span>
                </span>
              </span>
            ) : (
              <span style={{ display: "flex", flexDirection: "column", gap: 13, alignItems: "center" }}>
                <span style={{ width: 34, height: 34, borderRadius: 999, background: "#fff", border: "1px solid #e1e4e8", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: sortShadow }}>
                  <Upload size={16} style={{ color: "#6f7887" }} />
                </span>
                <span style={{ fontSize: 16, fontWeight: 500, color: "rgba(18,26,46,0.7)" }}>
                  {uploadIsMedia ? "Importer une photo ici :" : selectedPostNeedsCsv ? "Importer le CSV de ce post" : "Importer un post LinkedIn Ici"}
                </span>
                <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.5)" }}>
                  {importing ? "Import en cours..." : "Clique ici ou glisse un fichier ici"}
                </span>
              </span>
            )}
            <input
              type="file"
              accept={uploadIsMedia ? "image/*,.pdf,application/pdf" : ".xlsx,.csv"}
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  if (uploadIsMedia) void handleMediaFile(file);
                  else void handleImport(file);
                }
                event.currentTarget.value = "";
              }}
            />
          </label>

          {importMessage && (
            <p style={{ margin: "14px 0 0", fontFamily: '"Inter", sans-serif', fontSize: 13, lineHeight: 1.55, color: "rgba(18,26,46,0.55)" }}>
              {importMessage}
            </p>
          )}
        </div>

        {!editorActive ? (
          <div style={{ padding: "24px 26px 24px", display: "flex", flexDirection: "column", gap: 13, overflowY: "auto", minHeight: 0 }}>
            {metricCards.map((card) => (
              <article key={card.label} style={{ minHeight: 96, borderRadius: 20, border: "1px solid #e1e4e8", background: "#fff", boxShadow: cardShadow, padding: "18px 20px", boxSizing: "border-box" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#ececec", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  {card.icon}
                </div>
                <p style={{ margin: 0, fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "#6f7887" }}>{card.label}</p>
                <strong style={{ display: "block", marginTop: 8, fontSize: 20, fontWeight: 600, color: "#121a2e", lineHeight: 1 }}>{card.value}</strong>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ padding: "30px 26px 24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", minHeight: 0, flex: 1 }}>
            <Field label="Format du post *">
              <div style={{ position: "relative" }}>
                <button type="button" onClick={() => setFormatOpen((current) => !current)} style={{ ...figmaInputStyle, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <span style={{ color: editor.format ? "#121a2e" : "rgba(18,26,46,0.45)" }}>
                    {editor.format ? formatLabels[editor.format as PostFormat] : "Choisir un format"}
                  </span>
                  <ChevronDown size={15} style={{ color: "rgba(18,26,46,0.42)" }} />
                </button>
                {formatOpen ? (
                  <div style={{ position: "absolute", top: 48, left: 0, right: 0, zIndex: 10, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 12, background: "#fff", boxShadow: "0px 16px 34px rgba(18,26,46,0.12)", padding: 6 }}>
                    {(["text", "image", "carousel", "video"] as PostFormat[]).map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => {
                          handleEditorChange("format", format);
                          setFormatOpen(false);
                        }}
                        style={{ width: "100%", border: 0, borderRadius: 9, background: editor.format === format ? "rgba(0,0,0,0.03)" : "transparent", padding: "9px 10px", textAlign: "left", fontSize: 13, fontWeight: 500, color: "#121a2e", cursor: "pointer", fontFamily: '"Inter", sans-serif' }}
                      >
                        {formatLabels[format]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Field>

            <Field label="Style du post *">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {styles.map((style) => {
                  const active = selectedStyleId === style.id;
                  const visual = getStyleTagVisual(style, active);
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyleId(style.id)}
                      style={{
                        border: `1px solid ${visual.border}`,
                        borderRadius: 999,
                        background: visual.bg,
                        color: visual.color,
                        padding: "10px 14px",
                        fontFamily: '"Inter", sans-serif',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      {styleCategoryLabel(style)}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Contenu du post *">
              <textarea
                value={postContent}
                onChange={(event) => setPostContent(event.target.value)}
                placeholder="Colle ici le contenu complet du post LinkedIn."
                rows={8}
                style={{ ...figmaInputStyle, minHeight: 132, padding: 12, lineHeight: 1.5, resize: "vertical", whiteSpace: "pre-wrap" }}
              />
            </Field>

            <Field label="Lien du post">
              <input value={toInputValue(editor.postUrl)} onChange={(event) => handleEditorChange("postUrl", event.target.value)} style={figmaInputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Heure">
                <input type="time" value={toInputValue(editor.publishedTime)} onChange={(event) => handleEditorChange("publishedTime", event.target.value)} style={figmaInputStyle} />
              </Field>
              <Field label="Lien cliqué">
                <input value={toInputValue(editor.linkUrl)} onChange={(event) => handleEditorChange("linkUrl", event.target.value)} style={figmaInputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Membres touchés">
                <input type="number" min={0} value={toInputValue(editor.reach)} onChange={(event) => handleEditorChange("reach", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
              <Field label="Vues profil">
                <input type="number" min={0} value={toInputValue(editor.profileViews)} onChange={(event) => handleEditorChange("profileViews", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Abonnés gagnés">
                <input type="number" min={0} value={toInputValue(editor.followersGained)} onChange={(event) => handleEditorChange("followersGained", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
              <Field label="Engagement social">
                <input type="number" min={0} value={toInputValue(editor.socialEngagement)} onChange={(event) => handleEditorChange("socialEngagement", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Republications">
                <input type="number" min={0} value={toInputValue(editor.reposts)} onChange={(event) => handleEditorChange("reposts", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
              <Field label="Enregistrements">
                <input type="number" min={0} value={toInputValue(editor.saves)} onChange={(event) => handleEditorChange("saves", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Envois LinkedIn">
                <input type="number" min={0} value={toInputValue(editor.sends)} onChange={(event) => handleEditorChange("sends", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
              <Field label="Clics bouton">
                <input type="number" min={0} value={toInputValue(editor.customButtonClicks)} onChange={(event) => handleEditorChange("customButtonClicks", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Date">
                <input type="date" value={toInputValue(editor.publishedDate)} onChange={(event) => handleEditorChange("publishedDate", event.target.value)} style={figmaInputStyle} />
              </Field>
              <Field label="Impressions">
                <input type="number" min={0} value={toInputValue(editor.impressions)} onChange={(event) => handleEditorChange("impressions", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Réactions">
                <input type="number" min={0} value={toInputValue(editor.reactions)} onChange={(event) => handleEditorChange("reactions", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
              <Field label="Commentaires">
                <input type="number" min={0} value={toInputValue(editor.comments)} onChange={(event) => handleEditorChange("comments", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
            </div>

            <Field label="Clics sur le lien">
              <input type="number" min={0} value={toInputValue(editor.linkClicks)} onChange={(event) => handleEditorChange("linkClicks", Number(event.target.value))} style={figmaInputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Vues vidéo">
                <input type="number" min={0} value={toInputValue(editor.videoViews)} onChange={(event) => handleEditorChange("videoViews", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
              <Field label="Taux d'engagement %">
                <input type="number" min={0} step="0.01" value={toInputValue(editor.engagementRate)} onChange={(event) => handleEditorChange("engagementRate", Number(event.target.value))} style={figmaInputStyle} />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Temps de visionnage">
                <input value={toInputValue(editor.watchTime)} onChange={(event) => handleEditorChange("watchTime", event.target.value)} style={figmaInputStyle} />
              </Field>
              <Field label="Durée moyenne">
                <input value={toInputValue(editor.averageWatchTime)} onChange={(event) => handleEditorChange("averageWatchTime", event.target.value)} style={figmaInputStyle} />
              </Field>
            </div>

            {editor.demographics.length > 0 && (
              <div style={{ border: "1px solid rgba(18,26,46,0.1)", borderRadius: 12, padding: 12, background: "#fff" }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#121a2e" }}>Démographies importées</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                  {editor.demographics.map((item, index) => (
                    <div key={`${item.category}-${item.value}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, fontSize: 12, color: "rgba(18,26,46,0.62)" }}>
                      <span>{item.category} · {item.value}</span>
                      <strong style={{ color: "#121a2e" }}>{item.percentage}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {editorActive ? (
          <div style={{ flexShrink: 0, padding: "12px 20px 18px", background: "#fff", boxShadow: "0px -14px 28px rgba(255,255,255,0.9)", display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingImportedAnalytics ? (
              <button type="button" onClick={() => setLinkOverlayOpen(true)} style={{ minHeight: 42, borderRadius: 10, border: "1px solid #e1e4e8", background: "#fff", color: "#121a2e", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Link2 size={15} /> Lier a un post existant
              </button>
            ) : null}
            <button type="button" onClick={saveEditor} disabled={!canSave} style={{ ...loginButtonStyle, opacity: canSave ? 1 : 0.55, cursor: canSave ? "pointer" : "not-allowed" }}>
              Sauvegarder
            </button>
          </div>
        ) : null}
          </>
        ) : (
          <div style={{ padding: "28px 26px 24px", display: "flex", flexDirection: "column", gap: 18, overflowY: "auto", minHeight: 0, flex: 1 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#6f7887", fontFamily: '"Inter", sans-serif' }}>Période analysée</span>
              <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Calendar size={16} style={{ position: "absolute", left: 14, color: "#6f7887" }} />
                <select value={periodKey} onChange={(event) => setPeriodKey(event.target.value as PeriodKey)} style={{ ...figmaInputStyle, paddingLeft: 40, appearance: "none" }}>
                  {PERIOD_OPTIONS.map((period) => <option key={period.key} value={period.key}>{period.label}</option>)}
                </select>
                <ChevronDown size={15} style={{ position: "absolute", right: 12, color: "#6f7887", pointerEvents: "none" }} />
              </span>
            </label>

            <div style={{ height: 1, background: "#e9ecef" }} />

            {dataSideCards.map((card) => {
              const Icon = card.icon;
              const delta = percentDelta(card.value, card.previous);
              const hasPrevious = selectedPeriod.days !== null && card.previous > 0;
              return (
              <button key={card.label} type="button" onClick={() => setDataOverlay({ title: card.label, body: `${formatNumber(Math.round(card.value))} sur ${selectedPeriod.label}. Comparaison calculée avec la période précédente de même durée.` })} style={{ textAlign: "left", minHeight: 118, borderRadius: 20, border: "1px solid #e1e4e8", background: "#fff", boxShadow: cardShadow, padding: "18px 20px", boxSizing: "border-box", cursor: "pointer" }}>
                <div style={{ width: 42, height: 42, borderRadius: 9, background: "#ececec", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Icon size={17} style={{ color: "#6f7887" }} />
                </div>
                <p style={{ margin: 0, fontFamily: '"Inter", sans-serif', fontSize: 14, fontWeight: 500, color: "#6f7887" }}>{card.label}</p>
                <strong style={{ display: "block", marginTop: 9, fontSize: 22, fontWeight: 600, color: "#121a2e", lineHeight: 1 }}>{formatNumber(Math.round(card.value))}</strong>
                <span style={{ display: "block", marginTop: 8, fontSize: 12, color: !hasPrevious ? "#6f7887" : delta >= 0 ? "#168b64" : "#c53434", fontWeight: 600 }}>
                  {hasPrevious ? `${delta >= 0 ? "↑" : "↓"} ${formatDelta(Math.abs(delta))} vs période précédente` : "Pas assez de données avant"}
                </span>
              </button>
            );})}
          </div>
        )}
      </aside>

      <main
        onClick={(event) => {
          if (event.target === event.currentTarget) clearEditorSelection();
        }}
        style={{ flex: 1, minWidth: 0, padding: "28px 30px 44px", overflowY: "auto" }}
      >
        {activeTab === "data" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <section style={{ ...dataCardStyle, padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 22, lineHeight: "26px", fontWeight: 600, color: "#121a2e", letterSpacing: "-0.35px" }}>
                  Evolution de l'engagement
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <label style={{ position: "relative", minWidth: 188 }}>
                    <select value={dataStyleFilter} onChange={(event) => setDataStyleFilter(event.target.value)} style={{ ...figmaInputStyle, minHeight: 42, appearance: "none" }}>
                      <option value="">Tous les styles</option>
                      {styles.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
                    </select>
                    <ChevronDown size={15} style={{ position: "absolute", right: 12, top: 13, color: "#6f7887", pointerEvents: "none" }} />
                  </label>
                  <div style={{ position: "relative" }} onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setDataMetricOpen((current) => !current)}
                      style={{ minHeight: 42, minWidth: 178, borderRadius: 18, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", boxShadow: sortShadow, padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer", fontFamily: '"Inter", sans-serif', fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.72)" }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <SelectedMetricIcon size={15} style={{ color: "#6f7887" }} />
                        {selectedMetric.label}
                      </span>
                      <ChevronDown size={15} style={{ color: "#6f7887" }} />
                    </button>
                    {dataMetricOpen ? (
                      <div style={{ position: "absolute", top: 48, right: 0, zIndex: 6, width: 220, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 14, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(14px)", boxShadow: "0 18px 38px rgba(18,26,46,0.12)", padding: 6, animation: "fadeIn 0.16s ease-out" }}>
                        {DATA_METRICS.map((metric) => {
                          const Icon = metric.icon;
                          return (
                            <button key={metric.key} type="button" onClick={() => { setDataMetric(metric.key); setDataMetricOpen(false); }} style={{ width: "100%", border: 0, borderRadius: 10, background: dataMetric === metric.key ? "rgba(0,0,0,0.03)" : "transparent", padding: "10px 11px", textAlign: "left", fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.78)", cursor: "pointer", display: "flex", alignItems: "center", gap: 9 }}>
                              <Icon size={15} style={{ color: "#6f7887" }} /> {metric.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {timeline.length === 0 ? (
                <div style={{ minHeight: 270, borderRadius: 16, background: "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center", ...dataMutedText }}>
                  Importe au moins un CSV LinkedIn sauvegarde pour afficher l'evolution.
                </div>
              ) : (
                <svg viewBox="0 0 920 270" preserveAspectRatio="none" style={{ width: "100%", height: 285, display: "block" }}>
                  {[0, 1, 2, 3, 4].map((line) => (
                    <line key={line} x1="46" x2="890" y1={48 + line * 43} y2={48 + line * 43} stroke="rgba(18,26,46,0.055)" strokeWidth="1" />
                  ))}
                  {[0, 1, 2, 3, 4].map((line) => {
                    const value = Math.round(timelineMax - (timelineMax / 4) * line);
                    return <text key={line} x="4" y={52 + line * 43} fill="rgba(18,26,46,0.45)" fontSize="12" fontFamily="Inter">{formatNumber(value)}</text>;
                  })}
                  <defs>
                    <linearGradient id="linkedinStatsLineFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4e7dfa" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#4e7dfa" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {timelinePoints ? (
                    <>
                      <polyline points={`58,230 ${timelinePoints} 878,230`} fill="url(#linkedinStatsLineFill)" stroke="none" />
                      <polyline points={timelinePoints} fill="none" stroke="#6D96FE" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  ) : null}
                  {timeline.map((item, index) => {
                    const x = timeline.length <= 1 ? 58 : 58 + (index / Math.max(timeline.length - 1, 1)) * 820;
                    const y = 220 - (item.value / timelineMax) * 170;
                    const firstPost = item.posts[0];
                    const firstAnalytics = normalizeAnalytics(firstPost.analytics);
                    return (
                      <g key={item.date.toISOString()} onClick={() => setDataOverlay({ title: item.date.toLocaleDateString("fr-FR"), body: `${formatNumber(item.value)} ${DATA_METRICS.find((metric) => metric.key === dataMetric)?.label.toLowerCase()} sur ${item.posts.length} post(s).` })} style={{ cursor: "pointer" }}>
                        <line x1={x} x2={x} y1="35" y2="228" stroke="rgba(18,26,46,0.08)" strokeDasharray="3 4" />
                        <foreignObject x={x - 18} y={y - 18} width="36" height="40">
                          <div style={{ width: 26, height: 30, margin: 4, borderRadius: 5, border: "2px solid #fff", background: firstAnalytics.mediaPreviewUrl ? `url(${firstAnalytics.mediaPreviewUrl}) center / cover` : "#cfcfcf", boxShadow: previewShadow }} />
                        </foreignObject>
                        <title>{`${item.date.toLocaleDateString("fr-FR")} - ${formatNumber(item.value)}`}</title>
                      </g>
                    );
                  })}
                  {timeline.map((item, index) => {
                    if (index % Math.max(Math.ceil(timeline.length / 6), 1) !== 0) return null;
                    const x = timeline.length <= 1 ? 58 : 58 + (index / Math.max(timeline.length - 1, 1)) * 820;
                    return <text key={`label-${item.date.toISOString()}`} x={x - 28} y="260" fill="rgba(18,26,46,0.54)" fontSize="12" fontFamily="Inter">{item.date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</text>;
                  })}
                </svg>
              )}
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.9fr", gap: 22 }}>
              <article style={{ ...dataCardStyle, padding: 24 }}>
                <h3 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 600, color: "#121a2e" }}>Repartition par format</h3>
                <div style={{ display: "grid", gridTemplateColumns: "132px 1fr", gap: 20, alignItems: "center" }}>
                  <div style={{ width: 132, height: 132, borderRadius: "50%", background: `conic-gradient(${formatConic})`, position: "relative" }}>
                    <div style={{ position: "absolute", inset: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                      <span style={{ ...dataMutedText, fontSize: 13 }}>Total</span>
                      <strong style={{ fontSize: 22, color: "#121a2e" }}>{analyticsPosts.length}</strong>
                      <span style={{ ...dataMutedText, fontSize: 12 }}>posts</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {(formatDistribution.length ? formatDistribution : [{ label: "Aucune donnee", count: 0, percent: 0 }]).map((item, index) => (
                      <div key={item.label} style={{ display: "grid", gridTemplateColumns: "14px 1fr auto", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 4, background: formatChartColors[item.label] ?? formatChartColors.Autre }} />
                        <span style={{ ...dataMutedText }}>{item.label}</span>
                        <strong style={{ fontSize: 14, fontWeight: 700, color: "#121a2e" }}>{item.percent}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article style={{ ...dataCardStyle, padding: 24 }}>
                <h3 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 600, color: "#121a2e" }}>Performances par jour</h3>
                <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 8 }}>
                  {dayLabels.map((day, dayIndex) => (
                    <div key={day} style={{ display: "contents" }}>
                      <span style={{ ...dataMutedText, fontSize: 12, alignSelf: "center" }}>{day}</span>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 12px)", gap: 3 }}>
                        {heatmap[dayIndex].map((value, hour) => (
                          <button
                            key={`${day}-${hour}`}
                            type="button"
                            onClick={() => setDataOverlay({ title: `${day} ${String(hour).padStart(2, "0")}h`, body: `Engagement moyen : ${Math.round(value)}. Plus la case est bleue, plus les posts de ce créneau performent.` })}
                            style={{ width: 12, height: 12, border: 0, borderRadius: 3, background: `rgba(45,110,253,${0.08 + (value / maxHeatValue) * 0.72})`, cursor: "pointer" }}
                            aria-label={`${day} ${hour}h`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 8, marginTop: 12 }}>
                  <span />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", width: 357, ...dataMutedText, fontSize: 12 }}>
                    {hourLabels.map((hour) => <span key={hour}>{String(hour).padStart(2, "0")}h</span>)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingLeft: 44 }}>
                  <span style={{ ...dataMutedText, fontSize: 12 }}>Faible</span>
                  <span style={{ width: 142, height: 10, borderRadius: 999, background: "linear-gradient(90deg, rgba(45,110,253,0.08), rgba(45,110,253,0.8))" }} />
                  <span style={{ ...dataMutedText, fontSize: 12 }}>Élevé</span>
                </div>
              </article>

              <article style={{ ...dataCardStyle, padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 234 }}>
                <div>
                  <h3 style={{ margin: "0 0 52px", fontSize: 20, fontWeight: 600, color: "#121a2e" }}>Meilleur moment pour publier</h3>
                  <strong style={{ display: "block", fontSize: 34, fontWeight: 500, color: "#121a2e", letterSpacing: "-0.6px" }}>{bestTime.label}</strong>
                  <p style={{ margin: "6px 0 14px", ...dataMutedText }}>{bestTime.day}</p>
                  <span style={{ display: "inline-flex", borderRadius: 999, background: "#f5faf7", border: "1px solid #dcefe5", padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#168b64" }}>
                    {formatDelta(bestTime.delta)} plus d'engagement
                  </span>
                </div>
                <button type="button" onClick={() => setDataOverlay({ title: "Meilleur moment pour publier", body: `Le meilleur créneau détecté est ${bestTime.day} à ${bestTime.label}. Calcul basé sur l'engagement moyen des posts importés.` })} style={{ alignSelf: "flex-start", minHeight: 42, borderRadius: 10, border: "1px solid #e1e4e8", background: "#fff", padding: "0 18px", fontSize: 14, fontWeight: 700, color: "#121a2e", cursor: "pointer" }}>
                  Voir plus d'infos
                </button>
              </article>
            </section>

            <section style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 22 }}>
              <article style={{ ...dataCardStyle, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#121a2e" }}>Comparaison d'accroches</h3>
                    <p style={{ margin: "7px 0 0", ...dataMutedText }}>Recherche un mot dans les premieres lignes de tes posts.</p>
                  </div>
                  <button type="button" onClick={() => setCompareMode((current) => !current)} style={{ minHeight: 40, borderRadius: 10, border: "1px solid #e1e4e8", background: "#fff", padding: "0 14px", fontSize: 13, fontWeight: 700, color: "#121a2e", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                    <GitCompare size={15} /> Comparer
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: compareMode ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 14 }}>
                  <label style={{ minHeight: 44, borderRadius: 12, border: "1px solid #e1e4e8", background: "#f8f9fb", display: "flex", alignItems: "center", gap: 10, padding: "0 12px" }}>
                    <Search size={16} style={{ color: "#6f7887" }} />
                    <input value={hookQuery} onChange={(event) => setHookQuery(event.target.value)} placeholder="Ex : prospect, erreur, croissance..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontFamily: '"Inter", sans-serif', fontSize: 14, color: "#121a2e" }} />
                  </label>
                  {compareMode ? (
                    <label style={{ minHeight: 44, borderRadius: 12, border: "1px solid #e1e4e8", background: "#f8f9fb", display: "flex", alignItems: "center", gap: 10, padding: "0 12px" }}>
                      <Search size={16} style={{ color: "#6f7887" }} />
                      <input value={compareHookQuery} onChange={(event) => setCompareHookQuery(event.target.value)} placeholder="Mot a comparer..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontFamily: '"Inter", sans-serif', fontSize: 14, color: "#121a2e" }} />
                    </label>
                  ) : null}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {renderHookPanel(hookStats.primary, "#0147ff")}
                  {compareMode ? renderHookPanel(hookStats.compare, "#7c3aed") : null}
                </div>
              </article>

              <article style={{ ...dataCardStyle, padding: 24 }}>
                <h3 style={{ margin: "0 0 18px", fontSize: 20, fontWeight: 600, color: "#121a2e" }}>Activite recente</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {recentActivity.length === 0 ? (
                    <p style={{ margin: 0, ...dataMutedText }}>Aucun post importé pour l'instant.</p>
                  ) : recentActivity.map((post) => {
                    const analytics = normalizeAnalytics(post.analytics);
                    return (
                      <button key={post.id} type="button" onClick={() => { setActiveTab("posts"); selectPost(post); }} style={{ border: 0, borderBottom: "1px solid rgba(18,26,46,0.06)", background: "transparent", padding: "0 0 12px", display: "grid", gridTemplateColumns: "44px 1fr auto auto", alignItems: "center", gap: 12, textAlign: "left", cursor: "pointer" }}>
                        <span style={{ width: 36, height: 40, borderRadius: 5, background: analytics.mediaPreviewUrl ? `url(${analytics.mediaPreviewUrl}) center / cover` : "#ccc", border: "3px solid #fff", boxShadow: previewShadow }} />
                        <strong style={{ minWidth: 0, fontSize: 14, fontWeight: 600, color: "#121a2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{buildPostTitle(post)}</strong>
                        <span style={{ ...dataMutedText, whiteSpace: "nowrap" }}>{getAnalyticsDate(post).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#121a2e", whiteSpace: "nowrap" }}>{formatNumber(analytics.reactions)} reactions</span>
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={() => setActiveTab("posts")} style={{ marginTop: 16, border: 0, background: "transparent", color: "#0147ff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  Voir tous les posts →
                </button>
              </article>
            </section>

            <section style={{ ...dataCardStyle, padding: "26px 28px", minHeight: 360 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#121a2e" }}>Evolution par type</h3>
                <span style={{ ...dataMutedText }}>
                  {dataStyleFilter ? styles.find((style) => style.id === dataStyleFilter)?.name ?? "Style filtré" : "Tous les styles"} · {selectedMetric.label}
                </span>
              </div>
              {typeEvolutionPosts.length === 0 ? (
                <div style={{ minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, background: "#f7f8fa", ...dataMutedText }}>
                  Aucun post pour ce style sur la periode choisie.
                </div>
              ) : (
                <svg viewBox="0 0 920 260" preserveAspectRatio="none" style={{ width: "100%", height: 270, display: "block" }}>
                  {[0, 1, 2, 3].map((line) => <line key={line} x1="60" x2="890" y1={55 + line * 46} y2={55 + line * 46} stroke="rgba(18,26,46,0.06)" />)}
                  <polyline points={typePoints} fill="none" stroke="#6D96FE" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  {typeEvolutionPosts.map((post, index) => {
                    const x = typeEvolutionPosts.length <= 1 ? 58 : 58 + (index / Math.max(typeEvolutionPosts.length - 1, 1)) * 820;
                    const y = 210 - (getDataMetricValue(post, dataMetric) / typeMax) * 150;
                    const analytics = normalizeAnalytics(post.analytics);
                    return (
                      <foreignObject key={post.id} x={x - 16} y={y - 18} width="38" height="42" style={{ cursor: "pointer" }} onClick={() => { setActiveTab("posts"); selectPost(post); }}>
                        <div style={{ width: 28, height: 32, margin: 4, borderRadius: 5, border: "2px solid #fff", background: analytics.mediaPreviewUrl ? `url(${analytics.mediaPreviewUrl}) center / cover` : "#cfcfcf", boxShadow: previewShadow }} />
                      </foreignObject>
                    );
                  })}
                </svg>
              )}
            </section>
          </div>
        ) : (
          <>
        <section style={{ display: "none", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 13, marginBottom: 42 }}>
          {[
            { label: "Posts publiés", value: publishedPosts.length, icon: <BarChart3 size={17} style={{ color: "rgba(18,26,46,0.24)" }} /> },
            { label: "Impressions", value: formatNumber(totalImpressions), icon: <Eye size={17} style={{ color: "rgba(18,26,46,0.24)" }} /> },
            { label: "Réactions", value: formatNumber(totalReactions), icon: <ThumbsUp size={17} style={{ color: "rgba(18,26,46,0.24)" }} /> },
            { label: "Clics sur le lien", value: formatNumber(totalLinkClicks || totalComments), icon: <MousePointerClick size={17} style={{ color: "rgba(18,26,46,0.24)" }} /> },
          ].map((card) => (
            <article key={card.label} style={{ minHeight: 106, borderRadius: 20, border: "1px solid rgba(18,26,46,0.16)", background: "#fff", boxShadow: cardShadow, padding: "20px 22px", boxSizing: "border-box" }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: "#ececec", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 13 }}>
                {card.icon}
              </div>
              <p style={{ margin: 0, fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.7)" }}>{card.label}</p>
              <strong style={{ display: "block", marginTop: 8, fontSize: 20, fontWeight: 600, color: "#121a2e", lineHeight: 1 }}>{card.value}</strong>
            </article>
          ))}
        </section>

        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 32, position: "relative" }}>
            <h2 style={{ margin: 0, fontSize: 24, lineHeight: "28px", fontWeight: 600, color: "#121a2e", letterSpacing: "-0.45px" }}>
              {showPendingCsvPosts ? "Posts validés sans CSV" : "Tous les posts"}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSortOpen(false);
                  setShowPendingCsvPosts((current) => !current);
                }}
                style={{ border: "1px solid rgba(18,26,46,0.12)", background: showPendingCsvPosts ? "#121a2e" : "#fff", borderRadius: 18, minHeight: 38, padding: "0 15px", fontFamily: '"Inter", sans-serif', fontSize: 14, fontWeight: 600, color: showPendingCsvPosts ? "#fff" : "rgba(18,26,46,0.72)", cursor: "pointer", boxShadow: sortShadow, display: "flex", alignItems: "center", gap: 6 }}
              >
                À importer {pendingCsvPosts.length > 0 ? `(${pendingCsvPosts.length})` : ""}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSortOpen((current) => !current);
                }}
                style={{ border: "1px solid rgba(18,26,46,0.12)", background: "#fff", borderRadius: 18, minHeight: 38, padding: "0 15px", fontFamily: '"Inter", sans-serif', fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.72)", cursor: "pointer", boxShadow: sortShadow, display: "flex", alignItems: "center", gap: 6 }}
              >
                {SORT_OPTIONS.find((option) => option.key === sortBy)?.label ?? "Plus récent"} <SlidersHorizontal size={15} style={{ color: "rgba(18,26,46,0.48)" }} />
              </button>
            </div>
            {sortOpen ? (
              <div onClick={(event) => event.stopPropagation()} style={{ position: "absolute", top: 46, right: 0, zIndex: 5, width: 210, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 14, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(14px)", boxShadow: "0 18px 38px rgba(18,26,46,0.12)", padding: 6, animation: "fadeIn 0.16s ease-out" }}>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onMouseEnter={() => setHoveredSortKey(option.key)}
                    onMouseLeave={() => setHoveredSortKey((current) => (current === option.key ? null : current))}
                    onClick={() => {
                      setSortBy(option.key);
                      setSortOpen(false);
                    }}
                    style={{
                      width: "100%",
                      border: 0,
                      borderRadius: 10,
                      background: sortBy === option.key || hoveredSortKey === option.key ? "rgba(0,0,0,0.03)" : "transparent",
                      marginBottom: option.key === SORT_OPTIONS[SORT_OPTIONS.length - 1].key ? 0 : 4,
                      padding: "10px 11px",
                      textAlign: "left",
                      fontFamily: '"Inter", sans-serif',
                      fontSize: 13,
                      fontWeight: 500,
                      color: "rgba(18,26,46,0.78)",
                      cursor: "pointer",
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div
            onClick={(event) => {
              if (event.target === event.currentTarget) clearEditorSelection();
            }}
            style={{ borderTop: "1px solid rgba(18,26,46,0.08)", paddingTop: 32, minHeight: "55vh" }}
          >
            {visiblePosts.length === 0 ? (
              <div style={{ padding: "70px 20px", textAlign: "center", color: "rgba(18,26,46,0.45)", fontFamily: '"Inter", sans-serif', fontSize: 16 }}>
                {showPendingCsvPosts ? "Aucun post validé n'attend de CSV." : "Importe un export LinkedIn pour faire apparaître tes posts ici."}
              </div>
            ) : (
              visiblePosts.map((post) => {
                const analytics = normalizeAnalytics(post.analytics);
                const isActive = selectedPostId === post.id;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      selectPost(post);
                    }}
                    onMouseEnter={() => setHoveredPostId(post.id)}
                    onMouseLeave={() => setHoveredPostId((current) => (current === post.id ? null : current))}
                    style={{
                      width: "100%",
                      minHeight: 118,
                      border: 0,
                      borderBottom: "none",
                      background: "transparent",
                      display: "grid",
                      gridTemplateColumns: "84px minmax(180px, 1fr) auto auto 42px",
                      alignItems: "center",
                      gap: 8,
                      padding: 16,
                      textAlign: "left",
                      cursor: "pointer",
                      borderRadius: 13,
                      margin: "0 0 32px",
                      boxSizing: "border-box",
                      boxShadow: "none",
                      backgroundColor: isActive ? "rgba(0,0,0,0.03)" : hoveredPostId === post.id ? "rgba(0,0,0,0.02)" : "transparent",
                      transition: "background-color 0.14s ease",
                    }}
                  >
                    <MediaSquare analytics={analytics} />
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 16, lineHeight: "21px", fontWeight: 500, color: "#121a2e", letterSpacing: "-0.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {buildPostTitle(post)}
                      </h3>
                      <p style={{ margin: "7px 0 0", fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.7)" }}>
                        {formatPreviewDate(post)}
                      </p>
                    </div>
                    <div style={{ minHeight: 46, borderRadius: 11, background: "rgba(0,0,0,0.05)", padding: "0 16px", display: "flex", alignItems: "center", fontFamily: '"Inter", sans-serif', fontSize: 16, fontWeight: 500, color: "rgba(18,26,46,0.75)", whiteSpace: "nowrap" }}>
                      {formatNumber(analytics.reactions)} réactions <ReactionDots />
                    </div>
                    <div style={{ minHeight: 46, borderRadius: 11, background: "rgba(0,0,0,0.05)", padding: "0 16px", display: "flex", alignItems: "center", fontFamily: '"Inter", sans-serif', fontSize: 16, fontWeight: 500, color: "rgba(18,26,46,0.75)", whiteSpace: "nowrap" }}>
                      {formatNumber(analytics.impressions)} impressions
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Supprimer le post"
                      onClick={(event) => {
                        event.stopPropagation();
                        deletePost(post.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          deletePost(post.id);
                        }
                      }}
                      style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#c53434", cursor: "pointer", boxShadow: sortShadow }}
                    >
                      <Trash2 size={15} />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
          </>
        )}
      </main>

      {dataOverlay ? (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 35, background: "rgba(18,26,46,0.16)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setDataOverlay(null)}
        >
          <div
            style={{ width: "min(460px, 100%)", borderRadius: 20, background: "#fff", border: "1px solid #e1e4e8", boxShadow: "0 24px 70px rgba(18,26,46,0.18)", padding: 22 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "#f2f5ff", color: "#0147ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Info size={18} />
              </div>
              <button type="button" onClick={() => setDataOverlay(null)} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid #e1e4e8", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }} aria-label="Fermer">
                <X size={16} style={{ color: "#6f7887" }} />
              </button>
            </div>
            <h3 style={{ margin: "18px 0 8px", fontSize: 20, fontWeight: 700, color: "#121a2e" }}>{dataOverlay.title}</h3>
            <p style={{ margin: 0, fontFamily: '"Inter", sans-serif', fontSize: 14, lineHeight: 1.65, color: "rgba(18,26,46,0.68)" }}>{dataOverlay.body}</p>
          </div>
        </div>
      ) : null}

      {linkOverlayOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(18,26,46,0.18)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setLinkOverlayOpen(false)}>
          <div style={{ width: "min(560px, 100%)", maxHeight: "72vh", overflow: "hidden", borderRadius: 20, background: "#fff", border: "1px solid #e1e4e8", boxShadow: "0 24px 70px rgba(18,26,46,0.18)", display: "flex", flexDirection: "column" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #edf0f3", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.3px" }}>Lier les statistiques</h3>
                <p style={{ margin: "5px 0 0", fontSize: 13, color: "#6f7887", fontFamily: '"Inter", sans-serif' }}>Choisis le post existant auquel rattacher cet export LinkedIn.</p>
              </div>
              <button type="button" onClick={() => setLinkOverlayOpen(false)} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid #e1e4e8", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} aria-label="Fermer">
                <X size={16} style={{ color: "#6f7887" }} />
              </button>
            </div>
            <div style={{ padding: 16, borderBottom: "1px solid #edf0f3" }}>
              <div style={{ minHeight: 44, borderRadius: 12, border: "1px solid #e1e4e8", background: "#f8f9fb", display: "flex", alignItems: "center", gap: 10, padding: "0 12px" }}>
                <Search size={16} style={{ color: "#6f7887" }} />
                <input value={linkSearch} onChange={(event) => setLinkSearch(event.target.value)} placeholder="Rechercher par titre, contenu ou style..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontFamily: '"Inter", sans-serif', fontSize: 14, color: "#121a2e" }} autoFocus />
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {linkCandidates.length === 0 ? (
                <p style={{ margin: 0, padding: 20, textAlign: "center", color: "#6f7887", fontSize: 14 }}>Aucun post trouve.</p>
              ) : linkCandidates.map((post) => {
                const analytics = normalizeAnalytics(post.analytics);
                return (
                  <button key={post.id} type="button" onClick={() => linkImportedAnalyticsToPost(post)} style={{ border: 0, borderRadius: 14, background: "#fff", padding: 10, display: "grid", gridTemplateColumns: "52px 1fr", gap: 12, textAlign: "left", cursor: "pointer" }}>
                    <span style={{ width: 52, height: 58, borderRadius: 6, border: "3px solid #fff", background: analytics.mediaPreviewUrl ? `url(${analytics.mediaPreviewUrl}) center / cover` : "#ccc", boxShadow: previewShadow }} />
                    <span style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#121a2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{buildPostTitle(post)}</strong>
                      <span style={{ display: "block", marginTop: 5, fontSize: 12, color: "#6f7887" }}>{post.status === "published" ? "Valide LinkedIn" : post.status === "scheduled" ? "Planifie" : "Brouillon"} · {post.styleName ?? "Sans style"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={figmaLabelStyle}>{label}</span>
      {children}
    </label>
  );
}
