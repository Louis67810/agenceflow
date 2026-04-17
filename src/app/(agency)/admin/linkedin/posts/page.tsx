"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import {
  Wand2, Loader2, X, Check, Copy, Trash2, Link2,
  Youtube, Lightbulb, AlignLeft, LayoutTemplate, Edit3,
  ThumbsUp, MessageCircle, Eye, Calendar, Tag,
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
  saveLinkedInPosts,
} from "@/lib/linkedin/posts";
import { fetchRemoteLinkedInPosts, saveRemoteLinkedInPosts } from "@/lib/linkedin/remote";
import {
  fetchRemoteLinkedInWorkspace,
  hasMeaningfulLinkedInWorkspaceData,
  loadLinkedInWorkspaceCache,
  patchRemoteLinkedInWorkspace,
  persistLinkedInWorkspacePatch,
} from "@/lib/linkedin/workspace";

type SourceTab = "idea" | "url" | "youtube" | "manual";
type FilterTab = "all" | "draft" | "scheduled" | "published";

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
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [styles, setStyles] = useState<LinkedInStyle[]>(DEFAULT_STYLES);
  const [ideas, setIdeas] = useState<LinkedInIdea[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");

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
        const remotePosts = await fetchRemoteLinkedInPosts();
        if (remotePosts.length > 0) {
          setPosts(remotePosts);
          saveLinkedInPosts(remotePosts);
        } else if (localPosts.length > 0) {
          await saveRemoteLinkedInPosts(localPosts, true);
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
        sessionStorage.removeItem("linkedin_idea_prefill");
      } catch {}
    }
  }, []);

  const filteredPosts = posts
    .filter(p => filter === "all" || p.status === filter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
        const exRes = await fetch(`/api/linkedin/style-examples?styleId=${encodeURIComponent(selectedStyleId)}`);
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

  function handleSave(status: "draft" | "scheduled" | "published") {
    const content = postType === "carousel" ? generatedSlides.join("\n\n---\n\n") : generatedContent;
    if (!content.trim()) return;
    setSaving(true);
    const selectedStyle = styles.find(s => s.id === selectedStyleId);
    const newPost: LinkedInPost = {
      id: crypto.randomUUID(), content, type: postType,
      slides: postType === "carousel" ? generatedSlides : undefined,
      sourceType: sourceTab === "idea" ? "idea" : sourceTab === "manual" ? "manual" : sourceTab,
      sourceUrl: ["url", "youtube"].includes(sourceTab) ? sourceInput : undefined,
      sourceTitle: scrapedTitle || undefined,
      styleId: selectedStyleId || undefined, styleName: selectedStyle?.name,
      scheduledAt: status === "scheduled" && scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
      publishedAt: status === "published" ? new Date().toISOString() : undefined,
      likes: 0, comments: 0, impressions: 0, status,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    };
    const updated = [newPost, ...posts];
    setPosts(updated); saveLinkedInPosts(updated); void saveRemoteLinkedInPosts(updated, true);
    setGeneratedContent(""); setGeneratedSlides([]); setManualIdea("");
    setSourceInput(""); setScrapedContent(""); setScrapedTitle(""); setTags(""); setScheduleDate(""); setSaving(false);
  }

  function deletePost(id: string) { const updated = posts.filter(p => p.id !== id); setPosts(updated); saveLinkedInPosts(updated); void saveRemoteLinkedInPosts(updated, true); }

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
    setPosts(updated); saveLinkedInPosts(updated); void saveRemoteLinkedInPosts(updated, true); setStatsPost(null);
  }

  function copyPost(post: LinkedInPost) {
    navigator.clipboard.writeText(post.content).then(() => { setCopiedId(post.id); setTimeout(() => setCopiedId(null), 2000); });
  }

  const hasGenerated = (postType === "carousel" && generatedSlides.length > 0) || (postType === "post" && generatedContent.trim().length > 0);
  const stats = {
    total: posts.length, drafts: posts.filter(p => p.status === "draft").length,
    scheduled: posts.filter(p => p.status === "scheduled").length, published: posts.filter(p => p.status === "published").length,
    totalLikes: posts.reduce((s, p) => s + p.likes, 0), totalImpressions: posts.reduce((s, p) => s + p.impressions, 0),
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
          <button onClick={handleGenerate} disabled={generating} style={{ ...btnGrad, width: "100%", padding: "10px 0", fontSize: 13, opacity: generating ? 0.7 : 1 }}>
            {generating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={14} />}
            {generating ? "Génération..." : "Générer avec l'IA"}
          </button>

          {generationError && (
            <p style={{ fontSize: 12, color: "#c53030", background: "#fff0f0", border: "1px solid #fcc", borderRadius: 9, padding: "8px 12px", margin: 0 }}>
              {generationError}
            </p>
          )}

          {/* Generated content */}
          {hasGenerated && (
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

              {/* Tags + schedule */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(18,26,46,0.5)", marginBottom: 4 }}>
                    <Tag size={10} /> Tags (virgule)
                  </label>
                  <input value={tags} onChange={e => setTags(e.target.value)} placeholder="linkedin, content..." style={{ ...inp, fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(18,26,46,0.5)", marginBottom: 4 }}>
                    <Clock size={10} /> Programmer
                  </label>
                  <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ ...inp, fontSize: 12 }} />
                </div>
              </div>

              {/* Save buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => handleSave("draft")} disabled={saving} style={{ flex: 1, padding: "8px 0", fontSize: 12, fontWeight: 500, background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, cursor: "pointer", color: "rgba(18,26,46,0.6)", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  Brouillon
                </button>
                {scheduleDate && (
                  <button onClick={() => handleSave("scheduled")} disabled={saving} style={{ ...btnGrad, flex: 1, padding: "8px 0", fontSize: 12 }}>
                    Planifier
                  </button>
                )}
                <button onClick={() => handleSave("published")} disabled={saving} style={{ ...btnGrad, flex: 1, padding: "8px 0", fontSize: 12 }}>
                  Publié
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Posts list ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fbfbfb" }}>
        {/* Stats bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "10px 24px", display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
          {[
            { label: "Total", value: stats.total, color: "#121a2e" },
            { label: "Brouillons", value: stats.drafts, color: "rgba(18,26,46,0.5)" },
            { label: "Planifiés", value: stats.scheduled, color: "#073e63" },
            { label: "Publiés", value: stats.published, color: "#168b64" },
            { label: "Likes", value: stats.totalLikes, color: "#0147ff", icon: <ThumbsUp size={11} /> },
            { label: "Impressions", value: stats.totalImpressions > 1000 ? `${(stats.totalImpressions / 1000).toFixed(1)}k` : stats.totalImpressions, color: "#6236AA", icon: <Eye size={11} /> },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {s.icon && <span style={{ color: s.color }}>{s.icon}</span>}
              <span style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 12, color: "rgba(18,26,46,0.4)" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "0 24px", display: "flex", flexShrink: 0 }}>
          {([{ id: "all", label: "Tous" }, { id: "draft", label: "Brouillons" }, { id: "scheduled", label: "Planifiés" }, { id: "published", label: "Publiés" }] as { id: FilterTab; label: string }[]).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", background: "none", border: "none",
              borderBottom: `2px solid ${filter === f.id ? "#0147ff" : "transparent"}`,
              color: filter === f.id ? "#0147ff" : "rgba(18,26,46,0.5)",
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
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
                return (
                  <div key={post.id} style={{ background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.09)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
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
                        <button onClick={() => copyPost(post)} title="Copier" style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.35)", display: "flex" }}>
                          {copiedId === post.id ? <Check size={13} style={{ color: "#168b64" }} /> : <Copy size={13} />}
                        </button>
                        <button
                          onClick={() => {
                            setStatsPost(post);
                            setStatsInput({
                              postUrl: post.analytics?.postUrl ?? post.postUrl ?? "",
                              reactions: post.analytics?.reactions ?? post.likes,
                              comments: post.analytics?.comments ?? post.comments,
                              impressions: post.analytics?.impressions ?? post.impressions,
                              reach: post.analytics?.reach ?? 0,
                              profileViews: post.analytics?.profileViews ?? 0,
                              followersGained: post.analytics?.followersGained ?? 0,
                              reposts: post.analytics?.reposts ?? 0,
                              saves: post.analytics?.saves ?? 0,
                              sends: post.analytics?.sends ?? 0,
                              linkClicks: post.analytics?.linkClicks ?? 0,
                              engagementRate: post.analytics?.engagementRate ?? 0,
                            });
                          }}
                          title="Statistiques"
                          style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.35)", display: "flex" }}
                        >
                          <BarChart2 size={13} />
                        </button>
                        <button onClick={() => deletePost(post.id)} title="Supprimer" style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.2)", display: "flex" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Content preview */}
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

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {post.tags.map(tag => (
                          <span key={tag} style={{ fontSize: 11, padding: "2px 8px", background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 20, color: "rgba(18,26,46,0.5)" }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
