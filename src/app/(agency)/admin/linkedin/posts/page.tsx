"use client";

import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  Wand2, Loader2, X, Check, Copy, Trash2, Link2, Plus, Download,
  Youtube, Lightbulb, AlignLeft, LayoutTemplate, Edit3,
  ThumbsUp, MessageCircle, Eye, Calendar,
  BarChart2, Clock, Layers, Info, FileText, Image as ImageIcon,
  Search, Send, History, ArrowLeft, Sparkles, Repeat2,
} from "lucide-react";
import type { LinkedInCarouselPageTemplate, LinkedInCarouselTemplate, LinkedInPost, LinkedInStyle, LinkedInIdea } from "@/types/linkedin";
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
type PostsMode = "post" | "carousel";
type CarouselStudioTab = "pages" | "templates";
type CarouselStudioMode = "builder" | "generate";

const FREE_CAROUSEL_PAGE_ID = "__free_carousel_page__";

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
const STYLE_TAGS: Record<LinkedInStyle["category"] | "custom", { bg: string; color: string; border: string }> = {
  storytelling: { bg: "#E1D1FA", color: "#6236AA", border: "rgba(98,54,170,0.18)" },
  valeur: { bg: "#d5eeff", color: "#073e63", border: "rgba(7,62,99,0.14)" },
  educatif: { bg: "#ccfbf1", color: "#0f766e", border: "rgba(15,118,110,0.16)" },
  viral: { bg: "#ffe4e4", color: "#c53030", border: "rgba(197,48,48,0.14)" },
  engagement: { bg: "#fee6d0", color: "#663b12", border: "rgba(102,59,18,0.14)" },
  data: { bg: "#e0e7ff", color: "#3730a3", border: "rgba(55,48,163,0.14)" },
  custom: { bg: "#f6f6f6", color: "rgba(18,26,46,0.58)", border: "rgba(18,26,46,0.1)" },
};
const inactiveStyleTag = { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.55)" };

// ─────────────────────────────────────────────────────────────────────────────

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [styles, setStyles] = useState<LinkedInStyle[]>(DEFAULT_STYLES);
  const [ideas, setIdeas] = useState<LinkedInIdea[]>([]);
  const [carouselPageTemplates, setCarouselPageTemplates] = useState<LinkedInCarouselPageTemplate[]>([]);
  const [carouselTemplates, setCarouselTemplates] = useState<LinkedInCarouselTemplate[]>([]);

  const [sourceTab, setSourceTab] = useState<SourceTab>("idea");
  const [postsMode, setPostsMode] = useState<PostsMode>("post");
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const [postType, setPostType] = useState<"post" | "carousel">("post");
  const [carouselSlides, setCarouselSlides] = useState(5);
  const [carouselStudioTab, setCarouselStudioTab] = useState<CarouselStudioTab>("pages");
  const [carouselStudioMode, setCarouselStudioMode] = useState<CarouselStudioMode>("builder");
  const [selectedCarouselPageId, setSelectedCarouselPageId] = useState("");
  const [selectedCarouselTemplateId, setSelectedCarouselTemplateId] = useState("");
  const [selectedCarouselTemplateItemId, setSelectedCarouselTemplateItemId] = useState("");
  const [showCarouselPagePicker, setShowCarouselPagePicker] = useState(false);
  const [carouselPageSearch, setCarouselPageSearch] = useState("");
  const [carouselGenerationTemplateId, setCarouselGenerationTemplateId] = useState("");
  const [carouselGenerationPrompt, setCarouselGenerationPrompt] = useState("");
  const [carouselGenerationChat, setCarouselGenerationChat] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([]);
  const [carouselGenerationHistory, setCarouselGenerationHistory] = useState<Array<{ id: string; label: string; slides: string[]; createdAt: string }>>([]);
  const [showCarouselHistory, setShowCarouselHistory] = useState(false);
  const [newCarouselPageName, setNewCarouselPageName] = useState("");
  const [newCarouselTemplateName, setNewCarouselTemplateName] = useState("");
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
  const [editorHistory, setEditorHistory] = useState<Array<{ id: string; label: string; before: string; after: string; createdAt: string }>>([]);
  const [chatInput, setChatInput] = useState("");

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
    setCarouselPageTemplates(cachedWorkspace.carouselPageTemplates);
    setCarouselTemplates(cachedWorkspace.carouselTemplates);
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
          setCarouselPageTemplates(remoteWorkspace.workspace.carouselPageTemplates);
          setCarouselTemplates(remoteWorkspace.workspace.carouselTemplates);
        } else if (hasMeaningfulLinkedInWorkspaceData(cachedWorkspace)) {
          await patchRemoteLinkedInWorkspace(cachedWorkspace);
        }
      } catch {
        setStyles(cachedWorkspace.styles.length > 0 ? cachedWorkspace.styles : DEFAULT_STYLES);
        setCarouselPageTemplates(cachedWorkspace.carouselPageTemplates);
        setCarouselTemplates(cachedWorkspace.carouselTemplates);
      }
    })();

    const prefill = sessionStorage.getItem("linkedin_idea_prefill");
    if (prefill) {
      try {
        const idea = JSON.parse(prefill);
        setSourceTab("idea");
        setSelectedIdeaId(idea.id ?? "");
        setManualIdea("");
        if (idea.id) {
          setIdeas((currentIdeas) => currentIdeas.some((item) => item.id === idea.id) ? currentIdeas : [idea, ...currentIdeas]);
        }
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

  useEffect(() => {
    if (!selectedStyleId && styles.length > 0) setSelectedStyleId(styles[0].id);
  }, [selectedStyleId, styles]);

  useEffect(() => {
    if (!selectedCarouselPageId && carouselPageTemplates.length > 0) {
      setSelectedCarouselPageId(carouselPageTemplates[0].id);
    }
  }, [carouselPageTemplates, selectedCarouselPageId]);

  useEffect(() => {
    if (!selectedCarouselTemplateId && carouselTemplates.length > 0) {
      setSelectedCarouselTemplateId(carouselTemplates[0].id);
    }
  }, [carouselTemplates, selectedCarouselTemplateId]);

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
      case "idea": sourceContent = selectedIdea ? `${selectedIdea.title}\n\n${selectedIdea.description}${manualIdea.trim() ? `\n\nPrécisions:\n${manualIdea}` : ""}` : manualIdea; sourceTitle = selectedIdea?.title ?? ""; break;
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
        if (data.type === "carousel" && data.slides) {
          setGeneratedSlides(data.slides);
          setGeneratedContent("");
          setPostType("carousel");
          setActiveSlide(0);
        } else {
          setGeneratedContent(data.content);
          setGeneratedSlides([]);
          setPostType("post");
        }
        setManualEditorStarted(true);
        setEditingPostId(null);
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
    setEditorHistory([]);
    setChatInput("");
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
    setEditorHistory([]);
    setChatInput("");
  }

  function startManualPost() {
    setSourceTab("manual");
    setEditingPostId(null);
    setGeneratedContent("");
    setGeneratedSlides([]);
    setPostType("post");
    setGenerationError("");
    setDraftMedia(null);
    setEditorHistory([]);
    setManualEditorStarted(true);
  }

  function pushEditorHistory(entry: { label: string; before: string; after: string }) {
    setEditorHistory((current) => [
      { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...entry },
      ...current,
    ].slice(0, 30));
  }

  function persistCarouselWorkspace(nextPages = carouselPageTemplates, nextTemplates = carouselTemplates) {
    setCarouselPageTemplates(nextPages);
    setCarouselTemplates(nextTemplates);
    persistLinkedInWorkspacePatch({
      carouselPageTemplates: nextPages,
      carouselTemplates: nextTemplates,
    });
  }

  function createCarouselPageTemplate() {
    const name = newCarouselPageName.trim() || `Page ${carouselPageTemplates.length + 1}`;
    const page: LinkedInCarouselPageTemplate = {
      id: crypto.randomUUID(),
      name,
      description: "Template de slide à connecter ensuite à une frame Figma.",
      pagePrompt: `Créer une slide "${name}" claire, visuelle et très concise.`,
      imagePrompt: `Image simple et premium pour illustrer "${name}".`,
      fields: [
        {
          id: crypto.randomUUID(),
          label: "Titre principal",
          kind: "text",
          required: true,
          aiPrompt: "Génère un titre court, clair et très impactant.",
        },
        {
          id: crypto.randomUUID(),
          label: "Texte court",
          kind: "text",
          required: true,
          aiPrompt: "Génère un texte de slide en 1 à 2 phrases.",
        },
      ],
      createdAt: new Date().toISOString(),
    };
    const nextPages = [page, ...carouselPageTemplates];
    persistCarouselWorkspace(nextPages, carouselTemplates);
    setSelectedCarouselPageId(page.id);
    setNewCarouselPageName("");
  }

  function updateCarouselPageTemplate(pageId: string, patch: Partial<LinkedInCarouselPageTemplate>) {
    const nextPages = carouselPageTemplates.map((page) => page.id === pageId ? { ...page, ...patch } : page);
    persistCarouselWorkspace(nextPages, carouselTemplates);
  }

  function deleteCarouselPageTemplate(pageId: string) {
    const nextPages = carouselPageTemplates.filter((page) => page.id !== pageId);
    const nextTemplates = carouselTemplates.map((template) => ({
      ...template,
      items: template.items.filter((item) => item.pageTemplateId !== pageId),
    }));
    persistCarouselWorkspace(nextPages, nextTemplates);
    if (selectedCarouselPageId === pageId) setSelectedCarouselPageId(nextPages[0]?.id ?? "");
  }

  function addCarouselField(pageId: string, kind: "text" | "image") {
    const nextPages = carouselPageTemplates.map((page) => page.id === pageId ? {
      ...page,
      fields: [
        ...page.fields,
        {
          id: crypto.randomUUID(),
          label: kind === "image" ? "Image modifiable" : "Texte modifiable",
          kind,
          required: kind === "text",
          aiPrompt: kind === "image" ? "Décris l'image attendue pour cette zone." : "Explique comment remplir ce texte.",
        },
      ],
    } : page);
    persistCarouselWorkspace(nextPages, carouselTemplates);
  }

  function updateCarouselField(pageId: string, fieldId: string, patch: Partial<LinkedInCarouselPageTemplate["fields"][number]>) {
    const nextPages = carouselPageTemplates.map((page) => page.id === pageId ? {
      ...page,
      fields: page.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field),
    } : page);
    persistCarouselWorkspace(nextPages, carouselTemplates);
  }

  function deleteCarouselField(pageId: string, fieldId: string) {
    const nextPages = carouselPageTemplates.map((page) => page.id === pageId ? {
      ...page,
      fields: page.fields.filter((field) => field.id !== fieldId),
    } : page);
    persistCarouselWorkspace(nextPages, carouselTemplates);
  }

  function createCarouselTemplate() {
    const name = newCarouselTemplateName.trim() || `Template carrousel ${carouselTemplates.length + 1}`;
    const template: LinkedInCarouselTemplate = {
      id: crypto.randomUUID(),
      name,
      description: "Regroupement de pages utilisé par l'IA pour composer un carrousel.",
      items: [],
      createdAt: new Date().toISOString(),
    };
    const nextTemplates = [template, ...carouselTemplates];
    persistCarouselWorkspace(carouselPageTemplates, nextTemplates);
    setSelectedCarouselTemplateId(template.id);
    setNewCarouselTemplateName("");
  }

  function updateCarouselTemplate(templateId: string, patch: Partial<LinkedInCarouselTemplate>) {
    const nextTemplates = carouselTemplates.map((template) => template.id === templateId ? { ...template, ...patch } : template);
    persistCarouselWorkspace(carouselPageTemplates, nextTemplates);
  }

  function deleteCarouselTemplate(templateId: string) {
    const nextTemplates = carouselTemplates.filter((template) => template.id !== templateId);
    persistCarouselWorkspace(carouselPageTemplates, nextTemplates);
    if (selectedCarouselTemplateId === templateId) setSelectedCarouselTemplateId(nextTemplates[0]?.id ?? "");
  }

  function addPageToCarouselTemplate(templateId: string, pageTemplateId: string) {
    if (!pageTemplateId) return;
    const itemId = crypto.randomUUID();
    const nextTemplates = carouselTemplates.map((template) => template.id === templateId ? {
      ...template,
      items: [...template.items, { id: itemId, pageTemplateId, mode: "single" as const }],
    } : template);
    persistCarouselWorkspace(carouselPageTemplates, nextTemplates);
    setSelectedCarouselTemplateItemId(itemId);
    setShowCarouselPagePicker(false);
    setCarouselPageSearch("");
  }

  function removePageFromCarouselTemplate(templateId: string, itemId: string) {
    const nextTemplates = carouselTemplates.map((template) => template.id === templateId ? {
      ...template,
      items: template.items.filter((item) => item.id !== itemId),
    } : template);
    persistCarouselWorkspace(carouselPageTemplates, nextTemplates);
    if (selectedCarouselTemplateItemId === itemId) setSelectedCarouselTemplateItemId("");
  }

  function updateCarouselTemplateItem(templateId: string, itemId: string, patch: Partial<LinkedInCarouselTemplate["items"][number]>) {
    const nextTemplates = carouselTemplates.map((template) => template.id === templateId ? {
      ...template,
      items: template.items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
    } : template);
    persistCarouselWorkspace(carouselPageTemplates, nextTemplates);
  }

  function moveCarouselTemplateItem(templateId: string, itemId: string, direction: -1 | 1) {
    const nextTemplates = carouselTemplates.map((template) => {
      if (template.id !== templateId) return template;
      const index = template.items.findIndex((item) => item.id === itemId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= template.items.length) return template;
      const items = [...template.items];
      const [item] = items.splice(index, 1);
      items.splice(nextIndex, 0, item);
      return { ...template, items };
    });
    persistCarouselWorkspace(carouselPageTemplates, nextTemplates);
  }

  function resolveCarouselPage(pageTemplateId: string): LinkedInCarouselPageTemplate | null {
    if (pageTemplateId === FREE_CAROUSEL_PAGE_ID) {
      return {
        id: FREE_CAROUSEL_PAGE_ID,
        name: "Libre",
        description: "Page libre ajoutÃ©e manuellement, ignorÃ©e par l'IA.",
        fields: [],
        pagePrompt: "",
        imagePrompt: "",
        createdAt: "",
      };
    }
    return carouselPageTemplates.find((entry) => entry.id === pageTemplateId) ?? null;
  }

  function buildCarouselSlidesFromTemplate(template: LinkedInCarouselTemplate, prompt: string) {
    const slides = template.items.flatMap((item, itemIndex) => {
      if (item.pageTemplateId === FREE_CAROUSEL_PAGE_ID) {
        return [`PAGE LIBRE ${itemIndex + 1}\n\nImage manuelle Ã  ajouter aprÃ¨s gÃ©nÃ©ration.`];
      }
      const page = resolveCarouselPage(item.pageTemplateId);
      if (!page) return [];
      const count = item.mode === "repeat_ai" ? 3 : 1;
      return Array.from({ length: count }).map((_, repeatIndex) => {
        const suffix = item.mode === "repeat_ai" ? ` ${repeatIndex + 1}` : "";
        const fields = page.fields.length > 0
          ? page.fields.map((field) => `${field.label.toUpperCase()}:\n${field.defaultValue || field.aiPrompt || "Ã€ remplir par l'IA."}`).join("\n\n")
          : `TEXTE:\n${page.pagePrompt || "Contenu Ã  gÃ©nÃ©rer."}`;
        return `${page.name}${suffix}\n\n${fields}\n\nCONTEXTE:\n${prompt || "Aucun prompt de dÃ©part."}`;
      });
    });
    return slides.length > 0 ? slides : ["Carrousel vide\n\nAjoute des pages au template avant de gÃ©nÃ©rer."];
  }

  function startCarouselGeneration(template?: LinkedInCarouselTemplate) {
    const selected = template ?? carouselTemplates.find((entry) => entry.id === carouselGenerationTemplateId || entry.id === selectedCarouselTemplateId) ?? carouselTemplates[0];
    setCarouselStudioMode("generate");
    if (selected) {
      setCarouselGenerationTemplateId(selected.id);
      setSelectedCarouselTemplateId(selected.id);
      const slides = buildCarouselSlidesFromTemplate(selected, carouselGenerationPrompt);
      setGeneratedSlides(slides);
      setActiveSlide(0);
      setCarouselGenerationHistory([{ id: crypto.randomUUID(), label: "Version initiale", slides, createdAt: new Date().toISOString() }]);
    }
  }

  function runCarouselGenerationChat() {
    const prompt = carouselGenerationPrompt.trim();
    const template = carouselTemplates.find((entry) => entry.id === carouselGenerationTemplateId);
    if (!prompt || !template) return;
    const before = generatedSlides;
    const nextSlides = buildCarouselSlidesFromTemplate(template, prompt);
    setGeneratedSlides(nextSlides);
    setActiveSlide(0);
    setCarouselGenerationChat((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: prompt },
      { id: crypto.randomUUID(), role: "assistant", content: `J'ai prÃ©parÃ© ${nextSlides.length} slides avec le template "${template.name}".` },
    ]);
    setCarouselGenerationHistory((current) => [
      { id: crypto.randomUUID(), label: prompt.slice(0, 60) || "Modification", slides: nextSlides, createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), label: "Version prÃ©cÃ©dente", slides: before, createdAt: new Date().toISOString() },
      ...current,
    ].slice(0, 20));
    setCarouselGenerationPrompt("");
  }

  function downloadCurrentCarousel() {
    const content = generatedSlides.length > 0 ? generatedSlides.map((slide, index) => `Slide ${index + 1}\n${slide}`).join("\n\n---\n\n") : generatedContent;
    if (!content.trim()) return;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = postType === "carousel" ? "carousel-linkedin.txt" : "post-linkedin.txt";
    link.click();
    URL.revokeObjectURL(url);
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

  async function runEditorChat() {
    const instruction = chatInput.trim();
    if (!instruction || !generatedContent.trim()) return;
    const before = generatedContent;
    setChatInput("");
    try {
      const res = await fetch("/api/linkedin/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: generatedContent,
          fullText: generatedContent,
          instruction: instruction.startsWith("/")
            ? `Applique cette commande au post LinkedIn complet : ${instruction}`
            : `Modifie le post LinkedIn complet selon cette demande : ${instruction}`,
          contextLabel: "post LinkedIn",
          openrouterApiKey: settings?.openrouterApiKey || undefined,
          model: settings?.model,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || "Transformation impossible");
      setGeneratedContent(data.text);
      pushEditorHistory({ label: instruction, before, after: data.text });
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Modification impossible.");
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
  const selectedCarouselPage = carouselPageTemplates.find((page) => page.id === selectedCarouselPageId) ?? carouselPageTemplates[0] ?? null;
  const selectedCarouselTemplate = carouselTemplates.find((template) => template.id === selectedCarouselTemplateId) ?? carouselTemplates[0] ?? null;
  const selectedCarouselTemplateItem = selectedCarouselTemplate?.items.find((item) => item.id === selectedCarouselTemplateItemId) ?? null;
  const selectedTemplateItemPage = selectedCarouselTemplateItem ? resolveCarouselPage(selectedCarouselTemplateItem.pageTemplateId) : null;
  const carouselPickerPages = [resolveCarouselPage(FREE_CAROUSEL_PAGE_ID), ...carouselPageTemplates].filter(Boolean) as LinkedInCarouselPageTemplate[];
  const filteredCarouselPickerPages = carouselPickerPages.filter((page) => `${page.name} ${page.description}`.toLowerCase().includes(carouselPageSearch.toLowerCase()));
  const carouselStudioView = (
    <>
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, borderRadius: 999, background: "#ededed" }}>
            {(["pages", "templates"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => { setCarouselStudioMode("builder"); setCarouselStudioTab(tab); }} style={{ minHeight: 30, padding: "0 13px", borderRadius: 999, border: 0, background: carouselStudioMode === "builder" && carouselStudioTab === tab ? "#fff" : "transparent", boxShadow: carouselStudioMode === "builder" && carouselStudioTab === tab ? "0px 1px 4px rgba(0,0,0,0.08)" : "none", color: carouselStudioMode === "builder" && carouselStudioTab === tab ? "#121a2e" : "rgba(18,26,46,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                {tab === "pages" ? `Pages (${carouselPageTemplates.length})` : `Templates (${carouselTemplates.length})`}
              </button>
            ))}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#121a2e" }}>Studio carrousel</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(18,26,46,0.45)" }}>Construis les pages Figma, assemble-les en templates, puis génère.</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" onClick={() => { const template = carouselTemplates.find((entry) => entry.id === selectedCarouselTemplateId) ?? carouselTemplates[0]; if (carouselStudioMode === "builder" && template) startCarouselGeneration(template); else setCarouselStudioMode("builder"); }} disabled={carouselTemplates.length === 0} style={{ minHeight: 38, padding: "0 14px", borderRadius: 999, border: carouselStudioMode === "generate" ? "1px solid #121a2e" : "1px solid rgba(18,26,46,0.12)", background: carouselStudioMode === "generate" ? "#121a2e" : "#fff", color: carouselStudioMode === "generate" ? "#fff" : "#121a2e", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 850, cursor: carouselTemplates.length ? "pointer" : "not-allowed", opacity: carouselTemplates.length ? 1 : 0.45, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            <Sparkles size={14} /> Studio génération
          </button>
          {carouselStudioMode === "builder" && carouselStudioTab === "pages" && <><input value={newCarouselPageName} onChange={(event) => setNewCarouselPageName(event.target.value)} placeholder="Nom de page..." style={{ ...inp, width: 210, minHeight: 38 }} /><ClientBlueButton compact type="button" onClick={createCarouselPageTemplate} icon={<Plus size={14} />}>Créer une page</ClientBlueButton></>}
          {carouselStudioMode === "builder" && carouselStudioTab === "templates" && <button type="button" onClick={createCarouselTemplate} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(18,26,46,0.06)" }} title="Nouveau template"><Plus size={17} /></button>}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", position: "relative", padding: carouselStudioMode === "generate" ? 0 : 24 }}>
        {carouselStudioMode === "generate" ? (
          <div style={{ height: "100%", display: "grid", gridTemplateColumns: "310px minmax(0,1fr) 320px", background: "#fbfbfb" }}>
            <aside style={{ borderRight: "1px solid rgba(18,26,46,0.08)", background: "#fff", padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 850, color: "#121a2e" }}>Paramètres</p>
              <select value={carouselGenerationTemplateId} onChange={(event) => { const template = carouselTemplates.find((entry) => entry.id === event.target.value); setCarouselGenerationTemplateId(event.target.value); if (template) startCarouselGeneration(template); }} style={inp}>
                <option value="">Choisir un template</option>
                {carouselTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.45)", lineHeight: 1.55 }}>Les pages “Libre” restent manuelles et ne sont pas incluses dans le brief IA.</p>
            </aside>
            <main style={{ overflowY: "auto", padding: "30px 36px", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              {generatedSlides.length === 0 ? <div style={{ minHeight: 420, width: "min(620px, 100%)", borderRadius: 28, border: "1px dashed rgba(18,26,46,0.16)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "rgba(18,26,46,0.42)" }}><LayoutTemplate size={34} /><p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Sélectionne un template pour démarrer</p></div> : <>
                <div style={{ width: "min(620px, 100%)", minHeight: 520, borderRadius: 30, background: "#d1d1d1", border: "5px solid #fff", boxShadow: "0 30px 12px rgba(0,0,0,0.01), 0 17px 10px rgba(0,0,0,0.03), 0 7px 7px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.05)", padding: 26, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <SmartSelectionTextarea rows={10} value={generatedSlides[activeSlide] ?? ""} onChange={(value) => { const nextSlides = [...generatedSlides]; nextSlides[activeSlide] = value; setGeneratedSlides(nextSlides); }} contextLabel="slide de carrousel LinkedIn" showGlobalAction={false} autoFit apiKey={settings?.openrouterApiKey || undefined} model={settings?.model} style={{ width: "100%", minHeight: 120, background: "transparent", border: 0, outline: "none", resize: "none", fontSize: 18, lineHeight: 1.55, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 12px", borderRadius: 999, background: "#303030", boxShadow: "0 12px 28px rgba(0,0,0,0.18)" }}>{generatedSlides.map((_, index) => <button key={index} type="button" onClick={() => setActiveSlide(index)} style={{ width: activeSlide === index ? 9 : 7, height: activeSlide === index ? 9 : 7, borderRadius: 999, border: 0, background: activeSlide === index ? "#fff" : "rgba(255,255,255,0.35)", cursor: "pointer", padding: 0 }} />)}</div>
                <div style={{ width: "min(860px, 100%)", minHeight: 54, borderRadius: 999, background: "#fff", border: "1px solid rgba(18,26,46,0.08)", boxShadow: "0 18px 42px rgba(18,26,46,0.08)", padding: "8px 10px 8px 18px", display: "flex", alignItems: "center", gap: 10 }}><Plus size={16} /><input value={carouselGenerationPrompt} onChange={(event) => setCarouselGenerationPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") runCarouselGenerationChat(); }} placeholder="Analyser les posts LinkedIn, modifier cette slide, raccourcir..." style={{ flex: 1, border: 0, outline: "none", fontSize: 13, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }} /><button type="button" onClick={runCarouselGenerationChat} style={{ width: 42, height: 42, borderRadius: 999, border: "1px solid #121a2e", background: "#121a2e", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={16} /></button></div>
              </>}
            </main>
            <aside style={{ borderLeft: "1px solid rgba(18,26,46,0.08)", background: "#fff", padding: 18, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><p style={{ margin: 0, fontSize: 15, fontWeight: 850, color: "#121a2e" }}>{showCarouselHistory ? "Historique" : "Chat"}</p><button type="button" onClick={() => setShowCarouselHistory((value) => !value)} style={{ width: 34, height: 34, borderRadius: 999, border: showCarouselHistory ? "1px solid #121a2e" : "1px solid rgba(18,26,46,0.12)", background: showCarouselHistory ? "#121a2e" : "#fff", color: showCarouselHistory ? "#fff" : "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><History size={15} /></button></div>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 9 }}>{showCarouselHistory ? (carouselGenerationHistory.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.45)" }}>Aucune version enregistrée.</p> : carouselGenerationHistory.map((entry) => <button key={entry.id} type="button" onClick={() => { setGeneratedSlides(entry.slides); setActiveSlide(0); }} style={{ border: "1px solid rgba(18,26,46,0.08)", borderRadius: 14, background: "#f8f8f8", padding: 11, textAlign: "left", cursor: "pointer" }}><strong style={{ display: "block", fontSize: 12, color: "#121a2e" }}>{entry.label}</strong><span style={{ fontSize: 11, color: "rgba(18,26,46,0.45)" }}>{entry.slides.length} slides</span></button>)) : (carouselGenerationChat.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.45)", lineHeight: 1.5 }}>Les demandes de modification apparaîtront ici. Tu peux aussi sélectionner du texte dans une slide.</p> : carouselGenerationChat.map((message) => <div key={message.id} style={{ alignSelf: message.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%", borderRadius: 14, padding: "9px 11px", background: message.role === "user" ? "#121a2e" : "#f3f3f3", color: message.role === "user" ? "#fff" : "#121a2e", fontSize: 12, lineHeight: 1.45 }}>{message.content}</div>))}</div>
            </aside>
          </div>
        ) : carouselStudioTab === "pages" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 24 }}>
            {carouselPageTemplates.map((page) => <button key={page.id} type="button" onClick={() => setSelectedCarouselPageId(page.id)} style={{ minHeight: 206, borderRadius: 18, border: "1px solid rgba(18,26,46,0.09)", background: "#fff", boxShadow: "0 16px 32px rgba(18,26,46,0.05)", padding: 22, cursor: "pointer", textAlign: "center", fontFamily: '"Plus Jakarta Sans", sans-serif' }}><span style={{ width: 112, height: 112, borderRadius: 14, background: "#d1d1d1", border: "4px solid #fff", boxShadow: "0 16px 32px rgba(18,26,46,0.12)", display: "block", margin: "0 auto 18px" }} /><strong style={{ display: "block", fontSize: 15, color: "#121a2e" }}>{page.name}</strong></button>)}
            <button type="button" onClick={createCarouselPageTemplate} style={{ minHeight: 206, borderRadius: 18, border: "1px dashed rgba(18,26,46,0.16)", background: "#fff", color: "#121a2e", fontSize: 15, fontWeight: 850, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}><Plus size={22} /> Ajouter une page</button>
          </div>
        ) : (
          <div style={{ height: "100%", display: "grid", gridTemplateColumns: "320px minmax(0, 1fr) 300px", gap: 18, overflow: "hidden" }}>
            <aside style={{ border: "1px solid rgba(18,26,46,0.09)", borderRadius: 20, background: "#fff", boxShadow: "0 18px 42px rgba(18,26,46,0.07)", padding: 18, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>{selectedCarouselTemplateItem && selectedTemplateItemPage ? <><p style={{ margin: 0, fontSize: 15, fontWeight: 850, color: "#121a2e" }}>Paramètres de page</p><input value={selectedCarouselTemplateItem.label ?? selectedTemplateItemPage.name} onChange={(event) => updateCarouselTemplateItem(selectedCarouselTemplate.id, selectedCarouselTemplateItem.id, { label: event.target.value })} style={inp} /><button type="button" onClick={() => updateCarouselTemplateItem(selectedCarouselTemplate.id, selectedCarouselTemplateItem.id, { mode: selectedCarouselTemplateItem.mode === "single" ? "repeat_ai" : "single" })} style={{ minHeight: 42, borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: selectedCarouselTemplateItem.mode === "repeat_ai" ? "#e8edff" : "#fff", color: selectedCarouselTemplateItem.mode === "repeat_ai" ? "#0147ff" : "#121a2e", fontSize: 12, fontWeight: 850, cursor: "pointer" }}>{selectedCarouselTemplateItem.mode === "repeat_ai" ? "Illimité IA activé" : "Générer une seule page"}</button></> : selectedCarouselTemplate ? <><p style={{ margin: 0, fontSize: 15, fontWeight: 850, color: "#121a2e" }}>Paramètres du template</p><input value={selectedCarouselTemplate.name} onChange={(event) => updateCarouselTemplate(selectedCarouselTemplate.id, { name: event.target.value })} style={inp} /><textarea value={selectedCarouselTemplate.description} onChange={(event) => updateCarouselTemplate(selectedCarouselTemplate.id, { description: event.target.value })} rows={4} style={{ ...inp, resize: "vertical" }} /></> : <p style={{ margin: 0, fontSize: 13, color: "rgba(18,26,46,0.45)" }}>Sélectionne ou crée un template.</p>}</aside>
            <main style={{ borderRadius: 22, background: "#fff", padding: 18, overflow: "hidden", display: "flex", alignItems: "center", gap: 28 }}>{!selectedCarouselTemplate ? <div style={{ flex: 1, textAlign: "center", color: "rgba(18,26,46,0.42)" }}>Aucun template sélectionné</div> : selectedCarouselTemplate.items.length === 0 ? <button type="button" onClick={() => setShowCarouselPagePicker(true)} style={{ flex: 1, minHeight: 400, border: "1px dashed rgba(18,26,46,0.16)", borderRadius: 22, background: "#f8f8f8", color: "rgba(18,26,46,0.45)", fontSize: 15, fontWeight: 850, cursor: "pointer" }}><Plus size={24} /> Ajouter une page</button> : <div style={{ display: "flex", gap: 28, overflowX: "auto", width: "100%", padding: "24px 8px" }}>{selectedCarouselTemplate.items.map((item, index) => { const page = resolveCarouselPage(item.pageTemplateId); const active = selectedCarouselTemplateItemId === item.id; return <button key={item.id} type="button" onClick={() => setSelectedCarouselTemplateItemId(item.id)} style={{ minWidth: active ? 260 : 210, height: active ? 330 : 260, borderRadius: 28, border: active ? "2px solid #2d6efd" : "5px solid #fff", background: "#d1d1d1", boxShadow: "0 30px 12px rgba(0,0,0,0.01), 0 17px 10px rgba(0,0,0,0.03), 0 7px 7px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.05)", cursor: "pointer", position: "relative" }}><span style={{ position: "absolute", top: 12, left: 14, fontSize: 12, fontWeight: 850 }}>{index + 1}</span><span style={{ position: "absolute", left: 18, right: 18, bottom: 22, fontSize: 14, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label || page?.name || "Page"}</span>{item.mode === "repeat_ai" && <span style={{ position: "absolute", top: 12, right: 14, borderRadius: 999, background: "#121a2e", color: "#fff", padding: "4px 7px", fontSize: 10, fontWeight: 850 }}>Illimité</span>}</button>; })}<button type="button" onClick={() => setShowCarouselPagePicker(true)} style={{ minWidth: 200, height: 260, borderRadius: 22, border: "1px dashed rgba(18,26,46,0.16)", background: "#fff", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, fontSize: 15, fontWeight: 850, cursor: "pointer" }}><Plus size={22} /> Ajouter une page</button></div>}</main>
            <aside style={{ border: "1px solid rgba(18,26,46,0.09)", borderRadius: 20, background: "#fff", boxShadow: "0 18px 42px rgba(18,26,46,0.07)", padding: 18, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}><p style={{ margin: 0, fontSize: 15, fontWeight: 850, color: "#121a2e" }}>Templates</p>{carouselTemplates.length === 0 ? <button type="button" onClick={createCarouselTemplate} style={{ minHeight: 150, borderRadius: 18, border: "1px dashed rgba(18,26,46,0.16)", background: "#f8f8f8", cursor: "pointer" }}><Plus size={18} /> Nouveau template</button> : carouselTemplates.map((template) => <button key={template.id} type="button" onClick={() => { setSelectedCarouselTemplateId(template.id); setSelectedCarouselTemplateItemId(""); }} style={{ border: selectedCarouselTemplate?.id === template.id ? "1px solid rgba(1,71,255,0.28)" : "1px solid rgba(18,26,46,0.08)", borderRadius: 18, background: "#fff", padding: 14, textAlign: "left", cursor: "pointer", boxShadow: "0 16px 32px rgba(18,26,46,0.05)" }}><span style={{ width: 70, height: 70, borderRadius: 13, background: "#d1d1d1", border: "4px solid #fff", boxShadow: "10px 10px 0 #d7d7d7, -10px 10px 0 #d7d7d7", display: "block", margin: "0 auto 14px" }} /><strong style={{ display: "block", fontSize: 14 }}>{template.name}</strong><span style={{ fontSize: 11, color: "rgba(18,26,46,0.45)" }}>{template.items.length} pages</span></button>)}</aside>
          </div>
        )}
        {showCarouselPagePicker && selectedCarouselTemplate && <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(255,255,255,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}><div style={{ width: 560, maxHeight: "82vh", overflow: "hidden", borderRadius: 22, background: "#fff", border: "1px solid rgba(18,26,46,0.1)", boxShadow: "0 28px 70px rgba(18,26,46,0.18)", display: "flex", flexDirection: "column" }}><div style={{ padding: 16, borderBottom: "1px solid rgba(18,26,46,0.08)", display: "flex", alignItems: "center", gap: 10 }}><Search size={16} /><input value={carouselPageSearch} onChange={(event) => setCarouselPageSearch(event.target.value)} placeholder="Rechercher une page..." style={{ flex: 1, border: 0, outline: "none", fontSize: 14 }} /><button type="button" onClick={() => setShowCarouselPagePicker(false)} style={{ border: 0, background: "transparent", cursor: "pointer", display: "flex" }}><X size={18} /></button></div><div style={{ padding: 16, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{filteredCarouselPickerPages.map((page) => <button key={page.id} type="button" onClick={() => addPageToCarouselTemplate(selectedCarouselTemplate.id, page.id)} style={{ border: "1px solid rgba(18,26,46,0.08)", borderRadius: 16, background: page.id === FREE_CAROUSEL_PAGE_ID ? "#fbfbfb" : "#fff", padding: 13, minHeight: 110, textAlign: "left", cursor: "pointer" }}><span style={{ width: 36, height: 36, borderRadius: 11, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{page.id === FREE_CAROUSEL_PAGE_ID ? <ImageIcon size={15} /> : <FileText size={15} />}</span><strong style={{ display: "block", fontSize: 13 }}>{page.name}</strong><span style={{ fontSize: 11, color: "rgba(18,26,46,0.45)" }}>{page.description}</span></button>)}</div></div></div>}
      </div>
    </>
  );  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", ...jk }}>
      {/* ── Left: Create panel ── */}
      <div style={{ width: 384, borderRight: "1px solid rgba(0,0,0,0.09)", background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, borderRadius: 999, background: "#ededed", marginBottom: 14 }}>
            {([
              ["post", "Poste", <Edit3 size={12} key="post" />],
              ["carousel", "Carrousel", <LayoutTemplate size={12} key="carousel" />],
            ] as const).map(([mode, label, icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setPostsMode(mode);
                  if (mode === "post") setPostType("post");
                  else {
                    setPostType("carousel");
                    resetEditor();
                  }
                }}
                style={{ minHeight: 30, padding: "0 13px", borderRadius: 999, border: 0, background: postsMode === mode ? "#fff" : "transparent", boxShadow: postsMode === mode ? "0px 1px 4px rgba(0,0,0,0.08)" : "none", color: postsMode === mode ? "#121a2e" : "rgba(18,26,46,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', display: "flex", alignItems: "center", gap: 6 }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>Créer un post</h2>

          {/* Source tabs */}
          {!rightEditorVisible && <div style={{ display: "flex", gap: 2, marginTop: 12, background: "#f2f2f2", borderRadius: 9, padding: 3 }}>
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
          </div>}
        </div>

        <div style={{ flex: 1, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {rightEditorVisible ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.58)", marginBottom: 7 }}>Style du post</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {styles.map((style) => {
                    const tag = STYLE_TAGS[style.category] ?? STYLE_TAGS.custom;
                    const active = selectedStyleId === style.id;
                    return (
                      <button key={style.id} type="button" onClick={() => setSelectedStyleId(style.id)} style={{ padding: "6px 12px", borderRadius: 20, border: active ? `1px solid ${tag.border}` : inactiveStyleTag.border, background: active ? tag.bg : inactiveStyleTag.background, color: active ? tag.color : inactiveStyleTag.color, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        {style.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(18,26,46,0.5)", marginBottom: 4 }}>
                  <Clock size={10} /> Date de programmation
                </label>
                <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ ...inp, fontSize: 12 }} />
              </div>
              <label style={{ border: "1px dashed rgba(18,26,46,0.14)", borderRadius: 12, background: "#f7f7f7", minHeight: 58, padding: 10, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <ImageIcon size={16} style={{ color: "rgba(18,26,46,0.42)" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(18,26,46,0.58)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{draftMedia ? draftMedia.fileName : "Ajouter une image"}</span>
                <input type="file" accept="image/*,.pdf,application/pdf" style={{ display: "none" }} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleDraftMedia(file);
                  event.currentTarget.value = "";
                }} />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ClientBlueButton type="button" onClick={() => handleSave("draft")} loading={saving} wrapperStyle={{ width: "100%" }} style={{ width: "100%", fontSize: 14 }} disabled={!generatedContent.trim()}>
                  Sauvegarder
                </ClientBlueButton>
                <button type="button" onClick={() => handleSave("scheduled")} disabled={saving || !scheduleDate || !generatedContent.trim()} style={{ minHeight: 48, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 13, background: "#fff", color: "#121a2e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', boxShadow: "0px 4px 12px rgba(18,26,46,0.06)", opacity: scheduleDate && generatedContent.trim() ? 1 : 0.45 }}>
                  Programmer
                </button>
              </div>
              <button type="button" onClick={resetEditor} style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", color: "rgba(18,26,46,0.55)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Fermer l'éditeur
              </button>
            </div>
          ) : (
          <>
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
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Ajouter des précisions</label>
                <textarea rows={3} value={manualIdea} onChange={e => setManualIdea(e.target.value)}
                  placeholder="Ajoute un angle, une nuance, un exemple à intégrer..."
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {styles.map((style) => {
                const tag = STYLE_TAGS[style.category] ?? STYLE_TAGS.custom;
                const active = selectedStyleId === style.id;
                return (
                  <button key={style.id} type="button" onClick={() => setSelectedStyleId(style.id)} style={{ padding: "6px 12px", borderRadius: 20, border: active ? `1px solid ${tag.border}` : inactiveStyleTag.border, background: active ? tag.bg : inactiveStyleTag.background, color: active ? tag.color : inactiveStyleTag.color, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    {style.name}
                  </button>
                );
              })}
            </div>
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
          </>
          )}
        </div>
      </div>

      {/* ── Right: Posts list ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fbfbfb" }}>
        {postsMode === "carousel" ? carouselStudioView : (
        <>
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
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 760px) 320px", gap: 18, alignItems: "start" }}>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void handleDraftMedia(file);
              }}
              style={{ background: "#fff", border: "1px solid rgba(18,26,46,0.1)", borderRadius: 18, boxShadow: "0 30px 12px rgba(0,0,0,0.01), 0 17px 10px rgba(0,0,0,0.03), 0 7px 7px rgba(0,0,0,0.04), 0 2px 4.4px rgba(0,0,0,0.05)", padding: 22, display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>{editingPostId ? "Modifier le brouillon" : "Nouveau brouillon manuel"}</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(18,26,46,0.48)" }}>Écris librement, puis sélectionne un passage pour le transformer avec l’IA.</p>
                </div>
                <button type="button" onClick={resetEditor} style={{ border: "1px solid rgba(18,26,46,0.12)", borderRadius: 999, background: "#fff", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={16} />
                </button>
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
                  autoFit
                  showWordCount
                  onHistory={pushEditorHistory}
                  apiKey={settings?.openrouterApiKey || undefined}
                  model={settings?.model}
                  style={{ ...inp, minHeight: 42, background: "#fff", border: "none", lineHeight: 1.55, fontSize: 15, padding: 0, resize: "none", whiteSpace: "pre-wrap", fontFamily: "Arial, Helvetica, sans-serif" }}
                />
              </div>
              {draftMedia && <div style={{ width: "100%", maxWidth: 552, height: 240, borderRadius: 14, background: `url(${draftMedia.url}) center / cover`, boxShadow: "0 10px 22px rgba(18,26,46,0.12)" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid rgba(18,26,46,0.08)", paddingTop: 10 }}>
                <label style={{ width: 34, height: 34, borderRadius: 10, background: "#f6f6f6", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.45)", cursor: "pointer" }}>
                  <ImageIcon size={15} />
                  <input type="file" accept="image/*,.pdf,application/pdf" style={{ display: "none" }} onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleDraftMedia(file);
                    event.currentTarget.value = "";
                  }} />
                </label>
                <span style={{ fontSize: 12, color: "rgba(18,26,46,0.42)" }}>Glisse une image ici ou clique sur l’icône.</span>
              </div>
              <div style={{ borderTop: "1px solid rgba(18,26,46,0.08)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runEditorChat(); }} placeholder="Parle à l’IA ou tape / pour une commande..." style={{ ...inp, minHeight: 42, background: "#fff", flex: 1 }} />
                  <button type="button" onClick={() => void runEditorChat()} style={{ ...btnGrad, padding: "0 14px", minHeight: 42, fontSize: 12 }}>Envoyer</button>
                </div>
                {chatInput.startsWith("/") && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["/corriger", "/hook", "/open-loop", "/condenser", "/développer", "/citation"].map((cmd) => (
                      <button key={cmd} type="button" onClick={() => setChatInput(cmd + " ")} style={{ border: "1px solid rgba(18,26,46,0.1)", borderRadius: 999, background: "#fff", padding: "6px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{cmd}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <aside style={{ border: "1px solid rgba(18,26,46,0.1)", borderRadius: 18, background: "#fff", boxShadow: "0 18px 42px rgba(18,26,46,0.07)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#121a2e" }}>Historique</p>
              {editorHistory.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.45)", lineHeight: 1.5 }}>Les modifications IA apparaîtront ici. Tu pourras restaurer une ancienne version.</p>
              ) : editorHistory.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setGeneratedContent(entry.after)} style={{ border: "1px solid rgba(18,26,46,0.08)", borderRadius: 13, background: "#f8f8f8", padding: 10, textAlign: "left", cursor: "pointer" }}>
                  <strong style={{ display: "block", fontSize: 12, color: "#121a2e", marginBottom: 5 }}>{entry.label}</strong>
                  <span style={{ fontSize: 11, color: "rgba(18,26,46,0.48)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{entry.after}</span>
                </button>
              ))}
            </aside>
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
        </>
        )}
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
