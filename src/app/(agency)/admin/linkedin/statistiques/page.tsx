"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import type { LinkedInPost, LinkedInPostAnalytics } from "@/types/linkedin";
import {
  createImportedAnalyticsPost,
  findPostByAnalytics,
  loadLinkedInPosts,
  mergePostAnalytics,
  normalizeAnalytics,
  normalizePosts,
  saveLinkedInPosts,
  computeLinkedInPostScore,
} from "@/lib/linkedin/posts";
import {
  fetchRemoteLinkedInPosts,
  flushPendingRemoteLinkedInPosts,
  persistRemoteLinkedInPosts,
} from "@/lib/linkedin/remote";

const jk: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };

type EditableAnalytics = Omit<LinkedInPostAnalytics, "importedAt" | "sourceFileName">;
type MetricKey =
  | "impressions"
  | "reach"
  | "reactions"
  | "comments"
  | "profileViews"
  | "linkClicks"
  | "saves"
  | "sends"
  | "engagementRate";

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#f6f6f6",
  border: "1px solid rgba(0,0,0,0.09)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  color: "#121a2e",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

const loginButtonStyle: CSSProperties = {
  width: "100%",
  padding: "15px 20px",
  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
  color: "#fff",
  border: "1px solid #2f4d9d",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.45px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "inset 0px -3px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.2)",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

const metricOptions: Array<{ key: MetricKey; label: string; short: string }> = [
  { key: "impressions", label: "Impressions", short: "Impr." },
  { key: "reach", label: "Membres touches", short: "Reach" },
  { key: "reactions", label: "Reactions", short: "React." },
  { key: "comments", label: "Commentaires", short: "Com." },
  { key: "profileViews", label: "Vues profil", short: "Profil" },
  { key: "linkClicks", label: "Clics lien", short: "Clics" },
  { key: "saves", label: "Enregistrements", short: "Saves" },
  { key: "sends", label: "Envois LinkedIn", short: "Envois" },
  { key: "engagementRate", label: "Taux d'engagement", short: "Eng. %" },
];

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

function formatMetricValue(metric: MetricKey, value: number) {
  if (metric === "engagementRate") return `${value.toFixed(1)}%`;
  return value.toLocaleString("fr-FR");
}

function getMetricValue(post: LinkedInPost, metric: MetricKey) {
  const analytics = normalizeAnalytics(post.analytics);
  return analytics[metric] ?? 0;
}

function formatPreviewDate(post: LinkedInPost) {
  const analytics = normalizeAnalytics(post.analytics);
  const raw = analytics.publishedDate || post.publishedAt?.slice(0, 10);
  if (!raw) return "Non date";
  try {
    return new Date(`${raw}T12:00:00`).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return raw;
  }
}

function buildPdfPreviewDataUrl(fileName: string) {
  const safeName = fileName.replace(/[&<>"']/g, "");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
      <rect width="800" height="520" rx="32" fill="#eef2ff"/>
      <rect x="56" y="56" width="688" height="408" rx="28" fill="#ffffff" stroke="#dbe4ff" stroke-width="8"/>
      <rect x="96" y="104" width="160" height="188" rx="24" fill="#f04444"/>
      <text x="176" y="212" text-anchor="middle" font-size="54" font-family="Arial" font-weight="700" fill="#ffffff">PDF</text>
      <rect x="298" y="132" width="362" height="24" rx="12" fill="#d6def5"/>
      <rect x="298" y="182" width="312" height="20" rx="10" fill="#e4e9f7"/>
      <rect x="298" y="224" width="284" height="20" rx="10" fill="#e4e9f7"/>
      <rect x="298" y="266" width="334" height="20" rx="10" fill="#e4e9f7"/>
      <text x="96" y="356" font-size="30" font-family="Arial" font-weight="700" fill="#172033">${safeName.slice(0, 28)}</text>
      <text x="96" y="400" font-size="22" font-family="Arial" fill="#64748b">Apercu compresse pour distinguer le carrousel</text>
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

  const maxWidth = 520;
  const maxHeight = 520;
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = Math.max(120, Math.round(image.width * ratio));
  const height = Math.max(120, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const previewUrl = canvas.toDataURL("image/jpeg", 0.56);
  const bytes = Math.round((previewUrl.length * 3) / 4);
  return { previewUrl, bytes };
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
    const previewUrl = buildPdfPreviewDataUrl(file.name);
    return {
      previewUrl,
      previewKind: "pdf" as const,
      fileName: file.name,
      bytes: file.size,
    };
  }

  throw new Error("Seuls les images et les PDF sont supportes.");
}

function AnalyticsChart({
  posts,
  metric,
  selectedPostId,
  onSelectPost,
}: {
  posts: LinkedInPost[];
  metric: MetricKey;
  selectedPostId: string | null;
  onSelectPost: (post: LinkedInPost) => void;
}) {
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);

  const data = useMemo(() => {
    const sorted = [...posts].sort((a, b) => {
      const aDate = a.publishedAt || a.createdAt;
      const bDate = b.publishedAt || b.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });
    const max = Math.max(...sorted.map((post) => getMetricValue(post, metric)), 1);
    return sorted.map((post, index) => {
      const x = sorted.length === 1 ? 40 : 40 + (index * 760) / (sorted.length - 1);
      const value = getMetricValue(post, metric);
      const y = 210 - (value / max) * 158;
      return { post, x, y, value };
    });
  }, [metric, posts]);

  const polyline = data.map((point) => `${point.x},${point.y}`).join(" ");
  const hoveredPost = data.find((point) => point.post.id === hoveredPostId)?.post ?? null;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>{metricOptions.find((item) => item.key === metric)?.label}</h3>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.45)" }}>
            Hover pour voir l'aperçu du post, clique pour ouvrir la fiche detaillee.
          </p>
        </div>
      </div>

      <svg viewBox="0 0 840 240" style={{ width: "100%", height: 240, display: "block" }}>
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            x1={32}
            x2={808}
            y1={46 + line * 48}
            y2={46 + line * 48}
            stroke="rgba(18,26,46,0.08)"
            strokeDasharray="5 7"
          />
        ))}
        {data.length > 1 && (
          <polyline
            fill="none"
            stroke="#0147ff"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polyline}
          />
        )}
        {data.length === 1 && (
          <circle cx={data[0].x} cy={data[0].y} r={7} fill="#0147ff" />
        )}
        {data.map((point) => {
          const active = point.post.id === selectedPostId || point.post.id === hoveredPostId;
          return (
            <g key={point.post.id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={active ? 9 : 7}
                fill={active ? "#0A66C2" : "#ffffff"}
                stroke="#0147ff"
                strokeWidth={3}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredPostId(point.post.id)}
                onMouseLeave={() => setHoveredPostId((current) => (current === point.post.id ? null : current))}
                onClick={() => onSelectPost(point.post)}
              />
            </g>
          );
        })}
      </svg>

      {hoveredPost && (
        <div
          style={{
            position: "absolute",
            top: 22,
            right: 22,
            width: 280,
            borderRadius: 18,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "#fff",
            boxShadow: "0 20px 50px rgba(10,30,80,0.14)",
            overflow: "hidden",
          }}
        >
          <MediaThumb analytics={normalizeAnalytics(hoveredPost.analytics)} compact={false} />
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#121a2e", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {hoveredPost.content}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 12, color: "rgba(18,26,46,0.45)" }}>{formatPreviewDate(hoveredPost)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0147ff" }}>
                {formatMetricValue(metric, getMetricValue(hoveredPost, metric))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaThumb({
  analytics,
  compact,
}: {
  analytics: LinkedInPostAnalytics;
  compact: boolean;
}) {
  if (analytics.mediaPreviewUrl) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: compact ? "1 / 0.74" : "1 / 0.64",
          backgroundImage: `url(${analytics.mediaPreviewUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#eef2ff",
          borderBottom: compact ? "none" : "1px solid rgba(0,0,0,0.06)",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: compact ? "1 / 0.74" : "1 / 0.64",
        background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "rgba(18,26,46,0.4)",
        fontSize: compact ? 11 : 13,
        fontWeight: 600,
      }}
    >
      Aucun apercu media
    </div>
  );
}

export default function LinkedInStatsPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditableAnalytics>(emptyEditableAnalytics());
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [metric, setMetric] = useState<MetricKey>("impressions");
  const [importDragActive, setImportDragActive] = useState(false);
  const [mediaDragActive, setMediaDragActive] = useState(false);

  useEffect(() => {
    const loaded = loadLinkedInPosts();
    setPosts(loaded);

    void (async () => {
      try {
        await flushPendingRemoteLinkedInPosts();
        const remotePosts = await fetchRemoteLinkedInPosts();
        if (remotePosts.length > 0) {
          setPosts(remotePosts);
          saveLinkedInPosts(remotePosts);
        } else if (loaded.length > 0) {
          await persistRemoteLinkedInPosts(loaded, true);
        }
      } catch {}
    })();
  }, []);

  const publishedPosts = useMemo(
    () => posts.filter((post) => post.status === "published"),
    [posts]
  );

  const rankedPosts = useMemo(
    () => [...publishedPosts].sort((a, b) => computeLinkedInPostScore(b) - computeLinkedInPostScore(a)),
    [publishedPosts]
  );

  const bestPost = rankedPosts[0] ?? null;
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
  const totalImpressions = publishedPosts.reduce((sum, post) => sum + (post.analytics?.impressions ?? post.impressions ?? 0), 0);
  const totalReach = publishedPosts.reduce((sum, post) => sum + (post.analytics?.reach ?? 0), 0);
  const totalReactions = publishedPosts.reduce((sum, post) => sum + (post.analytics?.reactions ?? post.likes ?? 0), 0);
  const averageEngagement = publishedPosts.length === 0
    ? 0
    : publishedPosts.reduce((sum, post) => sum + (post.analytics?.engagementRate ?? 0), 0) / publishedPosts.length;

  const topicStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const post of publishedPosts) {
      const topic = normalizeAnalytics(post.analytics).topic?.trim();
      if (!topic) continue;
      const current = map.get(topic) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += getMetricValue(post, metric);
      map.set(topic, current);
    }
    return [...map.entries()]
      .map(([label, value]) => ({
        label,
        count: value.count,
        average: value.total / value.count,
      }))
      .sort((a, b) => b.average - a.average)
      .slice(0, 6);
  }, [metric, publishedPosts]);

  const formatStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const post of publishedPosts) {
      const format = normalizeAnalytics(post.analytics).format || post.type || "other";
      const current = map.get(format) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += getMetricValue(post, metric);
      map.set(format, current);
    }
    return [...map.entries()]
      .map(([label, value]) => ({
        label,
        count: value.count,
        average: value.total / value.count,
      }))
      .sort((a, b) => b.average - a.average);
  }, [metric, publishedPosts]);

  function persist(updatedPosts: LinkedInPost[]) {
    const normalized = normalizePosts(updatedPosts);
    setPosts(normalized);
    saveLinkedInPosts(normalized);
    void persistRemoteLinkedInPosts(normalized, true);
  }

  function selectPost(post: LinkedInPost) {
    setSelectedPostId(post.id);
    const analytics = normalizeAnalytics(post.analytics);
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
    if (message) setImportMessage(message);
  }

  function handleEditorChange<K extends keyof EditableAnalytics>(key: K, value: EditableAnalytics[K]) {
    setEditor((prev) => ({ ...prev, [key]: value }));
  }

  function saveEditor() {
    if (!selectedPostId) return;
    const updated = posts.map((post) =>
      post.id === selectedPostId
        ? mergePostAnalytics(post, {
            ...editor,
            importedAt: post.analytics?.importedAt ?? new Date().toISOString(),
          })
        : post
    );
    persist(updated);
    clearEditorSelection("Statistiques sauvegardees. La fiche a ete refermee pour faciliter un nouvel import.");
  }

  async function handleImport(file: File) {
    setImporting(true);
    setImportMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/linkedin/import-analytics", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import impossible");

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
      setImportMessage(match ? "Statistiques fusionnees avec le post existant." : "Nouveau post analytique cree a partir de l'import.");
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
      setImportMessage(`Apercu media pret (${Math.round(preview.bytes / 1024)} ko env.).`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Media impossible a charger.");
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

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#f7f8fc", ...jk }}>
      <div
        style={{
          width: 360,
          borderRight: "1px solid rgba(0,0,0,0.08)",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#121a2e" }}>Donnees LinkedIn</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.45)", lineHeight: 1.5 }}>
            Glisse un export LinkedIn CSV/XLSX, puis enrichis tes posts avec leurs vrais medias et statistiques.
          </p>
        </div>

        <div style={{ padding: 20, borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setImportDragActive(true);
            }}
            onDragLeave={() => setImportDragActive(false)}
            onDrop={handleImportDrop}
            style={{
              display: "flex",
              minHeight: 130,
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "18px 16px",
              borderRadius: 18,
              border: importDragActive ? "1px dashed #6b7280" : "1px dashed #cbd5e1",
              background: importDragActive ? "#eef2f7" : "#f3f4f6",
              color: "#6b7280",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.18s ease",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span>{importing ? "Import en cours..." : "Importer un export LinkedIn"}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.48)" }}>
                Clique ou glisse un fichier ici
              </span>
            </div>
            <input
              type="file"
              accept=".xlsx,.csv"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {importMessage && (
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "rgba(18,26,46,0.55)", lineHeight: 1.55 }}>{importMessage}</p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {rankedPosts.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "rgba(18,26,46,0.4)", fontSize: 13 }}>
              Aucun post publie avec statistiques pour l'instant.
            </div>
          ) : (
            rankedPosts.map((post, index) => {
              const analytics = normalizeAnalytics(post.analytics);
              const active = selectedPostId === post.id;
              return (
                <button
                  key={post.id}
                  onClick={() => selectPost(post)}
                  style={{
                    textAlign: "left",
                    padding: 0,
                    borderRadius: 18,
                    border: active ? "1px solid #9fb4ff" : "1px solid rgba(0,0,0,0.08)",
                    background: active ? "#f4f7ff" : "#fff",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  <MediaThumb analytics={analytics} compact />
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#0147ff" : "rgba(18,26,46,0.4)" }}>
                        #{index + 1}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(18,26,46,0.4)" }}>{formatPreviewDate(post)}</span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: "#121a2e",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {post.content}
                    </p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "rgba(18,26,46,0.55)" }}>
                      <span>{analytics.impressions.toLocaleString("fr-FR")} impr.</span>
                      <span>{analytics.reactions} reactions</span>
                      <span>{analytics.comments} com.</span>
                      <span>{analytics.engagementRate.toFixed(1)}% eng.</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14, marginBottom: 18 }}>
          {[
            { label: "Posts publies", value: publishedPosts.length },
            { label: "Impressions totales", value: totalImpressions.toLocaleString("fr-FR") },
            { label: "Reach total", value: totalReach.toLocaleString("fr-FR") },
            { label: "Reactions totales", value: totalReactions.toLocaleString("fr-FR") },
          ].map((card) => (
            <div key={card.label} style={{ background: "#fff", borderRadius: 18, padding: 18, border: "1px solid rgba(0,0,0,0.08)" }}>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.45)" }}>{card.label}</p>
              <p style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 700, color: "#121a2e" }}>{card.value}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr", gap: 18, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "#fff", borderRadius: 18, padding: 20, border: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>Vue analytique avancee</h3>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.45)" }}>
                    Taux d'engagement moyen: {averageEngagement.toFixed(2)}%
                  </p>
                </div>
                {bestPost && (
                  <button
                    onClick={() => selectPost(bestPost)}
                    style={{
                      border: "1px solid rgba(1,71,255,0.14)",
                      background: "#eef4ff",
                      color: "#0147ff",
                      borderRadius: 999,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Top de l'annee
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {metricOptions.map((option) => {
                  const active = option.key === metric;
                  return (
                    <button
                      key={option.key}
                      onClick={() => setMetric(option.key)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: active ? "1px solid #2f4d9d" : "1px solid rgba(0,0,0,0.08)",
                        background: active ? "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)" : "#f8fafc",
                        color: active ? "#fff" : "rgba(18,26,46,0.6)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <AnalyticsChart posts={rankedPosts} metric={metric} selectedPostId={selectedPostId} onSelectPost={selectPost} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div style={{ background: "#fff", borderRadius: 18, padding: 20, border: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#121a2e" }}>Par sujet</h3>
                  <span style={{ fontSize: 12, color: "rgba(18,26,46,0.45)" }}>{metricOptions.find((option) => option.key === metric)?.short}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topicStats.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: "rgba(18,26,46,0.4)" }}>
                      Renseigne le sujet de tes posts pour comparer ce qui marche le mieux.
                    </p>
                  ) : (
                    topicStats.map((item) => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#121a2e" }}>{item.label}</p>
                          <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(18,26,46,0.4)" }}>{item.count} post(s)</p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#0147ff" }}>{formatMetricValue(metric, item.average)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 18, padding: 20, border: "1px solid rgba(0,0,0,0.08)" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#121a2e" }}>Repartition formats</h3>
                  <span style={{ fontSize: 12, color: "rgba(18,26,46,0.45)" }}>Moyenne</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {formatStats.map((item) => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#121a2e", textTransform: "capitalize" }}>{item.label}</p>
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: "rgba(18,26,46,0.4)" }}>{item.count} post(s)</p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#0147ff" }}>{formatMetricValue(metric, item.average)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 18, padding: 20, border: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>Fiche post</h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.45)" }}>
                  Clique un point du graphique ou une carte a gauche pour ouvrir ses details.
                </p>
              </div>
            </div>

            {selectedPost ? (
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ overflow: "hidden", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)" }}>
                  <MediaThumb analytics={normalizeAnalytics(editor)} compact={false} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#121a2e" }}>{selectedPost.content}</p>
                  {editor.postUrl ? (
                    <a href={editor.postUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0147ff", textDecoration: "none" }}>
                      Ouvrir le post LinkedIn
                    </a>
                  ) : null}
                </div>

                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setMediaDragActive(true);
                  }}
                  onDragLeave={() => setMediaDragActive(false)}
                  onDrop={handleMediaDrop}
                  style={{
                    display: "flex",
                    minHeight: 92,
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: 14,
                    borderRadius: 16,
                    border: mediaDragActive ? "1px dashed #5b6475" : "1px dashed #d1d5db",
                    background: mediaDragActive ? "#eef2f7" : "#f8fafc",
                    color: "#6b7280",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span>Ajouter une image ou un PDF compresse</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.45)" }}>
                      Le preview est leger pour limiter le stockage Supabase/Vercel
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf,application/pdf"
                    style={{ display: "none" }}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleMediaFile(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)" }}>Sujet</label>
                    <input value={toInputValue(editor.topic)} onChange={(event) => handleEditorChange("topic", event.target.value)} style={inputStyle} placeholder="Ex: personal branding" />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)" }}>Format</label>
                    <select value={toInputValue(editor.format || "text")} onChange={(event) => handleEditorChange("format", event.target.value as EditableAnalytics["format"])} style={inputStyle}>
                      <option value="text">Texte</option>
                      <option value="image">Image</option>
                      <option value="carousel">Carousel</option>
                      <option value="video">Video</option>
                      <option value="poll">Sondage</option>
                      <option value="document">Document</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                </div>

                {[
                  ["Lien du post", "postUrl"],
                  ["Date de publication", "publishedDate"],
                  ["Heure", "publishedTime"],
                  ["Lien clique", "linkUrl"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)" }}>{label}</label>
                    <input
                      value={toInputValue(editor[key as keyof EditableAnalytics])}
                      onChange={(event) => handleEditorChange(key as keyof EditableAnalytics, event.target.value as never)}
                      style={inputStyle}
                    />
                  </div>
                ))}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    ["impressions", "Impressions"],
                    ["reach", "Membres touches"],
                    ["profileViews", "Vues profil"],
                    ["followersGained", "Abonnes gagnes"],
                    ["socialEngagement", "Engagement social"],
                    ["reactions", "Reactions"],
                    ["comments", "Commentaires"],
                    ["reposts", "Republications"],
                    ["saves", "Enregistrements"],
                    ["sends", "Envois LinkedIn"],
                    ["linkClicks", "Clics lien"],
                    ["customButtonClicks", "Clics bouton"],
                    ["engagementRate", "Taux engagement %"],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)" }}>{label}</label>
                      <input
                        type="number"
                        min={0}
                        step={key === "engagementRate" ? "0.1" : "1"}
                        value={toInputValue(editor[key as keyof EditableAnalytics])}
                        onChange={(event) => handleEditorChange(key as keyof EditableAnalytics, Number(event.target.value) as never)}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>

                <button onClick={saveEditor} style={loginButtonStyle}>
                  Sauvegarder mes statistiques
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 18, borderRadius: 16, border: "1px dashed rgba(0,0,0,0.12)", background: "#f8fafc", padding: 20 }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(18,26,46,0.5)" }}>
                  Selectionne un post pour le completer. Une fois sauvegarde, la fiche se referme afin que tu puisses en enchainer un autre rapidement.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
