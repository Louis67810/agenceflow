"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import {
  DEFAULT_STYLES,
  STYLE_CATEGORY_COLORS,
  type LinkedInPost,
  type LinkedInPostAnalytics,
  type LinkedInStyle,
} from "@/types/linkedin";
import {
  computeLinkedInPostScore,
  createImportedAnalyticsPost,
  findPostByAnalytics,
  loadLinkedInPosts,
  mergePostAnalytics,
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

type EditableAnalytics = Omit<LinkedInPostAnalytics, "importedAt" | "sourceFileName">;
type PostFormat = NonNullable<LinkedInPostAnalytics["format"]>;
type SortKey = "date" | "impressions" | "reactions" | "comments" | "linkClicks" | "score";

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "score", label: "Meilleure performance" },
  { key: "date", label: "Plus récent" },
  { key: "impressions", label: "Plus d'impressions" },
  { key: "reactions", label: "Plus de réactions" },
  { key: "comments", label: "Plus de commentaires" },
  { key: "linkClicks", label: "Plus de clics lien" },
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
  minHeight: 46,
  padding: "12px 18px",
  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
  color: "#fff",
  border: "1px solid #2f4d9d",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.45px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "inset 0px -3px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.2)",
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

function buildPostTitle(post: LinkedInPost) {
  const words = post.content.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return "Post LinkedIn importé";
  const title = words.slice(0, 4).join(" ");
  return words.length > 4 ? `${title}...` : title;
}

function getPostContentFallback(post: LinkedInPost) {
  if (post.content && !post.content.startsWith("http")) return post.content;
  return "";
}

function getMetricTotal(posts: LinkedInPost[], key: "impressions" | "reactions" | "comments" | "linkClicks") {
  return posts.reduce((sum, post) => sum + (normalizeAnalytics(post.analytics)[key] ?? 0), 0);
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
  return (
    <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 8 }}>
      {["#0A66C2", "#e34d2f", "#22c55e", "#94a3b8", "#ef4444"].map((color, index) => (
        <span
          key={color}
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: color,
            border: "2px solid #f0f0f0",
            marginLeft: index === 0 ? 0 : -6,
            display: "inline-block",
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
        border: "2px solid #fff",
        background: analytics.mediaPreviewUrl ? `url(${analytics.mediaPreviewUrl}) center / cover` : "#ccc",
        boxShadow: "0px 16px 22px rgba(0,0,0,0.11)",
        transform: "rotate(-1.83deg)",
        flexShrink: 0,
      }}
    />
  );
}

function styleChipColors(style: LinkedInStyle) {
  const category = STYLE_CATEGORY_COLORS[style.category] ?? STYLE_CATEGORY_COLORS.custom;
  if (category.includes("purple")) return { bg: "#f3e8ff", color: "#7e22ce", border: "#e9d5ff" };
  if (category.includes("blue")) return { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" };
  if (category.includes("teal")) return { bg: "#ccfbf1", color: "#0f766e", border: "#99f6e4" };
  if (category.includes("red")) return { bg: "#fee2e2", color: "#b91c1c", border: "#fecaca" };
  if (category.includes("orange")) return { bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" };
  if (category.includes("indigo")) return { bg: "#e0e7ff", color: "#4338ca", border: "#c7d2fe" };
  return { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0" };
}

function StyleChip({
  style,
  active,
  onClick,
}: {
  style: LinkedInStyle;
  active: boolean;
  onClick: () => void;
}) {
  const colors = styleChipColors(style);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? colors.color : colors.border}`,
        background: active ? colors.bg : "#fff",
        color: colors.color,
        borderRadius: 999,
        padding: "7px 10px",
        fontFamily: '"Inter", sans-serif',
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        lineHeight: 1,
        boxShadow: active ? "0 6px 14px rgba(18,26,46,0.08)" : "none",
      }}
    >
      {style.name}
    </button>
  );
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
  const [sortBy, setSortBy] = useState<SortKey>("score");
  const [sortOpen, setSortOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);
  const [importDragActive, setImportDragActive] = useState(false);
  const [mediaDragActive, setMediaDragActive] = useState(false);

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

  const publishedPosts = useMemo(
    () => posts.filter((post) => post.status === "published"),
    [posts]
  );

  const visiblePosts = useMemo(() => {
    const sorted = [...publishedPosts];
    if (sortBy === "date") {
      return sorted.sort((a, b) => {
        const aDate = a.publishedAt || a.createdAt;
        const bDate = b.publishedAt || b.createdAt;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    }
    if (sortBy !== "score") {
      return sorted.sort((a, b) => {
        const aValue = normalizeAnalytics(a.analytics)[sortBy] ?? 0;
        const bValue = normalizeAnalytics(b.analytics)[sortBy] ?? 0;
        return bValue - aValue;
      });
    }
    return sorted.sort((a, b) => computeLinkedInPostScore(b) - computeLinkedInPostScore(a));
  }, [publishedPosts, sortBy]);

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
    });
  }

  function clearEditorSelection(message?: string) {
    setSelectedPostId(null);
    setEditor(emptyEditableAnalytics());
    setPostContent("");
    setSelectedStyleId("");
    if (message) setImportMessage(message);
  }

  function handleEditorChange<K extends keyof EditableAnalytics>(key: K, value: EditableAnalytics[K]) {
    setEditor((prev) => ({ ...prev, [key]: value }));
  }

  function saveEditor() {
    if (!selectedPostId || !canSave) return;
    const selectedStyle = styles.find((style) => style.id === selectedStyleId);
    const updated = posts.map((post) => {
      if (post.id !== selectedPostId) return post;
      const merged = mergePostAnalytics(post, {
        ...editor,
        importedAt: post.analytics?.importedAt ?? new Date().toISOString(),
      });
      return normalizePost({
        ...merged,
        content: postContent.trim(),
        type: editor.format === "carousel" ? "carousel" : "post",
        styleId: selectedStyle?.id,
        styleName: selectedStyle?.name,
        tags: Array.from(new Set([...(merged.tags ?? []), editor.format ?? "text", selectedStyle?.name ?? ""])).filter(Boolean),
        analytics: normalizeAnalytics({
          ...merged.analytics,
          ...editor,
          format: editor.format,
        }),
      });
    });

    persist(updated);
    clearEditorSelection();
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

      const analytics = data.analytics as LinkedInPostAnalytics;
      const match = findPostByAnalytics(posts, analytics);

      let updatedPosts: LinkedInPost[];
      let targetPost: LinkedInPost;
      if (match) {
        updatedPosts = posts.map((post) => (post.id === match.id ? mergePostAnalytics(post, analytics) : post));
        targetPost = updatedPosts.find((post) => post.id === match.id)!;
      } else {
        targetPost = createImportedAnalyticsPost(analytics);
        updatedPosts = [targetPost, ...posts];
      }

      persist(updatedPosts);
      selectPost(targetPost);
      setImportMessage("");
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

  const uploadIsMedia = Boolean(selectedPost);
  const uploadDragActive = uploadIsMedia ? mediaDragActive : importDragActive;

  const sidebarWidth = isSidebarCollapsed ? 88 : 358;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#fbfbfb", overflow: "hidden", ...jk }}>
      <aside
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          height: "100vh",
          background: "#fff",
          borderRight: "1px solid rgba(18,26,46,0.18)",
          boxShadow: "11px 0px 25px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          transition: "width 0.22s ease, min-width 0.22s ease",
        }}
      >
        <div style={{ padding: isSidebarCollapsed ? "28px 16px 0" : "28px 26px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {!isSidebarCollapsed && (
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
          )}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            style={{
              border: "1px solid rgba(18,26,46,0.14)",
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0px 6px 14px rgba(0,0,0,0.08)",
              minHeight: 34,
              padding: isSidebarCollapsed ? "0 12px" : "0 14px",
              fontFamily: '"Inter", sans-serif',
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(18,26,46,0.72)",
              cursor: "pointer",
              marginLeft: isSidebarCollapsed ? 0 : "auto",
            }}
          >
            {isSidebarCollapsed ? "→" : "← Réduire"}
          </button>
        </div>

        {isSidebarCollapsed ? null : (
        <>
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
              height: 102,
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
            <span style={{ display: "flex", flexDirection: "column", gap: 13, alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(18,26,46,0.7)" }}>
                {uploadIsMedia ? "Importer une photo ici :" : "Importer un post LinkedIn Ici"}
              </span>
              <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.5)" }}>
                {importing ? "Import en cours..." : "Clique ici ou glisse un fichier ici"}
              </span>
            </span>
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

        {selectedPost ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "30px 26px 100px", display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Format du post *">
              <select value={editor.format ?? "text"} onChange={(event) => handleEditorChange("format", event.target.value as PostFormat)} style={figmaInputStyle}>
                <option value="text">Texte</option>
                <option value="image">Image</option>
                <option value="carousel">Carrousel</option>
                <option value="video">Vidéo</option>
              </select>
            </Field>

            <Field label="Style du post *">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 10, border: "1px solid rgba(18,26,46,0.13)", borderRadius: 10, background: "#fff" }}>
                {styles.map((style) => (
                  <StyleChip
                    key={style.id}
                    style={style}
                    active={selectedStyleId === style.id}
                    onClick={() => setSelectedStyleId(style.id)}
                  />
                ))}
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
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {selectedPost ? (
          <div style={{ position: "sticky", bottom: 0, padding: "14px 24px", background: "#fff", boxShadow: "0px -14px 28px rgba(255,255,255,0.9)" }}>
            <button
              type="button"
              onClick={saveEditor}
              disabled={!canSave}
              style={{ ...loginButtonStyle, opacity: canSave ? 1 : 0.48, cursor: canSave ? "pointer" : "not-allowed" }}
            >
              Sauvegarder
            </button>
          </div>
        ) : null}
        </>
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: "28px 30px 44px", overflowY: "auto" }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 13, marginBottom: 42 }}>
          {[
            { label: "Posts publiés", value: publishedPosts.length },
            { label: "Impressions", value: formatNumber(totalImpressions) },
            { label: "Réactions", value: formatNumber(totalReactions) },
            { label: "Clics lien", value: formatNumber(totalLinkClicks || totalComments) },
          ].map((card) => (
            <article key={card.label} style={{ minHeight: 106, borderRadius: 20, border: "1px solid rgba(18,26,46,0.16)", background: "#fff", boxShadow: "0px 12px 22px rgba(0,0,0,0.07)", padding: "20px 22px", boxSizing: "border-box" }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: "#ececec", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 13 }}>
                <span style={{ width: 17, height: 11, border: "2px solid rgba(18,26,46,0.22)", borderRadius: 999, display: "block", position: "relative" }}>
                  <span style={{ position: "absolute", width: 4, height: 4, borderRadius: 999, background: "rgba(18,26,46,0.22)", left: 4.5, top: 1.5 }} />
                </span>
              </div>
              <p style={{ margin: 0, fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.7)" }}>{card.label}</p>
              <strong style={{ display: "block", marginTop: 8, fontSize: 20, fontWeight: 600, color: "#121a2e", lineHeight: 1 }}>{card.value}</strong>
            </article>
          ))}
        </section>

        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 22, position: "relative" }}>
            <h2 style={{ margin: 0, fontSize: 24, lineHeight: "28px", fontWeight: 600, color: "#121a2e", letterSpacing: "-0.45px" }}>
              Tous les posts
            </h2>
            <button
              type="button"
              onClick={() => setSortOpen((current) => !current)}
              style={{ border: "1px solid rgba(18,26,46,0.12)", background: "#fff", borderRadius: 14, minHeight: 38, padding: "0 15px", fontFamily: '"Inter", sans-serif', fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.72)", cursor: "pointer", boxShadow: "0 5px 12px rgba(0,0,0,0.04)" }}
            >
              Trier
            </button>
            {sortOpen ? (
              <div style={{ position: "absolute", top: 46, right: 0, zIndex: 5, width: 210, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 14, background: "#fff", boxShadow: "0 18px 38px rgba(18,26,46,0.12)", padding: 6 }}>
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setSortBy(option.key);
                      setSortOpen(false);
                    }}
                    style={{
                      width: "100%",
                      border: 0,
                      borderRadius: 10,
                      background: sortBy === option.key ? "rgba(0,0,0,0.05)" : "transparent",
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

          <div style={{ borderTop: "1px solid rgba(18,26,46,0.08)" }}>
            {visiblePosts.length === 0 ? (
              <div style={{ padding: "70px 20px", textAlign: "center", color: "rgba(18,26,46,0.45)", fontFamily: '"Inter", sans-serif', fontSize: 16 }}>
                Importe un export LinkedIn pour faire apparaître tes posts ici.
              </div>
            ) : (
              visiblePosts.map((post) => {
                const analytics = normalizeAnalytics(post.analytics);
                const isActive = selectedPostId === post.id;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => selectPost(post)}
                    onMouseEnter={() => setHoveredPostId(post.id)}
                    onMouseLeave={() => setHoveredPostId((current) => (current === post.id ? null : current))}
                    style={{
                      width: "100%",
                      minHeight: 118,
                      border: 0,
                      borderBottom: "1px solid rgba(18,26,46,0.06)",
                      background: "transparent",
                      display: "grid",
                      gridTemplateColumns: "84px minmax(180px, 1fr) auto auto",
                      alignItems: "center",
                      gap: 16,
                      padding: 16,
                      textAlign: "left",
                      cursor: "pointer",
                      borderRadius: 13,
                      margin: "0 0 6px",
                      boxSizing: "border-box",
                      boxShadow: "none",
                      backgroundColor: isActive ? "rgba(0,0,0,0.05)" : hoveredPostId === post.id ? "rgba(0,0,0,0.03)" : "transparent",
                      transition: "background-color 0.14s ease",
                    }}
                  >
                    <MediaSquare analytics={analytics} />
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ margin: 0, fontSize: 18, lineHeight: "23px", fontWeight: 600, color: "#121a2e", letterSpacing: "-0.25px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {buildPostTitle(post)}
                      </h3>
                      <p style={{ margin: "7px 0 0", fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.7)" }}>
                        {formatPreviewDate(post)}
                      </p>
                    </div>
                    <div style={{ minHeight: 46, borderRadius: 11, background: "#f0f0f0", padding: "0 16px", display: "flex", alignItems: "center", fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.75)", whiteSpace: "nowrap" }}>
                      {formatNumber(analytics.reactions)} réactions <ReactionDots />
                    </div>
                    <div style={{ minHeight: 46, borderRadius: 11, background: "#f0f0f0", padding: "0 16px", display: "flex", alignItems: "center", fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.75)", whiteSpace: "nowrap" }}>
                      {formatNumber(analytics.impressions)} impressions
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </main>
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
