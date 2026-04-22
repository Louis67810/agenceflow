"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  Wand2, Loader2, X, Check, Copy, Trash2, Link2,
  Youtube, Lightbulb, AlignLeft, LayoutTemplate, Edit3,
  ThumbsUp, MessageCircle, Eye, Calendar,
  BarChart2, Clock, Layers, Info,
} from "lucide-react";
import type { LinkedInPost, LinkedInStyle, LinkedInIdea } from "@/types/linkedin";
import { DEFAULT_STYLES } from "@/types/linkedin";
import { loadLinkedInSettings, type LinkedInSettings } from "../layout";
import SmartSelectionTextarea from "@/components/shared/SmartSelectionTextarea";
import {
  computeLinkedInPostScore,
  loadLinkedInPosts,
  mergePostAnalytics,
  normalizeAnalytics,
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
  hasMeaningfulLinkedInWorkspaceData,
  loadLinkedInWorkspaceCache,
  patchRemoteLinkedInWorkspace,
  persistLinkedInWorkspacePatch,
} from "@/lib/linkedin/workspace";
import ClientBlueButton from "@/components/shared/ClientBlueButton";

type SourceTab = "idea" | "url" | "youtube" | "manual";
type PostsView = "draft" | "scheduled";

async function fileToCompressedPreview(file: File): Promise<{ url: string; bytes: number; kind: "image" | "pdf" }> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" rx="20" fill="#f1f5f9"/><rect x="52" y="36" width="216" height="168" rx="16" fill="#fff" stroke="#d8dee8" stroke-width="5"/><rect x="78" y="66" width="74" height="90" rx="11" fill="#ef4444"/><text x="115" y="119" text-anchor="middle" font-size="24" font-family="Arial" font-weight="700" fill="#fff">PDF</text><text x="78" y="180" font-size="14" font-family="Arial" font-weight="700" fill="#121a2e">Aperçu PDF</text></svg>`;
    return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, bytes: file.size, kind: "pdf" };
  }

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
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const url = canvas.toDataURL("image/jpeg", 0.45);
  return { url, bytes: Math.round((url.length * 3) / 4), kind: "image" };
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const jk: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };
const inp: CSSProperties = { width: "100%", background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "#121a2e", outline: "none", boxSizing: "border-box", fontFamily: '"Plus Jakarta Sans", sans-serif' };
const btnGrad: CSSProperties = { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 600 };

const STATUS_STYLES: Record<"draft" | "scheduled" | "published", { bg: string; color: string }> = {
  draft: { bg: "#f6f6f6", color: "rgba(18,26,46,0.5)" },
  scheduled: { bg: "#d5eeff", color: "#073e63" },
  published: { bg: "#d1fae5", color: "#168b64" },
};
const STATUS_LABELS = { draft: "Brouillon", scheduled: "Planifié", published: "Publié" };

// ─────────────────────────────────────────────────────────────────────────────

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [styles, setStyles] = useState<LinkedInStyle[]>(DEFAULT_STYLES);
  const [ideas, setIdeas] = useState<LinkedInIdea[]>([]);

  const [sourceTab, setSourceTab] = useState<SourceTab>("idea");
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const [postType, setPostType] = useState<"post" | "carousel">("post");
  const [carouselSlides, setCarouselSlides] = useState(5);
  const [sourceInput, setSourceInput] = useState("");
  const [manualIdea, setManualIdea] = useState("");
  const [selectedIdeaId, setSelectedIdeaId] = useState("");
  const [scrapedContent, setScrapedContent] = useState("");
  const [scrapedTitle, setScrapedTitle] = useState("");
  const [scraping, setScraping] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedSlides, setGeneratedSlides] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [tags, setTags] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postsView, setPostsView] = useState<PostsView>("draft");
  const [draftMedia, setDraftMedia] = useState<{ url: string; kind: "image" | "pdf"; fileName: string; bytes: number } | null>(null);
  const [manualEditorStarted, setManualEditorStarted] = useState(false);

  const [statsPost, setStatsPost] = useState<LinkedInPost | null>(null);
  const [statsInput, setStatsInput] = useState({
    postUrl: "",
    reactions: 0,
    comments: 0,
    impressions: 0,
    reach: 0,
    profileViews: 0,
    followersGained: 0,
    reposts: 0,
    saves: 0,
    sends: 0,
    linkClicks: 0,
    engagementRate: 0,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<LinkedInSettings | null>(null);

  useEffect(() => {
    const localPosts = loadLinkedInPosts();
    const cachedWorkspace = loadLinkedInWorkspaceCache();
    setPosts(localPosts);
    setStyles(cachedWorkspace.styles);
    setIdeas(cachedWorkspace.ideas);
    setSettings(loadLinkedInSettings());

    void (async () => {
      try {
        await flushPendingRemoteLinkedInPosts();
        const remotePosts = await fetchRemoteLinkedInPosts();
        if (remotePosts.length > 0) {
          setPosts(remotePosts);
          saveLinkedInPosts(remotePosts);
        } else if (localPosts.length > 0) {
          await persistRemoteLinkedInPosts(localPosts, true);
        }
      } catch {}
    })();

    void (async () => {
      try {
        const remoteWorkspace = await fetchRemoteLinkedInWorkspace();
        if (remoteWorkspace.hasStoredData) {
          setStyles(remoteWorkspace.workspace.styles);
          setIdeas(remoteWorkspace.workspace.ideas);
        } else if (hasMeaningfulLinkedInWorkspaceData(cachedWorkspace)) {
          await patchRemoteLinkedInWorkspace(cachedWorkspace);
        }
      } catch {
        setStyles(cachedWorkspace.styles.length > 0 ? cachedWorkspace.styles : DEFAULT_STYLES);
      }
    })();

    const prefill = sessionStorage.getItem("linkedin_idea_prefill");
    if (prefill) {
      try {
        const idea = JSON.parse(prefill);
        setSourceTab("idea");
        setManualIdea(`${idea.title}\n\n${idea.description}`);
        if (idea.styleId) setSelectedStyleId(idea.styleId);
        if (idea.scheduledAt) setScheduleDate(isoToLocalInput(idea.scheduledAt));
        sessionStorage.removeItem("linkedin_idea_prefill");
      } catch {}
    }

    const postPrefill = sessionStorage.getItem("linkedin_post_schedule_prefill");
    if (postPrefill) {
      try {
        const prefillPost = JSON.parse(postPrefill);
        setSourceTab("manual");
        setPostType("post");
        setGeneratedContent(prefillPost.content ?? "");
        setScheduleDate(prefillPost.scheduledAt ? isoToLocalInput(prefillPost.scheduledAt) : "");
        setManualEditorStarted(true);
        setPostsView("draft");
        sessionStorage.removeItem("linkedin_post_schedule_prefill");
      } catch {}
    }
  }, []);

  const filteredPosts = posts
    .filter((post) => post.status === postsView)
    .sort((a, b) => {
      const dateA = a.scheduledAt ?? a.publishedAt ?? a.createdAt;
      const dateB = b.scheduledAt ?? b.publishedAt ?? b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  const topPosts = [...posts]
    .filter(p => p.status === "published")
    .sort((a, b) => computeLinkedInPostScore(b) - computeLinkedInPostScore(a))
    .slice(0, 5)
    .map(p => ({
      content: p.content,
      likes: p.likes,
      comments: p.comments,
      impressions: p.impressions,
      styleName: p.styleName,
      reach: p.analytics?.reach ?? 0,
      profileViews: p.analytics?.profileViews ?? 0,
      followersGained: p.analytics?.followersGained ?? 0,
      reposts: p.analytics?.reposts ?? 0,
      saves: p.analytics?.saves ?? 0,
      sends: p.analytics?.sends ?? 0,
      linkClicks: p.analytics?.linkClicks ?? 0,
      engagementRate: p.analytics?.engagementRate ?? 0,
    }));

  async function handleScrapeUrl() {
    if (!sourceInput.trim()) return;
    setScraping(true); setScrapedContent("");
    try {
      const isYoutube = sourceTab === "youtube" || sourceInput.includes("youtube.com") || sourceInput.includes("youtu.be");
      if (isYoutube) {
        const res = await fetch("/api/linkedin/youtube-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: sourceInput }) });
        const data = await res.json();
        if (res.ok) { setScrapedTitle(data.title); setScrapedContent(`Titre: ${data.title}\nAuteur: ${data.author}\n\n${data.description || "Pas de description disponible."}`); }
        else setGenerationError(data.error);
      } else {
        const res = await fetch("/api/linkedin/scrape-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: sourceInput }) });
        const data = await res.json();
        if (res.ok) { setScrapedTitle(data.title); setScrapedContent(data.content); }
        else setGenerationError(data.error);
      }
    } catch (e) { setGenerationError(String(e)); }
    setScraping(false);
  }

  async function handleGenerate() {
    setGenerating(true); setGenerationError(""); setGeneratedContent(""); setGeneratedSlides([]);
    const currentSettings = settings ?? loadLinkedInSettings();
    const selectedStyle = styles.find(s => s.id === selectedStyleId);
    const selectedIdea = ideas.find(i => i.id === selectedIdeaId);
    let sourceContent = "", sourceTitle = "";
    switch (sourceTab) {
      case "idea": sourceContent = selectedIdea ? `${selectedIdea.title}\n\n${selectedIdea.description}` : manualIdea; sourceTitle = selectedIdea?.title ?? ""; break;
      case "url": case "youtube": sourceContent = scrapedContent || sourceInput; sourceTitle = scrapedTitle; break;
      case "manual": sourceContent = manualIdea; break;
    }
    if (!sourceContent.trim()) { setGenerationError("Veuillez entrer un contenu source."); setGenerating(false); return; }

    let styleExamples: { content: string }[] = [];
    if (selectedStyleId) {
      try {
        const exRes = await fetch(
          `/api/linkedin/style-examples?styleId=${encodeURIComponent(selectedStyleId)}&query=${encodeURIComponent(sourceContent.slice(0, 3000))}`
        );
        const exData = await exRes.json();
        styleExamples = (exData.examples ?? []).slice(0, 3);
      } catch {}
    }

    try {
      const res = await fetch("/api/linkedin/generate-post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: sourceTab, sourceContent, sourceTitle,
          style: selectedStyle ? { name: selectedStyle.name, prompt: selectedStyle.prompt, category: selectedStyle.category } : undefined,
          styleExamples, type: postType, carouselSlides,
          carouselTemplate: postType === "carousel" ? currentSettings.carouselTemplate : undefined,
          topPosts, language: currentSettings.language,
          openrouterApiKey: currentSettings.openrouterApiKey || undefined, model: currentSettings.model,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.type === "carousel" && data.slides) { setGeneratedSlides(data.slides); setActiveSlide(0); }
        else setGeneratedContent(data.content);
        if (selectedIdeaId) {
          const updated = ideas.map(i => i.id === selectedIdeaId ? { ...i, status: "used" as const, usedAt: new Date().toISOString() } : i);
          setIdeas(updated);
          persistLinkedInWorkspacePatch({ ideas: updated });
        }
      } else setGenerationError(data.error);
    } catch (e) { setGenerationError(String(e)); }
    setGenerating(false);
  }

  function resetEditor() {
    setEditingPostId(null);
    setGeneratedContent("");
    setGeneratedSlides([]);
    setManualIdea("");
    setSourceInput("");
    setScrapedContent("");
    setScrapedTitle("");
    setTags("");
    setScheduleDate("");
    setDraftMedia(null);
    setManualEditorStarted(false);
  }

  function isoToLocalInput(iso?: string) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function openPostForEdit(post: LinkedInPost) {
    setEditingPostId(post.id);
    setPostType(post.type);
    setSourceTab(post.sourceType === "idea" || post.sourceType === "manual" || post.sourceType === "url" || post.sourceType === "youtube" ? post.sourceType : "manual");
    setSelectedStyleId(post.styleId ?? "");
    setGeneratedContent(post.type === "carousel" ? "" : post.content);
    setGeneratedSlides(post.type === "carousel" ? post.slides ?? post.content.split("\n\n---\n\n") : []);
    setActiveSlide(0);
    setManualIdea(post.sourceType === "manual" ? post.content : "");
    setSourceInput(post.sourceUrl ?? "");
    setScrapedTitle(post.sourceTitle ?? "");
    setScrapedContent("");
    setTags("");
    setScheduleDate(isoToLocalInput(post.scheduledAt));
    const analytics = normalizeAnalytics(post.analytics);
    setDraftMedia(analytics.mediaPreviewUrl ? {
      url: analytics.mediaPreviewUrl,
      kind: analytics.mediaPreviewKind === "pdf" ? "pdf" : "image",
      fileName: analytics.mediaFileName ?? "media",
      bytes: analytics.mediaStorageBytes ?? 0,
    } : null);
    setManualEditorStarted(true);
  }

  function startManualPost() {
    setSourceTab("manual");
    setEditingPostId(null);
    setGeneratedContent("");
    setGeneratedSlides([]);
    setPostType("post");
    setGenerationError("");
    setDraftMedia(null);
    setManualEditorStarted(true);
  }

  async function handleDraftMedia(file: File) {
    try {
      const preview = await fileToCompressedPreview(file);
      setDraftMedia({ url: preview.url, kind: preview.kind, fileName: file.name, bytes: preview.bytes });
      setGenerationError("");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Image impossible à charger.");
    }
  }

  function handleSave(status: "draft" | "scheduled" | "published") {
    const content = postType === "carousel" ? generatedSlides.join("\n\n---\n\n") : generatedContent;
    if (!content.trim()) return;
    setSaving(true);
    const selectedStyle = styles.find(s => s.id === selectedStyleId);
    const existingPost = editingPostId ? posts.find((post) => post.id === editingPostId) : null;
    const nextPost: LinkedInPost = {
      ...(existingPost ?? {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
        impressions: 0,
      }),
      content, type: postType,
      slides: postType === "carousel" ? generatedSlides : undefined,
      sourceType: sourceTab === "idea" ? "idea" : sourceTab === "manual" ? "manual" : sourceTab,
      sourceUrl: ["url", "youtube"].includes(sourceTab) ? sourceInput : undefined,
      sourceTitle: scrapedTitle || undefined,
      styleId: selectedStyleId || undefined, styleName: selectedStyle?.name,
      scheduledAt: status === "scheduled" && scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
      publishedAt: status === "published" ? new Date().toISOString() : undefined,
      status,
      tags: selectedStyle ? [selectedStyle.name, selectedStyle.category] : [],
      analytics: normalizeAnalytics({
        ...existingPost?.analytics,
        mediaPreviewUrl: draftMedia?.url ?? existingPost?.analytics?.mediaPreviewUrl,
        mediaPreviewKind: draftMedia?.kind ?? existingPost?.analytics?.mediaPreviewKind,
        mediaFileName: draftMedia?.fileName ?? existingPost?.analytics?.mediaFileName,
        mediaStorageBytes: draftMedia?.bytes ?? existingPost?.analytics?.mediaStorageBytes,
      }),
    };
    const updated = normalizePosts(editingPostId ? posts.map((post) => post.id === editingPostId ? nextPost : post) : [nextPost, ...posts]);
    setPosts(updated); saveLinkedInPosts(updated); void persistRemoteLinkedInPosts(updated, true);
    setPostsView(status === "scheduled" ? "scheduled" : "draft");
    resetEditor();
    setSaving(false);
  }

  function deletePost(id: string) { const updated = normalizePosts(posts.filter(p => p.id !== id)); setPosts(updated); saveLinkedInPosts(updated); void persistRemoteLinkedInPosts(updated, true); }

  function saveStats(postId: string) {
    const updated = posts.map((post) =>
      post.id === postId
        ? mergePostAnalytics(post, {
            postUrl: statsInput.postUrl || post.postUrl,
            reactions: statsInput.reactions,
            comments: statsInput.comments,
            impressions: statsInput.impressions,
            reach: statsInput.reach,
            profileViews: statsInput.profileViews,
            followersGained: statsInput.followersGained,
            reposts: statsInput.reposts,
            saves: statsInput.saves,
            sends: statsInput.sends,
            linkClicks: statsInput.linkClicks,
            engagementRate: statsInput.engagementRate,
          })
        : post
    );
    const normalized = normalizePosts(updated);
    setPosts(normalized); saveLinkedInPosts(normalized); void persistRemoteLinkedInPosts(normalized, true); setStatsPost(null);
  }

  function copyPost(post: LinkedInPost) {
    navigator.clipboard.writeText(post.content).then(() => { setCopiedId(post.id); setTimeout(() => setCopiedId(null), 2000); });
  }

  const hasGenerated = (postType === "carousel" && generatedSlides.length > 0) || (postType === "post" && generatedContent.trim().length > 0);
  const editorVisible = hasGenerated && !manualEditorStarted && !editingPostId;
  const rightEditorVisible = manualEditorStarted || Boolean(editingPostId);
  const stats = {
    drafts: posts.filter(p => p.status === "draft").length,
    scheduled: posts.filter(p => p.status === "scheduled").length,
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", ...jk }}>
      {/* ── Left: Create panel ── */}
      <div style={{ width: 384, borderRight: "1px solid rgba(0,0,0,0.09)", background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>Créer un post</h2>

          {/* Source tabs */}
          <div style={{ display: "flex", gap: 2, marginTop: 12, background: "#f2f2f2", borderRadius: 9, padding: 3 }}>
            {([
              { id: "idea", icon: <Lightbulb size={12} />, label: "Idée" },
              { id: "url", icon: <Link2 size={12} />, label: "URL" },
              { id: "youtube", icon: <Youtube size={12} />, label: "YouTube" },
              { id: "manual", icon: <AlignLeft size={12} />, label: "Libre" },
            ] as { id: SourceTab; icon: React.ReactNode; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setSourceTab(t.id)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 4px",
                fontSize: 12, fontWeight: 500, borderRadius: 7, cursor: "pointer", border: "none",
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                ...(sourceTab === t.id ? { background: "#fff", color: "#121a2e", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } : { background: "transparent", color: "rgba(18,26,46,0.5)" }),
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Source input */}
          {sourceTab === "idea" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Sélectionner une idée</label>
              {ideas.filter(i => i.status === "new").length > 0 ? (
                <select value={selectedIdeaId} onChange={e => setSelectedIdeaId(e.target.value)} style={inp}>
                  <option value="">— Choisir une idée —</option>
                  {ideas.filter(i => i.status === "new").map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                </select>
              ) : (
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", fontStyle: "italic" }}>Aucune idée disponible. Allez dans l&apos;onglet Idées pour en générer.</p>
              )}
              <div style={{ marginTop: 8 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Ou entrer une idée libre</label>
                <textarea rows={3} value={manualIdea} onChange={e => setManualIdea(e.target.value)}
                  placeholder="Ex: Ma méthode pour closer des clients sans être pushy..."
                  style={{ ...inp, resize: "none", lineHeight: 1.6 }} />
              </div>
            </div>
          )}

          {(sourceTab === "url" || sourceTab === "youtube") && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>
                {sourceTab === "youtube" ? "URL de la vidéo YouTube" : "URL de l'article"}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="url" value={sourceInput} onChange={e => setSourceInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleScrapeUrl()}
                  placeholder={sourceTab === "youtube" ? "https://youtube.com/watch?v=..." : "https://exemple.com/article"}
                  style={{ ...inp, flex: 1 }} />
                <button onClick={handleScrapeUrl} disabled={!sourceInput.trim() || scraping}
                  style={{ padding: "8px 14px", background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#121a2e", opacity: !sourceInput.trim() || scraping ? 0.5 : 1, flexShrink: 0, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  {scraping ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Analyser"}
                </button>
              </div>
              {scrapedContent && (
                <div style={{ marginTop: 8, padding: "10px 12px", background: "#f6f6f6", borderRadius: 9, border: "1px solid rgba(0,0,0,0.07)" }}>
                  {scrapedTitle && <p style={{ fontSize: 12, fontWeight: 600, color: "#121a2e", margin: 0, marginBottom: 4 }}>{scrapedTitle}</p>}
                  <p style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{scrapedContent}</p>
                  <p style={{ fontSize: 11, color: "#168b64", marginTop: 6, marginBottom: 0, display: "flex", alignItems: "center", gap: 4 }}><Check size={10} /> Contenu extrait</p>
                </div>
              )}
            </div>
          )}

          {sourceTab === "manual" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Votre idée / contenu</label>
              <textarea rows={5} value={manualIdea} onChange={e => setManualIdea(e.target.value)}
                placeholder="Décrivez votre idée, copiez un texte brut, vos notes..."
                style={{ ...inp, resize: "none", lineHeight: 1.6 }} />
            </div>
          )}

          {/* Style */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Style de rédaction</label>
            <select value={selectedStyleId} onChange={e => setSelectedStyleId(e.target.value)} style={inp}>
              <option value="">— Style automatique —</option>
              {styles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Type */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Type de contenu</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["post", "carousel"] as const).map(t => (
                <button key={t} onClick={() => setPostType(t)} style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0",
                  fontSize: 12, fontWeight: 600, borderRadius: 9, cursor: "pointer", border: "1px solid",
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  ...(postType === t ? { background: "#e8edff", borderColor: "#0147ff", color: "#0147ff" } : { background: "#f6f6f6", borderColor: "rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
                }}>
                  {t === "post" ? <Edit3 size={12} /> : <LayoutTemplate size={12} />}
                  {t === "post" ? "Post" : "Carrousel"}
                </button>
              ))}
            </div>
            {postType === "carousel" && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)" }}>Slides :</span>
                  <input type="number" min={3} max={20} value={carouselSlides} onChange={e => setCarouselSlides(Number(e.target.value))}
                    style={{ width: 64, padding: "5px 8px", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 7, fontSize: 13, textAlign: "center", background: "#f6f6f6", outline: "none", color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, background: "#e8edff", border: "1px solid #c7d3ff", borderRadius: 9, padding: "8px 12px" }}>
                  <Info size={12} style={{ color: "#0147ff", marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: "#073e63", margin: 0, lineHeight: 1.5 }}>
                    Le contenu de chaque slide suivra le template défini dans les <strong>Paramètres LinkedIn</strong> (TITRE, SOUS-TITRE, TEXTE, VISUEL...)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <ClientBlueButton type="button" onClick={handleGenerate} loading={generating} icon={<Wand2 size={16} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%", fontSize: 16 }}>
            {generating ? "Génération..." : "Générer avec l'IA"}
          </ClientBlueButton>
            <button type="button" onClick={startManualPost} style={{ minHeight: 48, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 13, background: "#fff", color: "#121a2e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', boxShadow: "0px 4px 12px rgba(18,26,46,0.06)" }}>
              Démarrer manuellement
            </button>
          </div>

          {generationError && (
            <p style={{ fontSize: 12, color: "#c53030", background: "#fff0f0", border: "1px solid #fcc", borderRadius: 9, padding: "8px 12px", margin: 0 }}>
              {generationError}
            </p>
          )}

          {/* Generated content */}
          {editorVisible && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {postType === "carousel" && generatedSlides.length > 0 ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#121a2e", margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
                      <Layers size={12} />Carrousel — {generatedSlides.length} slides
                    </p>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {generatedSlides.map((_, i) => (
                        <button key={i} onClick={() => setActiveSlide(i)} style={{
                          width: 24, height: 24, fontSize: 11, fontWeight: 500,
                          cursor: "pointer", border: "none", fontFamily: '"Plus Jakarta Sans", sans-serif',
                          ...(activeSlide === i
                            ? { background: btnGrad.background, color: "#fff", borderRadius: "50%", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }
                            : { background: "#f6f6f6", color: "rgba(18,26,46,0.5)", borderRadius: "50%" }),
                        }}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SlidePreview content={generatedSlides[activeSlide] ?? ""} slideNum={activeSlide + 1} totalSlides={generatedSlides.length}
                    onChange={val => { const updated = [...generatedSlides]; updated[activeSlide] = val; setGeneratedSlides(updated); }} />
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6, marginTop: 0 }}>Post généré</p>
                  <SmartSelectionTextarea
                    rows={10}
                    value={generatedContent}
                    onChange={setGeneratedContent}
                    contextLabel="post LinkedIn"
                    globalLabel="Améliorer tout le post"
                    apiKey={settings?.openrouterApiKey || undefined}
                    model={settings?.model}
                    style={{ ...inp, background: "#f6f6f6", lineHeight: 1.6 }}
                  />
                </div>
              )}

              <label
                style={{ border: "1px dashed rgba(18,26,46,0.14)", borderRadius: 12, background: "#f7f7f7", minHeight: draftMedia ? 82 : 58, padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
              >
                {draftMedia ? (
                  <>
                    <span style={{ width: 58, height: 62, borderRadius: 8, background: `url(${draftMedia.url}) center / cover`, flexShrink: 0, boxShadow: "0 10px 22px rgba(18,26,46,0.12)" }} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#121a2e" }}>Image du brouillon</span>
                      <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draftMedia.fileName}</span>
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(18,26,46,0.58)" }}>Importer une image ou un PDF pour ce brouillon</span>
                )}
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleDraftMedia(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>

              {/* Schedule */}
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(18,26,46,0.5)", marginBottom: 4 }}>
                  <Clock size={10} /> Programmer
                </label>
                <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ ...inp, fontSize: 12 }} />
              </div>

              {/* Save buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <ClientBlueButton compact type="button" onClick={() => handleSave("draft")} loading={saving} wrapperStyle={{ flex: 1, width: "100%" }} style={{ width: "100%" }}>
                  Sauvegarder
                </ClientBlueButton>
                <button onClick={() => handleSave("scheduled")} disabled={saving || !scheduleDate} style={{ ...btnGrad, flex: 1, padding: "10px 0", fontSize: 12, opacity: scheduleDate ? 1 : 0.45 }}>
                    Planifier
                </button>
              </div>
              {editingPostId && (
                <button
                  type="button"
                  onClick={resetEditor}
                  style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", color: "rgba(18,26,46,0.55)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  Fermer l&apos;edition
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Posts list ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fbfbfb" }}>
        {/* Stats bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "10px 24px", display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
          {[
            { label: "Brouillons", value: stats.drafts, color: "rgba(18,26,46,0.5)" },
            { label: "Planifiés", value: stats.scheduled, color: "#073e63" },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 12, color: "rgba(18,26,46,0.4)" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Posts grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, borderRadius: 999, background: "#ededed" }}>
              {([
                ["draft", "Brouillons", stats.drafts],
                ["scheduled", "Planifiés", stats.scheduled],
              ] as const).map(([view, label, count]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setPostsView(view)}
                  style={{
                    minHeight: 30,
                    padding: "0 13px",
                    borderRadius: 999,
                    border: "none",
                    background: postsView === view ? "#fff" : "transparent",
                    boxShadow: postsView === view ? "0px 1px 4px rgba(0,0,0,0.08)" : "none",
                    color: postsView === view ? "#121a2e" : "rgba(18,26,46,0.5)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                  }}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>

          {rightEditorVisible ? (
            <div style={{ background: "#fff", border: "1px solid rgba(18,26,46,0.1)", borderRadius: 18, boxShadow: "0 18px 42px rgba(18,26,46,0.08)", padding: 22, display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>{editingPostId ? "Modifier le brouillon" : "Nouveau brouillon manuel"}</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(18,26,46,0.48)" }}>Écris librement, puis sélectionne un passage pour le transformer avec l’IA.</p>
                </div>
                <button type="button" onClick={resetEditor} style={{ border: "1px solid rgba(18,26,46,0.12)", borderRadius: 999, background: "#fff", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={16} />
                </button>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.58)" }}>
                  Style du post
                </label>
                <select value={selectedStyleId} onChange={(event) => setSelectedStyleId(event.target.value)} style={{ ...inp, minHeight: 44, background: "#fff", fontSize: 14 }}>
                  <option value="">Aucun style</option>
                  {styles.map((style) => (
                    <option key={style.id} value={style.id}>{style.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ width: "100%", maxWidth: 552, border: "1px solid rgba(18,26,46,0.08)", borderRadius: 16, background: "#fff", boxShadow: "0 10px 24px rgba(18,26,46,0.05)", padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,#dbeafe,#eef2ff)", flexShrink: 0 }} />
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#121a2e" }}>Louis Staub</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(18,26,46,0.45)" }}>Prévisualisation LinkedIn</p>
                  </div>
                </div>
                <SmartSelectionTextarea
                  rows={18}
                  value={generatedContent}
                  onChange={setGeneratedContent}
                  placeholder="Écris ton post ici..."
                  contextLabel="post LinkedIn"
                  showGlobalAction={false}
                  apiKey={settings?.openrouterApiKey || undefined}
                  model={settings?.model}
                  style={{ ...inp, minHeight: 390, background: "#fff", border: "none", lineHeight: 1.55, fontSize: 14, padding: 0, resize: "vertical", whiteSpace: "pre-wrap" }}
                />
              </div>

              <label style={{ border: "1px dashed rgba(18,26,46,0.14)", borderRadius: 14, background: "#f7f7f7", minHeight: draftMedia ? 92 : 64, padding: 12, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                {draftMedia ? (
                  <>
                    <span style={{ width: 72, height: 76, borderRadius: 10, background: `url(${draftMedia.url}) center / cover`, flexShrink: 0, boxShadow: "0 10px 22px rgba(18,26,46,0.12)" }} />
                    <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#121a2e" }}>Image du brouillon</span>
                      <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draftMedia.fileName}</span>
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(18,26,46,0.58)" }}>Ajouter une image ou un PDF</span>
                )}
                <input type="file" accept="image/*,.pdf,application/pdf" style={{ display: "none" }} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleDraftMedia(file);
                  event.currentTarget.value = "";
                }} />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ ...inp, minHeight: 46, fontSize: 14 }} />
                <button type="button" onClick={() => handleSave("draft")} disabled={saving || !generatedContent.trim()} style={{ minHeight: 46, padding: "0 18px", borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  Sauvegarder
                </button>
                <ClientBlueButton compact type="button" onClick={() => handleSave("scheduled")} disabled={saving || !scheduleDate || !generatedContent.trim()}>
                  Programmer
                </ClientBlueButton>
              </div>
            </div>
          ) : null}

          {!rightEditorVisible && (
          <>
          {filteredPosts.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 64 }}>
              <Edit3 size={32} style={{ color: "rgba(18,26,46,0.1)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.5)", margin: 0 }}>Aucun post</p>
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>Créez votre premier post depuis le panneau de gauche.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
              {filteredPosts.map(post => {
                const ss = STATUS_STYLES[post.status];
                const analytics = normalizeAnalytics(post.analytics);
                return (
                  <div
                    key={post.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openPostForEdit(post)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openPostForEdit(post); }}
                    style={{ textAlign: "left", background: "#fff", borderRadius: 13, border: editingPostId === post.id ? "1px solid rgba(1,71,255,0.35)" : "1px solid rgba(0,0,0,0.09)", padding: 16, display: "flex", flexDirection: "column", gap: 12, cursor: "pointer", boxShadow: editingPostId === post.id ? "0 8px 22px rgba(1,71,255,0.08)" : "none", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: ss.bg, color: ss.color }}>
                          {STATUS_LABELS[post.status]}
                        </span>
                        {post.type === "carousel" && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#E1D1FA", color: "#6236AA" }}>Carrousel</span>
                        )}
                        {post.styleName && <span style={{ fontSize: 12, color: "rgba(18,26,46,0.4)" }}>{post.styleName}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <button onClick={(event) => { event.stopPropagation(); copyPost(post); }} title="Copier" style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.35)", display: "flex" }}>
                          {copiedId === post.id ? <Check size={13} style={{ color: "#168b64" }} /> : <Copy size={13} />}
                        </button>
                        {post.status === "draft" && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              openPostForEdit(post);
                              if (!post.scheduledAt) {
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                tomorrow.setHours(9, 0, 0, 0);
                                setScheduleDate(isoToLocalInput(tomorrow.toISOString()));
                              }
                            }}
                            title="Planifier"
                            style={{ padding: "5px 8px", borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", cursor: "pointer", color: "rgba(18,26,46,0.55)", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                          >
                            <Calendar size={12} />
                            Planifier
                          </button>
                        )}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/admin/linkedin/statistiques?postId=${encodeURIComponent(post.id)}`);
                          }}
                          title="Statistiques"
                          style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.35)", display: "flex" }}
                        >
                          <BarChart2 size={13} />
                        </button>
                        <button onClick={(event) => { event.stopPropagation(); deletePost(post.id); }} title="Supprimer" style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.2)", display: "flex" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Content preview */}
                    {analytics.mediaPreviewUrl && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/admin/linkedin/statistiques?postId=${encodeURIComponent(post.id)}`);
                        }}
                        style={{ width: "100%", height: 138, border: "none", borderRadius: 11, background: `url(${analytics.mediaPreviewUrl}) center / cover`, cursor: "pointer", boxShadow: "0 12px 26px rgba(18,26,46,0.1)" }}
                        aria-label="Ouvrir les statistiques du post"
                      />
                    )}
                    <p style={{ fontSize: 13, color: "#121a2e", lineHeight: 1.6, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", whiteSpace: "pre-line" }}>
                      {post.content}
                    </p>

                    {/* Stats */}
                    {post.status === "published" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(18,26,46,0.5)" }}>
                          <ThumbsUp size={11} style={{ color: "#0147ff" }} /> {post.likes}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(18,26,46,0.5)" }}>
                          <MessageCircle size={11} style={{ color: "#168b64" }} /> {post.comments}
                        </span>
                        {post.impressions > 0 && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(18,26,46,0.5)" }}>
                            <Eye size={11} style={{ color: "#6236AA" }} /> {post.impressions.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Schedule date */}
                    {post.status === "scheduled" && post.scheduledAt && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#073e63" }}>
                        <Calendar size={11} />
                        {new Date(post.scheduledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {/* Stats modal */}
      {statsPost && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0px 20px 40px rgba(0,0,0,0.15)", width: 560, padding: 24, display: "flex", flexDirection: "column", gap: 16, ...jk }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#121a2e", margin: 0 }}>Ajouter des statistiques</h3>
              <button onClick={() => setStatsPost(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", fontStyle: "italic", margin: 0 }}>&quot;{statsPost.content.slice(0, 100)}...&quot;</p>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Lien du post</label>
              <input value={statsInput.postUrl} onChange={e => setStatsInput(prev => ({ ...prev, postUrl: e.target.value }))} style={inp} placeholder="https://www.linkedin.com/posts/..." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {([
                ["reactions", "Réactions"],
                ["comments", "Commentaires"],
                ["impressions", "Impressions"],
                ["reach", "Membres touchés"],
                ["profileViews", "Vues profil"],
                ["followersGained", "Abonnés gagnés"],
                ["reposts", "Republications"],
                ["saves", "Enregistrements"],
                ["sends", "Envois LinkedIn"],
                ["linkClicks", "Clics lien"],
                ["engagementRate", "Engagement %"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>{label}</label>
                  <input
                    type="number"
                    min={0}
                    step={key === "engagementRate" ? "0.1" : "1"}
                    value={statsInput[key]}
                    onChange={e => setStatsInput(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    style={inp}
                  />
                </div>
              ))}
            </div>
            <a href="/admin/linkedin/statistiques" style={{ fontSize: 12, color: "#0147ff", textDecoration: "none" }}>
              Ouvrir l’onglet Statistiques pour l’import `.xlsx/.csv` complet
            </a>
            <button onClick={() => saveStats(statsPost.id)} style={{ ...btnGrad, width: "100%", padding: "10px 0", fontSize: 13 }}>
              Sauvegarder
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Slide preview component ──────────────────────────────────────────────────

const SLIDE_FIELD_LABELS: Record<string, { label: string; color: string }> = {
  TITRE: { label: "Titre", color: "font-semibold" },
  "SOUS-TITRE": { label: "Sous-titre", color: "" },
  TEXTE: { label: "Texte", color: "" },
  VISUEL: { label: "Visuel suggéré", color: "" },
  CTA: { label: "CTA", color: "" },
  EXEMPLE: { label: "Exemple", color: "" },
  STAT: { label: "Statistique", color: "" },
  PROBLEMATIQUE: { label: "Problématique", color: "" },
  ACCROCHE: { label: "Accroche", color: "" },
};

const SLIDE_FIELD_COLORS: Record<string, string> = {
  TITRE: "#121a2e", "SOUS-TITRE": "#121a2e", TEXTE: "rgba(18,26,46,0.7)",
  VISUEL: "#0147ff", CTA: "#0147ff", EXEMPLE: "#168b64",
  STAT: "#d95b0a", PROBLEMATIQUE: "#c53030", ACCROCHE: "#121a2e",
};

function parseSlideFields(content: string): { key: string; value: string }[] | null {
  const lines = content.split("\n");
  const fields: { key: string; value: string }[] = [];
  let currentKey = "", currentValue: string[] = [];
  for (const line of lines) {
    const match = line.match(/^([A-ZÀ-Ü\-]+)\s*:\s*(.*)/);
    if (match) {
      if (currentKey) fields.push({ key: currentKey, value: currentValue.join("\n").trim() });
      currentKey = match[1]; currentValue = [match[2]];
    } else if (currentKey) { currentValue.push(line); }
  }
  if (currentKey) fields.push({ key: currentKey, value: currentValue.join("\n").trim() });
  return fields.length >= 2 ? fields : null;
}

function SlidePreview({ content, slideNum, totalSlides, onChange }: { content: string; slideNum: number; totalSlides: number; onChange: (val: string) => void }) {
  const [rawMode, setRawMode] = useState(false);
  const fields = parseSlideFields(content);
  const jkSlide: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };

  if (rawMode || !fields) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", ...jkSlide }}>Slide {slideNum}/{totalSlides} — mode brut</span>
          {fields && (
            <button onClick={() => setRawMode(false)} style={{ fontSize: 11, color: "#0147ff", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", ...jkSlide }}>Vue structurée</button>
          )}
        </div>
        <textarea rows={8} value={content} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "10px 12px", fontSize: 12, outline: "none", resize: "none", fontFamily: "monospace, monospace", color: "#121a2e", boxSizing: "border-box" }} />
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 11, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f6f6f6", padding: "8px 12px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(18,26,46,0.5)", ...jkSlide }}>Slide {slideNum} / {totalSlides}</span>
        <button onClick={() => setRawMode(true)} style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", background: "none", border: "none", cursor: "pointer", ...jkSlide }}>Éditer brut</button>
      </div>
      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 10, background: "#fff" }}>
        {fields.map(f => (
          <div key={f.key}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(18,26,46,0.35)", margin: 0, marginBottom: 2, ...jkSlide }}>
              {SLIDE_FIELD_LABELS[f.key]?.label || f.key}
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: SLIDE_FIELD_COLORS[f.key] || "rgba(18,26,46,0.7)", ...jkSlide }}>
              {f.value || <span style={{ color: "rgba(18,26,46,0.2)", fontStyle: "italic" }}>—</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
