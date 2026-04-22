"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import { BarChart3, ChevronDown, Eye, Link2, MousePointerClick, Search, SlidersHorizontal, ThumbsUp, Upload, X } from "lucide-react";
import {
  DEFAULT_STYLES,
  type LinkedInPost,
  type LinkedInPostAnalytics,
  type LinkedInStyle,
} from "@/types/linkedin";
import {
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

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "date", label: "Plus récent" },
  { key: "impressions", label: "Plus d'impressions" },
  { key: "reactions", label: "Plus de réactions" },
  { key: "comments", label: "Plus de commentaires" },
  { key: "linkClicks", label: "Plus de clics sur le lien" },
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

function emptyEditableAnalytics(): EditableAnalytics {
  return {
    postUrl: "",
    publishedDate: "",
    publishedTime: "",
    linkUrl: "",
    format: "text",
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
  const canSave = Boolean(selectedPostId && postContent.trim() && selectedStyleId && editor.format);

  function persist(updatedPosts: LinkedInPost[]) {
    const normalized = normalizePosts(updatedPosts);
    setPosts(normalized);
    saveLinkedInPosts(normalized);
    void persistRemoteLinkedInPosts(normalized, true);
  }

  function selectPost(post: LinkedInPost) {
    const analytics = normalizeAnalytics(post.analytics);
    setPendingImportedAnalytics(null);
    setLinkOverlayOpen(false);
    setSelectedPostId(post.id);
    setSelectedStyleId(post.styleId ?? styles[0]?.id ?? "");
    setPostContent(getPostContentFallback(post));
    setEditor({
      postUrl: analytics.postUrl ?? post.postUrl ?? "",
      publishedDate: analytics.publishedDate ?? post.publishedAt?.slice(0, 10) ?? "",
      publishedTime: analytics.publishedTime ?? post.publishedAt?.slice(11, 16) ?? "",
      linkUrl: analytics.linkUrl ?? "",
      format: analytics.format ?? (post.type === "carousel" ? "carousel" : "text"),
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
    setSelectedStyleId(styles[0]?.id ?? "");
    setEditor({
      ...emptyEditableAnalytics(),
      ...normalized,
      format: normalized.format ?? "text",
      demographics: normalized.demographics ?? [],
    });
    setPendingImportedAnalytics(normalized);
    setLinkSearch("");
    setLinkOverlayOpen(true);
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
      format: analytics.format ?? post.analytics?.format ?? "text",
    });

    return normalizePost({
      ...post,
      content: content.trim() || post.content,
      postUrl: normalizedAnalytics.postUrl || post.postUrl,
      type: normalizedAnalytics.format === "carousel" ? "carousel" : "post",
      styleId: selectedStyle?.id ?? post.styleId,
      styleName: selectedStyle?.name ?? post.styleName,
      likes: normalizedAnalytics.reactions,
      comments: normalizedAnalytics.comments,
      impressions: normalizedAnalytics.impressions,
      tags: Array.from(new Set([...(post.tags ?? []), normalizedAnalytics.format ?? "text", selectedStyle?.name ?? ""])).filter(Boolean),
      analytics: normalizedAnalytics,
    });
  }

  function saveEditor() {
    if (!selectedPostId || !canSave) return;
    const updated = posts.map((post) => {
      if (post.id !== selectedPostId) return post;
      return mergeAnalyticsIntoExistingPost(post, editor);
    });

    persist(updated);
    clearEditorSelection();
  }

  function linkImportedAnalyticsToPost(post: LinkedInPost) {
    const analyticsToLink = pendingImportedAnalytics ?? normalizeAnalytics({ ...editor, importedAt: new Date().toISOString() });
    const updated = posts.map((item) => (item.id === post.id ? mergeAnalyticsIntoExistingPost(item, analyticsToLink, item.styleId ?? selectedStyleId, item.content) : item));
    persist(updated);
    const linked = updated.find((item) => item.id === post.id);
    setPendingImportedAnalytics(null);
    setLinkOverlayOpen(false);
    setImportMessage("");
    if (linked) selectPost(linked);
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
        ? `Import pret. Correspondance possible : "${buildPostTitle(match)}". Clique sur le post pour le lier.`
        : "Import pret. Lie ces statistiques a un post existant avant de sauvegarder."
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

  return (
    <div
      onClick={() => setSortOpen(false)}
      style={{ display: "flex", height: "100vh", background: "#fbfbfb", overflow: "hidden", ...jk }}
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
          height: "100vh",
          background: "#fff",
          borderRight: "1px solid rgba(18,26,46,0.18)",
          boxShadow: "11px 0px 25px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        <div style={{ padding: "28px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "inline-flex", alignItems: "center", padding: 3, borderRadius: 999, background: "#f0f0f0" }}>
            <button
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 999,
                background: "#fff",
                minHeight: 32,
                padding: "0 18px",
                color: "rgba(18,26,46,0.7)",
                fontFamily: '"Inter", sans-serif',
                fontSize: 13,
                fontWeight: 500,
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              Posts
            </button>
            <button
              disabled
              style={{
                border: 0,
                borderRadius: 999,
                background: "transparent",
                minHeight: 32,
                padding: "0 16px",
                color: "rgba(18,26,46,0.45)",
                fontFamily: '"Inter", sans-serif',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Données
            </button>
          </div>
        </div>

        <div style={{ padding: "22px 26px 0" }}>
          <h1 style={{ margin: 0, fontSize: 22, lineHeight: "25px", fontWeight: 600, color: "#121a2e", letterSpacing: "-0.45px" }}>
            Posts LinkedIn
          </h1>
        </div>

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
          <div style={{ padding: "24px 26px 0", display: "flex", flexDirection: "column", gap: 13 }}>
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
          <div style={{ padding: "30px 26px 100px", display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Format du post *">
              <div style={{ position: "relative" }}>
                <button type="button" onClick={() => setFormatOpen((current) => !current)} style={{ ...figmaInputStyle, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                  <span>{formatLabels[(editor.format ?? "text") as PostFormat]}</span>
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
          <div style={{ position: "sticky", bottom: 0, padding: "12px 20px 16px", background: "#fff", boxShadow: "0px -14px 28px rgba(255,255,255,0.9)", display: "flex", flexDirection: "column", gap: 10 }}>
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
      </aside>

      <main
        onClick={(event) => {
          if (event.target === event.currentTarget) clearEditorSelection();
        }}
        style={{ flex: 1, minWidth: 0, padding: "28px 30px 44px", overflowY: "auto" }}
      >
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
                      gridTemplateColumns: "84px minmax(180px, 1fr) auto auto",
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
                  </button>
                );
              })
            )}
          </div>
        </section>
      </main>

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
