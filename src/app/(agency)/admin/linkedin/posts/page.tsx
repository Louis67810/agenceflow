"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Wand2, Loader2, X, Check, Copy, Trash2, Link2,
  Youtube, Lightbulb, AlignLeft, LayoutTemplate, Edit3,
  ThumbsUp, MessageCircle, Eye, Calendar, Tag, RefreshCw,
  ChevronDown, BarChart2, Clock,
} from "lucide-react";
import type { LinkedInPost, LinkedInStyle, LinkedInIdea } from "@/types/linkedin";
import { DEFAULT_STYLES, STYLE_CATEGORY_COLORS } from "@/types/linkedin";

type SourceTab = "idea" | "url" | "youtube" | "manual";
type FilterTab = "all" | "draft" | "scheduled" | "published";

const STORAGE_KEY = "linkedin_posts";
const STYLES_KEY = "linkedin_styles";
const IDEAS_KEY = "linkedin_ideas";

function loadPosts(): LinkedInPost[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}
function savePosts(posts: LinkedInPost[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}
function loadStyles(): LinkedInStyle[] {
  try {
    const s = localStorage.getItem(STYLES_KEY);
    return s ? JSON.parse(s) : DEFAULT_STYLES;
  } catch {
    return DEFAULT_STYLES;
  }
}
function loadIdeas(): LinkedInIdea[] {
  try {
    const s = localStorage.getItem(IDEAS_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}
function saveIdeas(ideas: LinkedInIdea[]) {
  localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
}

export default function PostsPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [styles, setStyles] = useState<LinkedInStyle[]>(DEFAULT_STYLES);
  const [ideas, setIdeas] = useState<LinkedInIdea[]>([]);
  const [filter, setFilter] = useState<FilterTab>("all");

  // Create panel
  const [sourceTab, setSourceTab] = useState<SourceTab>("idea");
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const [postType, setPostType] = useState<"post" | "carousel">("post");
  const [carouselSlides, setCarouselSlides] = useState(5);
  const [sourceInput, setSourceInput] = useState(""); // URL / YouTube URL
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

  // Stats modal
  const [statsPost, setStatsPost] = useState<LinkedInPost | null>(null);
  const [statsInput, setStatsInput] = useState({ likes: 0, comments: 0, impressions: 0 });

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setPosts(loadPosts());
    setStyles(loadStyles());
    setIdeas(loadIdeas());
  }, []);

  const filteredPosts = posts
    .filter((p) => filter === "all" || p.status === filter)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Top posts for AI context
  const topPosts = [...posts]
    .filter((p) => p.status === "published" && (p.likes + p.comments) > 0)
    .sort((a, b) => b.likes + b.comments * 3 - (a.likes + a.comments * 3))
    .slice(0, 5)
    .map((p) => ({
      content: p.content,
      likes: p.likes,
      comments: p.comments,
      impressions: p.impressions,
      styleName: p.styleName,
    }));

  async function handleScrapeUrl() {
    if (!sourceInput.trim()) return;
    setScraping(true);
    setScrapedContent("");
    try {
      const isYoutube =
        sourceTab === "youtube" ||
        sourceInput.includes("youtube.com") ||
        sourceInput.includes("youtu.be");

      if (isYoutube) {
        const res = await fetch("/api/linkedin/youtube-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sourceInput }),
        });
        const data = await res.json();
        if (res.ok) {
          setScrapedTitle(data.title);
          setScrapedContent(
            `Titre: ${data.title}\nAuteur: ${data.author}\n\n${data.description || "Pas de description disponible."}`
          );
        } else {
          setGenerationError(data.error);
        }
      } else {
        const res = await fetch("/api/linkedin/scrape-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: sourceInput }),
        });
        const data = await res.json();
        if (res.ok) {
          setScrapedTitle(data.title);
          setScrapedContent(data.content);
        } else {
          setGenerationError(data.error);
        }
      }
    } catch (e) {
      setGenerationError(String(e));
    }
    setScraping(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerationError("");
    setGeneratedContent("");
    setGeneratedSlides([]);

    const selectedStyle = styles.find((s) => s.id === selectedStyleId);
    const selectedIdea = ideas.find((i) => i.id === selectedIdeaId);

    let sourceContent = "";
    let sourceTitle = "";

    switch (sourceTab) {
      case "idea":
        sourceContent = selectedIdea ? `${selectedIdea.title}\n\n${selectedIdea.description}` : manualIdea;
        sourceTitle = selectedIdea?.title ?? "";
        break;
      case "url":
      case "youtube":
        sourceContent = scrapedContent || sourceInput;
        sourceTitle = scrapedTitle;
        break;
      case "manual":
        sourceContent = manualIdea;
        break;
    }

    if (!sourceContent.trim()) {
      setGenerationError("Veuillez entrer un contenu source.");
      setGenerating(false);
      return;
    }

    try {
      const res = await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: sourceTab,
          sourceContent,
          sourceTitle,
          style: selectedStyle
            ? { name: selectedStyle.name, prompt: selectedStyle.prompt, category: selectedStyle.category }
            : undefined,
          type: postType,
          carouselSlides,
          topPosts,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.type === "carousel" && data.slides) {
          setGeneratedSlides(data.slides);
          setActiveSlide(0);
        } else {
          setGeneratedContent(data.content);
        }
        // Mark idea as used
        if (selectedIdeaId) {
          const updated = ideas.map((i) =>
            i.id === selectedIdeaId ? { ...i, status: "used" as const, usedAt: new Date().toISOString() } : i
          );
          setIdeas(updated);
          saveIdeas(updated);
        }
      } else {
        setGenerationError(data.error);
      }
    } catch (e) {
      setGenerationError(String(e));
    }
    setGenerating(false);
  }

  function handleSave(status: "draft" | "scheduled" | "published") {
    const content = postType === "carousel" ? generatedSlides.join("\n\n---\n\n") : generatedContent;
    if (!content.trim()) return;

    setSaving(true);
    const selectedStyle = styles.find((s) => s.id === selectedStyleId);
    const newPost: LinkedInPost = {
      id: crypto.randomUUID(),
      content,
      type: postType,
      slides: postType === "carousel" ? generatedSlides : undefined,
      sourceType: sourceTab === "idea" ? "idea" : sourceTab === "manual" ? "manual" : sourceTab,
      sourceUrl: ["url", "youtube"].includes(sourceTab) ? sourceInput : undefined,
      sourceTitle: scrapedTitle || undefined,
      styleId: selectedStyleId || undefined,
      styleName: selectedStyle?.name,
      scheduledAt: status === "scheduled" && scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
      publishedAt: status === "published" ? new Date().toISOString() : undefined,
      likes: 0,
      comments: 0,
      impressions: 0,
      status,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
    };

    const updated = [newPost, ...posts];
    setPosts(updated);
    savePosts(updated);

    // Reset form
    setGeneratedContent("");
    setGeneratedSlides([]);
    setManualIdea("");
    setSourceInput("");
    setScrapedContent("");
    setScrapedTitle("");
    setTags("");
    setScheduleDate("");
    setSaving(false);
  }

  function deletePost(id: string) {
    const updated = posts.filter((p) => p.id !== id);
    setPosts(updated);
    savePosts(updated);
  }

  function saveStats(postId: string) {
    const updated = posts.map((p) =>
      p.id === postId
        ? {
            ...p,
            likes: statsInput.likes,
            comments: statsInput.comments,
            impressions: statsInput.impressions,
            status: "published" as const,
            publishedAt: p.publishedAt ?? new Date().toISOString(),
          }
        : p
    );
    setPosts(updated);
    savePosts(updated);
    setStatsPost(null);
  }

  function copyPost(post: LinkedInPost) {
    navigator.clipboard.writeText(post.content).then(() => {
      setCopiedId(post.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const hasGenerated =
    (postType === "carousel" && generatedSlides.length > 0) ||
    (postType === "post" && generatedContent.trim().length > 0);

  const stats = {
    total: posts.length,
    drafts: posts.filter((p) => p.status === "draft").length,
    scheduled: posts.filter((p) => p.status === "scheduled").length,
    published: posts.filter((p) => p.status === "published").length,
    totalLikes: posts.reduce((s, p) => s + p.likes, 0),
    totalImpressions: posts.reduce((s, p) => s + p.impressions, 0),
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Create panel ── */}
      <div className="w-96 border-r border-gray-200 bg-white flex flex-col shrink-0 overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Créer un post</h2>

          {/* Source tabs */}
          <div className="flex gap-0.5 mt-3 bg-gray-100 rounded-lg p-0.5">
            {(
              [
                { id: "idea", icon: <Lightbulb size={12} />, label: "Idée" },
                { id: "url", icon: <Link2 size={12} />, label: "URL" },
                { id: "youtube", icon: <Youtube size={12} />, label: "YouTube" },
                { id: "manual", icon: <AlignLeft size={12} />, label: "Libre" },
              ] as { id: SourceTab; icon: React.ReactNode; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setSourceTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sourceTab === t.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 px-5 py-4 space-y-4">
          {/* Source input */}
          {sourceTab === "idea" && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Sélectionner une idée</label>
              {ideas.filter((i) => i.status === "new").length > 0 ? (
                <select
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                  value={selectedIdeaId}
                  onChange={(e) => setSelectedIdeaId(e.target.value)}
                >
                  <option value="">— Choisir une idée —</option>
                  {ideas
                    .filter((i) => i.status === "new")
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title}
                      </option>
                    ))}
                </select>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  Aucune idée disponible. Allez dans l'onglet Idées pour en générer.
                </p>
              )}
              <div className="mt-2">
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                  Ou entrer une idée libre
                </label>
                <textarea
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 resize-none"
                  placeholder="Ex: Ma méthode pour closer des clients sans être pushy..."
                  value={manualIdea}
                  onChange={(e) => setManualIdea(e.target.value)}
                />
              </div>
            </div>
          )}

          {(sourceTab === "url" || sourceTab === "youtube") && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                {sourceTab === "youtube" ? "URL de la vidéo YouTube" : "URL de l'article"}
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                  placeholder={
                    sourceTab === "youtube" ? "https://youtube.com/watch?v=..." : "https://exemple.com/article"
                  }
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScrapeUrl()}
                />
                <button
                  onClick={handleScrapeUrl}
                  disabled={!sourceInput.trim() || scraping}
                  className="px-3 py-2 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {scraping ? <Loader2 size={13} className="animate-spin" /> : "Analyser"}
                </button>
              </div>
              {scrapedContent && (
                <div className="mt-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  {scrapedTitle && (
                    <p className="text-xs font-medium text-gray-700 mb-1">{scrapedTitle}</p>
                  )}
                  <p className="text-xs text-gray-500 line-clamp-3">{scrapedContent}</p>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <Check size={10} /> Contenu extrait
                  </p>
                </div>
              )}
            </div>
          )}

          {sourceTab === "manual" && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Votre idée / contenu</label>
              <textarea
                rows={5}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 resize-none"
                placeholder="Décrivez votre idée, copiez un texte brut, vos notes..."
                value={manualIdea}
                onChange={(e) => setManualIdea(e.target.value)}
              />
            </div>
          )}

          {/* Style */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Style de rédaction</label>
            <select
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
              value={selectedStyleId}
              onChange={(e) => setSelectedStyleId(e.target.value)}
            >
              <option value="">— Style automatique —</option>
              {styles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Type de contenu</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPostType("post")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  postType === "post"
                    ? "bg-[#0A66C2] border-[#0A66C2] text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <Edit3 size={12} /> Post
              </button>
              <button
                onClick={() => setPostType("carousel")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  postType === "carousel"
                    ? "bg-[#0A66C2] border-[#0A66C2] text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <LayoutTemplate size={12} /> Carrousel
              </button>
            </div>
            {postType === "carousel" && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500">Slides :</span>
                <input
                  type="number"
                  min={3}
                  max={15}
                  value={carouselSlides}
                  onChange={(e) => setCarouselSlides(Number(e.target.value))}
                  className="w-16 text-sm border border-gray-200 rounded px-2 py-1 text-center"
                />
              </div>
            )}
          </div>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0A66C2] text-white text-sm font-semibold rounded-xl hover:bg-[#004182] disabled:opacity-60 transition-colors"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {generating ? "Génération..." : "Générer avec l'IA"}
          </button>

          {generationError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {generationError}
            </p>
          )}

          {/* Generated content */}
          {hasGenerated && (
            <div className="space-y-3">
              {postType === "carousel" && generatedSlides.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-600">
                      Carrousel — {generatedSlides.length} slides
                    </p>
                    <div className="flex gap-1">
                      {generatedSlides.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveSlide(i)}
                          className={`w-6 h-6 text-xs rounded-full font-medium transition-colors ${
                            activeSlide === i
                              ? "bg-[#0A66C2] text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={8}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 resize-none"
                    value={generatedSlides[activeSlide] ?? ""}
                    onChange={(e) => {
                      const updated = [...generatedSlides];
                      updated[activeSlide] = e.target.value;
                      setGeneratedSlides(updated);
                    }}
                  />
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Post généré</p>
                  <textarea
                    rows={10}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 resize-none"
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                  />
                </div>
              )}

              {/* Tags + schedule */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                    <Tag size={10} /> Tags (virgule)
                  </label>
                  <input
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0A66C2]/30"
                    placeholder="linkedin, content..."
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block flex items-center gap-1">
                    <Clock size={10} /> Programmer
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0A66C2]/30"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Save buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave("draft")}
                  disabled={saving}
                  className="flex-1 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Brouillon
                </button>
                {scheduleDate && (
                  <button
                    onClick={() => handleSave("scheduled")}
                    disabled={saving}
                    className="flex-1 py-2 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Planifier
                  </button>
                )}
                <button
                  onClick={() => handleSave("published")}
                  disabled={saving}
                  className="flex-1 py-2 text-xs font-medium bg-[#0A66C2] text-white rounded-lg hover:bg-[#004182]"
                >
                  Publié
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Posts list ── */}
      <div className="flex-1 overflow-hidden flex flex-col bg-gray-50">
        {/* Stats bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          {[
            { label: "Total", value: stats.total, color: "text-gray-900" },
            { label: "Brouillons", value: stats.drafts, color: "text-gray-500" },
            { label: "Planifiés", value: stats.scheduled, color: "text-indigo-600" },
            { label: "Publiés", value: stats.published, color: "text-green-600" },
            { label: "Likes", value: stats.totalLikes, color: "text-[#0A66C2]", icon: <ThumbsUp size={11} /> },
            {
              label: "Impressions",
              value: stats.totalImpressions > 1000
                ? `${(stats.totalImpressions / 1000).toFixed(1)}k`
                : stats.totalImpressions,
              color: "text-purple-600",
              icon: <Eye size={11} />,
            },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5">
              {s.icon && <span className={s.color}>{s.icon}</span>}
              <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="bg-white border-b border-gray-100 px-6 flex items-center gap-0">
          {(
            [
              { id: "all", label: "Tous" },
              { id: "draft", label: "Brouillons" },
              { id: "scheduled", label: "Planifiés" },
              { id: "published", label: "Publiés" },
            ] as { id: FilterTab; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                filter === f.id
                  ? "border-[#0A66C2] text-[#0A66C2]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <Edit3 size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Aucun post</p>
              <p className="text-gray-400 text-sm mt-1">
                Créez votre premier post depuis le panneau de gauche.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 xl:grid-cols-2">
              {filteredPosts.map((post) => (
                <div key={post.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                  {/* Post header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          post.status === "published"
                            ? "bg-green-100 text-green-700"
                            : post.status === "scheduled"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {post.status === "published"
                          ? "Publié"
                          : post.status === "scheduled"
                          ? "Planifié"
                          : "Brouillon"}
                      </span>
                      {post.type === "carousel" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                          Carrousel
                        </span>
                      )}
                      {post.styleName && (
                        <span className="text-xs text-gray-400">{post.styleName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => copyPost(post)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copier"
                      >
                        {copiedId === post.id ? (
                          <Check size={13} className="text-green-500" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setStatsPost(post);
                          setStatsInput({
                            likes: post.likes,
                            comments: post.comments,
                            impressions: post.impressions,
                          });
                        }}
                        className="p-1.5 text-gray-400 hover:text-[#0A66C2] transition-colors"
                        title="Statistiques"
                      >
                        <BarChart2 size={13} />
                      </button>
                      <button
                        onClick={() => deletePost(post.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Content preview */}
                  <p className="text-sm text-gray-700 line-clamp-4 leading-relaxed whitespace-pre-line">
                    {post.content}
                  </p>

                  {/* Stats (published) */}
                  {post.status === "published" && (
                    <div className="flex items-center gap-3 pt-1 border-t border-gray-50">
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <ThumbsUp size={11} className="text-[#0A66C2]" /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <MessageCircle size={11} className="text-teal-500" /> {post.comments}
                      </span>
                      {post.impressions > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Eye size={11} className="text-purple-500" /> {post.impressions.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Schedule date */}
                  {post.status === "scheduled" && post.scheduledAt && (
                    <div className="flex items-center gap-1 text-xs text-indigo-500">
                      <Calendar size={11} />
                      {new Date(post.scheduledAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}

                  {/* Tags */}
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-full text-gray-500"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats modal */}
      {statsPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-80 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Ajouter des statistiques</h3>
              <button onClick={() => setStatsPost(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2 italic">"{statsPost.content.slice(0, 100)}..."</p>
            {[
              { key: "likes" as const, label: "Likes", icon: <ThumbsUp size={13} /> },
              { key: "comments" as const, label: "Commentaires", icon: <MessageCircle size={13} /> },
              { key: "impressions" as const, label: "Impressions", icon: <Eye size={13} /> },
            ].map((s) => (
              <div key={s.key}>
                <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1.5">
                  {s.icon} {s.label}
                </label>
                <input
                  type="number"
                  min={0}
                  value={statsInput[s.key]}
                  onChange={(e) =>
                    setStatsInput((prev) => ({ ...prev, [s.key]: Number(e.target.value) }))
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                />
              </div>
            ))}
            <button
              onClick={() => saveStats(statsPost.id)}
              className="w-full py-2.5 bg-[#0A66C2] text-white text-sm font-semibold rounded-xl hover:bg-[#004182]"
            >
              Sauvegarder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
