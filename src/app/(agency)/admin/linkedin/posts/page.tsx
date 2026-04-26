"use client";

import { useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Wand2, Loader2, X, Check, Trash2, Link2, Plus, Download,
  Youtube, Lightbulb, AlignLeft, LayoutTemplate, Edit3,
  ThumbsUp, MessageCircle, Eye, Calendar,
  FileText, Image as ImageIcon,
  Search, Send, History, ChevronDown, ArrowLeft, ArrowRight, MoveRight,
  Upload,
} from "lucide-react";
import type { LinkedInCarouselPageTemplate, LinkedInCarouselTemplate, LinkedInPost, LinkedInPostAnalytics, LinkedInStyle, LinkedInIdea } from "@/types/linkedin";
import { DEFAULT_STYLES } from "@/types/linkedin";
import { loadLinkedInSettings, type LinkedInSettings } from "@/lib/linkedin/settings";
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
  persistRemoteLinkedInSettings,
  queueRemoteLinkedInSettingsSync,
} from "@/lib/linkedin/settings";
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
type CarouselStudioTab = "templates" | "editor";
type CarouselStudioMode = "builder" | "generate";
type ManualPostFormat = NonNullable<LinkedInPostAnalytics["format"]>;
type CarouselSlideKind = "context" | "step" | "argument-blue" | "argument-red" | "cta" | "before-after" | "why-design" | "avis" | "image" | "free";
type CarouselSlidePayload = {
  kind: CarouselSlideKind;
  label: string;
  stepNumber?: number;
  pointNumber?: number;
  title?: string;
  subtitle?: string;
  body?: string;
  result?: string;
  showResult?: boolean;
  showCheck?: boolean;
  showStepCta?: boolean;
  stepCtaText?: string;
  imageMode?: "frame" | "full";
  imageSource?: "manual" | "ai";
  imageUrl?: string;
  beforeImage?: string;
  afterImage?: string;
  backgroundImage1?: string;
  backgroundImage2?: string;
};

type CarouselTemplateItemMeta = {
  label?: string;
  fields?: Record<string, string>;
  pagePrompt?: string;
  imagePrompt?: string;
};

const MANUAL_POST_FORMATS: Array<{ value: ManualPostFormat; label: string }> = [
  { value: "text", label: "Texte" },
  { value: "image", label: "Image" },
  { value: "video", label: "Vidéo" },
  { value: "document", label: "Document" },
];

const FREE_CAROUSEL_PAGE_ID = "__free_carousel_page__";
const SLIDE_KIND_PREFIX = "builtin:";

const CAROUSEL_SLIDE_LIBRARY: LinkedInCarouselPageTemplate[] = [
  {
    id: "builtin:context",
    name: "Contexte",
    description: "Slide contexte avec label fixe et sous-titre modifiable.",
    figmaNodeId: "slide:context",
    pagePrompt: "Genere une slide contexte. Remplis uniquement le texte de contexte principal. Respecte le ton LinkedIn, une progression claire, et tiens compte du parametre d'affichage du bouton de transition ainsi que de son texte si le bouton est active.",
    imagePrompt: "",
    fields: [
      { id: "context-subtitle", label: "Texte du sous-titre", kind: "text", required: true, aiPrompt: "Genere le texte de contexte.", defaultValue: "La plupart des landing pages convertissent mal.\n\nPas parce qu'elles sont moches. Mais parce qu'elles parlent a tout le monde... donc a personne." },
      { id: "context-step-enabled", label: "Afficher le bouton etape", kind: "text", required: false, aiPrompt: "oui/non", defaultValue: "oui" },
      { id: "context-step-text", label: "Texte du bouton", kind: "text", required: false, aiPrompt: "Texte court du bouton noir.", defaultValue: "Voici les 3 etapes pour y remedier" },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:step",
    name: "Etape",
    description: "Slide etape avec numerotation automatique.",
    figmaNodeId: "slide:step",
    pagePrompt: "Genere une slide etape courte et actionnable. Respecte la numerotation automatique de l'etape et genere un titre d'etape tres court, net et orienté action.",
    imagePrompt: "",
    fields: [
      { id: "step-title", label: "Texte de l'etape", kind: "text", required: true, aiPrompt: "Titre d'etape.", defaultValue: "Creer ton avatar client" },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:argument-blue",
    name: "Point bleu",
    description: "Argument positif dynamique avec image et resultat optionnel.",
    figmaNodeId: "slide:argument-blue",
    pagePrompt: "Genere une slide argument positive. Renseigne un titre court, un sous-texte clair, le bloc resultat si active, et respecte les options d'image, de mode d'image et d'affichage du resultat.",
    imagePrompt: "Decris une image qui illustre precisement ce point positif. L'image doit etre exploitable par un modele image et fonctionner en mode avec cadre ou plein format.",
    fields: [
      { id: "arg-title", label: "Titre max 22 caracteres", kind: "text", required: true, aiPrompt: "Titre court.", defaultValue: "Definis son profil" },
      { id: "arg-subtitle", label: "Sous-titre", kind: "text", required: true, aiPrompt: "Explication courte.", defaultValue: "Pas environ 30 ans. Exactement qui il est : age, metier, ville, niveau de vie, situation familiale." },
      { id: "arg-image", label: "Image", kind: "image", required: false, aiPrompt: "Image manuelle ou generee." },
      { id: "arg-image-source", label: "Image IA active", kind: "text", required: false, aiPrompt: "oui/non", defaultValue: "non" },
      { id: "arg-image-mode", label: "Mode image", kind: "text", required: false, aiPrompt: "frame/full", defaultValue: "frame" },
      { id: "arg-result-enabled", label: "Afficher resultat", kind: "text", required: false, aiPrompt: "oui/non", defaultValue: "oui" },
      { id: "arg-result", label: "Texte resultat", kind: "text", required: false, aiPrompt: "Resultat court.", defaultValue: "Resultat : La valeur percue s'effondre" },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:argument-red",
    name: "Point rouge",
    description: "Argument negatif, meme structure que le point bleu.",
    figmaNodeId: "slide:argument-red",
    pagePrompt: "Genere une slide argument negative. Renseigne un titre court, un sous-texte clair, le bloc resultat si active, et respecte les options d'image, de mode d'image et d'affichage du resultat.",
    imagePrompt: "Decris une image qui illustre precisement cette erreur ou faiblesse. L'image doit etre exploitable par un modele image et fonctionner en mode avec cadre ou plein format.",
    fields: [
      { id: "arg-title", label: "Titre max 22 caracteres", kind: "text", required: true, aiPrompt: "Titre court.", defaultValue: "Aucune preuve sociale" },
      { id: "arg-subtitle", label: "Sous-titre", kind: "text", required: true, aiPrompt: "Explication courte.", defaultValue: "Pas environ 30 ans. Exactement qui il est : age, metier, ville, niveau de vie, situation familiale." },
      { id: "arg-image", label: "Image", kind: "image", required: false, aiPrompt: "Image manuelle ou generee." },
      { id: "arg-image-source", label: "Image IA active", kind: "text", required: false, aiPrompt: "oui/non", defaultValue: "non" },
      { id: "arg-image-mode", label: "Mode image", kind: "text", required: false, aiPrompt: "frame/full", defaultValue: "frame" },
      { id: "arg-result-enabled", label: "Afficher resultat", kind: "text", required: false, aiPrompt: "oui/non", defaultValue: "oui" },
      { id: "arg-result", label: "Texte resultat", kind: "text", required: false, aiPrompt: "Resultat court.", defaultValue: "Resultat : La valeur percue s'effondre" },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:cta",
    name: "CTA",
    description: "Slide CTA fixe, seules les deux images de fond sont modifiables.",
    figmaNodeId: "slide:cta",
    pagePrompt: "Slide CTA fixe. Ne modifie pas la structure de la slide. Utilise uniquement les visuels de fond si necessaire.",
    imagePrompt: "",
    fields: [
      { id: "cta-bg-1", label: "Image de fond 1", kind: "image", required: false, aiPrompt: "Image de fond principale." },
      { id: "cta-bg-2", label: "Image de fond 2", kind: "image", required: false, aiPrompt: "Image de fond secondaire." },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:before-after",
    name: "Avant / Apres",
    description: "Deux images fixes avant et apres.",
    figmaNodeId: "slide:before-after",
    pagePrompt: "Genere une slide avant/apres en conservant la structure fixe. Utilise uniquement les deux visuels compares et garde une lecture immediate de la transformation.",
    imagePrompt: "",
    fields: [
      { id: "before-image", label: "Image avant", kind: "image", required: true, aiPrompt: "Image avant." },
      { id: "after-image", label: "Image apres", kind: "image", required: true, aiPrompt: "Image apres." },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:why-design",
    name: "Pourquoi ce design fonctionne",
    description: "Slide bleue dont seul le texte est modifiable.",
    figmaNodeId: "slide:why-design",
    pagePrompt: "Genere uniquement le texte principal de la slide pourquoi ce design fonctionne mieux. Ne cree pas de titre additionnel et respecte la structure fixe.",
    imagePrompt: "",
    fields: [
      { id: "why-text", label: "Texte", kind: "text", required: true, aiPrompt: "Texte de la carte bleue.", defaultValue: "Pourquoi ce design fonctionne-t-il mieux ?" },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:avis",
    name: "Avis",
    description: "Slide avis fixe.",
    figmaNodeId: "slide:avis",
    pagePrompt: "Genere une slide avis ou question de preference. Respecte la structure fixe et concentre-toi sur l'intention de comparaison ou de choix.",
    imagePrompt: "",
    fields: [
      { id: "avis-title", label: "Question", kind: "text", required: true, aiPrompt: "Question de preference.", defaultValue: "Tu preferes quelle version ?" },
      { id: "avis-image-1", label: "Image version 1", kind: "image", required: false, aiPrompt: "Premiere image." },
      { id: "avis-image-2", label: "Image version 2", kind: "image", required: false, aiPrompt: "Deuxieme image." },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:image",
    name: "Image",
    description: "Slide image plein format.",
    figmaNodeId: "slide:image",
    pagePrompt: "Slide image seule. Toute la slide doit etre portee par un unique visuel plein format sans autre element de contenu.",
    imagePrompt: "Decris une image hero plein format qui remplit toute la slide en 575x690 avec un cadrage fort et lisible.",
    fields: [
      { id: "image-src", label: "Image", kind: "image", required: true, aiPrompt: "Image principale de la slide." },
    ],
    createdAt: "builtin",
  },
];

function getSlideKind(pageTemplateId: string): CarouselSlideKind {
  return pageTemplateId.replace(SLIDE_KIND_PREFIX, "") as CarouselSlideKind;
}

function isEnabled(value?: string) {
  return !["non", "false", "0", "off"].includes((value || "").trim().toLowerCase());
}

function getTemplateField(page: LinkedInCarouselPageTemplate | null, fieldId: string, fallback = "") {
  return page?.fields.find((field) => field.id === fieldId)?.defaultValue ?? fallback;
}

function limitSlideTitle(value: string, max = 22) {
  const clean = value.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}...`;
}

function splitInstructionPoints(prompt: string) {
  const lines = prompt
    .split(/\n|;|•|-/)
    .map((line) => line.replace(/^\d+[\).\s-]*/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const sentences = prompt.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter((line) => line.length > 18);
  return sentences.length > 1 ? sentences : [];
}

function encodeCarouselSlide(payload: CarouselSlidePayload) {
  return `__AF_CAROUSEL_SLIDE__${JSON.stringify(payload)}`;
}

function decodeCarouselSlide(value: string): CarouselSlidePayload | null {
  if (!value.startsWith("__AF_CAROUSEL_SLIDE__")) return null;
  try {
    return JSON.parse(value.replace("__AF_CAROUSEL_SLIDE__", "")) as CarouselSlidePayload;
  } catch {
    return null;
  }
}

function encodeCarouselTemplateItemMeta(meta: CarouselTemplateItemMeta) {
  return `__AF_ITEM_META__${JSON.stringify(meta)}`;
}

function decodeCarouselTemplateItemMeta(label?: string): CarouselTemplateItemMeta {
  if (!label?.startsWith("__AF_ITEM_META__")) return {};
  try {
    return JSON.parse(label.replace("__AF_ITEM_META__", "")) as CarouselTemplateItemMeta;
  } catch {
    return {};
  }
}

function getCarouselTemplateItemLabel(item: LinkedInCarouselTemplate["items"][number], page: LinkedInCarouselPageTemplate | null, index: number) {
  const meta = decodeCarouselTemplateItemMeta(item.label);
  const rawLabel = item.label?.startsWith("__AF_ITEM_META__") ? "" : item.label ?? "";
  const safeLabel = /^[a-z0-9_-]+$/i.test(rawLabel) || rawLabel.includes("__AF_ITEM_META__") ? "" : rawLabel;
  return meta.label || safeLabel || page?.name || `Page ${index + 1}`;
}

function getCarouselTemplateItemField(item: LinkedInCarouselTemplate["items"][number], page: LinkedInCarouselPageTemplate | null, fieldId: string, fallback = "") {
  const meta = decodeCarouselTemplateItemMeta(item.label);
  return meta.fields?.[fieldId] ?? getTemplateField(page, fieldId, fallback);
}

function getCarouselTemplateItemPrompt(item: LinkedInCarouselTemplate["items"][number], page: LinkedInCarouselPageTemplate | null, kind: "pagePrompt" | "imagePrompt") {
  const meta = decodeCarouselTemplateItemMeta(item.label);
  return meta[kind] ?? page?.[kind] ?? "";
}

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
    img.onerror = () => reject(new Error("Impossible de télécharger l'image."));
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

// Style tokens

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
const OPENROUTER_MODEL_OPTIONS = [
  "anthropic/claude-sonnet-4",
  "anthropic/claude-3.7-sonnet",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4.1",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "google/gemini-2.0-flash",
];

//

export default function PostsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const isCarouselRoute = pathname.startsWith("/admin/linkedin/carrousel");
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [styles, setStyles] = useState<LinkedInStyle[]>(DEFAULT_STYLES);
  const [ideas, setIdeas] = useState<LinkedInIdea[]>([]);
  const [carouselPageTemplates, setCarouselPageTemplates] = useState<LinkedInCarouselPageTemplate[]>([]);
  const [carouselTemplates, setCarouselTemplates] = useState<LinkedInCarouselTemplate[]>([]);

  const [sourceTab, setSourceTab] = useState<SourceTab>("idea");
  const [postsMode, setPostsMode] = useState<PostsMode>("post");
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const [postType, setPostType] = useState<"post" | "carousel">("post");
  const [selectedPostFormat, setSelectedPostFormat] = useState<ManualPostFormat | "">("");
  const [carouselSlides, setCarouselSlides] = useState(5);
  const [carouselStudioTab, setCarouselStudioTab] = useState<CarouselStudioTab>("editor");
  const [carouselStudioMode, setCarouselStudioMode] = useState<CarouselStudioMode>("builder");
  const [selectedCarouselPageId, setSelectedCarouselPageId] = useState("");
  const [selectedCarouselTemplateId, setSelectedCarouselTemplateId] = useState("");
  const [selectedCarouselTemplateItemId, setSelectedCarouselTemplateItemId] = useState("");
  const [showCarouselPagePicker, setShowCarouselPagePicker] = useState(false);
  const [showCarouselTemplatePicker, setShowCarouselTemplatePicker] = useState(false);
  const [carouselPageSearch, setCarouselPageSearch] = useState("");
  const [carouselTemplateSearch, setCarouselTemplateSearch] = useState("");
  const [carouselGenerationTemplateId, setCarouselGenerationTemplateId] = useState("");
  const [carouselGenerationPrompt, setCarouselGenerationPrompt] = useState("");
  const [carouselDraftName, setCarouselDraftName] = useState("");
  const [carouselDraftCategory, setCarouselDraftCategory] = useState("");
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
  const [hoveredDraftImage, setHoveredDraftImage] = useState(false);
  const [scheduleOverlayPostId, setScheduleOverlayPostId] = useState<string | null>(null);
  const [scheduleOverlayDate, setScheduleOverlayDate] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [draggedCarouselItemId, setDraggedCarouselItemId] = useState("");
  const editorCarouselRef = useRef<HTMLDivElement | null>(null);
  const editorDragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });

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
  const [settings, setSettings] = useState<LinkedInSettings | null>(null);

  useEffect(() => {
    setPostsMode(isCarouselRoute ? "carousel" : "post");
    setPostType(isCarouselRoute ? "carousel" : "post");
    if (isCarouselRoute) {
      setCarouselStudioTab("editor");
    }
  }, [isCarouselRoute]);

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
        setSelectedPostFormat(prefillPost.format ?? "document");
        if (prefillPost.styleId) setSelectedStyleId(prefillPost.styleId);
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

  useEffect(() => {
    if (postsMode !== "carousel" || !manualEditorStarted || generatedSlides.length === 0) return;
    const timeout = window.setTimeout(() => {
      setPosts((currentPosts) => {
        const existingPost = editingPostId ? currentPosts.find((post) => post.id === editingPostId) : null;
        const content = generatedSlides.join("\n\n---\n\n");
        const nextPost: LinkedInPost = {
          ...(existingPost ?? {
            id: editingPostId ?? crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            likes: 0,
            comments: 0,
            impressions: 0,
          }),
          content,
          type: "carousel",
          slides: generatedSlides,
          status: existingPost?.status ?? "draft",
          sourceType: existingPost?.sourceType ?? "manual",
          sourceTitle: carouselDraftName.trim() || existingPost?.sourceTitle,
          styleId: existingPost?.styleId,
          styleName: existingPost?.styleName,
          scheduledAt: existingPost?.scheduledAt,
          publishedAt: existingPost?.publishedAt,
          tags: (styles.find((entry) => entry.id === carouselDraftCategory)?.name ?? "").trim()
            ? [styles.find((entry) => entry.id === carouselDraftCategory)?.name ?? ""]
            : existingPost?.tags ?? [],
          analytics: normalizeAnalytics({
            ...existingPost?.analytics,
            format: "carousel",
            topic: styles.find((entry) => entry.id === carouselDraftCategory)?.name || existingPost?.analytics?.topic || "",
          }),
        };
        const nextEditingPostId = existingPost?.id ?? nextPost.id;
        const updated = normalizePosts(
          existingPost
            ? currentPosts.map((post) => (post.id === existingPost.id ? nextPost : post))
            : [nextPost, ...currentPosts]
        );
        saveLinkedInPosts(updated);
        void persistRemoteLinkedInPosts(updated, true);
        if (editingPostId !== nextEditingPostId) {
          window.setTimeout(() => setEditingPostId(nextEditingPostId), 0);
        }
        return updated;
      });
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [postsMode, manualEditorStarted, generatedSlides, editingPostId]);

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
    setSelectedPostFormat("");
    setDraftMedia(null);
    setManualEditorStarted(false);
    setEditorHistory([]);
    setChatInput("");
    setHoveredDraftImage(false);
    setScheduleOverlayPostId(null);
    setScheduleOverlayDate("");
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
    setSelectedPostFormat(analytics.format && analytics.format !== "carousel" ? analytics.format : "");
    setDraftMedia(analytics.mediaPreviewUrl ? {
      url: analytics.mediaPreviewUrl,
      kind: analytics.mediaPreviewKind === "pdf" ? "pdf" : "image",
      fileName: analytics.mediaFileName ?? "media",
      bytes: analytics.mediaStorageBytes ?? 0,
    } : null);
    setManualEditorStarted(true);
    setEditorHistory([]);
    setChatInput("");
    setHoveredDraftImage(false);
  }

  function startManualPost() {
    setSourceTab("manual");
    setEditingPostId(null);
    setGeneratedContent("");
    setGeneratedSlides([]);
    setPostType("post");
    setSelectedPostFormat("");
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
      pagePrompt: `Genere une slide "${name}" claire, visuelle et concise. Decris precisement le role de chaque champ, les textes attendus, les options activables ou desactivables, et la logique de mise en page pour que la slide soit directement exploitable.`,
      imagePrompt: `Decris l'image attendue pour "${name}" de maniere tres precise afin qu'un modele image puisse la generer proprement.`,
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

  function updateCarouselTemplateItemMeta(templateId: string, itemId: string, patch: Partial<CarouselTemplateItemMeta>) {
    const nextTemplates = carouselTemplates.map((template) => {
      if (template.id !== templateId) return template;
      return {
        ...template,
        items: template.items.map((item) => {
          if (item.id !== itemId) return item;
          const current = decodeCarouselTemplateItemMeta(item.label);
          if (!item.label?.startsWith("__AF_ITEM_META__") && item.label) current.label = item.label;
          return { ...item, label: encodeCarouselTemplateItemMeta({ ...current, ...patch }) };
        }),
      };
    });
    persistCarouselWorkspace(carouselPageTemplates, nextTemplates);
    const nextTemplate = nextTemplates.find((template) => template.id === templateId);
    if (nextTemplate && carouselStudioMode === "generate" && generatedSlides.length > 0) {
      setGeneratedSlides(buildCarouselSlidesFromTemplate(nextTemplate, carouselGenerationPrompt));
    }
  }

  function updateCarouselTemplateItemField(templateId: string, itemId: string, fieldId: string, value: string) {
    const item = carouselTemplates.find((template) => template.id === templateId)?.items.find((entry) => entry.id === itemId);
    const current = decodeCarouselTemplateItemMeta(item?.label);
    updateCarouselTemplateItemMeta(templateId, itemId, {
      fields: {
        ...(current.fields ?? {}),
        [fieldId]: fieldId === "arg-title" ? limitSlideTitle(value) : value,
      },
    });
  }

  function updateCarouselTemplateItemPrompt(
    templateId: string,
    itemId: string,
    kind: "pagePrompt" | "imagePrompt",
    value: string
  ) {
    updateCarouselTemplateItemMeta(templateId, itemId, {
      [kind]: value,
    });
  }

  async function importCarouselTemplateItemImage(templateId: string, itemId: string, fieldId: string, file?: File | null) {
    if (!file) return;
    const preview = await fileToCompressedPreview(file);
    updateCarouselTemplateItemField(templateId, itemId, fieldId, preview.url);
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

  function reorderCarouselTemplateItem(templateId: string, draggedId: string, targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const nextTemplates = carouselTemplates.map((template) => {
      if (template.id !== templateId) return template;
      const fromIndex = template.items.findIndex((item) => item.id === draggedId);
      const toIndex = template.items.findIndex((item) => item.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return template;
      const items = [...template.items];
      const [dragged] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, dragged);
      return { ...template, items };
    });
    persistCarouselWorkspace(carouselPageTemplates, nextTemplates);
  }

  function resolveCarouselPage(pageTemplateId: string): LinkedInCarouselPageTemplate | null {
    const builtin = CAROUSEL_SLIDE_LIBRARY.find((entry) => entry.id === pageTemplateId);
    if (builtin) return builtin;
    if (pageTemplateId === FREE_CAROUSEL_PAGE_ID) {
      return {
        id: FREE_CAROUSEL_PAGE_ID,
        name: "Libre",
        description: "Page libre ajoutée manuellement, ignorée par l'IA.",
        fields: [],
        pagePrompt: "",
        imagePrompt: "",
        createdAt: "",
      };
    }
    return carouselPageTemplates.find((entry) => entry.id === pageTemplateId) ?? null;
  }

  function buildCarouselSlidesFromTemplate(template: LinkedInCarouselTemplate, prompt: string) {
    let stepIndex = 0;
    let pointIndex = 0;
    const instructionPoints = splitInstructionPoints(prompt);
    const slides = template.items.flatMap((item, itemIndex) => {
      if (item.pageTemplateId === FREE_CAROUSEL_PAGE_ID) {
        return [encodeCarouselSlide({ kind: "free", label: "Libre", body: "" })];
      }
      const page = resolveCarouselPage(item.pageTemplateId);
      if (!page) return [];
      const kind = getSlideKind(page.id);
      const getField = (fieldId: string, fallback = "") => getCarouselTemplateItemField(item, page, fieldId, fallback);
      const isArgument = kind === "argument-blue" || kind === "argument-red";
      const dynamicPoints = item.mode === "repeat_ai" || isArgument ? instructionPoints : [];
      const count = dynamicPoints.length > 0 ? dynamicPoints.length : item.mode === "repeat_ai" ? 3 : 1;
      return Array.from({ length: count }).map((_, repeatIndex) => {
        const pointText = dynamicPoints[repeatIndex] ?? prompt;
        if (kind === "step") stepIndex += 1;
        if (isArgument) pointIndex += 1;
        const payload: CarouselSlidePayload = {
          kind,
          label: page.name,
          stepNumber: kind === "step" ? stepIndex : undefined,
          pointNumber: isArgument ? pointIndex : undefined,
          title: kind === "avis" ? getField("avis-title") : limitSlideTitle(isArgument ? (pointText || getField("arg-title")) : getField("step-title")),
          subtitle: isArgument ? getField("arg-subtitle", pointText) : getField("context-subtitle"),
          body: kind === "why-design" ? getField("why-text") : pointText,
          result: getField("arg-result"),
          showResult: isEnabled(getField("arg-result-enabled", "oui")),
          showStepCta: isEnabled(getField("context-step-enabled", "oui")),
          stepCtaText: getField("context-step-text", "Voici les 3 etapes pour y remedier"),
          imageMode: getField("arg-image-mode", "frame") === "full" ? "full" : "frame",
          imageSource: isEnabled(getField("arg-image-source", "non")) ? "ai" : "manual",
          imageUrl: kind === "image" ? getField("image-src") : getField("arg-image"),
          beforeImage: kind === "avis" ? getField("avis-image-1") : getField("before-image"),
          afterImage: kind === "avis" ? getField("avis-image-2") : getField("after-image"),
          backgroundImage1: getField("cta-bg-1"),
          backgroundImage2: getField("cta-bg-2"),
        };
        return encodeCarouselSlide(payload);
      });
    });
    return slides;
  }

  function startCarouselGeneration(template?: LinkedInCarouselTemplate) {
    const selected = template ?? carouselTemplates.find((entry) => entry.id === carouselGenerationTemplateId || entry.id === selectedCarouselTemplateId) ?? carouselTemplates[0];
    if (!carouselDraftName.trim() || !carouselDraftCategory) return;
    setCarouselStudioMode("generate");
    setCarouselStudioTab("editor");
    setPostType("carousel");
    setSelectedStyleId(carouselDraftCategory);
    setManualEditorStarted(true);
    setEditingPostId(null);
    if (selected) {
      setShowCarouselTemplatePicker(false);
      setCarouselGenerationTemplateId(selected.id);
      setSelectedCarouselTemplateId(selected.id);
      const slides = buildCarouselSlidesFromTemplate(selected, carouselGenerationPrompt);
      setGeneratedSlides(slides);
      setActiveSlide(0);
      setCarouselGenerationHistory([{ id: crypto.randomUUID(), label: "Version initiale", slides, createdAt: new Date().toISOString() }]);
    }
  }

  function updateGeneratedCarouselSlide(
    index: number,
    updater: (payload: CarouselSlidePayload) => CarouselSlidePayload
  ) {
    setGeneratedSlides((current) =>
      current.map((slide, slideIndex) => {
        if (slideIndex !== index) return slide;
        const payload = decodeCarouselSlide(slide) ?? { kind: "free" as CarouselSlideKind, label: "Libre", body: "" };
        return encodeCarouselSlide(updater(payload));
      })
    );
  }

  async function importGeneratedCarouselSlideImage(index: number, file?: File | null) {
    if (!file) return;
    const preview = await fileToCompressedPreview(file);
    updateGeneratedCarouselSlide(index, (payload) => ({
      ...payload,
      imageUrl: preview.url,
      beforeImage: payload.kind === "before-after" || payload.kind === "avis" ? payload.beforeImage ?? preview.url : payload.beforeImage,
      afterImage: payload.kind === "before-after" || payload.kind === "avis" ? payload.afterImage ?? preview.url : payload.afterImage,
    }));
  }

  function startCarouselManualEditing(template?: LinkedInCarouselTemplate) {
    const selected = template ?? carouselTemplates.find((entry) => entry.id === carouselGenerationTemplateId || entry.id === selectedCarouselTemplateId) ?? carouselTemplates[0];
    if (!selected || !carouselDraftName.trim() || !carouselDraftCategory) return;
    setCarouselStudioMode("generate");
    setCarouselStudioTab("editor");
    setPostType("carousel");
    setSelectedStyleId(carouselDraftCategory);
    setManualEditorStarted(true);
    setEditingPostId(null);
    setCarouselGenerationTemplateId(selected.id);
    setSelectedCarouselTemplateId(selected.id);
    setGeneratedSlides(buildCarouselSlidesFromTemplate(selected, ""));
    setActiveSlide(0);
    setShowCarouselTemplatePicker(false);
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
      { id: crypto.randomUUID(), role: "assistant", content: `J'ai préparé ${nextSlides.length} slides avec le template "${template.name}".` },
    ]);
    setCarouselGenerationHistory((current) => [
      { id: crypto.randomUUID(), label: prompt.slice(0, 60) || "Modification", slides: nextSlides, createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), label: "Version précédente", slides: before, createdAt: new Date().toISOString() },
      ...current,
    ].slice(0, 20));
    setCarouselGenerationPrompt("");
  }

  async function generatePostFromCurrentCarousel(openPlanner = false) {
    if (generatedSlides.length === 0) return;
    setGenerating(true);
    setGenerationError("");
    const selectedStyle = styles.find((style) => style.id === carouselDraftCategory || style.id === selectedStyleId);
    const currentSettings = settings ?? loadLinkedInSettings();
    const sourceContent = generatedSlides
      .map((slide, index) => {
        const payload = decodeCarouselSlide(slide);
        if (!payload) return `Slide ${index + 1}`;
        return [
          `Slide ${index + 1}`,
          payload.title,
          payload.subtitle,
          payload.body,
          payload.result ? `Resultat: ${payload.result}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    try {
      const res = await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: "manual",
          sourceContent,
          sourceTitle: carouselDraftName.trim() || "Carrousel",
          style: selectedStyle ? { name: selectedStyle.name, prompt: selectedStyle.prompt, category: selectedStyle.category } : undefined,
          styleExamples: [],
          type: "post",
          topPosts,
          language: currentSettings.language,
          openrouterApiKey: currentSettings.openrouterApiKey || undefined,
          model: currentSettings.carouselContentModel || currentSettings.model,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerationError(data.error || "Impossible de generer le contenu.");
        return;
      }
      sessionStorage.setItem(
        "linkedin_post_schedule_prefill",
        JSON.stringify({
          content: data.content ?? "",
          styleId: selectedStyle?.id || undefined,
          format: "document",
          scheduledAt: openPlanner ? getDefaultScheduleInput() : "",
        })
      );
      router.push("/admin/linkedin/posts");
    } catch (error) {
      setGenerationError(String(error));
    } finally {
      setGenerating(false);
    }
  }

  async function downloadCurrentCarousel() {
    if (generatedSlides.length === 0) return;

    setGenerating(true);
    setGenerationError("");

    const offscreen = document.createElement("div");
    offscreen.style.cssText = "position:fixed;top:0;left:0;width:575px;height:690px;opacity:0.001;pointer-events:none;z-index:-1;overflow:hidden;";
    document.body.appendChild(offscreen);

    try {
      await document.fonts.ready;

      const preloadImages = [
        "/linkedin/logo-ruff-agency.png",
        "/linkedin/profile.jpg",
        "/linkedin/swipe-cta.png",
        "/linkedin/check.png",
        "/linkedin/croix.png",
        "/linkedin/bars-left.svg",
        "/linkedin/bars-right.svg",
      ];
      await Promise.all(
        preloadImages.map((src) => new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = src;
        }))
      );

      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [575, 690] });
      const ReactDOM = await import("react-dom/client");

      for (let i = 0; i < generatedSlides.length; i++) {
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "width:575px;height:690px;position:relative;overflow:hidden;";
        offscreen.appendChild(wrapper);

        const payload = decodeCarouselSlide(generatedSlides[i]);
        const root = ReactDOM.default.createRoot(wrapper);
        root.render(<CarouselSlideCanvas payload={payload} raw={generatedSlides[i]} scale={1} />);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const imgs = wrapper.querySelectorAll("img");
        await Promise.all(
          Array.from(imgs).map((img) => new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) { resolve(); return; }
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }))
        );

        const canvas = await html2canvas(wrapper, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#F6F6F6",
          logging: false,
          width: 575,
          height: 690,
        });

        const imgData = canvas.toDataURL("image/png", 1.0);

        if (i > 0) pdf.addPage([575, 690], "portrait");
        pdf.addImage(imgData, "PNG", 0, 0, 575, 690);

        root.unmount();
        wrapper.remove();
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      pdf.save("carousel-linkedin.pdf");
    } catch (error) {
      console.error("Erreur export carousel:", error);
      setGenerationError("Erreur lors de l'export du PDF.");
    } finally {
      offscreen.remove();
      setGenerating(false);
    }
  }

  async function handleDraftMedia(file: File) {
    try {
      const preview = await fileToCompressedPreview(file);
      setDraftMedia({ url: preview.url, kind: preview.kind, fileName: file.name, bytes: preview.bytes });
      setGenerationError("");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Image impossible à télécharger.");
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

  function updateActiveModel(nextModel: string) {
    if (!nextModel) return;
    setSettings((current) => {
      const nextSettings = { ...(current ?? loadLinkedInSettings()), carouselContentModel: nextModel };
      queueRemoteLinkedInSettingsSync(nextSettings);
      void persistRemoteLinkedInSettings(nextSettings);
      return nextSettings;
    });
    setModelPickerOpen(false);
    setModelSearch("");
  }

  function getDefaultScheduleInput() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return isoToLocalInput(tomorrow.toISOString());
  }

  function openScheduleOverlay(post?: LinkedInPost) {
    setScheduleOverlayPostId(post?.id ?? null);
    setScheduleOverlayDate(post?.scheduledAt ? isoToLocalInput(post.scheduledAt) : scheduleDate || getDefaultScheduleInput());
  }

  function closeScheduleOverlay() {
    setScheduleOverlayPostId(null);
    setScheduleOverlayDate("");
  }

  function handleSave(status: "draft" | "scheduled" | "published", scheduledOverride?: string) {
    const content = postType === "carousel" ? generatedSlides.join("\n\n---\n\n") : generatedContent;
    if (!content.trim()) return;
    if (postType === "post" && !selectedPostFormat) {
      setGenerationError("Choisis un format avant de sauvegarder ce post.");
      return;
    }
    setSaving(true);
    const selectedStyle = styles.find(s => s.id === selectedStyleId);
    const existingPost = editingPostId ? posts.find((post) => post.id === editingPostId) : null;
    const nextScheduledInput = scheduledOverride ?? scheduleDate;
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
      scheduledAt: status === "scheduled" && nextScheduledInput ? new Date(nextScheduledInput).toISOString() : undefined,
      publishedAt: status === "published" ? new Date().toISOString() : undefined,
      status,
      tags: selectedStyle ? [selectedStyle.name, selectedStyle.category] : [],
      analytics: normalizeAnalytics({
        ...existingPost?.analytics,
        format: postType === "carousel" ? "carousel" : selectedPostFormat || existingPost?.analytics?.format || "text",
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

  function schedulePost(postId: string, scheduledInput: string) {
    if (!scheduledInput) return;
    const updated = normalizePosts(
      posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              status: "scheduled" as const,
              scheduledAt: new Date(scheduledInput).toISOString(),
            }
          : post
      )
    );
    setPosts(updated);
    saveLinkedInPosts(updated);
    void persistRemoteLinkedInPosts(updated, true);
    setPostsView("scheduled");
  }

  function confirmScheduleOverlay() {
    if (!scheduleOverlayDate) return;
    if (scheduleOverlayPostId) {
      schedulePost(scheduleOverlayPostId, scheduleOverlayDate);
      closeScheduleOverlay();
      return;
    }
    setScheduleDate(scheduleOverlayDate);
    handleSave("scheduled", scheduleOverlayDate);
    closeScheduleOverlay();
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

  const hasGenerated = (postType === "carousel" && generatedSlides.length > 0) || (postType === "post" && generatedContent.trim().length > 0);
  const editorVisible = hasGenerated && !manualEditorStarted && !editingPostId;
  const rightEditorVisible = manualEditorStarted || Boolean(editingPostId);
  const stats = {
    drafts: posts.filter(p => p.status === "draft").length,
    scheduled: posts.filter(p => p.status === "scheduled").length,
  };
  const selectedCarouselTemplate = carouselTemplates.find((template) => template.id === selectedCarouselTemplateId) ?? carouselTemplates[0] ?? null;
  const selectedCarouselTemplateItem = selectedCarouselTemplate?.items.find((item) => item.id === selectedCarouselTemplateItemId) ?? null;
  const selectedTemplateItemPage = selectedCarouselTemplateItem ? resolveCarouselPage(selectedCarouselTemplateItem.pageTemplateId) : null;
  const carouselPickerPages = CAROUSEL_SLIDE_LIBRARY;
  const filteredCarouselPickerPages = carouselPickerPages.filter((page) => page.name.toLowerCase().includes(carouselPageSearch.toLowerCase()));
  const filteredCarouselTemplates = carouselTemplates.filter((template) => template.name.toLowerCase().includes(carouselTemplateSearch.toLowerCase()));
  const selectedCarouselTemplateForPicker = carouselTemplates.find((entry) => entry.id === (carouselGenerationTemplateId || selectedCarouselTemplateId)) ?? null;
  const carouselPosts = posts.filter((post) => post.type === "carousel");
  const carouselHasGeneratedSlides = generatedSlides.length > 0;
  const activeCarouselEditor = carouselStudioTab === "editor";
  const activeGeneratedSlidePayload = decodeCarouselSlide(generatedSlides[activeSlide] ?? "") ?? null;
  const carouselRightRailStyle: CSSProperties = {
    width: 320,
    borderLeft: "1px solid rgba(18,26,46,0.12)",
    background: "#fff",
    boxShadow: "18px 0px 11px rgba(0,0,0,0.01), 8px 0px 8px rgba(0,0,0,0.01), 2px 0px 4px rgba(0,0,0,0.01)",
    padding: "34px 24px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
    overflow: "hidden",
  };
  const carouselPanelShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";
  const carouselSlideShadow = "0px 24px 10px rgba(0,0,0,0.01), 0px 14px 8px rgba(0,0,0,0.03), 0px 6px 6px rgba(0,0,0,0.04), 0px 1px 3px rgba(0,0,0,0.05)";
  const modelOptions = Array.from(new Set([settings?.model, ...OPENROUTER_MODEL_OPTIONS].filter(Boolean) as string[]));
  const filteredModelOptions = modelOptions.filter((model) => model.toLowerCase().includes(modelSearch.toLowerCase()));
  const activeModelLabel = settings?.carouselContentModel || settings?.model || "anthropic/claude-sonnet-4";

  const getCarouselPreviewPayload = (page: LinkedInCarouselPageTemplate | null, item?: LinkedInCarouselTemplate["items"][number] | null, index = 0): CarouselSlidePayload => {
    if (!page) return { kind: "context", label: "Slide", subtitle: "" };
    if (page.id === FREE_CAROUSEL_PAGE_ID) return { kind: "free", label: "Libre", body: "" };
    const kind = getSlideKind(page.id);
    const getField = (fieldId: string, fallback = "") => item ? getCarouselTemplateItemField(item, page, fieldId, fallback) : getTemplateField(page, fieldId, fallback);
    const isArgument = kind === "argument-blue" || kind === "argument-red";
    return {
      kind,
      label: page.name,
      stepNumber: kind === "step" ? index + 1 : undefined,
      pointNumber: isArgument ? index + 1 : undefined,
      title: limitSlideTitle(isArgument ? getField("arg-title") : getField("step-title")),
      subtitle: isArgument ? getField("arg-subtitle") : getField("context-subtitle"),
      body: kind === "why-design" ? getField("why-text") : "",
      result: getField("arg-result"),
      showResult: isEnabled(getField("arg-result-enabled", "oui")),
      showStepCta: isEnabled(getField("context-step-enabled", "oui")),
      stepCtaText: getField("context-step-text", "Voici les 3 etapes pour y remedier"),
      imageMode: getField("arg-image-mode", "frame") === "full" ? "full" : "frame",
      imageSource: isEnabled(getField("arg-image-source", "non")) ? "ai" : "manual",
      imageUrl: kind === "image" ? getField("image-src") : getField("arg-image"),
      beforeImage: kind === "avis" ? getField("avis-image-1") : getField("before-image"),
      afterImage: kind === "avis" ? getField("avis-image-2") : getField("after-image"),
      backgroundImage1: getField("cta-bg-1"),
      backgroundImage2: getField("cta-bg-2"),
      ...(kind === "avis" ? { title: getField("avis-title") } : {}),
    };
  };

  const renderSlideMiniPreview = (payload: CarouselSlidePayload, width: number, height: number, radius = 18) => {
    const scale = Math.min(width / 575, height / 690);
    return (
      <span style={{ position: "relative", width, height, borderRadius: radius, background: "#f6f6f6", border: "4px solid #fff", boxShadow: carouselSlideShadow, overflow: "hidden", display: "block", flexShrink: 0 }}>
        <span style={{ position: "absolute", left: (width - 575 * scale) / 2, top: (height - 690 * scale) / 2, width: 575 * scale, height: 690 * scale }}>
          <CarouselSlideCanvas payload={payload} raw="" scale={scale} />
        </span>
      </span>
    );
  };

  const renderTemplateStackPreview = (template: LinkedInCarouselTemplate) => {
    const items = template.items.slice(0, 3);
    const previewItems = items.length > 0 ? items : [{ id: "fallback", pageTemplateId: CAROUSEL_SLIDE_LIBRARY[0].id, mode: "single" as const }];
    return (
      <span style={{ position: "relative", width: 74, height: 82, flexShrink: 0, display: "inline-block" }}>
        {previewItems.map((item, index) => {
          const page = resolveCarouselPage(item.pageTemplateId);
          const payload = getCarouselPreviewPayload(page, item, index);
          const left = index === 0 ? 0 : index === 1 ? 13 : 26;
          const rotate = index === 0 ? -11 : index === 1 ? 0 : 11;
          return (
            <span key={`${item.id}-${index}`} style={{ position: "absolute", left, top: index === 1 ? 0 : 6, transform: `rotate(${rotate}deg)`, zIndex: index + 1 }}>
              {renderSlideMiniPreview(payload, 48, 62, 7)}
            </span>
          );
        })}
      </span>
    );
  };

  const renderGeneratedCarouselStackPreview = (slides?: string[]) => {
    const previewSlides = (slides && slides.length > 0 ? slides : [""]).slice(0, 4);
    return (
      <span style={{ position: "relative", width: 86, height: 82, flexShrink: 0, display: "inline-block" }}>
        {previewSlides.map((slide, index) => {
          const payload = decodeCarouselSlide(slide) ?? { kind: "free" as CarouselSlideKind, label: "Slide", body: "" };
          const left = index * 13;
          const rotate = [-12, -4, 5, 12][index] ?? 0;
          return (
            <span key={`${index}-${slide.slice(0, 12)}`} style={{ position: "absolute", left, top: index === 1 ? 0 : 6, transform: `rotate(${rotate}deg)`, zIndex: index + 1 }}>
              {renderSlideMiniPreview(payload, 48, 62, 7)}
            </span>
          );
        })}
      </span>
    );
  };

  const renderCarouselTemplateField = (field: LinkedInCarouselPageTemplate["fields"][number]) => {
    if (!selectedCarouselTemplate || !selectedCarouselTemplateItem || !selectedTemplateItemPage) return null;
    const value = getCarouselTemplateItemField(selectedCarouselTemplateItem, selectedTemplateItemPage, field.id);
    const update = (nextValue: string) => updateCarouselTemplateItemField(selectedCarouselTemplate.id, selectedCarouselTemplateItem.id, field.id, nextValue);
    const fieldLabelStyle: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#121a2e", marginBottom: 7 };
    const chipStyle = (active: boolean): CSSProperties => ({
      minHeight: 34,
      borderRadius: 999,
      border: active ? "1px solid rgba(1,71,255,0.32)" : "1px solid rgba(18,26,46,0.1)",
      background: active ? "rgba(1,71,255,0.08)" : "#f6f6f6",
      color: active ? "#0147ff" : "rgba(18,26,46,0.62)",
      fontSize: 12,
      fontWeight: 700,
      padding: "0 13px",
      cursor: "pointer",
      fontFamily: '"Plus Jakarta Sans", sans-serif',
    });

    if (field.id === "context-step-enabled" || field.id === "arg-result-enabled" || field.id === "arg-image-source") {
      return (
        <div key={field.id}>
          <label style={fieldLabelStyle}>{field.label}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => update("oui")} style={chipStyle(isEnabled(value || field.defaultValue))}>Oui</button>
            <button type="button" onClick={() => update("non")} style={chipStyle(!isEnabled(value || field.defaultValue))}>Non</button>
          </div>
        </div>
      );
    }

    if (field.id === "arg-image-mode") {
      const activeValue = value || field.defaultValue || "frame";
      return (
        <div key={field.id}>
          <label style={fieldLabelStyle}>{field.label}</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => update("frame")} style={chipStyle(activeValue !== "full")}>Avec cadre</button>
            <button type="button" onClick={() => update("full")} style={chipStyle(activeValue === "full")}>Plein format</button>
          </div>
        </div>
      );
    }

    if (field.kind === "image") {
      return (
        <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={fieldLabelStyle}>{field.label}</label>
          {value ? (
            <div style={{ position: "relative", marginBottom: 8 }}>
              <img src={value} alt="" style={{ width: "100%", height: 92, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)" }} />
              <button type="button" onClick={() => updateCarouselTemplateItemField(selectedCarouselTemplate.id, selectedCarouselTemplateItem.id, field.id, "")} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 999, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={14} /></button>
            </div>
          ) : (
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 92, borderRadius: 12, border: "2px dashed rgba(18,26,46,0.2)", background: "#f8f8f8", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(1,71,255,0.4)"; e.currentTarget.style.background = "rgba(1,71,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(18,26,46,0.2)"; e.currentTarget.style.background = "#f8f8f8"; }}>
              <Upload size={24} style={{ color: "rgba(18,26,46,0.4)" }} />
              <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", fontWeight: 500 }}>Cliquer ou glisser une image</span>
              <input type="file" accept="image/*,application/pdf" onChange={(event) => importCarouselTemplateItemImage(selectedCarouselTemplate.id, selectedCarouselTemplateItem.id, field.id, event.target.files?.[0])} style={{ display: "none" }} />
            </label>
          )}
        </div>
      );
    }

    const multiline = field.id.includes("subtitle") || field.id.includes("result") || field.id === "why-text" || field.id === "context-subtitle";
    return (
      <div key={field.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={fieldLabelStyle}>{field.label}</label>
        {multiline ? (
          <textarea rows={field.id === "context-subtitle" ? 6 : 3} value={value} onChange={(event) => update(event.target.value)} style={{ ...inp, background: "#f2f2f2", borderRadius: 12, resize: "vertical", lineHeight: 1.45 }} />
        ) : (
          <input value={value} maxLength={field.id === "arg-title" ? 22 : undefined} onChange={(event) => update(event.target.value)} style={{ ...inp, minHeight: 54, background: "#f2f2f2", borderRadius: 12 }} />
        )}
        {field.id === "arg-title" ? <span style={{ fontSize: 11, color: value.length > 22 ? "#ef0c0c" : "rgba(18,26,46,0.45)" }}>{Math.min(value.length, 22)}/22 caracteres</span> : null}
      </div>
    );
  };

  const renderGeneratedCarouselSlideFields = () => {
    if (!activeGeneratedSlidePayload) return null;

    const payload = activeGeneratedSlidePayload;
    const labelStyle: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#121a2e", marginBottom: 7 };
    const inputStyle: CSSProperties = { ...inp, minHeight: 46, background: "#f2f2f2", borderRadius: 12 };
    const chipStyle = (active: boolean): CSSProperties => ({
      minHeight: 34,
      borderRadius: 999,
      border: active ? "1px solid rgba(1,71,255,0.32)" : "1px solid rgba(18,26,46,0.1)",
      background: active ? "rgba(1,71,255,0.08)" : "#f6f6f6",
      color: active ? "#0147ff" : "rgba(18,26,46,0.62)",
      fontSize: 12,
      fontWeight: 700,
      padding: "0 13px",
      cursor: "pointer",
      fontFamily: '"Plus Jakarta Sans", sans-serif',
    });

    const update = (patch: Partial<CarouselSlidePayload>) =>
      updateGeneratedCarouselSlide(activeSlide, (current) => ({ ...current, ...patch }));

    if (payload.kind === "cta") {
      return (
        <div style={{ minHeight: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "rgba(18,26,46,0.46)", textAlign: "center", padding: 24 }}>
          <LayoutTemplate size={26} />
          <strong style={{ fontSize: 14, lineHeight: "20px", fontWeight: 600, color: "#121a2e" }}>Aucun champ a remplir ici</strong>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
        {(payload.kind === "context" || payload.kind === "argument-blue" || payload.kind === "argument-red" || payload.kind === "step" || payload.kind === "avis") && (
          <div>
            <label style={labelStyle}>Titre</label>
            <input
              value={payload.title ?? ""}
              onChange={(event) => update({ title: payload.kind === "argument-blue" || payload.kind === "argument-red" ? limitSlideTitle(event.target.value) : event.target.value })}
              style={inputStyle}
            />
          </div>
        )}

        {(payload.kind === "context" || payload.kind === "argument-blue" || payload.kind === "argument-red") && (
          <div>
            <label style={labelStyle}>Texte</label>
            <textarea
              rows={payload.kind === "context" ? 6 : 4}
              value={payload.subtitle ?? ""}
              onChange={(event) => update({ subtitle: event.target.value })}
              style={{ ...inp, background: "#f2f2f2", borderRadius: 12, resize: "vertical", lineHeight: 1.45 }}
            />
          </div>
        )}

        {payload.kind === "context" && (
          <>
            <div>
              <label style={labelStyle}>Afficher le bouton etape</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => update({ showStepCta: true })} style={chipStyle(payload.showStepCta !== false)}>Oui</button>
                <button type="button" onClick={() => update({ showStepCta: false })} style={chipStyle(payload.showStepCta === false)}>Non</button>
              </div>
            </div>
            {payload.showStepCta !== false && (
              <div>
                <label style={labelStyle}>Texte du bouton</label>
                <input value={payload.stepCtaText ?? ""} onChange={(event) => update({ stepCtaText: event.target.value })} style={inputStyle} />
              </div>
            )}
          </>
        )}

        {payload.kind === "step" && (
          <div>
            <label style={labelStyle}>Texte de l'etape</label>
            <input value={payload.title ?? ""} onChange={(event) => update({ title: event.target.value })} style={inputStyle} />
          </div>
        )}

        {payload.kind === "why-design" && (
          <div>
            <label style={labelStyle}>Texte</label>
            <textarea rows={4} value={payload.body ?? ""} onChange={(event) => update({ body: event.target.value })} style={{ ...inp, background: "#f2f2f2", borderRadius: 12, resize: "vertical", lineHeight: 1.45 }} />
          </div>
        )}

        {(payload.kind === "argument-blue" || payload.kind === "argument-red") && (
          <>
            <div>
              <label style={labelStyle}>Afficher resultat</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => update({ showResult: true })} style={chipStyle(payload.showResult !== false)}>Oui</button>
                <button type="button" onClick={() => update({ showResult: false })} style={chipStyle(payload.showResult === false)}>Non</button>
              </div>
            </div>
            {payload.showResult !== false && (
              <div>
                <label style={labelStyle}>Texte resultat</label>
                <input value={payload.result ?? ""} onChange={(event) => update({ result: event.target.value })} style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Afficher {payload.kind === "argument-red" ? "croix" : "check"}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => update({ showCheck: true })} style={chipStyle(payload.showCheck !== false)}>Oui</button>
                <button type="button" onClick={() => update({ showCheck: false })} style={chipStyle(payload.showCheck === false)}>Non</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Image</label>
              {payload.imageUrl ? (
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <img src={payload.imageUrl} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: "#fff" }} />
                  <button type="button" onClick={() => update({ imageUrl: undefined })} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 999, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={14} /></button>
                </div>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 120, borderRadius: 12, border: "2px dashed rgba(18,26,46,0.2)", background: "#f8f8f8", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(1,71,255,0.4)"; e.currentTarget.style.background = "rgba(1,71,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(18,26,46,0.2)"; e.currentTarget.style.background = "#f8f8f8"; }}>
                  <Upload size={24} style={{ color: "rgba(18,26,46,0.4)" }} />
                  <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", fontWeight: 500 }}>Cliquer ou glisser une image</span>
                  <input type="file" accept="image/*,application/pdf" onChange={(event) => importGeneratedCarouselSlideImage(activeSlide, event.target.files?.[0])} style={{ display: "none" }} />
                </label>
              )}
            </div>
            <div>
              <label style={labelStyle}>Mode image</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => update({ imageMode: "frame" })} style={chipStyle(payload.imageMode !== "full")}>Avec cadre</button>
                <button type="button" onClick={() => update({ imageMode: "full" })} style={chipStyle(payload.imageMode === "full")}>Plein format</button>
              </div>
            </div>
          </>
        )}

        {(payload.kind === "before-after" || payload.kind === "avis") && (
          <>
            <div>
              <label style={labelStyle}>{payload.kind === "avis" ? "Image 1" : "Image avant"}</label>
              {payload.beforeImage ? (
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <img src={payload.beforeImage} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)" }} />
                  <button type="button" onClick={() => update({ beforeImage: undefined })} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 999, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={14} /></button>
                </div>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 120, borderRadius: 12, border: "2px dashed rgba(18,26,46,0.2)", background: "#f8f8f8", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(1,71,255,0.4)"; e.currentTarget.style.background = "rgba(1,71,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(18,26,46,0.2)"; e.currentTarget.style.background = "#f8f8f8"; }}>
                  <Upload size={24} style={{ color: "rgba(18,26,46,0.4)" }} />
                  <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", fontWeight: 500 }}>Cliquer ou glisser une image</span>
                  <input type="file" accept="image/*,application/pdf" onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const preview = await fileToCompressedPreview(file);
                    update({ beforeImage: preview.url });
                  }} style={{ display: "none" }} />
                </label>
              )}
            </div>
            <div>
              <label style={labelStyle}>{payload.kind === "avis" ? "Image 2" : "Image apres"}</label>
              {payload.afterImage ? (
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <img src={payload.afterImage} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)" }} />
                  <button type="button" onClick={() => update({ afterImage: undefined })} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 999, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={14} /></button>
                </div>
              ) : (
                <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 120, borderRadius: 12, border: "2px dashed rgba(18,26,46,0.2)", background: "#f8f8f8", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(1,71,255,0.4)"; e.currentTarget.style.background = "rgba(1,71,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(18,26,46,0.2)"; e.currentTarget.style.background = "#f8f8f8"; }}>
                  <Upload size={24} style={{ color: "rgba(18,26,46,0.4)" }} />
                  <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", fontWeight: 500 }}>Cliquer ou glisser une image</span>
                  <input type="file" accept="image/*,application/pdf" onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const preview = await fileToCompressedPreview(file);
                    update({ afterImage: preview.url });
                  }} style={{ display: "none" }} />
                </label>
              )}
            </div>
          </>
        )}

        {payload.kind === "image" && (
          <div>
            <label style={labelStyle}>Image</label>
            {payload.imageUrl ? (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <img src={payload.imageUrl} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)" }} />
                <button type="button" onClick={() => update({ imageUrl: undefined })} style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 999, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", display: "grid", placeItems: "center" }}><X size={14} /></button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, height: 160, borderRadius: 12, border: "2px dashed rgba(18,26,46,0.2)", background: "#f8f8f8", cursor: "pointer", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(1,71,255,0.4)"; e.currentTarget.style.background = "rgba(1,71,255,0.04)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(18,26,46,0.2)"; e.currentTarget.style.background = "#f8f8f8"; }}>
                <Upload size={24} style={{ color: "rgba(18,26,46,0.4)" }} />
                <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", fontWeight: 500 }}>Cliquer ou glisser une image</span>
                <input type="file" accept="image/*,application/pdf" onChange={(event) => importGeneratedCarouselSlideImage(activeSlide, event.target.files?.[0])} style={{ display: "none" }} />
              </label>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCarouselTabs = () => (
    <div style={{ display: "inline-flex", alignItems: "center", padding: 4, borderRadius: 33, background: "#f0f0f0" }}>
      {([
        { id: "editor", label: "Editeur" },
        { id: "templates", label: "Template" },
      ] as { id: CarouselStudioTab; label: string }[]).map((tab) => {
        const active = carouselStudioTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setCarouselStudioTab(tab.id);
              setCarouselStudioMode("builder");
              if (tab.id === "editor") {
                setSelectedCarouselTemplateItemId("");
              }
            }}
            style={{
              minHeight: 36,
              padding: "8px 16px",
              borderRadius: 46,
              border: active ? "1px solid rgba(0,0,0,0.12)" : "1px solid transparent",
              background: active ? "#fff" : "transparent",
              color: active ? "#121a2e" : "rgba(18,26,46,0.5)",
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: "-0.3px",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              boxShadow: active ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  const PageThumb = ({ size = 64, stacked = false }: { size?: number; stacked?: boolean }) => (
    <span style={{ position: "relative", width: stacked ? size * 1.16 : size, height: size * 1.22, display: "inline-block", flexShrink: 0 }}>
      {stacked && <span style={{ position: "absolute", width: size * 0.72, height: size * 0.98, left: 0, top: size * 0.14, borderRadius: 12, background: "#ccc", border: "3px solid #fff", transform: "rotate(-15deg)", boxShadow: carouselSlideShadow }} />}
      {stacked && <span style={{ position: "absolute", width: size * 0.72, height: size * 0.98, right: 0, top: size * 0.14, borderRadius: 12, background: "#ccc", border: "3px solid #fff", transform: "rotate(15deg)", boxShadow: carouselSlideShadow }} />}
      <span style={{ position: "absolute", width: stacked ? size * 0.86 : size, height: stacked ? size * 1.14 : size * 1.16, left: stacked ? size * 0.15 : 0, top: 0, borderRadius: 14, background: "#ccc", border: "3px solid #fff", boxShadow: carouselSlideShadow, transform: stacked ? "none" : "rotate(-1.83deg)" }} />
    </span>
  );

  const renderRightList = () => {
    const showHistoryPanel = carouselStudioTab === "editor" && carouselStudioMode === "generate" && carouselHasGeneratedSlides;
    const rightRailTitle = carouselStudioTab === "templates" ? "Toutes les templates" : showHistoryPanel ? "Récents" : "Tous les carrousels faits";
    return (
      <aside style={carouselRightRailStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h3 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: showHistoryPanel ? 20 : 18, lineHeight: "22px", letterSpacing: "-0.3px", color: "#121a2e", fontWeight: 600 }}>
            {rightRailTitle}
          </h3>
          {showHistoryPanel && (
            <button type="button" onClick={() => setShowCarouselHistory((value) => !value)} style={{ width: 38, height: 38, borderRadius: 999, border: showCarouselHistory ? "1px solid #121a2e" : "1px solid rgba(0,0,0,0.07)", background: showCarouselHistory ? "#121a2e" : "#fff", color: showCarouselHistory ? "#fff" : "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <History size={16} />
            </button>
          )}
        </div>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", flex: 1, overflowY: "auto", overflowX: "hidden", paddingRight: 2 }}>
          {showHistoryPanel ? (
            showCarouselHistory ? (
              carouselGenerationHistory.length === 0 ? <p style={{ margin: "24px 0 0", fontSize: 14, color: "rgba(18,26,46,0.5)" }}>Aucune version enregistrée.</p> : carouselGenerationHistory.map((entry) => (
                <button key={entry.id} type="button" onClick={() => { setGeneratedSlides(entry.slides); setActiveSlide(0); }} style={{ width: "100%", border: 0, borderBottom: "1px solid rgba(0,0,0,0.08)", background: "#fff", padding: "22px 0", textAlign: "left", cursor: "pointer" }}>
                  <strong style={{ display: "block", fontSize: 14, color: "#121a2e", fontWeight: 600 }}>{entry.label}</strong>
                  <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "rgba(18,26,46,0.7)" }}>{entry.slides.length} slides</span>
                </button>
              ))
            ) : (
              <div style={{ paddingTop: 38, display: "flex", flexDirection: "column", gap: 24 }}>
                {carouselGenerationChat.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.5)", lineHeight: 1.55 }}>Les demandes récentes et réponses IA apparaîtront ici.</p> : carouselGenerationChat.map((message) => (
                  <div key={message.id} style={{ display: "flex", flexDirection: "column", alignItems: message.role === "user" ? "flex-end" : "flex-start", gap: 12 }}>
                    <span style={{ maxWidth: 168, borderRadius: 12, background: message.role === "user" ? "#f4f4f4" : "transparent", padding: message.role === "user" ? "10px 12px" : 0, color: "rgba(0,0,0,0.7)", fontSize: 12, lineHeight: "20px", letterSpacing: "-0.2px" }}>{message.content}</span>
                  </div>
                ))}
              </div>
            )
          ) : carouselStudioTab === "templates" ? (
            <>
              {carouselTemplates.map((template) => {
                const isSelected = template.id === selectedCarouselTemplateId;
                return (
                  <button key={template.id} type="button" onClick={() => { setSelectedCarouselTemplateId(template.id); setSelectedCarouselTemplateItemId(""); }} style={{ width: "100%", minHeight: 96, border: 0, borderBottom: "1px solid rgba(0,0,0,0.1)", background: isSelected ? "rgba(0,0,0,0.03)" : "#fff", borderRadius: 8, display: "flex", alignItems: "center", gap: 12, padding: "18px 4px", textAlign: "left", cursor: "pointer", overflow: "visible" }}>
                    {renderTemplateStackPreview(template)}
                    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <strong style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 13, lineHeight: "18px", fontWeight: 600, color: "#121a2e", maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{template.name}</strong>
                      <span style={{ fontSize: 12, lineHeight: "18px", color: "rgba(18,26,46,0.7)", fontWeight: 500 }}>Il y a 2 minutes</span>
                    </span>
                  </button>
                );
              })}
              <div style={{ paddingTop: 20 }}><ClientBlueButton type="button" onClick={createCarouselTemplate} icon={<Plus size={14} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%", fontSize: 12 }}>Nouvelle Template</ClientBlueButton></div>
            </>
          ) : null}
        </div>
      </aside>
    );
  };

  const renderTemplateMode = () => (
    <main onClick={() => setSelectedCarouselTemplateItemId("")} style={{ position: "relative", flex: 1, minWidth: 0, background: "#fbfbfb", overflowX: "hidden", overflowY: "auto", padding: "40px 40px 56px 46px" }}>
      <div style={{ marginBottom: 22, display: "flex", flexDirection: "column", gap: 6 }}>
        <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 22, lineHeight: "28px", fontWeight: 700, color: "#121a2e" }}>Creer votre template</h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: "rgba(18,26,46,0.56)", fontFamily: '"Inter", sans-serif' }}>Selectionne une page pour regler ses prompts et ses champs.</p>
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", overflow: "visible", paddingBottom: 8 }}>
        {(selectedCarouselTemplate?.items.length ? selectedCarouselTemplate.items : []).slice(0, 10).map((item, index) => {
          const page = resolveCarouselPage(item.pageTemplateId);
          const previewPayload = getCarouselPreviewPayload(page, item, index);
          const selected = selectedCarouselTemplateItemId === item.id;
          const selectedShadow = "0px 20px 12px rgba(1,71,255,0.02), 0px 9px 9px rgba(1,71,255,0.03), 0px 2px 5px rgba(1,71,255,0.03)";
          return (
            <button
              key={item.id}
              type="button"
              draggable
              onClick={(event) => { event.stopPropagation(); setSelectedCarouselTemplateItemId(item.id); }}
              onDragStart={(event) => {
                setDraggedCarouselItemId(item.id);
                event.dataTransfer.effectAllowed = "move";
                const ghost = document.createElement("div");
                ghost.style.width = "1px";
                ghost.style.height = "1px";
                ghost.style.opacity = "0";
                document.body.appendChild(ghost);
                event.dataTransfer.setDragImage(ghost, 0, 0);
                window.setTimeout(() => ghost.remove(), 0);
              }}
              onDragEnd={() => setDraggedCarouselItemId("")}
              onDragOver={(event) => { event.preventDefault(); if (selectedCarouselTemplate) reorderCarouselTemplateItem(selectedCarouselTemplate.id, draggedCarouselItemId, item.id); }}
              style={{ position: "relative", width: 210, minHeight: 268, borderRadius: 24, border: selected ? "1px solid rgba(1,71,255,0.42)" : "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: selected ? selectedShadow : carouselPanelShadow, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 28, cursor: draggedCarouselItemId === item.id ? "grabbing" : "grab", overflow: "visible", zIndex: draggedCarouselItemId === item.id ? 10 : 1, transform: draggedCarouselItemId === item.id ? "translateY(-8px) rotate(-2deg) scale(1.03)" : "none", transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease", userSelect: "none", WebkitUserSelect: "none" }}
            >
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => { event.stopPropagation(); if (selectedCarouselTemplate) removePageFromCarouselTemplate(selectedCarouselTemplate.id, item.id); }}
                onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && selectedCarouselTemplate) removePageFromCarouselTemplate(selectedCarouselTemplate.id, item.id); }}
                style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(18,26,46,0.04)", background: "#fff", color: "rgba(18,26,46,0.72)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px rgba(18,26,46,0.08)", cursor: "pointer", zIndex: 3 }}
                aria-label="Supprimer la page"
              >
                <Trash2 size={13} />
              </span>
              {renderSlideMiniPreview(previewPayload, 132, 174, 18)}
              <strong style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, lineHeight: "21px", fontWeight: 600, color: "#121a2e", maxWidth: 150, minHeight: 42, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textAlign: "center" }}>{getCarouselTemplateItemLabel(item, page, index)}</strong>
            </button>
          );
        })}
        <button type="button" onClick={(event) => { event.stopPropagation(); setShowCarouselPagePicker(true); }} style={{ width: "fit-content", minWidth: 210, minHeight: 268, borderRadius: 24, border: "1px dashed rgba(18,26,46,0.18)", background: "#f3f3f3", color: "#121a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, lineHeight: "20px", fontWeight: 600, cursor: "pointer", padding: "28px 24px", textAlign: "center", alignSelf: "stretch" }}>
          <Plus size={20} /> Ajouter une page
        </button>
      </div>
    </main>
  );

  const renderEditorBeforeClick = () => (
    <main style={{ position: "relative", flex: 1, minWidth: 0, background: "#fbfbfb", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 46, top: 92, right: 40, display: "flex", flexDirection: "column", gap: 6 }}>
        <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 22, lineHeight: "28px", fontWeight: 700, color: "#121a2e" }}>Selectionner un carrousel</h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: "rgba(18,26,46,0.56)", fontFamily: '"Inter", sans-serif' }}>Ouvre un carrousel existant ou cree-en un nouveau.</p>
      </div>
      <div style={{ position: "absolute", left: 46, top: 138, right: 40, display: "flex", gap: 24, flexWrap: "wrap", overflow: "visible" }}>
        {carouselPosts.slice(0, 8).map((post) => {
          const slides = post.slides?.length ? post.slides : [post.content];
          return (
            <button key={post.id} type="button" onClick={() => { setGeneratedSlides(slides); setActiveSlide(0); setCarouselStudioMode("generate"); setCarouselStudioTab("editor"); setEditingPostId(post.id); setPostType("carousel"); setManualEditorStarted(true); setCarouselDraftName(post.sourceTitle ?? ""); setCarouselDraftCategory(post.styleId ?? ""); setModelPickerOpen(false); }} style={{ position: "relative", width: 280, minHeight: 292, borderRadius: 24, border: "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: carouselPanelShadow, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 28, cursor: "pointer", overflow: "visible" }}>
              <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); deletePost(post.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); deletePost(post.id); } }} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(18,26,46,0.04)", background: "#fff", color: "rgba(18,26,46,0.72)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px rgba(18,26,46,0.08)", cursor: "pointer", zIndex: 3 }}>
                <Trash2 size={13} />
              </span>
              {renderGeneratedCarouselStackPreview(slides)}
              <strong style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, lineHeight: "21px", fontWeight: 600, color: "#121a2e", maxWidth: 180, minHeight: 42, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textAlign: "center" }}>{post.sourceTitle || (post.content ? `${post.content.slice(0, 36)}${post.content.length > 36 ? "..." : ""}` : "Carrousel")}</strong>
            </button>
          );
        })}
        <button type="button" onClick={() => { setCarouselDraftName(""); setCarouselDraftCategory(""); setShowCarouselTemplatePicker(true); }} style={{ width: 280, minHeight: 292, borderRadius: 24, border: "1px dashed rgba(18,26,46,0.18)", background: "#f3f3f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 28, cursor: "pointer", color: "#121a2e", textAlign: "center" }}>
          <Plus size={20} />
          <strong style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, lineHeight: "21px", fontWeight: 600, color: "#121a2e" }}>Creer un carrousel</strong>
        </button>
      </div>
    </main>
  );

  const scrollEditorToSlide = (index: number) => {
    const nextIndex = Math.max(0, Math.min(generatedSlides.length - 1, index));
    editorCarouselRef.current?.scrollTo({ left: nextIndex * 458, behavior: "smooth" });
    setActiveSlide(nextIndex);
  };

  const handleEditorCarouselScroll = () => {
    const container = editorCarouselRef.current;
    if (!container) return;
    const nextIndex = Math.max(0, Math.min(generatedSlides.length - 1, Math.round(container.scrollLeft / 458)));
    if (nextIndex !== activeSlide) setActiveSlide(nextIndex);
  };

  const renderEditorMode = () => (
    <main data-carousel-editor style={{ position: "relative", flex: 1, minWidth: 0, background: "#fbfbfb", overflow: "hidden" }}>
      <button type="button" onClick={() => { setCarouselStudioMode("builder"); setCarouselStudioTab("editor"); setModelPickerOpen(false); setCarouselGenerationPrompt(""); setSelectedCarouselTemplateItemId(""); }} style={{ position: "absolute", top: 24, right: 24, zIndex: 8, minHeight: 38, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", cursor: "pointer", padding: "0 14px", color: "#121a2e", fontSize: 13, fontWeight: 700, fontFamily: '"Plus Jakarta Sans", sans-serif', boxShadow: "0 8px 20px rgba(18,26,46,0.08)" }} aria-label="Revenir aux carrousels">
        <ArrowLeft size={15} />
        Revenir aux carrousels
      </button>
      <div
        ref={editorCarouselRef}
        className="carousel-editor-strip"
        onScroll={handleEditorCarouselScroll}
        onPointerDown={(event) => {
          const container = editorCarouselRef.current;
          if (!container) return;
          editorDragRef.current = { active: true, startX: event.clientX, startScrollLeft: container.scrollLeft };
          container.setPointerCapture(event.pointerId);
          container.style.cursor = "grabbing";
        }}
        onPointerMove={(event) => {
          const container = editorCarouselRef.current;
          if (!container || !editorDragRef.current.active) return;
          container.scrollLeft = editorDragRef.current.startScrollLeft - (event.clientX - editorDragRef.current.startX);
        }}
        onWheel={(event) => {
          const container = editorCarouselRef.current;
          if (!container) return;
          const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
          if (delta === 0) return;
          event.preventDefault();
          container.scrollLeft += delta;
        }}
        onPointerUp={(event) => {
          const container = editorCarouselRef.current;
          if (!container) return;
          editorDragRef.current.active = false;
          container.releasePointerCapture(event.pointerId);
          container.style.cursor = "grab";
          scrollEditorToSlide(Math.round(container.scrollLeft / 458));
        }}
        onPointerLeave={() => {
          const container = editorCarouselRef.current;
          if (!container) return;
          editorDragRef.current.active = false;
          container.style.cursor = "grab";
        }}
        style={{ position: "absolute", left: 0, right: 0, top: 84, height: 640, display: "flex", alignItems: "center", gap: 28, overflowX: "auto", overflowY: "hidden", padding: "0 max(32px, calc(50% - 215px))", scrollSnapType: "x proximity", scrollbarWidth: "none", cursor: "grab", userSelect: "none", WebkitUserSelect: "none", scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
      >
        {generatedSlides.map((slide, index) => (
          <button key={`${index}-${slide.slice(0, 24)}`} data-carousel-slide type="button" onClick={() => scrollEditorToSlide(index)} style={{ width: 430, height: 516, borderRadius: 34, background: "#fff", border: "7px solid #fff", boxShadow: carouselSlideShadow, padding: 0, flex: "0 0 430px", overflow: "hidden", scrollSnapAlign: "center", cursor: "grab", transition: "box-shadow 0.2s ease", userSelect: "none", WebkitUserSelect: "none" }}>
            <CarouselSlideCanvas payload={decodeCarouselSlide(slide)} raw={slide} scale={430 / 575} />
          </button>
        ))}
      </div>
      {generatedSlides.length > 1 ? (
        <div style={{ position: "absolute", left: "50%", bottom: 143, transform: "translateX(-50%)", display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "14px 18px", minWidth: 70, height: 44, borderRadius: 122, background: "#3f3f3f", boxShadow: "0px 21px 8px rgba(0,0,0,0.01), 0px 12px 7px rgba(0,0,0,0.05), 0px 5px 5px rgba(0,0,0,0.09), 0px 1px 3px rgba(0,0,0,0.1)" }}>
          {generatedSlides.map((_, index) => <button key={index} type="button" onClick={() => scrollEditorToSlide(index)} style={{ width: 12, height: 12, padding: 0, border: 0, borderRadius: 999, background: activeSlide === index ? "#fff" : "rgba(255,255,255,0.19)", cursor: "pointer" }} />)}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 46, right: 46, bottom: 45, height: 66, borderRadius: 62, border: "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: carouselPanelShadow, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <button type="button" title="Ajouter une page" onClick={() => { if (selectedCarouselTemplate) setShowCarouselPagePicker(true); }} style={{ width: 40, height: 40, borderRadius: 34, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: selectedCarouselTemplate ? "pointer" : "default" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#F6F6F6"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}><Plus size={18} /></button>
          <input value={carouselGenerationPrompt} onChange={(event) => setCarouselGenerationPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") runCarouselGenerationChat(); }} placeholder="Taper un texte ici" style={{ flex: 1, border: 0, outline: "none", color: "rgba(18,26,46,0.7)", fontSize: 16, fontWeight: 500, lineHeight: "20px", letterSpacing: "-0.2px", fontFamily: "Inter, sans-serif" }} />
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
          <button type="button" onClick={() => setModelPickerOpen((current) => !current)} style={{ border: 0, background: "transparent", padding: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "rgba(18,26,46,0.7)", fontSize: 14, fontWeight: 500, lineHeight: "18px", fontFamily: "Inter, sans-serif" }}>
            <span>{activeModelLabel}</span>
            <ChevronDown size={14} style={{ color: "rgba(18,26,46,0.52)" }} />
          </button>
          <button type="button" onClick={runCarouselGenerationChat} style={{ width: 46, height: 46, borderRadius: 34, background: "#121a2e", color: "#fff", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={18} /></button>
          {modelPickerOpen ? (
            <div style={{ position: "absolute", right: 58, bottom: 56, width: 300, borderRadius: 18, border: "1px solid rgba(18,26,46,0.12)", background: "rgba(255,255,255,0.96)", boxShadow: carouselPanelShadow, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", padding: "0 12px" }}>
                <Search size={14} style={{ color: "#6f7887" }} />
                        <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Rechercher un modèle..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#121a2e" }} autoFocus />
              </div>
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredModelOptions.map((model) => (
                  <button key={model} type="button" onClick={() => updateActiveModel(model)} style={{ width: "100%", border: 0, borderRadius: 10, background: model === activeModelLabel ? "rgba(0,0,0,0.04)" : "transparent", padding: "10px 11px", textAlign: "left", fontSize: 13, fontWeight: 500, color: "#121a2e", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                    {model}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );

  const carouselStudioView = (
    <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", background: "#fbfbfb" }}>
      {activeCarouselEditor && (carouselHasGeneratedSlides && carouselStudioMode === "generate" ? renderEditorMode() : renderEditorBeforeClick())}
      {carouselStudioTab === "templates" && renderTemplateMode()}
      {carouselStudioTab === "templates" || (activeCarouselEditor && carouselHasGeneratedSlides) ? renderRightList() : null}
      {showCarouselPagePicker && selectedCarouselTemplate && (
        <div onClick={() => setShowCarouselPagePicker(false)} style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(255,255,255,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: 560, maxHeight: "82vh", overflow: "hidden", borderRadius: 22, background: "#fff", border: "1px solid rgba(18,26,46,0.1)", boxShadow: "0 28px 70px rgba(18,26,46,0.18)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 16, borderBottom: "1px solid rgba(18,26,46,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
              <Search size={16} />
              <input value={carouselPageSearch} onChange={(event) => setCarouselPageSearch(event.target.value)} placeholder="Rechercher une page..." style={{ flex: 1, border: 0, outline: "none", fontSize: 14 }} />
              <button type="button" onClick={() => setShowCarouselPagePicker(false)} style={{ border: 0, background: "transparent", cursor: "pointer", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 18, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
              {filteredCarouselPickerPages.map((page) => {
                const previewPayload = getCarouselPreviewPayload(page, null, 0);
                return (
                <button key={page.id} type="button" onClick={() => addPageToCarouselTemplate(selectedCarouselTemplate.id, page.id)} style={{ border: "1px solid rgba(18,26,46,0.08)", borderRadius: 18, background: page.id === FREE_CAROUSEL_PAGE_ID ? "#fbfbfb" : "#fff", padding: 13, minHeight: 198, height: "fit-content", textAlign: "left", cursor: "pointer" }}>
                  <span style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                    {renderSlideMiniPreview(previewPayload, 116, 140, 14)}
                  </span>
                  <strong style={{ display: "block", fontSize: 13 }}>{page.name}</strong>
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showCarouselTemplatePicker && (
        <div onClick={() => setShowCarouselTemplatePicker(false)} style={{ position: "absolute", inset: 0, zIndex: 31, background: "rgba(255,255,255,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "fit-content", maxWidth: "min(96vw, 1120px)", maxHeight: "84vh", overflow: "hidden", borderRadius: 22, background: "#fff", border: "1px solid rgba(18,26,46,0.1)", boxShadow: "0 28px 70px rgba(18,26,46,0.18)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 16, borderBottom: "1px solid rgba(18,26,46,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
              <Search size={16} />
              <input value={carouselTemplateSearch} onChange={(event) => setCarouselTemplateSearch(event.target.value)} placeholder="Rechercher une template..." style={{ flex: 1, border: 0, outline: "none", fontSize: 14 }} />
              <button type="button" onClick={() => setShowCarouselTemplatePicker(false)} style={{ border: 0, background: "transparent", cursor: "pointer", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 320px))", justifyContent: "center", gap: 18, alignItems: "start" }}>
              {filteredCarouselTemplates.map((template) => (
                <button key={template.id} type="button" onClick={() => { setSelectedCarouselTemplateId(template.id); setCarouselGenerationTemplateId(template.id); }} style={{ width: 320, border: template.id === (carouselGenerationTemplateId || selectedCarouselTemplateId) ? "1px solid rgba(1,71,255,0.28)" : "1px solid rgba(18,26,46,0.08)", borderRadius: 18, background: "#fff", padding: 16, textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "flex", justifyContent: "center" }}>
                    {renderTemplateStackPreview(template)}
                  </span>
                  <strong style={{ display: "block", fontSize: 13, lineHeight: "18px", color: "#121a2e", textAlign: "center" }}>{template.name}</strong>
                </button>
              ))}
            </div>
            <div style={{ padding: 20, borderTop: "1px solid rgba(18,26,46,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
              <input value={carouselDraftName} onChange={(event) => setCarouselDraftName(event.target.value)} placeholder="Nom du carrousel" style={{ ...inp, minHeight: 44, background: "#f2f2f2", borderRadius: 12 }} />
              <select
                value={carouselDraftCategory}
                onChange={(event) => {
                  setCarouselDraftCategory(event.target.value);
                }}
                style={{ ...inp, minHeight: 44, background: "#f2f2f2", borderRadius: 12 }}
              >
                <option value="">Choisir une categorie</option>
                {styles.map((style) => (
                  <option key={style.id} value={style.id}>
                    {style.name}
                  </option>
                ))}
              </select>
              {selectedCarouselTemplateForPicker ? (
                <>
                  <ClientBlueButton type="button" onClick={() => startCarouselGeneration(selectedCarouselTemplateForPicker)} wrapperStyle={{ width: "100%" }} style={{ width: "100%" }} disabled={!carouselDraftName.trim() || !carouselDraftCategory}>
                    Generer avec l'IA
                  </ClientBlueButton>
                  <button type="button" onClick={() => startCarouselManualEditing(selectedCarouselTemplateForPicker)} disabled={!carouselDraftName.trim() || !carouselDraftCategory} style={{ width: "100%", minHeight: 44, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    Demarrer manuellement
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
  const showCarouselEditorSidebar = postsMode === "carousel" && activeCarouselEditor && carouselHasGeneratedSlides;
  const showCarouselBuilderSidebar = postsMode === "carousel" && !showCarouselEditorSidebar;
  const showCarouselGeneratedSidebar = postsMode === "carousel" && activeCarouselEditor && carouselHasGeneratedSlides;
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", ...jk }}>
      {/* Left: Create panel */}
      <div style={{ width: 384, borderRight: "1px solid rgba(0,0,0,0.09)", background: "#fff", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>
            {showCarouselBuilderSidebar
              ? "Paramètres de template"
              : "Créer un post"}
          </h2>

          {postsMode === "carousel" ? (
            <div style={{ marginTop: 12 }}>
              {renderCarouselTabs()}
            </div>
          ) : null}

          {/* Source tabs */}
          {!isCarouselRoute && !rightEditorVisible && !showCarouselBuilderSidebar && <div style={{ display: "flex", gap: 2, marginTop: 12, background: "#f2f2f2", borderRadius: 9, padding: 3 }}>
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
          {showCarouselBuilderSidebar ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "100%" }}>
              {selectedCarouselTemplate && selectedCarouselTemplateItem && selectedTemplateItemPage ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 6 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#121a2e" }}>Pre-prompt de la page</label>
                    <textarea
                      rows={6}
                      value={getCarouselTemplateItemPrompt(selectedCarouselTemplateItem, selectedTemplateItemPage, "pagePrompt")}
                      onChange={(event) => updateCarouselTemplateItemPrompt(selectedCarouselTemplate.id, selectedCarouselTemplateItem.id, "pagePrompt", event.target.value)}
                      style={{ ...inp, background: "#f2f2f2", borderRadius: 12, resize: "vertical", lineHeight: 1.45, minHeight: 132 }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#121a2e" }}>Pre-prompt image</label>
                    <textarea
                      rows={4}
                      value={getCarouselTemplateItemPrompt(selectedCarouselTemplateItem, selectedTemplateItemPage, "imagePrompt")}
                      onChange={(event) => updateCarouselTemplateItemPrompt(selectedCarouselTemplate.id, selectedCarouselTemplateItem.id, "imagePrompt", event.target.value)}
                      style={{ ...inp, background: "#f2f2f2", borderRadius: 12, resize: "vertical", lineHeight: 1.45, minHeight: 96 }}
                    />
                  </div>
                  {selectedTemplateItemPage.fields.length > 0 ? selectedTemplateItemPage.fields.map(renderCarouselTemplateField) : null}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 6 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#121a2e" }}>Prompt global carrousel (skill md)</label>
                  <textarea
                    rows={14}
                    value={settings?.carouselSkillPrompt ?? ""}
                    onChange={(event) => {
                      const nextSettings = { ...(settings ?? loadLinkedInSettings()), carouselSkillPrompt: event.target.value };
                      setSettings(nextSettings);
                      queueRemoteLinkedInSettingsSync(nextSettings);
                      void persistRemoteLinkedInSettings(nextSettings);
                    }}
                    style={{ ...inp, background: "#f2f2f2", borderRadius: 12, resize: "vertical", lineHeight: 1.5, minHeight: 280, fontFamily: "monospace" }}
                  />
                </div>
              )}

            </div>
          ) : showCarouselGeneratedSidebar ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "100%" }}>
              {renderGeneratedCarouselSlideFields()}
              <ClientBlueButton
                type="button"
                onClick={() => void generatePostFromCurrentCarousel(false)}
                loading={generating}
                wrapperStyle={{ width: "100%" }}
                style={{ width: "100%", fontSize: 14 }}
                disabled={generatedSlides.length === 0}
              >
                <Wand2 size={14} />
                Generer le format long
              </ClientBlueButton>
              <button
                type="button"
                onClick={downloadCurrentCarousel}
                disabled={generatedSlides.length === 0}
                style={{ width: "100%", minHeight: 46, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: "auto", opacity: generatedSlides.length === 0 ? 0.5 : 1 }}
              >
                <Download size={14} />
                Télécharger
              </button>
            </div>
          ) : postsMode === "carousel" ? (
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
              <div style={{ paddingTop: 8, fontSize: 12, lineHeight: "18px", color: "rgba(18,26,46,0.46)" }}>
                Choisis une template puis cree ton carrousel pour commencer.
              </div>
            </div>
          ) : rightEditorVisible ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.58)", marginBottom: 7 }}>Format du post</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {MANUAL_POST_FORMATS.map((format) => {
                    const active = selectedPostFormat === format.value;
                    return (
                      <button key={format.value} type="button" onClick={() => setSelectedPostFormat(format.value)} style={{ padding: "6px 12px", borderRadius: 20, border: active ? "1px solid rgba(1,71,255,0.34)" : inactiveStyleTag.border, background: active ? "rgba(45,110,253,0.1)" : inactiveStyleTag.background, color: active ? "#0147ff" : inactiveStyleTag.color, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        {format.label}
                      </button>
                    );
                  })}
                </div>
              </div>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <ClientBlueButton type="button" onClick={() => handleSave("draft")} loading={saving} wrapperStyle={{ width: "100%" }} style={{ width: "100%", fontSize: 14 }} disabled={!generatedContent.trim() || !selectedPostFormat}>
                  Sauvegarder
                </ClientBlueButton>
                <button type="button" onClick={() => openScheduleOverlay()} disabled={saving || !generatedContent.trim() || !selectedPostFormat} style={{ minHeight: 48, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 13, background: "#fff", color: "#121a2e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', boxShadow: "0px 4px 12px rgba(18,26,46,0.06)", opacity: generatedContent.trim() && selectedPostFormat ? 1 : 0.45 }}>
                  Programmer
                </button>
              </div>
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
          <ClientBlueButton type="button" onClick={handleGenerate} loading={generating} icon={<Wand2 size={14} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%", fontSize: 14 }}>
            {generating ? "Génération..." : "Générer avec l'IA"}
          </ClientBlueButton>
            {postsMode === "post" && (
              <button type="button" onClick={startManualPost} style={{ minHeight: 48, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 13, background: "#fff", color: "#121a2e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', boxShadow: "0px 4px 12px rgba(18,26,46,0.06)" }}>
                Démarrer manuellement
              </button>
            )}
          </div>

          {false && (
            <button
              type="button"
              onClick={downloadCurrentCarousel}
              disabled={generatedSlides.length === 0 && !generatedContent.trim()}
              style={{ width: "100%", minHeight: 46, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: "auto", opacity: generatedSlides.length === 0 && !generatedContent.trim() ? 0.5 : 1 }}
            >
              <Download size={14} />
              Télécharger
            </button>
          )}

          {generationError && (
            <p style={{ fontSize: 12, color: "#c53030", background: "#fff0f0", border: "1px solid #fcc", borderRadius: 9, padding: "8px 12px", margin: 0 }}>
              {generationError}
            </p>
          )}

          {/* Generated content */}
          {editorVisible && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {postType !== "carousel" && (
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

              {postType !== "carousel" && <label
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
              </label>}

              {/* Save buttons */}
              {postType !== "carousel" && <div style={{ display: "flex", gap: 8 }}>
                <ClientBlueButton compact type="button" onClick={() => handleSave("draft")} loading={saving} wrapperStyle={{ flex: 1, width: "100%" }} style={{ width: "100%" }}>
                  Sauvegarder
                </ClientBlueButton>
                <button onClick={() => openScheduleOverlay()} disabled={saving || !generatedContent.trim()} style={{ flex: 1, minHeight: 40, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 10, background: "#fff", color: "#121a2e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', boxShadow: "0px 4px 12px rgba(18,26,46,0.06)", opacity: generatedContent.trim() ? 1 : 0.45 }}>
                    Planifier
                </button>
              </div>}
            </div>
          )}
          </>
          )}
        </div>
      </div>

      {/* Right: Posts list */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fbfbfb" }}>
        {postsMode === "carousel" ? carouselStudioView : (
        <>
        {/* Stats bar */}
        <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "10px 24px", display: "none", alignItems: "center", gap: 24, flexShrink: 0 }}>
          {[
            { label: "Brouillons", value: "", color: "rgba(18,26,46,0.5)" },
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
          <div style={{ display: rightEditorVisible ? "none" : "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, borderRadius: 999, background: "#ededed" }}>
              {([
                ["draft", "Brouillons", stats.drafts],
                ["scheduled", "Planifiés", stats.scheduled],
              ] as const).map(([view, label]) => (
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
                  {label}
                </button>
              ))}
            </div>
          </div>

          {rightEditorVisible ? (
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 0, alignItems: "stretch", minHeight: "calc(100vh - 180px)" }}>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void handleDraftMedia(file);
              }}
              style={{ background: "transparent", border: "none", borderRadius: 0, boxShadow: "none", padding: "0 28px 0 0", display: "flex", flexDirection: "column", gap: 18, maxWidth: "none" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>{editingPostId ? "Modifier le brouillon" : "Nouveau brouillon manuel"}</h3>
                </div>
                <button type="button" onClick={resetEditor} style={{ position: "absolute", top: 24, right: 344, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 999, background: "#fff", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={12} />
                </button>
              </div>
              <div style={{ width: "100%", maxWidth: 700, border: "1px solid rgba(18,26,46,0.08)", borderRadius: 20, background: "#fff", boxShadow: "none", padding: 20 }}>
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
                <div style={{ marginTop: 16 }}>
                  {draftMedia ? (
                  <div onMouseEnter={() => setHoveredDraftImage(true)} onMouseLeave={() => setHoveredDraftImage(false)} style={{ position: "relative", width: "100%", minHeight: 240, borderRadius: 16, overflow: "hidden", background: "#f5f7fa" }}>
                    <div style={{ width: "100%", height: 240, background: `url(${draftMedia.url}) center / cover` }} />
                    <button type="button" onClick={() => setDraftMedia(null)} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(18,26,46,0.14)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: hoveredDraftImage ? 1 : 0, transform: hoveredDraftImage ? "translateY(0px)" : "translateY(-6px)", transition: "opacity 0.18s ease, transform 0.18s ease" }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: "#F6F6F6", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.58)", cursor: "pointer" }}>
                    <ImageIcon size={16} />
                    <input type="file" accept="image/*,.pdf,application/pdf" style={{ display: "none" }} onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleDraftMedia(file);
                      event.currentTarget.value = "";
                    }} />
                  </label>
                )}
                </div>
              </div>
              <div style={{ width: "100%", maxWidth: 700, height: 66, borderRadius: 62, border: "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: carouselPanelShadow, display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <button type="button" style={{ width: 40, height: 40, borderRadius: 34, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#F6F6F6"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}><Plus size={18} /></button>
                  <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runEditorChat(); }} placeholder="Taper un texte ici" style={{ flex: 1, border: 0, outline: "none", color: "rgba(18,26,46,0.7)", fontSize: 16, fontWeight: 500, lineHeight: "20px", letterSpacing: "-0.2px", fontFamily: "Inter, sans-serif" }} />
                </div>
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
                  <button type="button" onClick={() => setModelPickerOpen((current) => !current)} style={{ border: 0, background: "transparent", padding: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "rgba(18,26,46,0.7)", fontSize: 14, fontWeight: 500, lineHeight: "18px", fontFamily: "Inter, sans-serif" }}>
                    <span>{activeModelLabel}</span>
                    <ChevronDown size={14} style={{ color: "rgba(18,26,46,0.52)" }} />
                  </button>
                  <button type="button" onClick={() => void runEditorChat()} style={{ width: 46, height: 46, borderRadius: 34, background: "#121a2e", color: "#fff", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={18} /></button>
                  {modelPickerOpen ? (
                    <div style={{ position: "absolute", right: 58, bottom: 56, width: 300, borderRadius: 18, border: "1px solid rgba(18,26,46,0.12)", background: "rgba(255,255,255,0.96)", boxShadow: carouselPanelShadow, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", padding: "0 12px" }}>
                        <Search size={14} style={{ color: "#6f7887" }} />
                        <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Rechercher un modèle..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#121a2e" }} autoFocus />
                      </div>
                      <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                        {filteredModelOptions.map((model) => (
                          <button key={model} type="button" onClick={() => updateActiveModel(model)} style={{ width: "100%", border: 0, borderRadius: 10, background: model === activeModelLabel ? "rgba(0,0,0,0.04)" : "transparent", padding: "10px 11px", textAlign: "left", fontSize: 13, fontWeight: 500, color: "#121a2e", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                            {model}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <aside style={{ borderLeft: "1px solid rgba(18,26,46,0.12)", borderRadius: 0, background: "#fff", boxShadow: "none", padding: "34px 24px 24px", display: "flex", flexDirection: "column", gap: 18, minHeight: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#121a2e" }}>Récents</p>
                <button type="button" style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(0,0,0,0.07)", background: "#fff", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <History size={16} />
                </button>
              </div>
              {editorHistory.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.45)", lineHeight: 1.5 }}>Les modifications IA apparaîtront ici. Tu pourras restaurer une ancienne version.</p>
              ) : editorHistory.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setGeneratedContent(entry.after)} style={{ border: 0, borderBottom: "1px solid rgba(0,0,0,0.08)", background: "#fff", padding: "18px 0", textAlign: "left", cursor: "pointer" }}>
                  <strong style={{ display: "block", fontSize: 13, color: "#121a2e", marginBottom: 5 }}>{entry.label}</strong>
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
                        {post.status === "draft" && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              openScheduleOverlay(post);
                            }}
                            title="Planifier"
                            style={{ padding: "5px 8px", borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", cursor: "pointer", color: "rgba(18,26,46,0.55)", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                          >
                            <Calendar size={12} />
                            Planifier
                          </button>
                        )}
                        <button onClick={(event) => { event.stopPropagation(); deletePost(post.id); }} title="Supprimer" style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.72)", display: "flex" }}>
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
      {(scheduleOverlayPostId !== null || scheduleOverlayDate) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(18,26,46,0.18)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={closeScheduleOverlay}>
          <div style={{ width: "min(420px, 100%)", borderRadius: 20, background: "#fff", border: "1px solid rgba(18,26,46,0.12)", boxShadow: "0 24px 70px rgba(18,26,46,0.18)", padding: 22, display: "flex", flexDirection: "column", gap: 16 }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>Programmer le post</h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.5)" }}>Choisis la date de programmation avant validation.</p>
              </div>
              <button type="button" onClick={closeScheduleOverlay} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            <input type="datetime-local" value={scheduleOverlayDate} onChange={(event) => setScheduleOverlayDate(event.target.value)} style={{ ...inp, minHeight: 46 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={closeScheduleOverlay} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Annuler
              </button>
              <ClientBlueButton type="button" onClick={confirmScheduleOverlay} wrapperStyle={{ flex: 1 }} style={{ width: "100%", minHeight: 44, fontSize: 13 }} disabled={!scheduleOverlayDate}>
                Programmer
              </ClientBlueButton>
            </div>
          </div>
        </div>
      )}

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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .carousel-editor-strip::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

// Slide preview component

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
    const match = line.match(/^([A-Z0-9_\-\s]{2,40})\s*:\s*(.*)$/i);
    if (match) {
      if (currentKey) fields.push({ key: currentKey, value: currentValue.join("\n").trim() });
      currentKey = match[1]; currentValue = [match[2]];
    } else if (currentKey) { currentValue.push(line); }
  }
  if (currentKey) fields.push({ key: currentKey, value: currentValue.join("\n").trim() });
  return fields.length >= 2 ? fields : null;
}

function CarouselSlideCanvas({ payload, raw, scale = 1 }: { payload: CarouselSlidePayload | null; raw: string; scale?: number }) {
  const data = payload ?? { kind: "context" as CarouselSlideKind, label: "Slide", body: raw };
  const isRed = data.kind === "argument-red";
  const accent = isRed ? "#EF0C0C" : "#0147FF";
  const gradient = isRed
    ? "linear-gradient(89.57deg, #EF0C0C -1.45%, #FE5454 54.17%, #F01717 95.71%)"
    : "linear-gradient(95.73deg, #0147FF 25.27%, #376EFF 45.55%, #0147FF 67.55%)";
  const card: CSSProperties = {
    width: 575,
    height: 690,
    position: "relative",
    background: "#F6F6F6",
    overflow: "hidden",
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    color: "#121A2E",
    transform: `scale(${scale})`,
    transformOrigin: "top left",
  };

  const logo = (
    <div style={{ position: "absolute", top: 20, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <img src="/linkedin/logo-ruff-agency.png" alt="RUFF Agency" style={{ height: 64, objectFit: "contain" }} />
    </div>
  );
  const leftBars = (
    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
      <img src="/linkedin/bars-left.svg" alt="" style={{ height: "100%", width: "auto", objectFit: "contain" }} />
    </div>
  );
  const rightBars = (
    <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
      <img src="/linkedin/bars-right.svg" alt="" style={{ height: "100%", width: "auto", objectFit: "contain" }} />
    </div>
  );
  const swipeCta = (
    <img
      src="/linkedin/swipe-cta.png"
      alt="Swipe"
      style={{
        position: "absolute",
        right: 52,
        bottom: 20,
        height: 50,
        objectFit: "contain",
        zIndex: 10,
        marginBottom: -6,
      }}
    />
  );
  const footer = (
    <div style={{ position: "absolute", left: 52, right: 52, bottom: 20, height: 56, display: "flex", alignItems: "flex-end", justifyContent: "flex-start", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <img src="/linkedin/profile.jpg" alt="Louis Staub" style={{ width: 46, height: 46, borderRadius: 999, border: "1.72px solid #fff", objectFit: "cover", boxShadow: "0 21px 8.2px rgba(0,0,0,0.01), 0 11.71px 7.03px rgba(0,0,0,0.05), 0 4.68px 4.68px rgba(0,0,0,0.09), 0 1.17px 2.34px rgba(0,0,0,0.1)" }} />
        <span style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 2 }}>
          <strong style={{ display: "block", fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: 13.33, lineHeight: "16px", color: "#121A2E" }}>Louis Staub</strong>
          <span style={{ display: "block", fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: 11.5, lineHeight: "15px", color: "#121A2E" }}>J'optimise le taux de conversion de ta landing page</span>
        </span>
      </div>
    </div>
  );

  if (data.kind === "cta") {
    if (!data.backgroundImage1 && !data.backgroundImage2) {
      return (
        <div style={card} data-carousel-slide-inner>
          {leftBars}
          {rightBars}
          <img src="/linkedin/slide-cta-reference.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      );
    }
    return (
      <div style={{ ...card, background: "linear-gradient(115deg,#2D6EFD 0%,#0147FF 72%)", color: "#fff" }}>
        {leftBars}
        {rightBars}
        {data.backgroundImage1 ? <img src={data.backgroundImage1} alt="" style={{ position: "absolute", right: -70, top: 48, width: 210, height: 290, objectFit: "cover", borderRadius: 26, transform: "rotate(13deg)", opacity: 0.9, boxShadow: "0 20px 42px rgba(0,0,0,0.2)" }} /> : null}
        {data.backgroundImage2 ? <img src={data.backgroundImage2} alt="" style={{ position: "absolute", right: -40, bottom: 80, width: 235, height: 250, objectFit: "cover", borderRadius: 26, transform: "rotate(13deg)", opacity: 0.92, boxShadow: "0 20px 42px rgba(0,0,0,0.2)" }} /> : null}
        {logo}
        <div style={{ position: "absolute", left: 72, top: 96, display: "flex", alignItems: "center", gap: 18, fontSize: 28 }}>
          <span style={{ display: "flex" }}><span style={{ width: 34, height: 34, borderRadius: 999, background: "#fff", marginLeft: -7 }} /></span>
          <span>+30 clients satisfaits</span>
        </div>
        <h2 style={{ position: "absolute", left: 72, top: 155, width: 388, margin: 0, fontSize: 40, lineHeight: 1.08, letterSpacing: "-0.04em" }}>Votre landing optimisé conversion</h2>
        <strong style={{ position: "absolute", left: 72, top: 242, fontSize: 70, lineHeight: 1 }}>1450€</strong>
        {["Copywriting optimisé conversion", "Analyse stratégique et concurrentielle", "Assets 100% personnalisés avec animation en motion design", "Rapport avec des explications détaillées", "Livraison en 10 jours", "Support client 24h/24 et 7j/7"].map((item, index) => (
          <p key={item} style={{ position: "absolute", left: 72, top: 335 + index * 48, margin: 0, fontSize: 24, lineHeight: 1.15, opacity: 0.86 }}>✓ {item}</p>
        ))}
        <div style={{ position: "absolute", left: 72, bottom: 74, width: 180, height: 48, borderRadius: 14, background: "#fff", color: "#121A2E", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 700 }}>Réserver un appel</div>
      </div>
    );
  }

  if (data.kind === "before-after" || data.kind === "avis") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        {data.kind === "avis" && <div style={{ position: "absolute", left: 68, right: 68, top: 82, height: 69, borderRadius: 15, background: "#fff", border: "1px solid rgba(0,0,0,0.16)", boxShadow: "0 12px 20px rgba(0,0,0,0.07)", display: "grid", placeItems: "center", fontSize: 31, fontWeight: 700 }}>{data.title || "Tu preferes quelle version ?"}</div>}
        <div style={{ position: "absolute", left: 86, right: 86, top: data.kind === "avis" ? 184 : 92, height: data.kind === "avis" ? 204 : 243, borderRadius: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.18)", boxShadow: "0 18px 24px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {data.beforeImage ? <img src={data.beforeImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
        <div style={{ position: "absolute", left: 86, right: 86, top: data.kind === "avis" ? 405 : 353, height: data.kind === "avis" ? 204 : 243, borderRadius: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.18)", boxShadow: "0 18px 24px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          {data.afterImage ? <img src={data.afterImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
        {data.kind === "before-after" && <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 300, border: "1px solid #0147FF", borderRadius: 999, background: "#fff", padding: "12px 18px", fontWeight: 700, fontSize: 13, boxShadow: "0 4px 8px rgba(0,0,0,0.06)", whiteSpace: "nowrap" }}>Ancienne version du site</span>}
        {data.kind === "before-after" && <span style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 563, border: "1px solid #0147FF", borderRadius: 999, background: "#fff", padding: "12px 18px", fontWeight: 700, fontSize: 13, boxShadow: "0 4px 8px rgba(0,0,0,0.06)", whiteSpace: "nowrap" }}>Nouvelle version du site</span>}
        {swipeCta}{footer}
      </div>
    );
  }

  if (data.kind === "why-design") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        <div style={{ position: "absolute", left: 86, top: 184, width: 403, minHeight: 178, borderRadius: 21, background: "#0147FF", color: "#fff", padding: 24, boxShadow: "0 18px 24px rgba(10,132,255,0.08)" }}>
          <h2 style={{ margin: 0, fontSize: 32, lineHeight: 1.06, letterSpacing: "-0.02em" }}>{data.body || data.title}</h2>
          <span style={{ marginTop: 16, width: 65, height: 45, borderRadius: 8, background: "#fff", color: "#000", display: "grid", placeItems: "center" }}><MoveRight size={28} strokeWidth={3} style={{ color: "#121A2E" }} /></span>
        </div>
        {swipeCta}{footer}
      </div>
    );
  }

  if (data.kind === "step") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        <div style={{ position: "absolute", left: 86, top: 184, width: 403, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 15 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 97,
            borderRadius: 26,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.22)",
            padding: "16px 26px",
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 56,
            fontWeight: 700,
            color: "#121A2E",
            letterSpacing: "-0.02em",
            boxShadow: "0 12px 16px rgba(26,26,26,0.06)",
          }}>
            Etape {data.stepNumber || 1}
          </div>
          <div style={{
            minHeight: 82,
            borderRadius: 19,
            background: "#0147FF",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            padding: "16px 24px",
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            boxShadow: "0 18px 24px rgba(10,132,255,0.08)",
            textAlign: "left",
          }}>
            {data.title}
          </div>
        </div>
        {swipeCta}{footer}
      </div>
    );
  }

  if (data.kind === "free") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        <div style={{ position: "absolute", left: 86, top: 112, width: 403, height: 488, borderRadius: 24, border: "1.5px dashed rgba(18,26,46,0.18)", background: "linear-gradient(45deg, rgba(255,255,255,0.72) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.72) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.72) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.72) 75%)", backgroundSize: "28px 28px", backgroundPosition: "0 0, 0 14px, 14px -14px, -14px 0", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.42)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Libre
        </div>
        {swipeCta}{footer}
      </div>
    );
  }

  if (data.kind === "image") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {data.imageUrl ? (
          <img src={data.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, border: "3px dashed rgba(18,26,46,0.18)", background: "#f2f2f2", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.42)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Image
          </div>
        )}
      </div>
    );
  }

  if (data.kind === "argument-blue" || data.kind === "argument-red") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        <div style={{ position: "absolute", left: 86, top: 98, width: 403, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Case numéro */}
            <span style={{
              width: 66,
              height: 65,
              borderRadius: 15,
              background: "#e5e5e5",
              border: "1px solid rgba(0,0,0,0.06)",
              display: "grid",
              placeItems: "center",
            }}>
              <span style={{
                width: 56,
                height: 56,
                borderRadius: 11,
                background: "#fff",
                display: "grid",
                placeItems: "center",
                fontFamily: "Inter, sans-serif",
                fontSize: 31.86,
                fontWeight: 700,
                color: "#121A2E",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 6px 2px rgba(0,0,0,0.02), 0 3px 2px rgba(0,0,0,0.08), 0 1.5px 1.5px rgba(0,0,0,0.13)",
              }}>{data.pointNumber || 1}</span>
            </span>
            {/* Conteneur titre */}
            <span style={{
              minHeight: 60,
              borderRadius: 14,
              background: gradient,
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              padding: "0 20px",
              fontSize: 26,
              lineHeight: 1.06,
              fontWeight: 700,
              boxShadow: isRed
                ? "0 24px 9.38px rgba(150,13,13,0.02), 0 13.39px 8.04px rgba(150,13,13,0.08), 0 6.03px 6.03px rgba(150,13,13,0.13), 0 1.34px 3.35px rgba(150,13,13,0.15)"
                : "0 24px 9.38px rgba(1,71,255,0.02), 0 13.39px 8.04px rgba(1,71,255,0.08), 0 6.03px 6.03px rgba(1,71,255,0.13), 0 1.34px 3.35px rgba(1,71,255,0.15)",
            }}>{limitSlideTitle(data.title || "")}</span>
          </div>
          <p style={{
            margin: "12px 0 0",
            minHeight: 99,
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 21,
            lineHeight: 1.58,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "rgba(18,26,46,0.8)",
            textAlign: "left",
          }}>{data.subtitle}</p>
          <div style={{
            position: "relative",
            marginTop: 12,
            height: 264,
            borderRadius: data.imageMode === "full" ? 0 : 16,
            background: "#fff",
            border: data.imageMode === "full" ? "none" : "1px solid rgba(0,0,0,0.1)",
            overflow: data.showCheck === false ? "hidden" : "visible",
          }}>
            {data.imageUrl ? <img src={data.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
            {data.showCheck !== false && (
              <img
                src={isRed ? "/linkedin/croix.png" : "/linkedin/check.png"}
                alt=""
                style={{
                  position: "absolute",
                  right: -10,
                  top: -12,
                  width: 52,
                  height: 52,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            )}
          </div>
          {data.showResult && (
            <p style={{ margin: "16px 0 0", display: "flex", alignItems: "center", gap: 16, fontSize: 18, lineHeight: 1.34, fontWeight: 700 }}>
              <MoveRight size={24} strokeWidth={3} style={{ color: accent }} />
              {data.result}
            </p>
          )}
        </div>
        {swipeCta}{footer}
      </div>
    );
  }

  return (
    <div style={card} data-carousel-slide-inner>
      {leftBars}
      {rightBars}
      {logo}
      <div style={{ position: "absolute", left: 86, top: 118, width: 403, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 73,
          borderRadius: 20,
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.22)",
          padding: "0 20px",
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontSize: 42,
          fontWeight: 700,
          color: "#121A2E",
          letterSpacing: "-0.02em",
          boxShadow: "0 9px 4px rgba(26,26,26,0.01), 0 5px 3px rgba(26,26,26,0.03), 0 2px 2px rgba(26,26,26,0.04), 0 1px 1px rgba(26,26,26,0.05)",
        }}>
          Contexte
        </div>
        <p style={{
          margin: "24px 0 0",
          whiteSpace: "pre-line",
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.26,
          letterSpacing: "-0.02em",
          color: "rgba(18,26,46,0.8)",
        }}>
          {data.subtitle || data.body}
        </p>
        {data.showStepCta && (
          <div style={{
            marginTop: 28,
            height: 56,
            borderRadius: 38,
            background: "#000",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 12,
            padding: "8px 8px 8px 24px",
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 22,
            fontWeight: 700,
            textAlign: "left",
            boxShadow: "0 15px 6px rgba(0,0,0,0.02), 0 8.65px 5.19px rgba(0,0,0,0.08), 0 4px 4px rgba(0,0,0,0.13), 0 0.86px 2.16px rgba(0,0,0,0.15)",
          }}>
            <span style={{ textAlign: "left" }}>{data.stepCtaText}</span>
            <span style={{
              width: 57,
              height: 39,
              borderRadius: 32,
              background: "#fff",
              color: "#000",
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(0,0,0,0.06)",
            }}>
              <MoveRight size={24} strokeWidth={3} />
            </span>
          </div>
        )}
      </div>
      {swipeCta}{footer}
    </div>
  );
}

function SlidePreview({ content, slideNum, totalSlides, onChange }: { content: string; slideNum: number; totalSlides: number; onChange: (val: string) => void }) {
  const [rawMode, setRawMode] = useState(false);
  const fields = parseSlideFields(content);
  const jkSlide: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };

  if (rawMode || !fields) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          {fields && (
            <button onClick={() => setRawMode(false)} style={{ fontSize: 11, color: "rgba(18,26,46,0.5)", background: "none", border: "none", cursor: "pointer", ...jkSlide }}>Vue structurée</button>
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
        <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(18,26,46,0.5)", ...jkSlide }}></span>
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

