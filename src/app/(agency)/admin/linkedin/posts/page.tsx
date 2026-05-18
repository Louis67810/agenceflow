"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { flushSync } from "react-dom";
import type { CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Wand2, Loader2, X, Check, Trash2, Link2, Plus, Download,
  Youtube, Lightbulb, AlignLeft, LayoutTemplate, Edit3,
  ThumbsUp, MessageCircle, Eye, Calendar,
  FileText, Image as ImageIcon, Copy,
  Search, Send, History, ChevronDown, ArrowLeft, ArrowRight, MoveRight,
  Upload, Calendar as CalendarIcon, Info, Settings, Repeat2,
  BarChart3, Share2, Rocket, AlertTriangle,
} from "lucide-react";
import type { LinkedInCarouselPageTemplate, LinkedInCarouselTemplate, LinkedInPost, LinkedInPostAnalytics, LinkedInStyle, LinkedInIdea } from "@/types/linkedin";
import { DEFAULT_STYLES } from "@/types/linkedin";
import { loadLinkedInSettings, type LinkedInSettings } from "@/lib/linkedin/settings";
import SmartSelectionTextarea, { buildSmartSelectionCommands } from "@/components/shared/SmartSelectionTextarea";
import { fillLinkedInEditActionPrompt } from "@/lib/linkedin/edit-ai-actions";
import {
  computeLinkedInPostScore,
  ensureAutoRecyclePosts,
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
  DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES,
  hasMeaningfulLinkedInWorkspaceData,
  loadLinkedInWorkspaceCache,
  patchRemoteLinkedInWorkspace,
  persistLinkedInWorkspacePatch,
} from "@/lib/linkedin/workspace";
import ClientBlueButton from "@/components/shared/ClientBlueButton";
import {
  CarouselSlideCanvas,
  decodeCarouselSlide,
  type CarouselSlideKind,
  type CarouselSlidePayload,
} from "@/components/linkedin/CarouselSlideRender";

type SourceTab = "idea" | "url" | "youtube" | "manual";
type PostsView = "draft" | "scheduled" | "auto";
type PostsMode = "post" | "carousel";
type CarouselStudioTab = "templates" | "editor";
type CarouselStudioMode = "builder" | "generate";
type CarouselCreateStep = "setup" | "ai-source" | "ai-assets" | "ai-options";
type ManualPostFormat = NonNullable<LinkedInPostAnalytics["format"]>;
type EditorSnapshot = NonNullable<LinkedInPost["editorSnapshots"]>[number];
type CarouselTemplateItemMeta = {
  label?: string;
  fields?: Record<string, string>;
  pagePrompt?: string;
  imagePrompt?: string;
};
type CarouselHistoryEntry = {
  id: string;
  label: string;
  slides: string[];
  createdAt: string;
  details?: string[];
};
type CarouselImageAsset = {
  id: string;
  url: string;
  fileName: string;
  description: string;
};
type ViralityAnalysis = {
  likes: number;
  comments: number;
  shares: number;
  ratio: string;
  viralityLevel: string;
  viralityScore: number;
  boostingFactors: string[];
  limitingFactors: string[];
};

const MANUAL_POST_FORMATS: Array<{ value: ManualPostFormat; label: string }> = [
  { value: "text", label: "Texte" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "document", label: "Document" },
];

const FREE_CAROUSEL_PAGE_ID = "__free_carousel_page__";
const SLIDE_KIND_PREFIX = "builtin:";
const AI_CAROUSEL_TEMPLATE_ID = "__ai_carousel_template__";

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
    pagePrompt: "Genere une slide etape courte et actionnable. Respecte la numerotation automatique de l'etape et genere un titre d'etape tres court, net et oriente action.",
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
    pagePrompt: "Genere une slide argument positive. Renseigne un titre court, un sous-texte clair, le bloc resultat si active, et respecte les options d'image, de mode d'image et d'affichage du resultat. Contraintes strictes: titre maximum 19 caracteres, sous-titre maximum 105 caracteres sur 3 lignes maximum. Ne mets jamais de points de suspension pour raccourcir.",
    imagePrompt: "Decris une image qui illustre precisement ce point positif. L'image doit etre exploitable par un modele image et fonctionner en mode avec cadre ou plein format.",
    fields: [
      { id: "arg-title", label: "Titre (19 caracteres recommandes)", kind: "text", required: true, aiPrompt: "Titre court. Maximum strict: 19 caracteres. Ne mets jamais de points de suspension.", defaultValue: "Definis son profil" },
      { id: "arg-subtitle", label: "Sous-titre", kind: "text", required: true, aiPrompt: "Explication courte. Maximum strict: 105 caracteres, 3 lignes maximum.", defaultValue: "Pas environ 30 ans. Exactement qui il est : age, metier, ville, niveau de vie, situation familiale." },
      { id: "arg-image", label: "Image", kind: "image", required: false, aiPrompt: "Image manuelle ou generee." },
      { id: "arg-image-source", label: "Image IA active", kind: "text", required: false, aiPrompt: "oui/non", defaultValue: "non" },
      { id: "arg-image-mode", label: "Mode image", kind: "text", required: false, aiPrompt: "frame/full", defaultValue: "frame" },
      { id: "arg-number-enabled", label: "Afficher le numero", kind: "text", required: false, aiPrompt: "oui/non", defaultValue: "oui" },
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
    pagePrompt: "Genere une slide argument negative. Renseigne un titre court, un sous-texte clair, le bloc resultat si active, et respecte les options d'image, de mode d'image et d'affichage du resultat. Contraintes strictes: titre maximum 19 caracteres, sous-titre maximum 105 caracteres sur 3 lignes maximum. Ne mets jamais de points de suspension pour raccourcir.",
    imagePrompt: "Decris une image qui illustre precisement cette erreur ou faiblesse. L'image doit etre exploitable par un modele image et fonctionner en mode avec cadre ou plein format.",
    fields: [
      { id: "arg-title", label: "Titre (19 caracteres recommandes)", kind: "text", required: true, aiPrompt: "Titre court. Maximum strict: 19 caracteres. Ne mets jamais de points de suspension.", defaultValue: "Aucune preuve sociale" },
      { id: "arg-subtitle", label: "Sous-titre", kind: "text", required: true, aiPrompt: "Explication courte. Maximum strict: 105 caracteres, 3 lignes maximum.", defaultValue: "Pas environ 30 ans. Exactement qui il est : age, metier, ville, niveau de vie, situation familiale." },
      { id: "arg-image", label: "Image", kind: "image", required: false, aiPrompt: "Image manuelle ou generee." },
      { id: "arg-image-source", label: "Image IA active", kind: "text", required: false, aiPrompt: "oui/non", defaultValue: "non" },
      { id: "arg-image-mode", label: "Mode image", kind: "text", required: false, aiPrompt: "frame/full", defaultValue: "frame" },
      { id: "arg-number-enabled", label: "Afficher le numero", kind: "text", required: false, aiPrompt: "oui/non", defaultValue: "oui" },
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
    pagePrompt: "",
    imagePrompt: "",
    fields: [
      { id: "before-image", label: "Image avant", kind: "image", required: true, aiPrompt: "" },
      { id: "after-image", label: "Image apres", kind: "image", required: true, aiPrompt: "" },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:why-design",
    name: "Pourquoi ce design fonctionne",
    description: "Slide bleue dont seul le texte est modifiable.",
    figmaNodeId: "slide:why-design",
    pagePrompt: "",
    imagePrompt: "",
    fields: [
      { id: "why-text", label: "Texte", kind: "text", required: true, aiPrompt: "", defaultValue: "Pourquoi ce design fonctionne-t-il mieux ?" },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:avis",
    name: "Avis",
    description: "Slide avis fixe.",
    figmaNodeId: "slide:avis",
    pagePrompt: "",
    imagePrompt: "",
    fields: [
      { id: "avis-title", label: "Question", kind: "text", required: true, aiPrompt: "", defaultValue: "Tu preferes quelle version ?" },
      { id: "avis-image-1", label: "Image version 1", kind: "image", required: false, aiPrompt: "" },
      { id: "avis-image-2", label: "Image version 2", kind: "image", required: false, aiPrompt: "" },
    ],
    createdAt: "builtin",
  },
  {
    id: "builtin:image",
    name: "Image",
    description: "Slide image plein format.",
    figmaNodeId: "slide:image",
    pagePrompt: "",
    imagePrompt: "",
    fields: [],
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

function splitInstructionPoints(prompt: string) {
  const lines = prompt
    .split(/\n|;|-/)
    .map((line) => line.replace(/^\d+[\).\s-]*/, "").trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const sentences = prompt.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter((line) => line.length > 18);
  return sentences.length > 1 ? sentences : [];
}

function encodeCarouselSlide(payload: CarouselSlidePayload) {
  return `__AF_CAROUSEL_SLIDE__${JSON.stringify(payload)}`;
}

function normalizeCarouselSlideCounters(slides: string[]) {
  let stepIndex = 0;
  let bluePointIndex = 0;
  let redPointIndex = 0;

  return slides.map((slide) => {
    const payload = decodeCarouselSlide(slide);
    if (!payload) return slide;

    if (payload.kind === "step") {
      stepIndex += 1;
      bluePointIndex = 0;
      redPointIndex = 0;
      return encodeCarouselSlide({ ...payload, stepNumber: stepIndex, pointNumber: undefined });
    }

    if (payload.kind === "why-design") {
      stepIndex = 0;
      bluePointIndex = 0;
      redPointIndex = 0;
      return encodeCarouselSlide({ ...payload, stepNumber: undefined, pointNumber: undefined });
    }

    if (payload.kind === "argument-blue") {
      bluePointIndex += 1;
      return encodeCarouselSlide({ ...payload, pointNumber: bluePointIndex, stepNumber: undefined });
    }

    if (payload.kind === "argument-red") {
      redPointIndex += 1;
      return encodeCarouselSlide({ ...payload, pointNumber: redPointIndex, stepNumber: undefined });
    }

    return encodeCarouselSlide({ ...payload, stepNumber: undefined, pointNumber: undefined });
  });
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" rx="20" fill="#f1f5f9"/><rect x="52" y="36" width="216" height="168" rx="16" fill="#fff" stroke="#d8dee8" stroke-width="5"/><rect x="78" y="66" width="74" height="90" rx="11" fill="#ef4444"/><text x="115" y="119" text-anchor="middle" font-size="24" font-family="Arial" font-weight="700" fill="#fff">PDF</text><text x="78" y="180" font-size="14" font-family="Arial" font-weight="700" fill="#121a2e">Apercu PDF</text></svg>`;
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
    img.onerror = () => reject(new Error("Impossible de telecharger l'image."));
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

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// Style tokens

const jk: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };
const inp: CSSProperties = { width: "100%", background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "#121a2e", outline: "none", boxSizing: "border-box", fontFamily: '"Plus Jakarta Sans", sans-serif' };

const STATUS_STYLES: Record<"draft" | "scheduled" | "published", { bg: string; color: string }> = {
  draft: { bg: "#f6f6f6", color: "rgba(18,26,46,0.5)" },
  scheduled: { bg: "#d5eeff", color: "#073e63" },
  published: { bg: "#d1fae5", color: "#168b64" },
};
const STATUS_LABELS = { draft: "Brouillon", scheduled: "Planifie", published: "Publie" };
const STYLE_TAGS: Record<LinkedInStyle["category"] | "custom", { bg: string; color: string; border: string }> = {
  storytelling: { bg: "#E1D1FA", color: "#6236AA", border: "rgba(98,54,170,0.18)" },
  valeur: { bg: "#d5eeff", color: "#073e63", border: "rgba(7,62,99,0.14)" },
  educatif: { bg: "#ccfbf1", color: "#0f766e", border: "rgba(15,118,110,0.16)" },
  educatif_carrousel: { bg: "#dff7ff", color: "#036782", border: "rgba(3,103,130,0.14)" },
  presentation_projet: { bg: "#e9edf5", color: "#334155", border: "rgba(51,65,85,0.14)" },
  viral: { bg: "#ffe4e4", color: "#c53030", border: "rgba(197,48,48,0.14)" },
  engagement: { bg: "#fee6d0", color: "#663b12", border: "rgba(102,59,18,0.14)" },
  data: { bg: "#e0e7ff", color: "#3730a3", border: "rgba(55,48,163,0.14)" },
  lead_magnet: { bg: "#d1fae5", color: "#047857", border: "rgba(4,120,87,0.14)" },
  custom: { bg: "#f6f6f6", color: "rgba(18,26,46,0.58)", border: "rgba(18,26,46,0.1)" },
};
const inactiveStyleTag = { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.55)" };
const STYLE_CATEGORY_LABELS: Record<string, string> = {
  storytelling: "Storytelling",
  valeur: "Valeur / Liste",
  educatif: "Educatif",
  educatif_carrousel: "Educatif carousel",
  presentation_projet: "Presentation de projet",
  engagement: "Engagement",
  data: "Data chiffres",
  lead_magnet: "Lead magnet",
  viral: "Opinion forte",
  custom: "Personnalise",
};
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
  const [showGeneratedSlidePagePicker, setShowGeneratedSlidePagePicker] = useState(false);
  const [showCarouselTemplatePicker, setShowCarouselTemplatePicker] = useState(false);
  const [carouselPageSearch, setCarouselPageSearch] = useState("");
  const [carouselTemplateSearch, setCarouselTemplateSearch] = useState("");
  const [carouselGenerationTemplateId, setCarouselGenerationTemplateId] = useState("");
  const [carouselGenerationPrompt, setCarouselGenerationPrompt] = useState("");
  const [carouselDraftName, setCarouselDraftName] = useState("");
  const [carouselDraftCategory, setCarouselDraftCategory] = useState("");
  const [carouselCreateStep, setCarouselCreateStep] = useState<CarouselCreateStep>("setup");
  const [carouselGenerateImagesWithAI, setCarouselGenerateImagesWithAI] = useState(false);
  const [carouselUseTemplate, setCarouselUseTemplate] = useState(true);
  const [carouselSourceTab, setCarouselSourceTab] = useState<SourceTab>("idea");
  const [carouselSourceIdeaId, setCarouselSourceIdeaId] = useState("");
  const [carouselSourceValue, setCarouselSourceValue] = useState("");
  const [carouselSourceContext, setCarouselSourceContext] = useState("");
  const [carouselSourceLoading, setCarouselSourceLoading] = useState(false);
  const [carouselGenerationPhase, setCarouselGenerationPhase] = useState("");
  const [carouselImageAssets, setCarouselImageAssets] = useState<CarouselImageAsset[]>([]);
  const [carouselAssetsDragActive, setCarouselAssetsDragActive] = useState(false);
  const [carouselGenerationChat, setCarouselGenerationChat] = useState<Array<{ id: string; role: "user" | "assistant"; content: string }>>([]);
  const [carouselGenerationHistory, setCarouselGenerationHistory] = useState<CarouselHistoryEntry[]>([]);
  const [carouselHistoryDetails, setCarouselHistoryDetails] = useState<CarouselHistoryEntry | null>(null);
  const [showCarouselHistory, setShowCarouselHistory] = useState(false);
  const [carouselTemplateMenu, setCarouselTemplateMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renamingCarouselTemplateId, setRenamingCarouselTemplateId] = useState("");
  const [renamingCarouselTemplateName, setRenamingCarouselTemplateName] = useState("");
  const [carouselChatLoading, setCarouselChatLoading] = useState(false);
  const [carouselApplyingEdit, setCarouselApplyingEdit] = useState(false);
  const [carouselTargetPickerOpen, setCarouselTargetPickerOpen] = useState(false);
  const [carouselFieldPickerOpen, setCarouselFieldPickerOpen] = useState(false);
  const [carouselCommandPickerOpen, setCarouselCommandPickerOpen] = useState(false);
  const [carouselChatTargetSlides, setCarouselChatTargetSlides] = useState<number[]>([]);
  const [carouselChatTargetField, setCarouselChatTargetField] = useState<keyof CarouselSlidePayload | "">("");
  const [newCarouselPageName, setNewCarouselPageName] = useState("");
  const [newCarouselTemplateName, setNewCarouselTemplateName] = useState("");
  const [sourceInput, setSourceInput] = useState("");
  const [manualIdea, setManualIdea] = useState("");
  const [selectedIdeaId, setSelectedIdeaId] = useState("");
  const [sourceContext, setSourceContext] = useState("");
  const [scrapedContent, setScrapedContent] = useState("");
  const [scrapedTitle, setScrapedTitle] = useState("");
  const [scraping, setScraping] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [generatedSlides, setGeneratedSlides] = useState<string[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [carouselDownloading, setCarouselDownloading] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [tags, setTags] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postsView, setPostsView] = useState<PostsView>("draft");
  const [draftMedia, setDraftMedia] = useState<{ url: string; kind: "image" | "pdf"; fileName: string; bytes: number } | null>(null);
  const [manualEditorStarted, setManualEditorStarted] = useState(false);
  const [editorHistory, setEditorHistory] = useState<Array<{ id: string; label: string; before: string; after: string; createdAt: string }>>([]);
  const [editorChat, setEditorChat] = useState<Array<{ id: string; role: "user" | "assistant" | "system"; content: string; images?: Array<{ url: string; fileName: string }>; createdAt: string }>>([]);
  const [editorSnapshots, setEditorSnapshots] = useState<EditorSnapshot[]>([]);
  const [editorPanelMode, setEditorPanelMode] = useState<"conversation" | "history">("conversation");
  const [chatInput, setChatInput] = useState("");
  const [chatImageAttachments, setChatImageAttachments] = useState<CarouselImageAsset[]>([]);
  const [editorChatLoading, setEditorChatLoading] = useState(false);
  const [editorApplyingEdit, setEditorApplyingEdit] = useState(false);
  const [selectedChatText, setSelectedChatText] = useState("");
  const [postCopied, setPostCopied] = useState(false);
  const [hoveredDraftImage, setHoveredDraftImage] = useState(false);
  const [scheduleOverlayPostId, setScheduleOverlayPostId] = useState<string | null>(null);
  const [scheduleOverlayDate, setScheduleOverlayDate] = useState("");
  const [scheduleCalendarMonth, setScheduleCalendarMonth] = useState("");
  const [autoRecycleSettingsOpen, setAutoRecycleSettingsOpen] = useState(false);
  const [autoRecycleEnabled, setAutoRecycleEnabled] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.autoRecycleEnabled);
  const [autoRecycleDelayDays, setAutoRecycleDelayDays] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.autoRecycleDelayDays);
  const [autoRecycleMinLikes, setAutoRecycleMinLikes] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.autoRecycleMinLikes);
  const [autoRecyclePrompt, setAutoRecyclePrompt] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.autoRecyclePrompt);
  const [userWritingStylePrompt, setUserWritingStylePrompt] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.userWritingStylePrompt);
  const [autoRecycleVariantLoadingId, setAutoRecycleVariantLoadingId] = useState<string | null>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [chatActionsOpen, setChatActionsOpen] = useState(false);
  const [selectedChatCommandId, setSelectedChatCommandId] = useState("");
  const [createPostOverlayOpen, setCreatePostOverlayOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostSourceTab, setNewPostSourceTab] = useState<SourceTab>("manual");
  const [newPostSourceValue, setNewPostSourceValue] = useState("");
  const [newPostSourceContext, setNewPostSourceContext] = useState("");
  const [newPostIdeaId, setNewPostIdeaId] = useState("");
  const [newPostStyleId, setNewPostStyleId] = useState("");
  const [newPostFormat, setNewPostFormat] = useState<ManualPostFormat>("text");
  const [draggedCarouselItemId, setDraggedCarouselItemId] = useState("");
  const [viralityOpen, setViralityOpen] = useState(false);
  const [viralityLoading, setViralityLoading] = useState(false);
  const [viralityError, setViralityError] = useState("");
  const [viralityImageDescription, setViralityImageDescription] = useState("");
  const [viralityResult, setViralityResult] = useState<ViralityAnalysis | null>(null);
  const [viralityConfigured, setViralityConfigured] = useState(true);
  const editorCarouselRef = useRef<HTMLDivElement | null>(null);
  const editorDragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 });
  const chatComposerRef = useRef<HTMLDivElement | null>(null);

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
  const smartSelectionCommands = useMemo(
    () => buildSmartSelectionCommands(settings?.editActions),
    [settings?.editActions]
  );

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
    setAutoRecycleEnabled(cachedWorkspace.preferences.autoRecycleEnabled);
    setAutoRecycleDelayDays(cachedWorkspace.preferences.autoRecycleDelayDays);
    setAutoRecycleMinLikes(cachedWorkspace.preferences.autoRecycleMinLikes);
    setAutoRecyclePrompt(cachedWorkspace.preferences.autoRecyclePrompt);
    setUserWritingStylePrompt(cachedWorkspace.preferences.userWritingStylePrompt);
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
          setAutoRecycleEnabled(remoteWorkspace.workspace.preferences.autoRecycleEnabled);
          setAutoRecycleDelayDays(remoteWorkspace.workspace.preferences.autoRecycleDelayDays);
          setAutoRecycleMinLikes(remoteWorkspace.workspace.preferences.autoRecycleMinLikes);
          setAutoRecyclePrompt(remoteWorkspace.workspace.preferences.autoRecyclePrompt);
          setUserWritingStylePrompt(remoteWorkspace.workspace.preferences.userWritingStylePrompt);
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
    const updated = ensureAutoRecyclePosts(posts, {
      enabled: autoRecycleEnabled,
      delayDays: autoRecycleDelayDays,
      minLikes: autoRecycleMinLikes,
    });
    if (JSON.stringify(updated) === JSON.stringify(posts)) return;
    setPosts(updated);
    saveLinkedInPosts(updated);
    void persistRemoteLinkedInPosts(updated, true);
  }, [autoRecycleDelayDays, autoRecycleEnabled, autoRecycleMinLikes, posts]);

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

  const autoRecyclePosts = posts.filter((post) => Boolean(post.analytics?.autoRecycleSourcePostId));
  const filteredPosts = posts
    .filter((post) => post.type !== "carousel")
    .filter((post) => postsView === "auto" ? Boolean(post.analytics?.autoRecycleSourcePostId) : post.status === postsView && !post.analytics?.autoRecycleSourcePostId)
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
      case "idea": sourceContent = selectedIdea ? `${selectedIdea.title}\n\n${selectedIdea.description}${manualIdea.trim() ? `\n\nPrecisions:\n${manualIdea}` : ""}` : manualIdea; sourceTitle = selectedIdea?.title ?? ""; break;
      case "url": case "youtube": sourceContent = [scrapedContent || sourceInput, sourceContext.trim() ? `Contexte ajoute:\n${sourceContext.trim()}` : ""].filter(Boolean).join("\n\n"); sourceTitle = scrapedTitle; break;
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
          businessContext: currentSettings.businessContext,
          postSystemPrompt: currentSettings.postSystemPrompt,
          userWritingStylePrompt: currentSettings.userWritingStylePrompt || userWritingStylePrompt,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.type === "carousel" && data.slides) {
          setGeneratedSlides(normalizeCarouselSlideCounters(data.slides));
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
    if (rightEditorVisible && editingPostId) {
      persistPostDraft();
    }
    setEditingPostId(null);
    setDraftTitle("");
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
    setEditorChat([]);
    setEditorSnapshots([]);
    setEditorPanelMode("conversation");
    setChatInput("");
    setSelectedChatText("");
    setChatActionsOpen(false);
    setSelectedChatCommandId("");
    setPostCopied(false);
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
    setDraftTitle(post.title ?? "");
    setPostType(post.type);
    setSourceTab(post.sourceType === "idea" || post.sourceType === "manual" || post.sourceType === "url" || post.sourceType === "youtube" ? post.sourceType : "manual");
    setSelectedStyleId(post.styleId ?? "");
    setGeneratedContent(post.type === "carousel" ? "" : post.content);
    setGeneratedSlides(post.type === "carousel" ? normalizeCarouselSlideCounters(post.slides ?? post.content.split("\n\n---\n\n")) : []);
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
    setEditorHistory(post.editorHistory ?? []);
    setEditorChat(post.editorChat ?? []);
    setEditorSnapshots(post.editorSnapshots ?? []);
    setEditorPanelMode("conversation");
    setChatInput("");
    setSelectedChatText("");
    setChatActionsOpen(false);
    setSelectedChatCommandId("");
    setPostCopied(false);
    setHoveredDraftImage(false);
  }

  function startManualPost() {
    setNewPostTitle("");
    setNewPostSourceTab("manual");
    setNewPostSourceValue("");
    setNewPostSourceContext("");
    setNewPostIdeaId("");
    setNewPostStyleId(selectedStyleId || styles[0]?.id || "");
    setNewPostFormat("text");
    setCreatePostOverlayOpen(true);
  }

  function pushEditorHistory(entry: { label: string; before: string; after: string }) {
    setEditorHistory((current) => [
      { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...entry },
      ...current,
    ].slice(0, 30));
  }

  function pushEditorChat(role: "user" | "assistant" | "system", content: string) {
    setEditorChat((current) => [
      ...current,
      { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() },
    ].slice(-80));
  }

  function upsertPostsAndSync(nextPosts: LinkedInPost[]) {
    const normalized = normalizePosts(nextPosts);
    setPosts(normalized);
    saveLinkedInPosts(normalized);
    void persistRemoteLinkedInPosts(normalized, true);
    return normalized;
  }

  function createOrUpdateCarouselDraft(slides: string[], patch?: Partial<LinkedInPost>) {
    if (slides.length === 0) return null;
    const selectedStyle = styles.find((style) => style.id === carouselDraftCategory || style.id === selectedStyleId);
    const postId = editingPostId ?? crypto.randomUUID();
    const existingPost = posts.find((post) => post.id === postId);
    const nextPost: LinkedInPost = {
      ...(existingPost ?? {
        id: postId,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
        impressions: 0,
        status: "draft",
        tags: selectedStyle ? [selectedStyle.name, selectedStyle.category] : [],
        sourceType: "manual",
        type: "carousel",
        content: "",
      }),
      title: carouselDraftName.trim() || existingPost?.title || "Carrousel",
      content: slides.join("\n\n---\n\n"),
      type: "carousel",
      slides,
      sourceType: carouselSourceTab || existingPost?.sourceType || "manual",
      sourceUrl: ["url", "youtube"].includes(carouselSourceTab) ? carouselSourceValue.trim() || existingPost?.sourceUrl : existingPost?.sourceUrl,
      sourceTitle: carouselDraftName.trim() || existingPost?.sourceTitle || "Carrousel",
      styleId: selectedStyle?.id || existingPost?.styleId,
      styleName: selectedStyle?.name || existingPost?.styleName,
      analytics: normalizeAnalytics({
        ...existingPost?.analytics,
        format: "carousel",
      }),
      editorHistory,
      editorChat: carouselGenerationChat.map((entry) => ({
        id: entry.id,
        role: entry.role,
        content: entry.content,
        createdAt: "createdAt" in entry && typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
      })),
      editorSnapshots,
      ...patch,
    };
    upsertPostsAndSync(existingPost ? posts.map((post) => post.id === postId ? nextPost : post) : [nextPost, ...posts]);
    if (!editingPostId) setEditingPostId(postId);
    return nextPost;
  }

  function createEditorSnapshot() {
    if (!generatedContent.trim()) return;
    const defaultLabel = `Sauvegarde ${editorSnapshots.length + 1}`;
    const label = window.prompt("Nom de la sauvegarde", defaultLabel)?.trim();
    if (!label) return;
    setEditorSnapshots((current) => [
      {
        id: crypto.randomUUID(),
        label,
        content: generatedContent,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    setEditorPanelMode("history");
  }

  function renameEditorSnapshot(snapshot: EditorSnapshot) {
    const label = window.prompt("Renommer la sauvegarde", snapshot.label)?.trim();
    if (!label) return;
    setEditorSnapshots((current) =>
      current.map((entry) =>
        entry.id === snapshot.id ? { ...entry, label, updatedAt: new Date().toISOString() } : entry
      )
    );
  }

  function restoreEditorSnapshot(snapshot: EditorSnapshot) {
    const before = generatedContent;
    setGeneratedContent(snapshot.content);
    pushEditorHistory({ label: `Retour a ${snapshot.label}`, before, after: snapshot.content });
  }

  function deleteEditorSnapshot(snapshotId: string) {
    setEditorSnapshots((current) => current.filter((entry) => entry.id !== snapshotId));
  }

  function persistPostDraft(nextPatch?: Partial<LinkedInPost>) {
    const content = postType === "carousel" ? generatedSlides.join("\n\n---\n\n") : generatedContent;
    const selectedStyle = styles.find((style) => style.id === selectedStyleId);
    const existingPost = editingPostId ? posts.find((post) => post.id === editingPostId) : null;
    if (!existingPost && !content.trim() && !draftTitle.trim()) return;
    const postId = existingPost?.id ?? editingPostId;
    if (!postId) return;
    const nextPost: LinkedInPost = {
      ...(existingPost ?? {
        id: postId,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
        impressions: 0,
        status: "draft",
        tags: [],
        sourceType: sourceTab,
        type: postType,
        content: "",
      }),
      title: draftTitle.trim() || existingPost?.title,
      content,
      type: postType,
      slides: postType === "carousel" ? generatedSlides : undefined,
      sourceType: sourceTab,
      sourceUrl: ["url", "youtube"].includes(sourceTab) ? sourceInput : undefined,
      sourceTitle: scrapedTitle || existingPost?.sourceTitle,
      styleId: selectedStyleId || undefined,
      styleName: selectedStyle?.name,
      analytics: normalizeAnalytics({
        ...existingPost?.analytics,
        format: postType === "carousel" ? "carousel" : selectedPostFormat || existingPost?.analytics?.format || "text",
        mediaPreviewUrl: draftMedia?.url ?? existingPost?.analytics?.mediaPreviewUrl,
        mediaPreviewKind: draftMedia?.kind ?? existingPost?.analytics?.mediaPreviewKind,
        mediaFileName: draftMedia?.fileName ?? existingPost?.analytics?.mediaFileName,
        mediaStorageBytes: draftMedia?.bytes ?? existingPost?.analytics?.mediaStorageBytes,
      }),
      editorHistory,
      editorChat: postType === "carousel"
        ? carouselGenerationChat.map((entry) => ({ ...entry, createdAt: new Date().toISOString() }))
        : editorChat,
      editorSnapshots,
      ...nextPatch,
    };
    const updated = normalizePosts(existingPost ? posts.map((post) => post.id === postId ? nextPost : post) : [nextPost, ...posts]);
    setPosts(updated);
    saveLinkedInPosts(updated);
    void persistRemoteLinkedInPosts(updated, true);
  }

  function createManualDraft() {
    const title = newPostTitle.trim() || "Nouveau brouillon";
    const id = crypto.randomUUID();
    const selectedStyle = styles.find((style) => style.id === newPostStyleId);
    const selectedIdea = ideas.find((idea) => idea.id === newPostIdeaId);
    const sourceDetails = (() => {
      if (newPostSourceTab === "manual") return newPostSourceValue.trim();
      if (newPostSourceTab === "idea") {
        return [
          selectedIdea ? `${selectedIdea.title}\n\n${selectedIdea.description}` : "",
          newPostSourceContext.trim() ? `Contexte ajoute:\n${newPostSourceContext.trim()}` : "",
        ].filter(Boolean).join("\n\n");
      }
      return [
        newPostSourceValue.trim() ? `URL: ${newPostSourceValue.trim()}` : "",
        newPostSourceContext.trim() ? `Contexte ajoute:\n${newPostSourceContext.trim()}` : "",
      ].filter(Boolean).join("\n\n");
    })();
    const nextPost: LinkedInPost = normalizePosts([{
      id,
      title,
      content: newPostSourceTab === "manual" ? newPostSourceValue.trim() : "",
      type: "post",
      sourceType: newPostSourceTab,
      sourceUrl: ["url", "youtube"].includes(newPostSourceTab) ? newPostSourceValue.trim() || undefined : undefined,
      sourceTitle: selectedIdea?.title || title,
      styleId: newPostStyleId || undefined,
      styleName: selectedStyle?.name,
      scheduledAt: undefined,
      publishedAt: undefined,
      likes: 0,
      comments: 0,
      impressions: 0,
      analytics: normalizeAnalytics({
        format: newPostFormat,
      }),
      status: "draft",
      tags: selectedStyle ? [selectedStyle.name, selectedStyle.category] : [],
      createdAt: new Date().toISOString(),
      editorHistory: [],
      editorChat: [{
        id: crypto.randomUUID(),
        role: "system",
        content: [`Brouillon cree depuis ${newPostSourceTab === "manual" ? "Libre" : newPostSourceTab === "idea" ? "Idee" : newPostSourceTab.toUpperCase()}.`, sourceDetails ? `Source:\n${sourceDetails}` : ""].filter(Boolean).join("\n\n"),
        createdAt: new Date().toISOString(),
      }],
      editorSnapshots: [],
    }])[0];
    const updated = normalizePosts([nextPost, ...posts]);
    setPosts(updated);
    saveLinkedInPosts(updated);
    void persistRemoteLinkedInPosts(updated, true);
    setCreatePostOverlayOpen(false);
    openPostForEdit(nextPost);
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
      description: "Template de slide a connecter ensuite a une frame Figma.",
      pagePrompt: `Genere une slide "${name}" claire, visuelle et concise. Decris precisement le role de chaque champ, les textes attendus, les options activables ou desactivables, et la logique de mise en page pour que la slide soit directement exploitable.`,
      imagePrompt: `Decris l'image attendue pour "${name}" de maniere tres precise afin qu'un modele image puisse la generer proprement.`,
      fields: [
        {
          id: crypto.randomUUID(),
          label: "Titre principal",
          kind: "text",
          required: true,
          aiPrompt: "Genere un titre court, clair et tres impactant.",
        },
        {
          id: crypto.randomUUID(),
          label: "Texte court",
          kind: "text",
          required: true,
          aiPrompt: "Genere un texte de slide en 1 a 2 phrases.",
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
          aiPrompt: kind === "image" ? "Decris l'image attendue pour cette zone." : "Explique comment remplir ce texte.",
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
      description: "Regroupement de pages utilise par l'IA pour composer un carrousel.",
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
    if (carouselGenerationTemplateId === templateId) setCarouselGenerationTemplateId(nextTemplates[0]?.id ?? "");
    setCarouselTemplateMenu(null);
  }

  function startRenameCarouselTemplate(templateId: string) {
    const template = carouselTemplates.find((entry) => entry.id === templateId);
    if (!template) return;
    setRenamingCarouselTemplateId(templateId);
    setRenamingCarouselTemplateName(template.name);
    setCarouselTemplateMenu(null);
  }

  function commitRenameCarouselTemplate() {
    const name = renamingCarouselTemplateName.trim();
    if (renamingCarouselTemplateId && name) {
      updateCarouselTemplate(renamingCarouselTemplateId, { name });
    }
    setRenamingCarouselTemplateId("");
    setRenamingCarouselTemplateName("");
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
      setGeneratedSlides(buildCarouselSlidesFromTemplate(nextTemplate, carouselGenerationPrompt, {}));
    }
  }

  function updateCarouselTemplateItemField(templateId: string, itemId: string, fieldId: string, value: string) {
    const item = carouselTemplates.find((template) => template.id === templateId)?.items.find((entry) => entry.id === itemId);
    const current = decodeCarouselTemplateItemMeta(item?.label);
    updateCarouselTemplateItemMeta(templateId, itemId, {
      fields: {
        ...(current.fields ?? {}),
        [fieldId]: value,
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
        description: "Page libre ajoutee manuellement, ignoree par l'IA.",
        fields: [],
        pagePrompt: "",
        imagePrompt: "",
        createdAt: "",
      };
    }
    return carouselPageTemplates.find((entry) => entry.id === pageTemplateId) ?? null;
  }

  function buildCarouselSlidesFromTemplate(template: LinkedInCarouselTemplate, prompt: string, aiPoints?: Record<string, string[]>, generateImagesWithAI = false, imageAssets: CarouselImageAsset[] = []) {
    let stepIndex = 0;
    let bluePointIndex = 0;
    let redPointIndex = 0;
    let imageAssetIndex = 0;
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
      const isRepeatAi = item.mode === "repeat_ai";
      // Pour les arguments en mode repeat_ai, utiliser les points generes par l'IA
      const aiSectionKey = `SECTION_${itemIndex + 1}`;
      const aiGeneratedPoints = (isRepeatAi && aiPoints?.[aiSectionKey]) || [];
      const dynamicPoints = isRepeatAi ? (aiGeneratedPoints.length > 0 ? aiGeneratedPoints : instructionPoints) : [];
      const count = dynamicPoints.length > 0 ? dynamicPoints.length : isRepeatAi ? 3 : 1;
      return Array.from({ length: count }).map((_, repeatIndex) => {
        const pointText = dynamicPoints[repeatIndex] ?? prompt;
        if (kind === "step") { stepIndex += 1; bluePointIndex = 0; redPointIndex = 0; }
        if (kind === "why-design") { stepIndex = 0; bluePointIndex = 0; redPointIndex = 0; }
        if (kind === "argument-blue") bluePointIndex += 1;
        if (kind === "argument-red") redPointIndex += 1;
        const nextAsset = imageAssets[imageAssetIndex];
        const shouldUseAsset = Boolean(nextAsset) && (kind === "image" || isArgument);
        if (shouldUseAsset) imageAssetIndex += 1;
        const assetDescription = nextAsset ? [nextAsset.description, nextAsset.fileName].filter(Boolean).join(" - ") : "";
        const payload: CarouselSlidePayload = {
          kind,
          label: page.name,
          stepNumber: kind === "step" ? stepIndex : undefined,
          pointNumber: kind === "argument-blue" ? bluePointIndex : kind === "argument-red" ? redPointIndex : undefined,
          title: kind === "avis" ? getField("avis-title") : isArgument ? (pointText || getField("arg-title")) : getField("step-title"),
          subtitle: isArgument ? getField("arg-subtitle", pointText) : getField("context-subtitle"),
          body: kind === "why-design" ? getField("why-text") : pointText,
          result: getField("arg-result"),
          showResult: isEnabled(getField("arg-result-enabled", "oui")),
          showStepCta: isEnabled(getField("context-step-enabled", "oui")),
          stepCtaText: getField("context-step-text", "Voici les 3 etapes pour y remedier"),
          imageMode: getField("arg-image-mode", "frame") === "full" ? "full" : "frame",
          imageSource: generateImagesWithAI || isEnabled(getField("arg-image-source", "non")) ? "ai" : "manual",
          imageUrl: shouldUseAsset ? nextAsset.url : kind === "image" ? getField("image-src") : getField("arg-image"),
          imageDescription: shouldUseAsset ? assetDescription : undefined,
          beforeImage: kind === "avis" ? getField("avis-image-1") : getField("before-image"),
          afterImage: kind === "avis" ? getField("avis-image-2") : getField("after-image"),
          backgroundImage1: getField("cta-bg-1"),
          backgroundImage2: getField("cta-bg-2"),
        };
        return encodeCarouselSlide(payload);
      });
    });
    return normalizeCarouselSlideCounters(slides);
  }

  async function startCarouselGeneration(template?: LinkedInCarouselTemplate) {
    if (!carouselDraftName.trim() || !carouselDraftCategory) return;
    const selectedTemplate = carouselUseTemplate
      ? template ?? carouselTemplates.find((entry) => entry.id === carouselGenerationTemplateId || entry.id === selectedCarouselTemplateId) ?? carouselTemplates[0]
      : null;
    if (carouselUseTemplate && !selectedTemplate) return;
    let selected = selectedTemplate;
    setGenerationError("");
    let sourcePrompt = "";
    try {
      sourcePrompt = await resolveCarouselGenerationSource();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Source impossible a recuperer.");
      return;
    }
    const effectivePrompt = sourcePrompt.trim() || carouselDraftName.trim();
    if (!selected) {
      setCarouselGenerationPhase("Choix de la structure du carrousel");
      setGenerating(true);
      selected = await generateCarouselTemplatePlanWithAI(effectivePrompt, carouselImageAssets);
      setGenerating(false);
    }
    if (selected) {
      setCarouselStudioMode("generate");
      setCarouselStudioTab("editor");
      setPostType("carousel");
      setSelectedStyleId(carouselDraftCategory);
      setManualEditorStarted(true);
      setEditingPostId(null);
      setShowCarouselTemplatePicker(false);
      setCarouselGenerationTemplateId(selected.id);
      if (selected.id !== AI_CAROUSEL_TEMPLATE_ID) setSelectedCarouselTemplateId(selected.id);

      const hasRepeatAi = selected.items.some((item) => {
        const page = resolveCarouselPage(item.pageTemplateId);
        const kind = getSlideKind(page?.id ?? "");
        return item.mode === "repeat_ai" && (kind === "argument-blue" || kind === "argument-red");
      });

      let aiPoints: Record<string, string[]> = {};
      if (hasRepeatAi && effectivePrompt) {
        setCarouselGenerationPhase("Creation des points dynamiques");
        setGenerating(true);
        aiPoints = await generateArgumentPointsWithAI(selected, effectivePrompt);
        setGenerating(false);
      }

      setCarouselGenerationPhase("Redaction des champs de chaque slide");
      setGenerating(true);
      const aiSlides = await generateCarouselSlidesContentWithAI(selected, effectivePrompt, carouselImageAssets);
      setGenerating(false);
      const fallbackSlides = buildCarouselSlidesFromTemplate(selected, effectivePrompt, aiPoints, carouselGenerateImagesWithAI, carouselImageAssets);
      const slides = aiSlides?.length ? aiSlides : fallbackSlides;
      setGeneratedSlides(slides);
      setActiveSlide(0);
      createOrUpdateCarouselDraft(slides, { editorChat: [] });
      setCarouselGenerationHistory([{ id: crypto.randomUUID(), label: "Version initiale", slides, createdAt: new Date().toISOString() }]);
      setCarouselGenerationChat([]);
      setCarouselChatTargetSlides([]);
      setCarouselChatTargetField("");
      setCarouselGenerationPrompt("");
      setCarouselGenerateImagesWithAI(false);
      setCarouselUseTemplate(true);
      setCarouselGenerationPhase("");
      setCarouselCreateStep("setup");
      setCarouselSourceTab("idea");
      setCarouselSourceIdeaId("");
      setCarouselSourceValue("");
      setCarouselSourceContext("");
      setCarouselImageAssets([]);
      setCarouselAssetsDragActive(false);
    }
  }

  function updateGeneratedCarouselSlide(
    index: number,
    updater: (payload: CarouselSlidePayload) => CarouselSlidePayload
  ) {
    setGeneratedSlides((current) =>
      normalizeCarouselSlideCounters(current.map((slide, slideIndex) => {
        if (slideIndex !== index) return slide;
        const payload = decodeCarouselSlide(slide) ?? { kind: "free" as CarouselSlideKind, label: "Libre", body: "" };
        return encodeCarouselSlide(updater(payload));
      }))
    );
  }

  function createGeneratedCarouselSlide(pageId: string) {
    const page = resolveCarouselPage(pageId);
    if (!page) return encodeCarouselSlide({ kind: "free", label: "Libre", body: "" });
    return encodeCarouselSlide(getCarouselPreviewPayload(page, null));
  }

  function addGeneratedCarouselSlide(pageId: string) {
    const slide = createGeneratedCarouselSlide(pageId);
    setGeneratedSlides((current) => {
      const insertAfter = current.length === 0 ? -1 : Math.max(0, Math.min(activeSlide, current.length - 1));
      const next = [...current.slice(0, insertAfter + 1), slide, ...current.slice(insertAfter + 1)];
      return normalizeCarouselSlideCounters(next);
    });
    setActiveSlide((current) => Math.max(0, Math.min(current + 1, generatedSlides.length)));
    setShowGeneratedSlidePagePicker(false);
  }

  function removeGeneratedCarouselSlide(index: number) {
    setGeneratedSlides((current) => {
      if (current.length <= 1) return current;
      const safeIndex = Math.max(0, Math.min(index, current.length - 1));
      const next = current.filter((_, slideIndex) => slideIndex !== safeIndex);
      return normalizeCarouselSlideCounters(next);
    });
    setActiveSlide((current) => Math.max(0, Math.min(current > 0 ? current - 1 : 0, generatedSlides.length - 2)));
    setShowGeneratedSlidePagePicker(false);
  }

  function moveGeneratedCarouselSlide(index: number, direction: -1 | 1) {
    setGeneratedSlides((current) => {
      const safeIndex = Math.max(0, Math.min(index, current.length - 1));
      const targetIndex = safeIndex + direction;
      if (targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      [next[safeIndex], next[targetIndex]] = [next[targetIndex], next[safeIndex]];
      return normalizeCarouselSlideCounters(next);
    });
    setActiveSlide((current) => Math.max(0, Math.min(current + direction, generatedSlides.length - 1)));
    setShowGeneratedSlidePagePicker(false);
  }

  function resetCarouselCreateState() {
    setCarouselDraftName("");
    setCarouselDraftCategory("");
    setCarouselGenerationPrompt("");
    setSelectedCarouselTemplateItemId("");
    setCarouselChatTargetSlides([]);
    setCarouselChatTargetField("");
    setCarouselTargetPickerOpen(false);
    setCarouselFieldPickerOpen(false);
    setCarouselCommandPickerOpen(false);
    setShowCarouselHistory(false);
    setShowGeneratedSlidePagePicker(false);
    setCarouselCreateStep("setup");
    setCarouselGenerateImagesWithAI(false);
    setCarouselUseTemplate(true);
    setCarouselSourceTab("idea");
    setCarouselSourceIdeaId("");
    setCarouselSourceValue("");
    setCarouselSourceContext("");
    setCarouselSourceLoading(false);
    setCarouselImageAssets([]);
    setCarouselAssetsDragActive(false);
  }

  function getCarouselEditableFields(payload: CarouselSlidePayload | null): Array<{ key: keyof CarouselSlidePayload; label: string; value: string }> {
    if (!payload) return [];
    const fieldsByKind: Partial<Record<CarouselSlideKind, Array<{ key: keyof CarouselSlidePayload; label: string }>>> = {
      context: [
        { key: "subtitle", label: "Texte" },
        { key: "stepCtaText", label: "Texte du bouton noir" },
      ],
      step: [{ key: "title", label: "Texte de l'etape" }],
      "argument-blue": [
        { key: "title", label: "Titre" },
        { key: "subtitle", label: "Texte" },
        { key: "result", label: "Resultat" },
        { key: "showPointNumber", label: "Afficher le numero" },
      ],
      "argument-red": [
        { key: "title", label: "Titre" },
        { key: "subtitle", label: "Texte" },
        { key: "result", label: "Resultat" },
        { key: "showPointNumber", label: "Afficher le numero" },
      ],
      "why-design": [{ key: "body", label: "Texte" }],
      free: [{ key: "body", label: "Texte libre" }],
    };
    return (fieldsByKind[payload.kind] ?? [])
      .map((field) => ({ ...field, value: String(payload[field.key] ?? "") }))
      .filter((field) => field.value.trim().length > 0 || ["title", "subtitle", "body"].includes(field.key));
  }

  function getCarouselSlideText(payload: CarouselSlidePayload | null) {
    if (!payload) return "";
    return getCarouselEditableFields(payload)
      .map((field) => `${field.label}: ${field.value}`)
      .join("\n");
  }

  function updateCarouselPayloadField(payload: CarouselSlidePayload, field: keyof CarouselSlidePayload, value: string): CarouselSlidePayload {
    return { ...payload, [field]: value };
  }

  function cleanCarouselAiText(value: string) {
    return value
      .split("\n")
      .map((line) => line.replace(/^\s*(slide\s*\d+\s*[-:]\s*)?(titre|texte|corps|resultat|cta|sous-titre|sous titre)\s*:\s*/i, "").trimEnd())
      .join("\n")
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/[—–]/g, "-")
      .trim();
  }

  function getAiSlideString(slide: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = slide[key];
      if (typeof value === "string" && value.trim()) return cleanCarouselAiText(value);
    }
    return "";
  }

  function toggleCarouselTargetSlide(index: number) {
    setCarouselChatTargetSlides((current) => {
      const next = current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort((a, b) => a - b);
      if (next.length !== 1) setCarouselChatTargetField("");
      return next;
    });
  }

  function buildCarouselGlobalPrompt(template: LinkedInCarouselTemplate) {
    return template.items.map((item, index) => {
      const page = resolveCarouselPage(item.pageTemplateId);
      if (!page) return "";
      const meta = decodeCarouselTemplateItemMeta(item.label);
      const pagePrompt = (meta.pagePrompt || page.pagePrompt || "").trim();
      const imagePrompt = (meta.imagePrompt || page.imagePrompt || "").trim();
      if (!pagePrompt && !imagePrompt && page.fields.every((field) => !field.aiPrompt?.trim())) return "";
      const fieldLines = page.fields
        .filter((field) => field.kind === "text")
        .map((field) => {
          const value = getCarouselTemplateItemField(item, page, field.id, field.defaultValue || "");
          const aiPrompt = field.aiPrompt?.trim();
          return value || aiPrompt ? `  - **${field.label}**${value ? `: ${value}` : ""}${aiPrompt ? `\n    - Prompt champ: ${aiPrompt}` : ""}` : "";
        })
        .filter(Boolean);
      const sections = [
        `## Page ${index + 1} - ${page.name}`,
        item.mode === "repeat_ai" ? "- **Mode generation**: repeter cette page avec l'IA. Genere plusieurs slides distinctes pour cette section, sans repetition d'idee, d'angle ou de formulation." : "- **Mode generation**: une seule slide.",
        pagePrompt ? `- **Prompt page**: ${pagePrompt}` : "",
        imagePrompt ? `- **Prompt image**: ${imagePrompt}` : "",
        fieldLines.length ? `- **Champs**:\n${fieldLines.join("\n")}` : "",
      ].filter(Boolean);
      return sections.length > 1 ? sections.join("\n") : "";
    }).filter(Boolean).join("\n\n---\n\n");
  }

  function getCarouselFieldConstraint(payload: CarouselSlidePayload | null, field: keyof CarouselSlidePayload) {
    if (!payload) return "";
    if ((payload.kind === "argument-blue" || payload.kind === "argument-red") && field === "title") {
      return "Maximum strict: 19 caracteres. Ne jamais ajouter de points de suspension.";
    }
    if ((payload.kind === "argument-blue" || payload.kind === "argument-red") && field === "subtitle") {
      return "Maximum strict: 105 caracteres, 3 lignes maximum.";
    }
    if (payload.kind === "context" && field === "stepCtaText") {
      return "Bouton noir: texte court, fit-content, maximum visuel 437px.";
    }
    return "";
  }

  function getCarouselChatFields(payload: CarouselSlidePayload | null) {
    if (!payload) return [];
    const fieldDefs: Array<{ field: keyof CarouselSlidePayload; label: string; value: unknown }> = [
      { field: "title", label: "Titre", value: payload.title },
      { field: "subtitle", label: "Texte / sous-titre", value: payload.subtitle },
      { field: "body", label: "Texte principal", value: payload.body },
      { field: "result", label: "Texte resultat", value: payload.result },
      { field: "showResult", label: "Afficher le resultat", value: payload.showResult },
      { field: "showCheck", label: "Afficher le check / croix", value: payload.showCheck },
      { field: "showStepCta", label: "Afficher le bouton noir", value: payload.showStepCta },
      { field: "stepCtaText", label: "Texte du bouton noir", value: payload.stepCtaText },
      { field: "imageMode", label: "Mode image", value: payload.imageMode },
      { field: "imageSource", label: "Source image", value: payload.imageSource },
      { field: "imageUrl", label: "Image / description image", value: payload.imageUrl },
      { field: "imageDescription", label: "Description de l'image", value: payload.imageDescription },
      { field: "beforeImage", label: "Image avant / image 1", value: payload.beforeImage },
      { field: "afterImage", label: "Image apres / image 2", value: payload.afterImage },
    ];
    return fieldDefs
      .filter((entry) => entry.value !== undefined && entry.value !== "")
      .map((entry) => ({ ...entry, constraint: getCarouselFieldConstraint(payload, entry.field) }));
  }

  function buildCarouselChatContext(slides = generatedSlides) {
    return JSON.stringify(slides.map((slide, index) => {
      const payload = decodeCarouselSlide(slide);
      return {
        slideIndex: index,
        slideNumber: index + 1,
        kind: payload?.kind,
        label: payload?.label,
        fields: getCarouselChatFields(payload).map((entry) => ({
          field: entry.field,
          label: entry.label,
          value: entry.value,
          constraint: entry.constraint,
        })),
      };
    }), null, 2);
  }

  function applyCarouselAiEdits(edits: Array<{ slideIndex?: number; field?: string; value?: unknown }>) {
    const validFields = new Set<keyof CarouselSlidePayload>(["title", "subtitle", "body", "result", "showResult", "showPointNumber", "showCheck", "showStepCta", "stepCtaText", "imageMode", "imageSource", "imageUrl", "imageDescription", "beforeImage", "afterImage"]);
    let changed = false;
    const details: string[] = [];
    const nextSlides = generatedSlides.map((slide, index) => {
      const payload = decodeCarouselSlide(slide);
      if (!payload) return slide;
      let nextPayload = payload;
      edits.filter((edit) => edit.slideIndex === index && validFields.has(edit.field as keyof CarouselSlidePayload)).forEach((edit) => {
        const field = edit.field as keyof CarouselSlidePayload;
        const value = edit.value;
        if (typeof value === "undefined") return;
        const beforeValue = nextPayload[field];
        if (field === "showResult" || field === "showPointNumber" || field === "showCheck" || field === "showStepCta") {
          const nextValue = Boolean(value);
          if (beforeValue !== nextValue) {
            changed = true;
            details.push(`Slide ${index + 1} - ${String(field)}: ${String(beforeValue ?? "")} -> ${String(nextValue)}`);
            nextPayload = { ...nextPayload, [field]: nextValue };
          }
          return;
        }
        if (field === "imageMode") {
          const nextValue = value === "full" ? "full" : "frame";
          if (beforeValue !== nextValue) {
            changed = true;
            details.push(`Slide ${index + 1} - imageMode: ${String(beforeValue ?? "")} -> ${nextValue}`);
            nextPayload = { ...nextPayload, imageMode: nextValue };
          }
          return;
        }
        if (field === "imageSource") {
          const nextValue = value === "ai" ? "ai" : "manual";
          if (beforeValue !== nextValue) {
            changed = true;
            details.push(`Slide ${index + 1} - imageSource: ${String(beforeValue ?? "")} -> ${nextValue}`);
            nextPayload = { ...nextPayload, imageSource: nextValue };
          }
          return;
        }
        const nextValue = cleanCarouselAiText(String(value));
        if (String(beforeValue ?? "") !== nextValue) {
          changed = true;
          const beforePreview = String(beforeValue ?? "").replace(/\s+/g, " ").slice(0, 80);
          const afterPreview = nextValue.replace(/\s+/g, " ").slice(0, 80);
          details.push(`Slide ${index + 1} - ${String(field)}: "${beforePreview}" -> "${afterPreview}"`);
          nextPayload = updateCarouselPayloadField(nextPayload, field, nextValue);
        }
      });
      return nextPayload === payload ? slide : encodeCarouselSlide(nextPayload);
    });
    return changed ? { slides: normalizeCarouselSlideCounters(nextSlides), details } : null;
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
    const slides = buildCarouselSlidesFromTemplate(selected, "", {}, false);
    setCarouselStudioMode("generate");
    setCarouselStudioTab("editor");
    setPostType("carousel");
    setSelectedStyleId(carouselDraftCategory);
    setManualEditorStarted(true);
    setCarouselGenerationTemplateId(selected.id);
    setSelectedCarouselTemplateId(selected.id);
    setGeneratedSlides(slides);
    createOrUpdateCarouselDraft(slides, { editorChat: [] });
    setActiveSlide(0);
    setShowCarouselTemplatePicker(false);
    setCarouselGenerationChat([]);
    setCarouselGenerationHistory([]);
    setCarouselChatTargetSlides([]);
    setCarouselChatTargetField("");
  }

  function startFreeCarouselManualEditing() {
    if (!carouselDraftName.trim() || !carouselDraftCategory) return;
    const slides = normalizeCarouselSlideCounters([
      encodeCarouselSlide({ kind: "free", label: "Libre", body: "" }),
    ]);
    setCarouselStudioMode("generate");
    setCarouselStudioTab("editor");
    setPostType("carousel");
    setSelectedStyleId(carouselDraftCategory);
    setManualEditorStarted(true);
    setGeneratedSlides(slides);
    createOrUpdateCarouselDraft(slides, { editorChat: [] });
    setActiveSlide(0);
    setShowCarouselTemplatePicker(false);
    setCarouselGenerationTemplateId("");
    setSelectedCarouselTemplateId("");
    setCarouselGenerationChat([]);
    setCarouselGenerationHistory([]);
    setCarouselChatTargetSlides([]);
    setCarouselChatTargetField("");
  }

  async function resolveCarouselGenerationSource() {
    if (carouselSourceTab === "idea") {
      return carouselSourceValue.trim();
    }
    if (carouselSourceTab === "manual") return carouselSourceValue.trim();
    if (!carouselSourceValue.trim()) return "";

    setCarouselSourceLoading(true);
    try {
      setCarouselGenerationPhase(carouselSourceTab === "youtube" ? "Analyse de la video YouTube avec Gemini" : "Analyse du site avec Gemini");
      const currentSettings = settings ?? loadLinkedInSettings();
      const res = await fetch("/api/linkedin/enrich-carousel-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: carouselSourceTab,
          url: carouselSourceValue.trim(),
          context: carouselSourceContext.trim(),
          openrouterApiKey: currentSettings.openrouterApiKey || undefined,
          model: "google/gemini-2.5-pro-preview",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'enrichir la source.");
      return [data.title ? `Titre: ${data.title}` : "", data.content].filter(Boolean).join("\n\n");
    } finally {
      setCarouselSourceLoading(false);
    }
  }

  async function addCarouselImageFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;
    const previews = await Promise.all(images.map(async (file) => {
      const preview = await fileToCompressedPreview(file);
      return {
        id: crypto.randomUUID(),
        url: preview.url,
        fileName: file.name,
        description: "",
      } satisfies CarouselImageAsset;
    }));
    setCarouselImageAssets((current) => [...current, ...previews]);
    setCarouselAssetsDragActive(false);
  }

  async function addChatImageFiles(files: FileList | File[]) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return;
    const previews = await Promise.all(images.slice(0, 4).map(async (file) => {
      const preview = await fileToCompressedPreview(file);
      return {
        id: crypto.randomUUID(),
        url: preview.url,
        fileName: file.name,
        description: "",
      } satisfies CarouselImageAsset;
    }));
    setChatImageAttachments((current) => [...current, ...previews].slice(-4));
  }

  function updateCarouselImageAsset(assetId: string, patch: Partial<CarouselImageAsset>) {
    setCarouselImageAssets((current) => current.map((asset) => asset.id === assetId ? { ...asset, ...patch } : asset));
  }

  function removeCarouselImageAsset(assetId: string) {
    setCarouselImageAssets((current) => current.filter((asset) => asset.id !== assetId));
  }

  function buildCarouselImageAssetsPrompt(assets = carouselImageAssets) {
    if (assets.length === 0) return "Aucune photo importee.";
    return assets.map((asset, index) => [
      `Asset ${index + 1}`,
      `- id: ${asset.id}`,
      `- fichier: ${asset.fileName}`,
      asset.description.trim() ? `- description: ${asset.description.trim()}` : "- description: non renseignee",
    ].join("\n")).join("\n\n");
  }

  async function generateCarouselTemplatePlanWithAI(sourcePrompt: string, imageAssets: CarouselImageAsset[] = []): Promise<LinkedInCarouselTemplate> {
    const currentSettings = settings ?? loadLinkedInSettings();
    const apiKey = currentSettings.openrouterApiKey?.trim() || "";
    const fallbackKinds: Array<{ kind: CarouselSlideKind; mode: "single" | "repeat_ai" }> = [
      { kind: "image", mode: "single" },
      { kind: "context", mode: "single" },
      { kind: "argument-blue", mode: "repeat_ai" },
      { kind: "why-design", mode: "single" },
      { kind: "cta", mode: "single" },
    ];

    const buildTemplate = (items: Array<{ kind?: string; mode?: string }>) => {
      const allowed = new Set<CarouselSlideKind>(["image", "context", "step", "argument-blue", "argument-red", "why-design", "cta", "free"]);
      const cleaned = items
        .map((item) => ({
          kind: item.kind as CarouselSlideKind,
          mode: item.mode === "repeat_ai" ? "repeat_ai" as const : "single" as const,
        }))
        .filter((item) => allowed.has(item.kind) && item.kind !== "avis" && item.kind !== "before-after")
        .slice(0, 8);
      const sequence = cleaned.length >= 3 ? cleaned : fallbackKinds;
      const normalized = [
        { kind: "image" as CarouselSlideKind, mode: "single" as const },
        ...sequence.filter((item) => item.kind !== "image" && item.kind !== "cta"),
        { kind: "cta" as CarouselSlideKind, mode: "single" as const },
      ].slice(0, 10);

      return {
        id: AI_CAROUSEL_TEMPLATE_ID,
        name: "Template IA automatique",
        description: "Sequence generee automatiquement par l'IA.",
        createdAt: new Date().toISOString(),
        items: normalized.map((item) => ({
          id: crypto.randomUUID(),
          pageTemplateId: `${SLIDE_KIND_PREFIX}${item.kind}`,
          mode: item.kind === "argument-blue" || item.kind === "argument-red" ? item.mode : "single",
        })),
      };
    };

    if (!apiKey) return buildTemplate(fallbackKinds);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://agenceflow.app",
          "X-Title": "AgenceFlow LinkedIn",
        },
        body: JSON.stringify({
          model: currentSettings.carouselContentModel || currentSettings.model,
          messages: [
            {
              role: "system",
              content: [
                currentSettings.carouselSkillPrompt?.trim() ? `Skill stable:\n${currentSettings.carouselSkillPrompt.trim()}` : "",
                `Tu choisis une structure de carrousel LinkedIn. Reponds uniquement en JSON valide: {"items":[{"kind":"image","mode":"single"},{"kind":"context","mode":"single"}]}. Kinds autorises: image, context, step, argument-blue, argument-red, why-design, cta. Interdits: avis, before-after. La premiere slide doit toujours etre image. La derniere slide doit toujours etre cta. Utilise repeat_ai uniquement sur argument-blue ou argument-red quand une section doit produire plusieurs slides. Maximum 8 items avant normalisation. Si des photos sont importees, prevois assez de slides image ou argument pour les placer naturellement, sans forcer toutes les photos si elles ne servent pas le propos.`,
              ].filter(Boolean).join("\n\n"),
            },
            {
              role: "user",
              content: `Sujet/source du carrousel:\n${sourcePrompt}\n\nPhotos importees:\n${buildCarouselImageAssetsPrompt(imageAssets)}`,
            },
          ],
          temperature: 0.35,
          max_tokens: 900,
        }),
      });
      if (!res.ok) return buildTemplate(fallbackKinds);
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return buildTemplate(fallbackKinds);
      const parsed = JSON.parse(jsonMatch[0]) as { items?: Array<{ kind?: string; mode?: string }> };
      return buildTemplate(Array.isArray(parsed.items) ? parsed.items : fallbackKinds);
    } catch {
      return buildTemplate(fallbackKinds);
    }
  }

  function applyImportedAssetsToSlides(slides: string[], assets = carouselImageAssets) {
    if (assets.length === 0) return slides;
    let imageAssetIndex = 0;
    return normalizeCarouselSlideCounters(slides.map((slide) => {
      const payload = decodeCarouselSlide(slide);
      if (!payload) return slide;
      const canReceiveImage = payload.kind === "image" || payload.kind === "argument-blue" || payload.kind === "argument-red";
      if (!canReceiveImage || payload.imageUrl || imageAssetIndex >= assets.length) return slide;
      const asset = assets[imageAssetIndex++];
      return encodeCarouselSlide({
        ...payload,
        imageUrl: asset.url,
        imageDescription: [asset.description, asset.fileName].filter(Boolean).join(" - "),
        imageSource: "manual",
      });
    }));
  }

  async function generateCarouselSlidesContentWithAI(template: LinkedInCarouselTemplate, sourcePrompt: string, imageAssets: CarouselImageAsset[] = []) {
    const currentSettings = settings ?? loadLinkedInSettings();
    const apiKey = currentSettings.openrouterApiKey?.trim() || "";
    if (!apiKey) return null;

    const style = styles.find((entry) => entry.id === carouselDraftCategory || entry.id === selectedStyleId);
    const templateSchema = template.items.map((item, index) => {
      const page = resolveCarouselPage(item.pageTemplateId);
      const kind = getSlideKind(page?.id ?? "");
      const meta = decodeCarouselTemplateItemMeta(item.label);
      const pagePrompt = meta.pagePrompt || page?.pagePrompt || "";
      const imagePrompt = meta.imagePrompt || page?.imagePrompt || "";
      const aiPageName = kind === "why-design"
        ? "Carre bleu avec fleche"
        : kind === "step"
        ? "Slide etape numerotee"
        : page?.name || kind || "Page";
      const fields = (page?.fields ?? []).map((field) => ({
        id: field.id,
        label: field.label,
        kind: field.kind,
        required: field.required,
        aiPrompt: field.aiPrompt,
        defaultValue: getCarouselTemplateItemField(item, page, field.id, field.defaultValue || ""),
      }));
      const payloadFields = (() => {
        if (kind === "context") return [
          { field: "subtitle", meaning: "texte principal de contexte, sans modifier le label Contexte", maxLength: "environ 220 caracteres" },
          { field: "showStepCta", meaning: "true si le bouton noir doit apparaitre" },
          { field: "stepCtaText", meaning: "texte court du bouton noir si showStepCta=true" },
        ];
        if (kind === "step") return [
          { field: "title", aliasesAccepted: ["stepTitle", "step-title", "texteEtape", "text"], meaning: "texte du bloc bleu uniquement, sans Etape 1, sans numero", maxLength: "36 caracteres environ", example: "Creer ton avatar client" },
        ];
        if (kind === "argument-blue" || kind === "argument-red") return [
          { field: "title", meaning: "titre court dans le bandeau couleur", maxLength: "19 caracteres strict" },
          { field: "subtitle", meaning: "explication courte sous le bandeau", maxLength: "105 caracteres strict" },
          { field: "showPointNumber", meaning: "false si le numero a gauche doit etre masque" },
          { field: "showResult", meaning: "false si aucun bloc resultat n'est utile" },
          { field: "result", meaning: "texte du bloc resultat seulement si showResult=true" },
          { field: "imageDescription", meaning: "description exploitable par une IA image si aucune photo importee n'est utilisee" },
        ];
        if (kind === "why-design") return [
          { field: "body", aliasesAccepted: ["title", "text", "whyText"], meaning: "texte visible dans le carre bleu avec fleche", maxLength: "70 caracteres environ" },
        ];
        if (kind === "image") return [
          { field: "imageDescription", meaning: "description de l'image pleine page a generer ou a choisir" },
          { field: "assetIndex", meaning: "numero de photo importee a utiliser, si pertinent" },
        ];
        return [];
      })();
      return {
        templateItemIndex: index,
        pageName: aiPageName,
        kind,
        mode: item.mode,
        pagePrompt,
        imagePrompt,
        fields,
        payloadFields,
        constraints: [
          kind === "argument-blue" || kind === "argument-red" ? "title <= 19 caracteres strict, subtitle <= 105 caracteres / 3 lignes maximum." : "",
          kind === "argument-blue" || kind === "argument-red" ? "Le bloc resultat est optionnel. Si le point n'a pas besoin d'un resultat, mets showResult:false et result:\"\"." : "",
          kind === "context" ? "Le label Contexte reste fixe. Genere seulement subtitle et eventuellement stepCtaText." : "",
          kind === "step" ? "Le badge Etape 1, Etape 2, etc. est automatique. Ne l'ecris jamais dans les champs. Remplis seulement title avec le texte court affiche dans le bloc bleu, par exemple: Creer ton avatar client." : "",
          kind === "cta" ? "CTA fixe. Ne change pas le texte. Tu peux seulement decrire les images de fond si utile." : "",
          kind === "why-design" ? "Cette slide est un carre bleu avec fleche et un texte principal. Remplis uniquement body. Ne l'appelle pas pourquoi ce design fonctionne dans ta reflexion." : "",
          kind === "image" ? "Slide image: l'image doit occuper toute la slide. Genere une imageDescription si aucune photo importee n'est fournie." : "",
        ].filter(Boolean),
      };
    });

    const systemPrompt = [
      currentSettings.carouselSkillPrompt?.trim() ? `Skill carrousel:\n${currentSettings.carouselSkillPrompt.trim()}` : "",
      currentSettings.businessContext?.trim() ? `Contexte business:\n${currentSettings.businessContext.trim()}` : "",
      (currentSettings.userWritingStylePrompt || userWritingStylePrompt)?.trim() ? `Style d'ecriture utilisateur:\n${(currentSettings.userWritingStylePrompt || userWritingStylePrompt).trim()}` : "",
      style ? `Style LinkedIn choisi: ${style.name}\n${style.prompt || ""}` : "",
      "Tu generes le contenu exact des slides d'un carrousel LinkedIn.",
      "Tu dois respecter strictement le schema des pages fourni.",
      "Tu retournes uniquement un JSON valide.",
      "Ne cree pas de champs hors schema.",
      "N'utilise jamais de tiret long typographique (— ou –). Utilise un tiret simple '-' ou reformule.",
      "Si une page est en mode repeat_ai, tu peux produire plusieurs slides pour ce templateItemIndex.",
      "Si une page est en mode single, tu produis une seule slide pour ce templateItemIndex.",
      "Respecte l'ordre des templateItemIndex.",
      "Le texte doit etre directement injectable dans le rendu final.",
    ].filter(Boolean).join("\n\n");

    const userPrompt = [
      `Nom du carrousel: ${carouselDraftName.trim()}`,
      `Source/contexte complet:\n${sourcePrompt}`,
      `Schema des pages:\n${JSON.stringify(templateSchema, null, 2)}`,
      `Photos importees:\n${buildCarouselImageAssetsPrompt(imageAssets)}`,
      `Format JSON obligatoire:
{
  "slides": [
    {
      "templateItemIndex": 0,
      "kind": "context",
      "title": "",
      "subtitle": "",
      "body": "",
      "result": "",
      "showResult": true,
      "showPointNumber": true,
      "showStepCta": true,
      "stepCtaText": "",
      "imageMode": "frame",
      "imageSource": "manual|ai",
      "imageDescription": "",
      "assetIndex": 1
    }
  ]
}`,
      "assetIndex est optionnel et commence a 1. Utilise-le seulement si une photo importee doit etre placee sur cette slide.",
      "Rappel: pour les slides step, title = texte du bloc bleu uniquement, sans 'Etape 1'. Pour les slides carre bleu avec fleche, body = texte du carre bleu uniquement.",
    ].join("\n\n");

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://agenceflow.app",
          "X-Title": "AgenceFlow Carousel Slide Content",
        },
        body: JSON.stringify({
          model: currentSettings.carouselContentModel || currentSettings.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.72,
          max_tokens: 4200,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content ?? "";
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]) as { slides?: Array<Record<string, unknown>> };
      if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) return null;

      let stepIndex = 0;
      let bluePointIndex = 0;
      let redPointIndex = 0;
      const slides = parsed.slides.map((slide) => {
        const templateItemIndex = Number(slide.templateItemIndex ?? 0);
        const item = template.items[Math.max(0, Math.min(template.items.length - 1, templateItemIndex))];
        const page = resolveCarouselPage(item?.pageTemplateId ?? "");
        const kind = (slide.kind && typeof slide.kind === "string" ? slide.kind : getSlideKind(page?.id ?? "")) as CarouselSlideKind;
        if (kind === "step") { stepIndex += 1; bluePointIndex = 0; redPointIndex = 0; }
        if (kind === "why-design") { stepIndex = 0; bluePointIndex = 0; redPointIndex = 0; }
        if (kind === "argument-blue") bluePointIndex += 1;
        if (kind === "argument-red") redPointIndex += 1;
        const assetIndex = Number(slide.assetIndex ?? 0);
        const asset = Number.isFinite(assetIndex) && assetIndex > 0 ? imageAssets[assetIndex - 1] : undefined;
        const rawTitle = getAiSlideString(slide, ["title", "stepTitle", "step-title", "texteEtape", "text", "headline"]);
        const rawSubtitle = getAiSlideString(slide, ["subtitle", "subTitle", "sousTitre", "sous-titre", "description", "text"]);
        const rawBody = getAiSlideString(slide, ["body", "text", "whyText", "why-design", "content"]);
        const rawResult = getAiSlideString(slide, ["result", "resultat", "résultat", "outcome"]);
        return encodeCarouselSlide({
          kind,
          label: page?.name || String(slide.label || "Slide"),
          stepNumber: kind === "step" ? stepIndex : undefined,
          pointNumber: kind === "argument-blue" ? bluePointIndex : kind === "argument-red" ? redPointIndex : undefined,
          title: kind === "step" ? rawTitle || rawBody || rawSubtitle : rawTitle || undefined,
          subtitle: rawSubtitle || undefined,
          body: kind === "why-design" ? rawBody || rawTitle || rawSubtitle : rawBody || undefined,
          result: rawResult || undefined,
          showResult: typeof slide.showResult === "boolean" ? slide.showResult : Boolean(rawResult),
          showPointNumber: typeof slide.showPointNumber === "boolean" ? slide.showPointNumber : undefined,
          showStepCta: typeof slide.showStepCta === "boolean" ? slide.showStepCta : undefined,
          stepCtaText: getAiSlideString(slide, ["stepCtaText", "ctaText", "contextStepText"]) || undefined,
          imageMode: slide.imageMode === "full" ? "full" : "frame",
          imageSource: slide.imageSource === "ai" ? "ai" : "manual",
          imageUrl: asset?.url,
          imageDescription: asset ? [asset.description, asset.fileName].filter(Boolean).join(" - ") : getAiSlideString(slide, ["imageDescription", "imagePrompt", "visualDescription"]) || undefined,
          backgroundImage1: typeof slide.backgroundImage1 === "string" ? slide.backgroundImage1 : undefined,
          backgroundImage2: typeof slide.backgroundImage2 === "string" ? slide.backgroundImage2 : undefined,
          beforeImage: typeof slide.beforeImage === "string" ? slide.beforeImage : undefined,
          afterImage: typeof slide.afterImage === "string" ? slide.afterImage : undefined,
        });
      });
      return applyImportedAssetsToSlides(normalizeCarouselSlideCounters(slides), imageAssets);
    } catch {
      return null;
    }
  }

  async function generateArgumentPointsWithAI(template: LinkedInCarouselTemplate, userPrompt: string): Promise<Record<string, string[]>> {
    const currentSettings = settings ?? loadLinkedInSettings();
    const repeatAiItems = template.items.filter((item) => {
      const page = resolveCarouselPage(item.pageTemplateId);
      const kind = getSlideKind(page?.id ?? "");
      return item.mode === "repeat_ai" && (kind === "argument-blue" || kind === "argument-red");
    });
    if (repeatAiItems.length === 0) return {};

    const apiKey = currentSettings.openrouterApiKey?.trim() || "";
    const model = currentSettings.model || "anthropic/claude-sonnet-4";

    const pointsRequest = repeatAiItems.map((item, idx) => {
      const page = resolveCarouselPage(item.pageTemplateId);
      const kind = getSlideKind(page?.id ?? "");
      const meta = decodeCarouselTemplateItemMeta(item.label);
      const pagePrompt = meta.pagePrompt || page?.pagePrompt || "";
      return `SECTION_${idx + 1} (${kind === "argument-blue" ? "Point positif" : "Point negatif"}): ${pagePrompt}`;
    }).join("\n");

    const systemPrompt = `Tu es un expert en creation de carrousels LinkedIn. Pour chaque section demandee, genere une liste de points concis et percutants (1 phrase par point). Le nombre de points doit etre adapte au sujet, entre 3 et 8 points par section. Chaque point doit etre unique: interdiction de repeter la meme idee, le meme angle ou la meme formulation. Reponds UNIQUEMENT au format JSON suivant, sans autre texte :\n{\n  "SECTION_1": ["point 1", "point 2", ...],\n  "SECTION_2": ["point 1", "point 2", ...]\n}`;

    const userPromptText = [
      currentSettings.carouselSkillPrompt?.trim() ? `Skill stable:\n${currentSettings.carouselSkillPrompt.trim()}` : "",
      `Prompt global du template en MD:\n${buildCarouselGlobalPrompt(template) || "Aucun prompt global."}`,
      `Photos importees:\n${buildCarouselImageAssetsPrompt()}`,
      `Sujet : ${userPrompt}`,
      `Genere les points pour ces sections :\n${pointsRequest}`,
    ].filter(Boolean).join("\n\n");

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://agenceflow.app",
          "X-Title": "AgenceFlow LinkedIn",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPromptText },
          ],
          temperature: 0.8,
          max_tokens: 2000,
        }),
      });
      if (!res.ok) return {};
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as Record<string, string[]>;
      }
    } catch {}
    return {};
  }

  async function runCarouselGenerationChat() {
    const prompt = carouselGenerationPrompt.trim();
    const template = carouselTemplates.find((entry) => entry.id === carouselGenerationTemplateId);
    if (!prompt || !template) return;
    const before = generatedSlides;

    const hasRepeatAi = template.items.some((item) => {
      const page = resolveCarouselPage(item.pageTemplateId);
      const kind = getSlideKind(page?.id ?? "");
      return item.mode === "repeat_ai" && (kind === "argument-blue" || kind === "argument-red");
    });

    let aiPoints: Record<string, string[]> = {};
    if (hasRepeatAi) {
      setGenerating(true);
      aiPoints = await generateArgumentPointsWithAI(template, prompt);
      setGenerating(false);
    }

    const nextSlides = buildCarouselSlidesFromTemplate(template, prompt, aiPoints);
    setGeneratedSlides(nextSlides);
    setActiveSlide(0);
    setCarouselGenerationChat((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: prompt },
      { id: crypto.randomUUID(), role: "assistant", content: `J'ai prepare "${template.name}".` },
    ]);
    setCarouselGenerationHistory((current) => [
      { id: crypto.randomUUID(), label: prompt.slice(0, 60) || "Modification", slides: nextSlides, createdAt: new Date().toISOString() },
      { id: crypto.randomUUID(), label: "Version precedente", slides: before, createdAt: new Date().toISOString() },
      ...current,
    ].slice(0, 20));
    setCarouselGenerationPrompt("");
  }

  async function runCarouselEditorChat() {
    const instruction = carouselGenerationPrompt.trim();
    if (!instruction || generatedSlides.length === 0 || carouselChatLoading) return;
    const before = generatedSlides;
    const attachedImages = chatImageAttachments.map((image) => ({ url: image.url, fileName: image.fileName }));
    const selectedIndexes = carouselChatTargetSlides.length > 0 ? carouselChatTargetSlides : [activeSlide];
    const selectedCommand = selectedChatCommandId
      ? smartSelectionCommands.find((command) => command.id === selectedChatCommandId)
      : null;
    const targetLabel = selectedIndexes.length === 1
      ? `slide ${selectedIndexes[0] + 1}${carouselChatTargetField ? ` - ${String(carouselChatTargetField)}` : ""}`
      : `${selectedIndexes.length} slides`;
    setCarouselGenerationPrompt("");
    setChatImageAttachments([]);
    setChatActionsOpen(false);
    setCarouselTargetPickerOpen(false);
    setCarouselFieldPickerOpen(false);
    setSelectedChatCommandId("");
    setCarouselChatLoading(true);
    setCarouselGenerationChat((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: `${selectedCommand ? `${selectedCommand.label} - ` : ""}${instruction}` },
    ]);

    try {
      const selectedContext = selectedIndexes.map((index) => {
        const payload = decodeCarouselSlide(generatedSlides[index]);
        return { slideIndex: index, slideNumber: index + 1, kind: payload?.kind, label: payload?.label, selectedField: selectedIndexes.length === 1 ? carouselChatTargetField || null : null };
      });
      const selectedStyle = styles.find((style) => style.id === carouselDraftCategory || style.id === selectedStyleId);
      const res = await fetch("/api/linkedin/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: buildCarouselChatContext(),
          fullText: [
            `Slides actuelles avec champs modifiables:\n${buildCarouselChatContext()}`,
            `Selection utilisateur:\n${JSON.stringify(selectedContext, null, 2)}`,
            selectedStyle ? `Style selectionne: ${selectedStyle.name}\n${selectedStyle.prompt || ""}` : "",
          ].filter(Boolean).join("\n\n"),
          chatContext: carouselGenerationChat.slice(-10).map((entry) => `${entry.role}: ${entry.content}`).join("\n"),
          imageInputs: attachedImages,
          responseMode: "carouselChat",
          prompt: settings?.carouselSkillPrompt,
          instruction: [
            selectedCommand ? settings?.editActionGeneralPrompt : "",
            selectedCommand ? `Commande selectionnee: ${selectedCommand.label}\n${fillLinkedInEditActionPrompt(selectedCommand.instruction, buildCarouselChatContext())}` : "",
            `Demande utilisateur: ${instruction}`,
            "Si la demande ne demande pas explicitement une modification, reponds seulement avec edits: [].",
            "Si une modification est demandee, retourne uniquement les champs a changer dans edits. Utilise slideIndex zero-based et les fields exacts fournis.",
            "Respecte les contraintes indiquees dans chaque field. Pour les slides argument-blue et argument-red: title <= 19 caracteres, subtitle <= 105 caracteres / 3 lignes maximum. Ne mets jamais de points de suspension pour contourner la limite.",
            "Le message de chat doit expliquer ce que tu as fait point par point; ne recopie pas les textes finaux des champs dans le message.",
          ].filter(Boolean).join("\n\n"),
          contextLabel: "carrousel LinkedIn",
          openrouterApiKey: settings?.openrouterApiKey || undefined,
          model: settings?.carouselContentModel || settings?.model,
        }),
      });
      const rawResponse = await res.text();
      let data: { message?: string; edits?: Array<{ slideIndex?: number; field?: string; value?: unknown }>; error?: string } = {};
      try {
        data = rawResponse ? JSON.parse(rawResponse) : {};
      } catch {
        throw new Error(res.ok ? "Reponse API invalide." : rawResponse.slice(0, 180) || "Erreur serveur.");
      }
      if (!res.ok) throw new Error(data.error || "Transformation impossible");
      const edits = Array.isArray(data.edits) ? data.edits : [];
      const applied = edits.length ? applyCarouselAiEdits(edits) : null;
      if (applied) {
        setCarouselApplyingEdit(true);
        setGeneratedSlides(applied.slides);
        setCarouselGenerationHistory((current) => [
          { id: crypto.randomUUID(), label: instruction.slice(0, 60) || "Modification IA", slides: applied.slides, createdAt: new Date().toISOString(), details: applied.details },
          { id: crypto.randomUUID(), label: "Version precedente", slides: before, createdAt: new Date().toISOString() },
          ...current,
        ].slice(0, 20));
        window.setTimeout(() => setCarouselApplyingEdit(false), 900);
      }
      setCarouselGenerationChat((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: data.message?.trim() || (applied ? `C'est bon, j'ai modifie ${targetLabel}.` : "C'est note.") },
      ]);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Modification impossible.");
      setCarouselGenerationChat((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "Modification impossible." },
      ]);
    } finally {
      setCarouselChatLoading(false);
    }
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
          businessContext: currentSettings.businessContext,
          postSystemPrompt: currentSettings.postSystemPrompt,
          userWritingStylePrompt: currentSettings.userWritingStylePrompt || userWritingStylePrompt,
          carouselLongFormatPrompt: currentSettings.carouselLongFormatPrompt,
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

    setCarouselDownloading(true);
    setGenerationError("");

    try {
      const exportSlides = normalizeCarouselSlideCounters(generatedSlides);
      const res = await fetch("/api/linkedin/carousel-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slides: exportSlides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Export impossible.");

      const images = Array.isArray(data?.images) ? data.images as string[] : [];
      if (images.length === 0) throw new Error("Aucune image exportee.");

      if (images.length === 1) {
        const img = new Image();
        img.src = `data:image/png;base64,${images[0]}`;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image export invalide."));
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponible.");
        ctx.fillStyle = "#F6F6F6";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/jpeg", 0.96);
        link.download = "carousel-linkedin.jpg";
        link.click();
      } else {
        const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [575, 690] });
        images.forEach((base64, index) => {
          if (index > 0) pdf.addPage([575, 690], "portrait");
          pdf.addImage(`data:image/png;base64,${base64}`, "PNG", 0, 0, 575, 690);
        });
        pdf.save("carousel-linkedin.pdf");
      }
    } catch (error) {
      console.error("Erreur export carousel:", error);
      setGenerationError(error instanceof Error ? error.message : "Erreur lors de l'export du PDF.");
    } finally {
      setCarouselDownloading(false);
    }
  }

  async function handleDraftMedia(file: File) {
    try {
      const preview = await fileToCompressedPreview(file);
      setDraftMedia({ url: preview.url, kind: preview.kind, fileName: file.name, bytes: preview.bytes });
      setGenerationError("");
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Image impossible a telecharger.");
    }
  }

  async function copyGeneratedPost() {
    const content = generatedContent.trim();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setPostCopied(true);
      window.setTimeout(() => setPostCopied(false), 1400);
      setGenerationError("");
    } catch {
      setGenerationError("Impossible de copier le post.");
    }
  }

  async function analyzeVirality() {
    if (!generatedContent.trim() || viralityLoading) return;
    setViralityLoading(true);
    setViralityError("");
    try {
      const res = await fetch("/api/linkedin/analyze-virality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: generatedContent,
          imageUrl: draftMedia?.kind === "image" ? draftMedia.url : undefined,
          imageDescription: viralityImageDescription,
          openAiApiKey: settings?.viralityOpenAiApiKey || undefined,
          analyzerModel: settings?.viralityAnalyzerModel || undefined,
          openrouterApiKey: settings?.openrouterApiKey || undefined,
          imageModel: settings?.viralityImageModel || undefined,
          systemPrompt: settings?.viralitySystemPrompt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Analyse impossible.");
      setViralityConfigured(Boolean(data.configured));
      setViralityImageDescription(data.imageDescription || viralityImageDescription);
      setViralityResult(data.analysis ?? null);
    } catch (error) {
      setViralityError(error instanceof Error ? error.message : String(error));
    } finally {
      setViralityLoading(false);
    }
  }

  function restoreEditorHistory(entry: { label: string; before: string; after: string; createdAt: string }) {
    setGeneratedContent(entry.before);
  }

  function getEditorChatConfirmation(commandLabel?: string, hasSelection = false) {
    if (commandLabel) {
      return `C'est bon, j'ai applique "${commandLabel}" ${hasSelection ? "sur le passage selectionne" : "sur le post"}.`;
    }
    return hasSelection
      ? "C'est bon, j'ai modifie le passage selectionne."
      : "C'est bon, j'ai modifie le post.";
  }

  async function runEditorChat() {
    const instruction = chatInput.trim();
    if (!instruction || !generatedContent.trim() || editorChatLoading) return;
    const before = generatedContent;
    const selectedText = selectedChatText.trim();
    const targetText = selectedText || generatedContent;
    const attachedImages = chatImageAttachments.map((image) => ({ url: image.url, fileName: image.fileName }));
    setChatInput("");
    setChatImageAttachments([]);
    setChatActionsOpen(false);
    const selectedCommand = selectedChatCommandId
      ? smartSelectionCommands.find((command) => command.id === selectedChatCommandId)
      : null;
    setEditorChat((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: `${selectedText ? "Passage selectionne - " : ""}${selectedCommand ? `${selectedCommand.label} - ` : ""}${instruction}`,
        images: attachedImages,
        createdAt: new Date().toISOString(),
      },
    ].slice(-80));
    const slashCommand = selectedCommand || (instruction.startsWith("/")
      ? smartSelectionCommands.find((command) =>
          command.label.toLowerCase().includes(instruction.slice(1).trim().toLowerCase()) ||
          command.id.toLowerCase().includes(instruction.slice(1).trim().toLowerCase())
        )
      : null);
    setSelectedChatCommandId("");
    setSelectedChatText("");
    setEditorChatLoading(true);
    try {
      const res = await fetch("/api/linkedin/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: targetText,
          fullText: generatedContent,
          chatContext: editorChat.slice(-8).map((entry) => `${entry.role}: ${entry.content}`).join("\n"),
          imageInputs: attachedImages,
          responseMode: "chatWithOptionalTextEdit",
          instruction: slashCommand
            ? `${settings?.editActionGeneralPrompt || ""}\n\n${fillLinkedInEditActionPrompt(slashCommand.instruction, targetText)}\n\n${selectedText ? "Applique cette commande uniquement au passage selectionne, sans modifier le reste du post." : "Applique cette commande au post LinkedIn complet."}`
            : instruction.startsWith("/")
            ? `${selectedText ? "Applique cette commande uniquement au passage selectionne" : "Applique cette commande au post LinkedIn complet"} : ${instruction}`
            : `${selectedText ? "Modifie uniquement le passage selectionne selon cette demande" : "Modifie le post LinkedIn complet selon cette demande"} : ${instruction}`,
          contextLabel: "post LinkedIn",
          openrouterApiKey: settings?.openrouterApiKey || undefined,
          model: settings?.model,
        }),
      });
      const rawResponse = await res.text();
      let data: { text?: string; message?: string; error?: string } = {};
      try {
        data = rawResponse ? JSON.parse(rawResponse) : {};
      } catch {
        throw new Error(res.ok ? "Reponse API invalide." : rawResponse.slice(0, 180) || "Erreur serveur.");
      }
      if (!res.ok) throw new Error(data.error || "Transformation impossible");
      const nextContent = data.text
        ? selectedText && generatedContent.includes(targetText)
          ? generatedContent.replace(targetText, data.text)
          : data.text
        : null;
      if (nextContent) {
        setGeneratedContent(nextContent);
        pushEditorHistory({ label: selectedCommand ? selectedCommand.label : instruction, before, after: nextContent });
      }
      const aiMessage = data.message?.trim();
      const assistantMessage = aiMessage && (!data.text || aiMessage !== data.text.trim()) && aiMessage.length <= 240
        ? aiMessage
        : nextContent
        ? getEditorChatConfirmation(selectedCommand?.label, Boolean(selectedText))
        : "C'est note.";
      pushEditorChat("assistant", assistantMessage);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Modification impossible.");
      pushEditorChat("system", error instanceof Error ? error.message : "Modification impossible.");
    } finally {
      setEditorChatLoading(false);
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
    const nextDate = post?.scheduledAt ? isoToLocalInput(post.scheduledAt) : scheduleDate || getDefaultScheduleInput();
    setScheduleOverlayPostId(post?.id ?? null);
    setScheduleOverlayDate(nextDate);
    setScheduleCalendarMonth(nextDate.slice(0, 7));
  }

  function closeScheduleOverlay() {
    setScheduleOverlayPostId(null);
    setScheduleOverlayDate("");
    setScheduleCalendarMonth("");
  }

  function moveScheduleCalendarMonth(direction: -1 | 1) {
    const base = scheduleCalendarMonth ? new Date(`${scheduleCalendarMonth}-01T00:00`) : new Date();
    base.setMonth(base.getMonth() + direction);
    setScheduleCalendarMonth(`${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`);
  }

  function selectScheduleCalendarDay(day: number) {
    const month = scheduleCalendarMonth || new Date().toISOString().slice(0, 7);
    const currentTime = scheduleOverlayDate.includes("T") ? scheduleOverlayDate.slice(11, 16) : "09:00";
    setScheduleOverlayDate(`${month}-${String(day).padStart(2, "0")}T${currentTime}`);
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
      title: draftTitle.trim() || existingPost?.title,
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
      editorHistory,
      editorChat,
      editorSnapshots,
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

  function updateAutoRecyclePreferences(patch: {
    enabled?: boolean;
    delayDays?: number;
    minLikes?: number;
    prompt?: string;
  }) {
    const nextEnabled = patch.enabled ?? autoRecycleEnabled;
    const nextDelayDays = patch.delayDays ?? autoRecycleDelayDays;
    const nextMinLikes = patch.minLikes ?? autoRecycleMinLikes;
    const nextPrompt = patch.prompt ?? autoRecyclePrompt;
    setAutoRecycleEnabled(nextEnabled);
    setAutoRecycleDelayDays(nextDelayDays);
    setAutoRecycleMinLikes(nextMinLikes);
    setAutoRecyclePrompt(nextPrompt);
    persistLinkedInWorkspacePatch({
      preferences: {
        autoRecycleEnabled: nextEnabled,
        autoRecycleDelayDays: nextDelayDays,
        autoRecycleMinLikes: nextMinLikes,
        autoRecyclePrompt: nextPrompt,
      },
    });
  }

  async function generateAutoRecycleVariant(post: LinkedInPost) {
    if (!post.content.trim() || autoRecycleVariantLoadingId) return;
    setAutoRecycleVariantLoadingId(post.id);
    try {
      const res = await fetch("/api/linkedin/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: post.content,
          fullText: post.content,
          responseMode: "text",
          instruction: autoRecyclePrompt,
          contextLabel: "relance automatique LinkedIn",
          openrouterApiKey: settings?.openrouterApiKey || undefined,
          model: settings?.model,
          prompt: "Tu prepares une relance automatique LinkedIn. Tu dois conserver le hook et les deux premieres phrases exactement identiques. Le reste doit etre quasi identique, avec seulement quelques synonymes ou micro-ajustements. Ne reorganise pas le post, ne change pas le fond, ne rallonge pas, ne raccourcis pas fortement. Retourne uniquement le post complet final.",
        }),
      });
      const data = await res.json() as { text?: string; error?: string };
      if (!res.ok || !data.text?.trim()) throw new Error(data.error || "Generation impossible");
      setGeneratedContent(data.text.trim());
      setEditorHistory((current) => [
        {
          id: crypto.randomUUID(),
          label: "Version auto-planification generee",
          before: post.content,
          after: data.text!.trim(),
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
    } catch (error) {
      setGenerationError(String(error));
    } finally {
      setAutoRecycleVariantLoadingId(null);
    }
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

  function deletePost(id: string) {
    const updated = normalizePosts(posts.filter(p => p.id !== id));
    setPosts(updated);
    saveLinkedInPosts(updated);
    void persistRemoteLinkedInPosts(updated, true);
  }

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
    setPosts(normalized);
    saveLinkedInPosts(normalized);
    void persistRemoteLinkedInPosts(normalized, true);
    setStatsPost(null);
  }

  const hasGenerated = (postType === "carousel" && generatedSlides.length > 0) || (postType === "post" && generatedContent.trim().length > 0);
  const editorVisible = hasGenerated && !manualEditorStarted && !editingPostId;
  const rightEditorVisible = manualEditorStarted || Boolean(editingPostId);
  const stats = {
    drafts: posts.filter(p => p.status === "draft" && !p.analytics?.autoRecycleSourcePostId).length,
    scheduled: posts.filter(p => p.status === "scheduled" && !p.analytics?.autoRecycleSourcePostId).length,
    auto: autoRecyclePosts.length,
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
  const slashCommands = smartSelectionCommands.filter((command) => command.label.toLowerCase().includes(chatInput.replace(/^\//, "").toLowerCase()));
  const chatComposerRows = Math.min(7, Math.max(2, ...chatInput.split("\n").map((line) => Math.max(2, Math.ceil(line.length / 24)))));
  const chatComposerExpanded = true;
  const carouselComposerRows = Math.min(7, Math.max(1, ...carouselGenerationPrompt.split("\n").map((line) => Math.max(1, Math.ceil(line.length / 24)))));
  const carouselComposerExpanded = carouselComposerRows > 1 || Boolean(selectedChatCommandId || carouselChatTargetSlides.length > 0);
  const selectedChatCommand = selectedChatCommandId ? smartSelectionCommands.find((item) => item.id === selectedChatCommandId) : null;
  const chatCommandCategories = Array.from(new Set(smartSelectionCommands.map((command) => command.category)));
  const styleCategoryOptions = Array.from(new Set(styles.map((style) => style.category))).map((category) => ({
    id: category,
    label: STYLE_CATEGORY_LABELS[category] ?? category,
  }));

  const renderPostStyleSelector = (value: string, onChange: (styleId: string) => void) => {
    const selected = styles.find((style) => style.id === value) ?? styles[0] ?? null;
    const activeCategory = selected?.category ?? styleCategoryOptions[0]?.id ?? "custom";
    const stylesInCategory = styles.filter((style) => style.category === activeCategory);
    const tag = STYLE_TAGS[activeCategory] ?? STYLE_TAGS.custom;
    const cleanSubstyleName = (style: LinkedInStyle) => {
      const prefix = `${STYLE_CATEGORY_LABELS[style.category] ?? style.category} - `;
      return style.name.startsWith(prefix) ? style.name.slice(prefix.length) : style.name.replace(/^[^-]+ - /, "");
    };

    return (
      <div style={{ display: "grid", gap: 10 }}>
        <select
          value={activeCategory}
          onChange={(event) => {
            const nextStyle = styles.find((style) => style.category === event.target.value) ?? styles[0];
            if (nextStyle) onChange(nextStyle.id);
          }}
          style={{ ...inp, minHeight: 46, borderRadius: 12, background: "#fff", color: tag.color, border: `1px solid ${tag.border}`, fontWeight: 750 }}
        >
          {styleCategoryOptions.map((category) => (
            <option key={category.id} value={category.id}>{category.label}</option>
          ))}
        </select>
        {stylesInCategory.length > 1 ? (
          <select
            value={selected?.id ?? ""}
            onChange={(event) => onChange(event.target.value)}
            style={{ ...inp, minHeight: 46, borderRadius: 12, background: "#f6f6f6" }}
          >
            {stylesInCategory.map((style) => (
              <option key={style.id} value={style.id}>{cleanSubstyleName(style)}</option>
            ))}
          </select>
        ) : null}
      </div>
    );
  };

  useEffect(() => {
    if (!chatActionsOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (chatComposerRef.current?.contains(event.target as Node)) return;
      setChatActionsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [chatActionsOpen]);

  useEffect(() => {
    if (!rightEditorVisible || !editingPostId) return;
    const timeout = window.setTimeout(() => {
      persistPostDraft();
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [rightEditorVisible, editingPostId, draftTitle, generatedContent, generatedSlides, selectedPostFormat, selectedStyleId, sourceTab, sourceInput, scrapedTitle, draftMedia, editorHistory, editorChat, editorSnapshots, carouselGenerationChat]);

  const getCarouselPreviewPayload = (page: LinkedInCarouselPageTemplate | null, item?: LinkedInCarouselTemplate["items"][number] | null): CarouselSlidePayload => {
    if (!page) return { kind: "context", label: "Slide", subtitle: "" };
    if (page.id === FREE_CAROUSEL_PAGE_ID) return { kind: "free", label: "Libre", body: "" };
    const kind = getSlideKind(page.id);
    const getField = (fieldId: string, fallback = "") => item ? getCarouselTemplateItemField(item, page, fieldId, fallback) : getTemplateField(page, fieldId, fallback);
    const isArgument = kind === "argument-blue" || kind === "argument-red";
    return {
      kind,
      label: page.name,
      title: isArgument ? getField("arg-title") : getField("step-title"),
      subtitle: isArgument ? getField("arg-subtitle") : getField("context-subtitle"),
          body: kind === "why-design" ? getField("why-text") : "",
          result: getField("arg-result"),
          showResult: isEnabled(getField("arg-result-enabled", "oui")),
          showPointNumber: isEnabled(getField("arg-number-enabled", "oui")),
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

  const getTemplatePreviewPayloads = (template: LinkedInCarouselTemplate) =>
    normalizeCarouselSlideCounters(
      template.items.map((item) => {
        const page = resolveCarouselPage(item.pageTemplateId);
        return encodeCarouselSlide(getCarouselPreviewPayload(page, item));
      })
    ).map((slide) => decodeCarouselSlide(slide) ?? { kind: "free" as CarouselSlideKind, label: "Libre", body: "" });

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
    const previewItems = getTemplatePreviewPayloads(template).slice(0, 3);
    const fallbackPayload = getCarouselPreviewPayload(CAROUSEL_SLIDE_LIBRARY[0]);
    const previewPayloads = previewItems.length > 0 ? previewItems : [fallbackPayload];
    return (
      <span style={{ position: "relative", width: 74, height: 82, flexShrink: 0, display: "inline-block" }}>
        {previewPayloads.map((payload, index) => {
          const left = index === 0 ? 0 : index === 1 ? 13 : 26;
          const rotate = index === 0 ? -11 : index === 1 ? 0 : 11;
          return (
            <span key={`${payload.kind}-${index}`} style={{ position: "absolute", left, top: index === 1 ? 0 : 6, transform: `rotate(${rotate}deg)`, zIndex: index + 1 }}>
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

    if (field.id === "context-step-enabled" || field.id === "arg-result-enabled" || field.id === "arg-image-source" || field.id === "arg-number-enabled") {
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
          <input value={value} onChange={(event) => update(event.target.value)} style={{ ...inp, minHeight: 54, background: "#f2f2f2", borderRadius: 12 }} />
        )}
        {field.id === "arg-title" ? <span style={{ fontSize: 11, color: value.length > 19 ? "#ef0c0c" : "rgba(18,26,46,0.45)" }}>{value.length}/19 caracteres recommandes</span> : null}
        {field.id === "arg-subtitle" ? <span style={{ fontSize: 11, color: value.length > 105 ? "#ef0c0c" : "rgba(18,26,46,0.45)" }}>{value.length}/105 caracteres recommandes</span> : null}
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
        {(payload.kind === "argument-blue" || payload.kind === "argument-red" || payload.kind === "avis") && (
          <div>
            <label style={labelStyle}>Titre</label>
            <input
              value={payload.title ?? ""}
              onChange={(event) => update({ title: event.target.value })}
              style={inputStyle}
            />
            {payload.kind === "argument-blue" || payload.kind === "argument-red" ? (
              <span style={{ display: "block", marginTop: 6, fontSize: 11, color: (payload.title ?? "").length > 19 ? "#ef0c0c" : "rgba(18,26,46,0.45)" }}>{(payload.title ?? "").length}/19 caracteres recommandes</span>
            ) : null}
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
            {payload.kind === "argument-blue" || payload.kind === "argument-red" ? (
              <span style={{ display: "block", marginTop: 6, fontSize: 11, color: (payload.subtitle ?? "").length > 105 ? "#ef0c0c" : "rgba(18,26,46,0.45)" }}>{(payload.subtitle ?? "").length}/105 caracteres recommandes</span>
            ) : null}
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
                <label style={labelStyle}>Texte du bouton noir</label>
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
              <label style={labelStyle}>Afficher le numero</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => update({ showPointNumber: true })} style={chipStyle(payload.showPointNumber !== false)}>Oui</button>
                <button type="button" onClick={() => update({ showPointNumber: false })} style={chipStyle(payload.showPointNumber === false)}>Non</button>
              </div>
            </div>
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
    if (showHistoryPanel) {
      return (
        <aside style={{ ...carouselRightRailStyle, width: 525, padding: 0, gap: 0, position: "relative", zIndex: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "24px 24px 16px" }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#121a2e" }}>{showCarouselHistory ? "Historique" : "Conversation"}</p>
            <button type="button" onClick={() => setShowCarouselHistory((value) => !value)} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(0,0,0,0.07)", background: showCarouselHistory ? "#FBFBFB" : "#fff", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><History size={16} /></button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, padding: "0 24px" }}>
            {showCarouselHistory ? (
              carouselGenerationHistory.length === 0 ? <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(18,26,46,0.42)" }}>Aucune modification pour le moment.</p> : carouselGenerationHistory.map((entry) => (
                <div key={entry.id} style={{ width: "100%", borderRadius: 18, background: "#FBFBFB", padding: "14px 14px 14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  <button type="button" onClick={() => { setGeneratedSlides(normalizeCarouselSlideCounters(entry.slides)); setActiveSlide(0); }} style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 750, color: "#121a2e", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{entry.label}</span>
                    <span style={{ display: "block", fontSize: 11, color: "rgba(18,26,46,0.42)" }}>{entry.details?.length ? `${entry.details.length} modifications` : `${entry.slides.length} slides`}</span>
                  </button>
                  {entry.details?.length ? (
                    <button type="button" onClick={() => setCarouselHistoryDetails(entry)} aria-label="Voir les modifications" style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid rgba(18,26,46,0.08)", background: "#fff", color: "rgba(18,26,46,0.68)", display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}>
                      <Info size={14} />
                    </button>
                  ) : null}
                </div>
              ))
            ) : carouselGenerationChat.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(18,26,46,0.42)" }}>Demande une modification IA sur le carrousel. Par defaut, la demande agit sur la slide active.</p>
            ) : carouselGenerationChat.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} style={{ width: "fit-content", maxWidth: "75%", alignSelf: isUser ? "flex-end" : "flex-start", borderRadius: 20, background: isUser ? "#F4F4F4" : "transparent", padding: isUser ? "14px 16px" : 0 }}>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(18,26,46,0.82)", whiteSpace: "pre-wrap" }}>{message.content}</p>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: "12px 24px 16px" }}>
            <div ref={chatComposerRef} style={{ position: "relative", width: "100%", minHeight: 66, borderRadius: 34, border: "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: carouselPanelShadow, display: "flex", flexDirection: carouselComposerExpanded ? "column" : "row", alignItems: carouselComposerExpanded ? "stretch" : "center", justifyContent: "space-between", gap: carouselComposerExpanded ? 10 : 12, padding: 12, transition: "min-height 0.18s ease, gap 0.18s ease" }}>
              {chatActionsOpen ? (
                <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(100% + 10px)", borderRadius: 18, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: carouselPanelShadow, padding: 10, display: "grid", gap: 6, maxHeight: 320, overflowY: "auto", zIndex: 12 }}>
                  <button type="button" onClick={() => { setCarouselTargetPickerOpen((value) => !value); setCarouselCommandPickerOpen(false); setCarouselFieldPickerOpen(false); }} style={{ border: 0, borderRadius: 12, background: "#FBFBFB", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 12, fontWeight: 750, color: "#121a2e" }}><LayoutTemplate size={14} /> Selectionner un element</span>
                    <span style={{ fontSize: 11, color: "rgba(18,26,46,0.48)" }}>{carouselChatTargetSlides.length || 1}</span>
                  </button>
                  <button type="button" onClick={() => { setCarouselCommandPickerOpen((value) => !value); setCarouselTargetPickerOpen(false); setCarouselFieldPickerOpen(false); }} style={{ border: 0, borderRadius: 12, background: "#FBFBFB", padding: "10px 12px", display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    <Wand2 size={14} />
                    <span style={{ fontSize: 12, fontWeight: 750, color: "#121a2e" }}>Choisir une commande</span>
                  </button>
                  {carouselTargetPickerOpen ? generatedSlides.map((slide, index) => {
                    const payload = decodeCarouselSlide(slide);
                    const active = carouselChatTargetSlides.includes(index);
                    return (
                      <button key={index} type="button" onClick={() => toggleCarouselTargetSlide(index)} style={{ border: "1px solid rgba(18,26,46,0.08)", borderRadius: 12, background: active ? "rgba(1,71,255,0.08)" : "#fff", padding: "9px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", textAlign: "left" }}>
                        <span style={{ fontSize: 12, fontWeight: 750, color: "#121a2e" }}>Slide {index + 1} - {payload?.label || payload?.kind || "Page"}</span>
                        {carouselChatTargetSlides.length === 1 && active ? <button type="button" onClick={(event) => { event.stopPropagation(); setCarouselFieldPickerOpen((value) => !value); }} style={{ width: 28, height: 28, borderRadius: 999, border: 0, background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 4px 12px rgba(18,26,46,0.08)", cursor: "pointer" }}><ArrowRight size={14} /></button> : active ? <Check size={14} /> : null}
                      </button>
                    );
                  }) : null}
                  {carouselFieldPickerOpen && carouselChatTargetSlides.length === 1 ? getCarouselEditableFields(decodeCarouselSlide(generatedSlides[carouselChatTargetSlides[0]])).map((field) => (
                    <button key={String(field.key)} type="button" onClick={() => { setCarouselChatTargetField(field.key); setCarouselFieldPickerOpen(false); setCarouselTargetPickerOpen(false); setChatActionsOpen(false); }} style={{ border: 0, borderRadius: 12, background: carouselChatTargetField === field.key ? "rgba(1,71,255,0.08)" : "transparent", padding: "9px 10px", display: "flex", flexDirection: "column", gap: 3, textAlign: "left", cursor: "pointer" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#121a2e" }}>{field.label}</span>
                      <span style={{ fontSize: 11, color: "rgba(18,26,46,0.48)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{field.value || "Champ vide"}</span>
                    </button>
                  )) : null}
                  {carouselCommandPickerOpen ? chatCommandCategories.map((category) => (
                    <div key={category} style={{ display: "grid", gap: 4 }}>
                      <p style={{ margin: "8px 8px 4px", fontSize: 10, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(18,26,46,0.42)" }}>{category}</p>
                      {smartSelectionCommands.filter((command) => command.category === category).map((command) => {
                        const Icon = command.icon;
                        return (
                          <button key={command.id} type="button" onClick={() => { setSelectedChatCommandId(command.id); setChatActionsOpen(false); }} style={{ border: 0, borderRadius: 12, background: selectedChatCommandId === command.id ? "#FBFBFB" : "transparent", padding: "9px 10px", display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                            <span style={{ width: 24, height: 24, borderRadius: 999, background: `${command.color}18`, color: command.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={13} /></span>
                            <span style={{ fontSize: 12, fontWeight: 750, color: "#121a2e" }}>{command.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )) : null}
                </div>
              ) : null}
              <div style={{ display: carouselComposerExpanded ? "flex" : "none", flexDirection: "column", gap: 8, width: "100%" }}>
                {carouselChatTargetSlides.length > 0 ? (
                  <div style={{ borderRadius: 18, background: "#FBFBFB", padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <MoveRight size={16} style={{ color: "rgba(18,26,46,0.5)", flexShrink: 0, marginTop: 2 }} />
                    <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.45, color: "rgba(18,26,46,0.62)" }}>{carouselChatTargetSlides.length === 1 ? `Slide ${carouselChatTargetSlides[0] + 1}${carouselChatTargetField ? ` - ${String(carouselChatTargetField)}` : ""}` : `${carouselChatTargetSlides.length} slides selectionnees`}</p>
                    <button type="button" onClick={() => { setCarouselChatTargetSlides([]); setCarouselChatTargetField(""); }} style={{ border: 0, background: "transparent", color: "rgba(18,26,46,0.42)", cursor: "pointer", display: "flex", padding: 2 }}><X size={15} /></button>
                  </div>
                ) : null}
                {selectedChatCommand ? (() => {
                  const Icon = selectedChatCommand.icon;
                  return <button type="button" onClick={() => setSelectedChatCommandId("")} style={{ alignSelf: "flex-start", border: 0, borderRadius: 999, background: `${selectedChatCommand.color}14`, color: selectedChatCommand.color, minHeight: 24, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 800, fontFamily: '"Plus Jakarta Sans", sans-serif' }}><Icon size={12} />{selectedChatCommand.label}</button>;
                })() : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", flexWrap: carouselComposerExpanded ? "wrap" : "nowrap", gap: carouselComposerExpanded ? "10px 12px" : 12, width: "100%", minWidth: 0 }}>
                <button type="button" onClick={() => setChatActionsOpen((current) => !current)} style={{ width: 40, height: 40, borderRadius: 34, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.background = "#F6F6F6"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}><Plus size={18} /></button>
                <textarea wrap="soft" value={carouselGenerationPrompt} disabled={carouselChatLoading} rows={carouselComposerRows} onChange={(event) => setCarouselGenerationPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void runCarouselEditorChat(); } }} placeholder="Taper un texte ici" style={{ order: carouselComposerExpanded ? -1 : 0, flex: carouselComposerExpanded ? "0 0 100%" : 1, width: carouselComposerExpanded ? "100%" : "auto", minWidth: 0, minHeight: 24, maxHeight: 168, height: carouselComposerExpanded ? "auto" : 24, border: 0, outline: "none", color: "rgba(18,26,46,0.7)", fontSize: 16, fontWeight: 500, lineHeight: carouselComposerExpanded ? "22px" : "24px", letterSpacing: "-0.2px", fontFamily: "Inter, sans-serif", resize: "none", overflowY: carouselGenerationPrompt.split("\n").length > 7 || carouselGenerationPrompt.length > 238 ? "auto" : "hidden", overflowX: "hidden", background: "transparent", padding: 0, opacity: carouselChatLoading ? 0.55 : 1, transition: "height 0.18s ease, line-height 0.18s ease", whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" }} />
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: carouselComposerExpanded ? 10 : 16, flexShrink: 0 }}>
                  <button type="button" onClick={() => setModelPickerOpen((current) => !current)} style={{ border: 0, background: "transparent", padding: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "rgba(18,26,46,0.7)", fontSize: 14, fontWeight: 500, lineHeight: "18px", fontFamily: "Inter, sans-serif" }}>
                    <span>{activeModelLabel}</span>
                    <ChevronDown size={14} style={{ color: "rgba(18,26,46,0.52)" }} />
                  </button>
                  <button type="button" onClick={() => void runCarouselEditorChat()} disabled={carouselChatLoading || !carouselGenerationPrompt.trim()} style={{ width: 46, height: 46, borderRadius: 34, background: "#121a2e", color: "#fff", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: carouselChatLoading || !carouselGenerationPrompt.trim() ? "not-allowed" : "pointer", flexShrink: 0, opacity: carouselChatLoading || !carouselGenerationPrompt.trim() ? 0.72 : 1 }}>{carouselChatLoading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={18} />}</button>
                  {modelPickerOpen ? (
                    <div style={{ position: "absolute", right: 58, bottom: 56, width: 300, borderRadius: 18, border: "1px solid rgba(18,26,46,0.12)", background: "rgba(255,255,255,0.96)", boxShadow: carouselPanelShadow, padding: 10, display: "flex", flexDirection: "column", gap: 8, zIndex: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", padding: "0 12px" }}>
                        <Search size={14} style={{ color: "#6f7887" }} />
                        <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Rechercher un modele..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#121a2e" }} autoFocus />
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
          </div>
        </aside>
      );
    }
    const rightRailTitle = carouselStudioTab === "templates" ? "Toutes les templates" : showHistoryPanel ? "Recents" : "Tous les carrousels faits";
    return (
      <aside style={{ ...carouselRightRailStyle, position: "relative", zIndex: 4 }}>
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
              carouselGenerationHistory.length === 0 ? <p style={{ margin: "24px 0 0", fontSize: 14, color: "rgba(18,26,46,0.5)" }}>Aucune version enregistree.</p> : carouselGenerationHistory.map((entry) => (
                <button key={entry.id} type="button" onClick={() => { setGeneratedSlides(normalizeCarouselSlideCounters(entry.slides)); setActiveSlide(0); }} style={{ width: "100%", border: 0, borderBottom: "1px solid rgba(0,0,0,0.08)", background: "#fff", padding: "22px 0", textAlign: "left", cursor: "pointer" }}>
                  <strong style={{ display: "block", fontSize: 14, color: "#121a2e", fontWeight: 600 }}>{entry.label}</strong>
                  <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "rgba(18,26,46,0.7)" }}>{entry.slides.length} slides</span>
                </button>
              ))
            ) : (
              <div style={{ paddingTop: 38, display: "flex", flexDirection: "column", gap: 24 }}>
                {carouselGenerationChat.length === 0 ? <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.5)", lineHeight: 1.55 }}>Les demandes recentes et reponses IA apparaitront ici.</p> : carouselGenerationChat.map((message) => (
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
                  <button key={template.id} type="button" onContextMenu={(event) => { event.preventDefault(); setCarouselTemplateMenu({ id: template.id, x: event.clientX, y: event.clientY }); }} onClick={() => { setSelectedCarouselTemplateId(template.id); setSelectedCarouselTemplateItemId(""); }} style={{ width: "100%", minHeight: 96, border: 0, borderBottom: "1px solid rgba(0,0,0,0.1)", background: isSelected ? "rgba(0,0,0,0.03)" : "#fff", borderRadius: 8, display: "flex", alignItems: "center", gap: 12, padding: "18px 4px", textAlign: "left", cursor: "pointer", overflow: "visible" }}>
                    {renderTemplateStackPreview(template)}
                    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {renamingCarouselTemplateId === template.id ? (
                        <input value={renamingCarouselTemplateName} onClick={(event) => event.stopPropagation()} onChange={(event) => setRenamingCarouselTemplateName(event.target.value)} onBlur={commitRenameCarouselTemplate} onKeyDown={(event) => { if (event.key === "Enter") commitRenameCarouselTemplate(); if (event.key === "Escape") { setRenamingCarouselTemplateId(""); setRenamingCarouselTemplateName(""); } }} autoFocus style={{ width: 150, border: "1px solid rgba(18,26,46,0.14)", borderRadius: 8, padding: "6px 8px", fontSize: 13, fontWeight: 700, color: "#121a2e" }} />
                      ) : (
                        <strong style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 13, lineHeight: "18px", fontWeight: 600, color: "#121a2e", maxWidth: 150, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{template.name}</strong>
                      )}
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
        <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 28, lineHeight: "34px", fontWeight: 700, color: "#121a2e" }}>Creer votre template</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: "22px", color: "rgba(18,26,46,0.56)", fontFamily: '"Inter", sans-serif' }}>Selectionne une page pour regler ses prompts et ses champs.</p>
      </div>
      <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", overflow: "visible", paddingBottom: 8 }}>
        {(() => {
          const templateItems = (selectedCarouselTemplate?.items.length ? selectedCarouselTemplate.items : []).slice(0, 10);
          const previewPayloads = selectedCarouselTemplate ? getTemplatePreviewPayloads(selectedCarouselTemplate).slice(0, 10) : [];
          return templateItems.map((item, index) => {
          const page = resolveCarouselPage(item.pageTemplateId);
          const previewPayload = previewPayloads[index] ?? getCarouselPreviewPayload(page, item);
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
              {(page?.id === "builtin:argument-blue" || page?.id === "builtin:argument-red") && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!selectedCarouselTemplate) return;
                    const nextMode = item.mode === "repeat_ai" ? "single" : "repeat_ai";
                    updateCarouselTemplateItem(selectedCarouselTemplate.id, item.id, { mode: nextMode });
                  }}
                  style={{
                    position: "absolute",
                    bottom: 10,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 20,
                    border: "1px solid",
                    cursor: "pointer",
                    background: item.mode === "repeat_ai" ? "rgba(1,71,255,0.08)" : "#f6f6f6",
                    color: item.mode === "repeat_ai" ? "#0147ff" : "rgba(18,26,46,0.55)",
                    borderColor: item.mode === "repeat_ai" ? "rgba(1,71,255,0.32)" : "rgba(18,26,46,0.1)",
                    zIndex: 3,
                  }}
                >
                  {item.mode === "repeat_ai" ? "Repeter (IA)" : "1x"}
                </button>
              )}
            </button>
          );
          });
        })()}
        <button type="button" onClick={(event) => { event.stopPropagation(); setShowCarouselPagePicker(true); }} style={{ width: "fit-content", minWidth: 210, minHeight: 268, borderRadius: 24, border: "1px dashed rgba(18,26,46,0.18)", background: "#f3f3f3", color: "#121a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, lineHeight: "20px", fontWeight: 600, cursor: "pointer", padding: "28px 24px", textAlign: "center", alignSelf: "stretch" }}>
          <Plus size={20} /> Ajouter une page
        </button>
      </div>
    </main>
  );

  const renderEditorBeforeClick = () => (
    <main style={{ position: "relative", flex: 1, minWidth: 0, background: "#fbfbfb", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 46, top: 32, right: 40, display: "flex", flexDirection: "column", gap: 6, zIndex: 2 }}>
        <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 28, lineHeight: "34px", fontWeight: 700, color: "#121a2e" }}>Selectionner un carrousel</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: "22px", color: "rgba(18,26,46,0.56)", fontFamily: '"Inter", sans-serif' }}>Ouvre un carrousel existant ou cree-en un nouveau.</p>
      </div>
      <div style={{ position: "absolute", left: 46, top: 108, right: 40, display: "flex", gap: 24, flexWrap: "wrap", overflow: "visible" }}>
        {carouselPosts
          .sort((a, b) => {
            const aScheduled = a.status === "scheduled" ? 1 : 0;
            const bScheduled = b.status === "scheduled" ? 1 : 0;
            return aScheduled - bScheduled;
          })
          .slice(0, 8)
          .map((post) => {
          const slides = post.slides?.length ? post.slides : [post.content];
          return (
            <button key={post.id} type="button" onClick={() => { setGeneratedSlides(normalizeCarouselSlideCounters(slides)); setActiveSlide(0); setCarouselStudioMode("generate"); setCarouselStudioTab("editor"); setEditingPostId(post.id); setPostType("carousel"); setManualEditorStarted(true); setCarouselDraftName(post.sourceTitle ?? ""); setCarouselDraftCategory(post.styleId ?? ""); setCarouselGenerationChat((post.editorChat ?? []).filter((entry) => entry.role === "user" || entry.role === "assistant").map((entry) => ({ id: entry.id, role: entry.role as "user" | "assistant", content: entry.content }))); setCarouselGenerationHistory([]); setCarouselChatTargetSlides([]); setCarouselChatTargetField(""); setCarouselTargetPickerOpen(false); setCarouselFieldPickerOpen(false); setModelPickerOpen(false); }} style={{ position: "relative", width: 280, minHeight: 292, borderRadius: 24, border: "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: carouselPanelShadow, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 28, cursor: "pointer", overflow: "visible" }}>
              <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); deletePost(post.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); deletePost(post.id); } }} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(18,26,46,0.04)", background: "#fff", color: "rgba(18,26,46,0.72)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px rgba(18,26,46,0.08)", cursor: "pointer", zIndex: 3 }}>
                <Trash2 size={13} />
              </span>
              {post.status === "scheduled" && (
                <span style={{ position: "absolute", top: 12, left: 12, fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#d5eeff", color: "#073e63", zIndex: 3 }}>Planifie</span>
              )}
              {renderGeneratedCarouselStackPreview(slides)}
              <strong style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, lineHeight: "21px", fontWeight: 600, color: "#121a2e", maxWidth: 180, minHeight: 42, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textAlign: "center" }}>{post.sourceTitle || (post.content ? `${post.content.slice(0, 36)}${post.content.length > 36 ? "..." : ""}` : "Carrousel")}</strong>
            </button>
          );
        })}
        <button type="button" onClick={() => { resetCarouselCreateState(); setShowCarouselTemplatePicker(true); }} style={{ width: 280, minHeight: 292, borderRadius: 24, border: "1px dashed rgba(18,26,46,0.18)", background: "#f3f3f3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 28, cursor: "pointer", color: "#121a2e", textAlign: "center" }}>
          <Plus size={20} />
          <strong style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, lineHeight: "21px", fontWeight: 600, color: "#121a2e" }}>Creer un carrousel</strong>
        </button>
      </div>
    </main>
  );

  const scrollEditorToSlide = (index: number) => {
    const nextIndex = Math.max(0, Math.min(generatedSlides.length - 1, index));
    editorCarouselRef.current?.scrollTo({ left: nextIndex * 546, behavior: "smooth" });
    setActiveSlide(nextIndex);
  };

  const handleEditorCarouselScroll = () => {
    const container = editorCarouselRef.current;
    if (!container) return;
    const nextIndex = Math.max(0, Math.min(generatedSlides.length - 1, Math.round(container.scrollLeft / 546)));
    if (nextIndex !== activeSlide) setActiveSlide(nextIndex);
  };

  const renderEditorMode = () => (
    <main data-carousel-editor onClick={() => setShowGeneratedSlidePagePicker(false)} style={{ position: "relative", flex: 1, minWidth: 0, background: "#fbfbfb", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 64, zIndex: 8, borderBottom: "1px solid rgba(18,26,46,0.06)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 24px" }}>
        <button type="button" onClick={() => { resetCarouselCreateState(); setCarouselStudioMode("builder"); setCarouselStudioTab("editor"); setModelPickerOpen(false); }} style={{ minHeight: 38, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }} aria-label="Revenir aux carrousels">
          <ArrowLeft size={14} />
          Revenir aux carrousels
        </button>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <ClientBlueButton compact type="button" onClick={() => void generatePostFromCurrentCarousel(false)} disabled={generating || generatedSlides.length === 0} icon={generating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={14} />} wrapperStyle={{ width: "auto" }} style={{ minHeight: 40, padding: "0 18px", fontSize: 13, fontWeight: 650 }}>
            Generer le format long
          </ClientBlueButton>
          <button type="button" onClick={downloadCurrentCarousel} disabled={carouselDownloading || generatedSlides.length === 0} style={{ minHeight: 40, borderRadius: 10, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", boxShadow: "0px 4px 12px rgba(18,26,46,0.06)", padding: "0 18px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 650, fontFamily: '"Plus Jakarta Sans", sans-serif', cursor: carouselDownloading || generatedSlides.length === 0 ? "not-allowed" : "pointer", opacity: carouselDownloading || generatedSlides.length === 0 ? 0.55 : 1 }}>
            {carouselDownloading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={15} />}
            Telecharger
          </button>
          <button type="button" onClick={() => openScheduleOverlay()} disabled={saving || generatedSlides.length === 0} style={{ minHeight: 40, borderRadius: 10, border: "1px solid #121A2E", background: "#121A2E", color: "#fff", boxShadow: "none", padding: "0 18px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 650, fontFamily: '"Plus Jakarta Sans", sans-serif', cursor: saving || generatedSlides.length === 0 ? "not-allowed" : "pointer", opacity: saving || generatedSlides.length === 0 ? 0.7 : 1 }}>
            <CalendarIcon size={15} />
            Planifier le post
          </button>
        </div>
      </div>
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
          scrollEditorToSlide(Math.round(container.scrollLeft / 546));
        }}
        onPointerLeave={() => {
          const container = editorCarouselRef.current;
          if (!container) return;
          editorDragRef.current.active = false;
          container.style.cursor = "grab";
        }}
        style={{ position: "absolute", left: 0, right: 0, top: 88, height: 688, display: "flex", alignItems: "center", gap: 28, overflowX: "auto", overflowY: "visible", padding: "0 max(32px, calc(50% - 259px))", scrollSnapType: "x proximity", scrollbarWidth: "none", cursor: "grab", userSelect: "none", WebkitUserSelect: "none", scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
      >
        {generatedSlides.map((slide, index) => (
          <button key={`${index}-${slide.slice(0, 24)}`} data-carousel-slide type="button" draggable={false} onDragStart={(event) => event.preventDefault()} onClick={() => scrollEditorToSlide(index)} style={{ width: 518, height: 621, borderRadius: 31, background: "#fff", border: "6px solid #fff", boxShadow: carouselSlideShadow, padding: 0, flex: "0 0 518px", overflow: "hidden", scrollSnapAlign: "center", cursor: "grab", transition: "box-shadow 0.2s ease", userSelect: "none", WebkitUserSelect: "none" }}>
            <CarouselSlideCanvas payload={decodeCarouselSlide(slide)} raw={slide} scale={0.9} />
          </button>
        ))}
      </div>
      <div onClick={(event) => event.stopPropagation()} style={{ position: "absolute", left: "50%", bottom: generatedSlides.length > 1 ? 74 : 26, transform: "translateX(-50%)", zIndex: 10, display: "none", alignItems: "center", gap: 8, padding: 8, borderRadius: 999, background: "#fff", border: "1px solid rgba(18,26,46,0.1)", boxShadow: carouselPanelShadow }}>
        <button type="button" onClick={() => setShowGeneratedSlidePagePicker((current) => !current)} style={{ minHeight: 36, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#f6f6f6", color: "#121a2e", padding: "0 13px", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 12, fontWeight: 750, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          <Plus size={14} />
          Ajouter
        </button>
        <button type="button" title="Deplacer vers la gauche" onClick={() => moveGeneratedCarouselSlide(activeSlide, -1)} disabled={activeSlide <= 0} style={{ width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", color: "#121a2e", display: "grid", placeItems: "center", cursor: activeSlide <= 0 ? "not-allowed" : "pointer", opacity: activeSlide <= 0 ? 0.35 : 1 }}>
          <ArrowLeft size={14} />
        </button>
        <button type="button" title="Deplacer vers la droite" onClick={() => moveGeneratedCarouselSlide(activeSlide, 1)} disabled={activeSlide >= generatedSlides.length - 1} style={{ width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", color: "#121a2e", display: "grid", placeItems: "center", cursor: activeSlide >= generatedSlides.length - 1 ? "not-allowed" : "pointer", opacity: activeSlide >= generatedSlides.length - 1 ? 0.35 : 1 }}>
          <ArrowRight size={14} />
        </button>
        <button type="button" title="Supprimer la page" onClick={() => removeGeneratedCarouselSlide(activeSlide)} disabled={generatedSlides.length <= 1} style={{ width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(239,12,12,0.14)", background: "#fff", color: "#ef0c0c", display: "grid", placeItems: "center", cursor: generatedSlides.length <= 1 ? "not-allowed" : "pointer", opacity: generatedSlides.length <= 1 ? 0.35 : 1 }}>
          <Trash2 size={14} />
        </button>
        {showGeneratedSlidePagePicker ? (
          <div style={{ position: "absolute", left: "50%", bottom: 54, transform: "translateX(-50%)", width: 520, maxHeight: 390, overflowY: "auto", borderRadius: 22, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 28px 70px rgba(18,26,46,0.18)", padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {filteredCarouselPickerPages.map((page) => {
              const previewPayload = getCarouselPreviewPayload(page, null);
              return (
                <button key={page.id} type="button" onClick={() => addGeneratedCarouselSlide(page.id)} style={{ border: "1px solid rgba(18,26,46,0.08)", borderRadius: 16, background: page.id === FREE_CAROUSEL_PAGE_ID ? "#fbfbfb" : "#fff", padding: 10, minHeight: 168, textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  {renderSlideMiniPreview(previewPayload, 92, 110, 12)}
                  <strong style={{ fontSize: 11, lineHeight: "15px", fontWeight: 750, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{page.name}</strong>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      {generatedSlides.length > 0 ? (
        <div onClick={(event) => event.stopPropagation()} style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "center", padding: "8px 12px", minWidth: 70, height: 52, borderRadius: 122, background: "#3f3f3f", boxShadow: "0px 21px 8px rgba(0,0,0,0.01), 0px 12px 7px rgba(0,0,0,0.05), 0px 5px 5px rgba(0,0,0,0.09), 0px 1px 3px rgba(0,0,0,0.1)", zIndex: 11 }}>
          {generatedSlides.map((_, index) => <button key={index} type="button" onClick={() => scrollEditorToSlide(index)} style={{ width: 12, height: 12, padding: 0, border: 0, borderRadius: 999, background: activeSlide === index ? "#fff" : "rgba(255,255,255,0.19)", cursor: "pointer" }} />)}
          <span style={{ width: 1, height: 24, background: "rgba(255,255,255,0.18)", margin: "0 4px" }} />
          <button type="button" title="Ajouter une page" onClick={() => setShowGeneratedSlidePagePicker((current) => !current)} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><Plus size={14} /></button>
          <button type="button" title="Deplacer vers la gauche" onClick={() => moveGeneratedCarouselSlide(activeSlide, -1)} disabled={activeSlide <= 0} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)", color: "#fff", display: "grid", placeItems: "center", cursor: activeSlide <= 0 ? "not-allowed" : "pointer", opacity: activeSlide <= 0 ? 0.35 : 1 }}><ArrowLeft size={14} /></button>
          <button type="button" title="Deplacer vers la droite" onClick={() => moveGeneratedCarouselSlide(activeSlide, 1)} disabled={activeSlide >= generatedSlides.length - 1} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)", color: "#fff", display: "grid", placeItems: "center", cursor: activeSlide >= generatedSlides.length - 1 ? "not-allowed" : "pointer", opacity: activeSlide >= generatedSlides.length - 1 ? 0.35 : 1 }}><ArrowRight size={14} /></button>
          <button type="button" title="Supprimer la page" onClick={() => removeGeneratedCarouselSlide(activeSlide)} disabled={generatedSlides.length <= 1} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(255,95,95,0.24)", background: "rgba(255,255,255,0.08)", color: "#ff9a9a", display: "grid", placeItems: "center", cursor: generatedSlides.length <= 1 ? "not-allowed" : "pointer", opacity: generatedSlides.length <= 1 ? 0.35 : 1 }}><Trash2 size={14} /></button>
        </div>
      ) : null}
      {showGeneratedSlidePagePicker ? (
        <div onClick={(event) => event.stopPropagation()} style={{ position: "absolute", left: "50%", bottom: 78, transform: "translateX(-50%)", width: 520, maxHeight: 390, overflowY: "auto", borderRadius: 22, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 28px 70px rgba(18,26,46,0.18)", padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, zIndex: 12 }}>
          {filteredCarouselPickerPages.map((page) => {
            const previewPayload = getCarouselPreviewPayload(page, null);
            return (
              <button key={page.id} type="button" onClick={() => addGeneratedCarouselSlide(page.id)} style={{ border: "1px solid rgba(18,26,46,0.08)", borderRadius: 16, background: page.id === FREE_CAROUSEL_PAGE_ID ? "#fbfbfb" : "#fff", padding: 10, minHeight: 168, textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                {renderSlideMiniPreview(previewPayload, 92, 110, 12)}
                <strong style={{ fontSize: 11, lineHeight: "15px", fontWeight: 750, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{page.name}</strong>
              </button>
            );
          })}
        </div>
      ) : null}
      <div style={{ display: "none", position: "absolute", left: 46, right: 46, bottom: 45, height: 66, borderRadius: 62, border: "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: carouselPanelShadow, alignItems: "center", justifyContent: "space-between", padding: 12 }}>
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
                        <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Rechercher un modele..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#121a2e" }} autoFocus />
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
    <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden", background: "#fbfbfb", position: "relative" }}>
      {(generating || carouselApplyingEdit) && postsMode === "carousel" ? (
        <div style={{ position: "absolute", inset: 0, zIndex: 70, background: "rgba(251,251,251,0.78)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto" }}>
          <div style={{ width: 390, borderRadius: 24, background: "#fff", border: "1px solid rgba(18,26,46,0.1)", boxShadow: "0 28px 70px rgba(18,26,46,0.16)", padding: 24, display: "grid", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 46, height: 46, borderRadius: 16, background: "#121a2e", color: "#fff", display: "grid", placeItems: "center" }}>
                <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
              </span>
              <div>
                <strong style={{ display: "block", fontSize: 17, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Generation du carrousel</strong>
                <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "rgba(18,26,46,0.56)", lineHeight: 1.45 }}>{carouselGenerationPhase || (carouselApplyingEdit ? "Application des modifications" : "Preparation du contenu")}</span>
              </div>
            </div>
            <div style={{ display: "grid", gap: 9 }}>
              {[
                "Analyse de la source",
                "Choix de la structure",
                "Redaction des slides",
                "Preparation de la preview",
              ].map((step) => {
                const active = (carouselGenerationPhase || "").toLowerCase().includes(step.split(" ")[0].toLowerCase());
                return (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 28 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: active ? "#0147ff" : "rgba(18,26,46,0.16)", boxShadow: active ? "0 0 0 5px rgba(1,71,255,0.1)" : "none" }} />
                    <span style={{ fontSize: 13, fontWeight: active ? 800 : 650, color: active ? "#121a2e" : "rgba(18,26,46,0.48)" }}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      {activeCarouselEditor && (carouselHasGeneratedSlides && carouselStudioMode === "generate" ? renderEditorMode() : renderEditorBeforeClick())}
      {carouselStudioTab === "templates" && renderTemplateMode()}
      {carouselStudioTab === "templates" || (activeCarouselEditor && carouselHasGeneratedSlides && carouselStudioMode === "generate") ? renderRightList() : null}
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
                const previewPayload = getCarouselPreviewPayload(page, null);
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
      {carouselTemplateMenu ? (
        <div onClick={() => setCarouselTemplateMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ position: "fixed", left: carouselTemplateMenu.x, top: carouselTemplateMenu.y, width: 190, borderRadius: 14, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 18px 50px rgba(18,26,46,0.16)", padding: 6, display: "grid", gap: 4 }}>
            <button type="button" onClick={() => startRenameCarouselTemplate(carouselTemplateMenu.id)} style={{ border: 0, borderRadius: 10, background: "transparent", padding: "10px 12px", textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: 750, color: "#121a2e" }}>Renommer</button>
            <button type="button" onClick={() => deleteCarouselTemplate(carouselTemplateMenu.id)} style={{ border: 0, borderRadius: 10, background: "transparent", padding: "10px 12px", textAlign: "left", cursor: "pointer", fontSize: 13, fontWeight: 750, color: "#ef0c0c" }}>Supprimer</button>
          </div>
        </div>
      ) : null}
      {showCarouselTemplatePicker && (
        <div onClick={() => setShowCarouselTemplatePicker(false)} style={{ position: "absolute", inset: 0, zIndex: 31, background: "rgba(255,255,255,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: "min(92vw, 1200px)", maxHeight: "94vh", overflow: "hidden", borderRadius: 22, background: "#fff", border: "1px solid rgba(18,26,46,0.1)", boxShadow: "0 28px 70px rgba(18,26,46,0.18)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 16, borderBottom: "1px solid rgba(18,26,46,0.08)", display: "flex", alignItems: "center", gap: 10 }}>
              <Search size={16} />
              <input value={carouselTemplateSearch} onChange={(event) => setCarouselTemplateSearch(event.target.value)} placeholder="Rechercher une template..." style={{ flex: 1, border: 0, outline: "none", fontSize: 14 }} />
              <button type="button" onClick={() => setShowCarouselTemplatePicker(false)} style={{ border: 0, background: "transparent", cursor: "pointer", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 22, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 280px))", justifyContent: "center", gap: 24, alignItems: "start", minHeight: 0 }}>
              <button type="button" onClick={() => { setCarouselUseTemplate(false); setCarouselGenerationTemplateId(""); setSelectedCarouselTemplateId(""); }} style={{ position: "relative", width: 280, minHeight: 292, borderRadius: 24, border: !carouselUseTemplate ? "1px solid rgba(1,71,255,0.34)" : "1px dashed rgba(18,26,46,0.16)", background: !carouselUseTemplate ? "rgba(1,71,255,0.05)" : "#fbfbfb", boxShadow: !carouselUseTemplate ? "0px 20px 12px rgba(1,71,255,0.02), 0px 9px 9px rgba(1,71,255,0.03), 0px 2px 5px rgba(1,71,255,0.03)" : carouselPanelShadow, padding: 28, textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, overflow: "visible" }}>
                <span style={{ width: 54, height: 54, borderRadius: 18, background: "#121a2e", color: "#fff", display: "grid", placeItems: "center", boxShadow: "0 12px 26px rgba(18,26,46,0.16)" }}><Wand2 size={22} /></span>
                <strong style={{ display: "block", fontSize: 14, lineHeight: "19px", color: "#121a2e", textAlign: "center" }}>Sans template</strong>
                <span style={{ maxWidth: 250, fontSize: 12, lineHeight: 1.45, color: "rgba(18,26,46,0.52)" }}>L'IA choisit une sequence JSON controlee: image au debut, CTA a la fin, sans avis ni avant/apres.</span>
              </button>
              {filteredCarouselTemplates.map((template) => (
                <button key={template.id} type="button" onContextMenu={(event) => { event.preventDefault(); setCarouselTemplateMenu({ id: template.id, x: event.clientX, y: event.clientY }); }} onClick={() => { setCarouselUseTemplate(true); setSelectedCarouselTemplateId(template.id); setCarouselGenerationTemplateId(template.id); }} style={{ position: "relative", width: 280, minHeight: 292, borderRadius: 24, border: carouselUseTemplate && template.id === (carouselGenerationTemplateId || selectedCarouselTemplateId) ? "1px solid rgba(1,71,255,0.28)" : "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: carouselPanelShadow, padding: 28, textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, overflow: "visible" }}>
                  <span style={{ display: "flex", justifyContent: "center" }}>
                    {renderTemplateStackPreview(template)}
                  </span>
                  {renamingCarouselTemplateId === template.id ? (
                    <input value={renamingCarouselTemplateName} onClick={(event) => event.stopPropagation()} onChange={(event) => setRenamingCarouselTemplateName(event.target.value)} onBlur={commitRenameCarouselTemplate} onKeyDown={(event) => { if (event.key === "Enter") commitRenameCarouselTemplate(); if (event.key === "Escape") { setRenamingCarouselTemplateId(""); setRenamingCarouselTemplateName(""); } }} autoFocus style={{ width: "100%", border: "1px solid rgba(18,26,46,0.14)", borderRadius: 10, padding: "8px 10px", fontSize: 13, fontWeight: 700, color: "#121a2e", textAlign: "center" }} />
                  ) : (
                    <strong style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 15, lineHeight: "21px", fontWeight: 600, color: "#121a2e", maxWidth: 190, minHeight: 42, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", textAlign: "center" }}>{template.name}</strong>
                  )}
                </button>
              ))}
            </div>
            <div style={{ padding: 20, borderTop: "1px solid rgba(18,26,46,0.08)", display: carouselCreateStep === "setup" ? "flex" : "none", flexDirection: "column", gap: 10 }}>
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
              {selectedCarouselTemplateForPicker || !carouselUseTemplate ? (
                <>
                  <ClientBlueButton type="button" onClick={() => setCarouselCreateStep("ai-source")} icon={<Wand2 size={14} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%" }} disabled={!carouselDraftName.trim() || !carouselDraftCategory}>
                    Generer avec l'IA
                  </ClientBlueButton>
                  {carouselUseTemplate && selectedCarouselTemplateForPicker ? <button type="button" onClick={() => startCarouselManualEditing(selectedCarouselTemplateForPicker)} disabled={!carouselDraftName.trim() || !carouselDraftCategory} style={{ width: "100%", minHeight: 44, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    Demarrer manuellement
                  </button> : null}
                  {!carouselUseTemplate ? <button type="button" onClick={startFreeCarouselManualEditing} disabled={!carouselDraftName.trim() || !carouselDraftCategory} style={{ width: "100%", minHeight: 44, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    Creer librement
                  </button> : null}
                </>
              ) : null}
            </div>
            <div style={{ padding: 20, borderTop: "1px solid rgba(18,26,46,0.08)", display: carouselCreateStep === "ai-source" ? "flex" : "none", flexDirection: "column", gap: 14 }}>
              <button type="button" onClick={() => setCarouselCreateStep("setup")} style={{ alignSelf: "flex-start", border: 0, background: "transparent", color: "rgba(18,26,46,0.58)", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Retour
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <strong style={{ fontSize: 16, color: "#121a2e" }}>Source du carrousel</strong>
                <span style={{ fontSize: 13, color: "rgba(18,26,46,0.52)", lineHeight: 1.5 }}>Choisis la matiere premiere. Les URLs et YouTube sont recuperes avant d'envoyer le contenu au modele de carrousel.</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {([
                  { id: "idea", icon: <Lightbulb size={14} />, label: "Idee" },
                  { id: "manual", icon: <AlignLeft size={14} />, label: "Libre" },
                  { id: "url", icon: <Link2 size={14} />, label: "Site" },
                  { id: "youtube", icon: <Youtube size={14} />, label: "YouTube" },
                ] as { id: SourceTab; icon: React.ReactNode; label: string }[]).map((item) => (
                  <button key={item.id} type="button" onClick={() => { setCarouselSourceTab(item.id); setCarouselSourceContext(""); }} style={{ minHeight: 44, borderRadius: 14, border: carouselSourceTab === item.id ? "1px solid rgba(1,71,255,0.34)" : "1px solid rgba(18,26,46,0.12)", background: carouselSourceTab === item.id ? "rgba(1,71,255,0.08)" : "#fff", color: carouselSourceTab === item.id ? "#0147ff" : "#121a2e", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
              {carouselSourceTab === "idea" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <select value={carouselSourceIdeaId} onChange={(event) => {
                    const ideaId = event.target.value;
                    const idea = ideas.find((entry) => entry.id === ideaId);
                    setCarouselSourceIdeaId(ideaId);
                    if (idea) setCarouselSourceValue(`${idea.title}\n\n${idea.description}`.trim());
                  }} style={{ ...inp, minHeight: 44, background: "#f2f2f2", borderRadius: 12 }}>
                    <option value="">Choisir une idee existante</option>
                    {ideas.map((idea) => (
                      <option key={idea.id} value={idea.id}>{idea.title}</option>
                    ))}
                  </select>
                  <textarea value={carouselSourceValue} onChange={(event) => setCarouselSourceValue(event.target.value)} rows={4} placeholder={carouselSourceIdeaId ? "Ajoute ou modifie les informations de l'idee..." : "Ecris librement la matiere du carrousel..."} style={{ ...inp, minHeight: 110, background: "#f2f2f2", borderRadius: 12, resize: "vertical" }} />
                </div>
              ) : carouselSourceTab === "manual" ? (
                <textarea value={carouselSourceValue} onChange={(event) => setCarouselSourceValue(event.target.value)} rows={5} placeholder="Ecris librement la matiere du carrousel..." style={{ ...inp, minHeight: 132, background: "#f2f2f2", borderRadius: 12, resize: "vertical" }} />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <input value={carouselSourceValue} onChange={(event) => setCarouselSourceValue(event.target.value)} placeholder={carouselSourceTab === "youtube" ? "URL YouTube" : "URL du site"} style={{ ...inp, minHeight: 44, background: "#f2f2f2", borderRadius: 12 }} />
                  <textarea value={carouselSourceContext} onChange={(event) => setCarouselSourceContext(event.target.value)} rows={3} placeholder="Ajouter du contexte pour guider l'IA..." style={{ ...inp, minHeight: 92, background: "#f2f2f2", borderRadius: 12, resize: "vertical" }} />
                </div>
              )}
              <ClientBlueButton type="button" onClick={() => setCarouselCreateStep("ai-assets")} icon={<ArrowRight size={14} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%" }} disabled={!carouselSourceValue.trim()}>
                Continuer
              </ClientBlueButton>
            </div>
            <div style={{ padding: 20, borderTop: "1px solid rgba(18,26,46,0.08)", display: carouselCreateStep === "ai-assets" ? "flex" : "none", flexDirection: "column", gap: 14 }}>
              <button type="button" onClick={() => setCarouselCreateStep("ai-source")} style={{ alignSelf: "flex-start", border: 0, background: "transparent", color: "rgba(18,26,46,0.58)", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Retour
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <strong style={{ fontSize: 16, color: "#121a2e" }}>Photos du carrousel</strong>
                <span style={{ fontSize: 13, color: "rgba(18,26,46,0.52)", lineHeight: 1.5 }}>Importe les photos disponibles. L'IA les recoit comme assets, puis le code les place dans les slides image ou argument.</span>
              </div>
              <label
                onDragOver={(event) => { event.preventDefault(); setCarouselAssetsDragActive(true); }}
                onDragLeave={() => setCarouselAssetsDragActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  void addCarouselImageFiles(event.dataTransfer.files);
                }}
                style={{
                  minHeight: 118,
                  padding: "20px 12px",
                  boxSizing: "border-box",
                  borderRadius: 9,
                  border: carouselAssetsDragActive ? "1px dashed rgba(18,26,46,0.45)" : "1px dashed rgba(0,0,0,0.16)",
                  background: carouselAssetsDragActive ? "#f1f3f5" : "#f6f6f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "background 0.18s ease, border 0.18s ease",
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 13, alignItems: "center" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 999, background: "#fff", border: "1px solid #e1e4e8", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px rgba(18,26,46,0.08)" }}>
                    <Upload size={16} style={{ color: "#6f7887" }} />
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 500, color: "rgba(18,26,46,0.7)" }}>Importer des photos ici</span>
                  <span style={{ fontFamily: '"Inter", sans-serif', fontSize: 13, fontWeight: 500, color: "rgba(18,26,46,0.5)" }}>Clique ici ou glisse des fichiers ici</span>
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(event) => {
                    if (event.target.files) void addCarouselImageFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {carouselImageAssets.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
                  {carouselImageAssets.map((asset, index) => (
                    <div key={asset.id} style={{ borderRadius: 14, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", padding: 10, display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 54, height: 60, borderRadius: 8, background: `url(${asset.url}) center / cover`, border: "2px solid #fff", boxShadow: "0 8px 18px rgba(18,26,46,0.1)", flexShrink: 0 }} />
                        <span style={{ minWidth: 0, display: "grid", gap: 3 }}>
                          <strong style={{ fontSize: 12, color: "#121a2e" }}>Photo {index + 1}</strong>
                          <span style={{ fontSize: 11, color: "rgba(18,26,46,0.48)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{asset.fileName}</span>
                        </span>
                        <button type="button" onClick={() => removeCarouselImageAsset(asset.id)} style={{ marginLeft: "auto", width: 28, height: 28, borderRadius: 999, border: 0, background: "#FBFBFB", color: "rgba(18,26,46,0.72)", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={14} /></button>
                      </div>
                      <input value={asset.description} onChange={(event) => updateCarouselImageAsset(asset.id, { description: event.target.value })} placeholder="Description optionnelle pour aider l'IA" style={{ ...inp, minHeight: 38, background: "#f6f6f6", borderRadius: 10, fontSize: 12 }} />
                    </div>
                  ))}
                </div>
              ) : null}
              <ClientBlueButton type="button" onClick={() => setCarouselCreateStep("ai-options")} icon={<ArrowRight size={14} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%" }}>
                Continuer
              </ClientBlueButton>
            </div>
            <div style={{ padding: 20, borderTop: "1px solid rgba(18,26,46,0.08)", display: carouselCreateStep === "ai-options" ? "flex" : "none", flexDirection: "column", gap: 14 }}>
              <button type="button" onClick={() => setCarouselCreateStep("ai-assets")} style={{ alignSelf: "flex-start", border: 0, background: "transparent", color: "rgba(18,26,46,0.58)", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <ArrowLeft size={14} /> Retour
              </button>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <strong style={{ fontSize: 16, color: "#121a2e" }}>Options de generation IA</strong>
                <span style={{ fontSize: 13, color: "rgba(18,26,46,0.52)", lineHeight: 1.5 }}>Choisis si les slides qui acceptent une image doivent etre preparees pour une generation d'image IA.</span>
              </div>
              <label style={{ display: "grid", gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(18,26,46,0.62)" }}>Modele de generation du carrousel</span>
                <select
                  value={settings?.carouselContentModel || settings?.model || ""}
                  onChange={(event) => {
                    const nextModel = event.target.value;
                    setSettings((current) => {
                      const nextSettings = { ...(current ?? loadLinkedInSettings()), carouselContentModel: nextModel };
                      queueRemoteLinkedInSettingsSync(nextSettings);
                      void persistRemoteLinkedInSettings(nextSettings);
                      return nextSettings;
                    });
                  }}
                  style={{ ...inp, minHeight: 44, background: "#f2f2f2", borderRadius: 12 }}
                >
                  {modelOptions.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setCarouselGenerateImagesWithAI((value) => !value)} style={{ minHeight: 54, borderRadius: 14, border: carouselGenerateImagesWithAI ? "1px solid rgba(1,71,255,0.34)" : "1px solid rgba(18,26,46,0.12)", background: carouselGenerateImagesWithAI ? "rgba(1,71,255,0.08)" : "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 16px", cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#121a2e" }}>
                Generer les images avec IA
                <span style={{ width: 38, height: 22, borderRadius: 999, background: carouselGenerateImagesWithAI ? "#0147ff" : "#d8d8d8", display: "flex", alignItems: "center", justifyContent: carouselGenerateImagesWithAI ? "flex-end" : "flex-start", padding: 3 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 999, background: "#fff" }} />
                </span>
              </button>
              <ClientBlueButton type="button" onClick={() => void startCarouselGeneration(selectedCarouselTemplateForPicker ?? undefined)} icon={carouselSourceLoading || generating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={14} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%" }} disabled={(carouselUseTemplate && !selectedCarouselTemplateForPicker) || carouselSourceLoading || generating}>
                {carouselSourceLoading ? "Recuperation..." : generating ? "Generation..." : "Demarrer la generation"}
              </ClientBlueButton>
            </div>
          </div>
        </div>
      )}
      {carouselHistoryDetails ? (
        <div onClick={() => setCarouselHistoryDetails(null)} style={{ position: "absolute", inset: 0, zIndex: 42, background: "rgba(255,255,255,0.62)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(event) => event.stopPropagation()} style={{ width: 520, maxWidth: "92vw", maxHeight: "72vh", overflow: "hidden", borderRadius: 22, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 28px 70px rgba(18,26,46,0.18)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(18,26,46,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <strong style={{ display: "block", fontSize: 15, color: "#121a2e" }}>{carouselHistoryDetails.label}</strong>
                <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "rgba(18,26,46,0.5)" }}>{carouselHistoryDetails.details?.length ?? 0} modifications</span>
              </div>
              <button type="button" onClick={() => setCarouselHistoryDetails(null)} style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: "#FBFBFB", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", display: "grid", gap: 10 }}>
              {(carouselHistoryDetails.details ?? []).map((detail, index) => (
                <div key={`${detail}-${index}`} style={{ borderRadius: 14, background: "#FBFBFB", padding: "12px 14px", fontSize: 12, lineHeight: 1.55, color: "rgba(18,26,46,0.76)" }}>{detail}</div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
  const showCarouselEditorSidebar = postsMode === "carousel" && activeCarouselEditor && carouselHasGeneratedSlides && carouselStudioMode === "generate";
  const showCarouselBuilderSidebar = postsMode === "carousel" && carouselStudioTab === "templates";
  const showCarouselGeneratedSidebar = postsMode === "carousel" && activeCarouselEditor && carouselHasGeneratedSlides && carouselStudioMode === "generate";
  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", ...jk }}>
      {/* Left: Create panel */}
      <div style={{ width: 384, borderRight: "1px solid rgba(0,0,0,0.09)", background: "#fff", display: postsMode === "post" ? "none" : "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto", position: "relative", zIndex: 4 }}>
        <div style={{ padding: postsMode === "post" ? "0 20px" : "16px 20px", borderBottom: postsMode === "post" ? "none" : "1px solid rgba(0,0,0,0.07)" }}>
          {postsMode !== "post" ? (
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>
              {showCarouselBuilderSidebar
                ? "Parametres de template"
                : "Creer un post"}
            </h2>
          ) : null}

          {postsMode === "carousel" ? (
            <div style={{ marginTop: 12 }}>
              {renderCarouselTabs()}
            </div>
          ) : null}

          {/* Source tabs */}
          {!isCarouselRoute && !rightEditorVisible && !showCarouselBuilderSidebar && postsMode !== "post" && <div style={{ display: "flex", gap: 2, marginTop: 12, background: "#f2f2f2", borderRadius: 9, padding: 3 }}>
            {([
              { id: "idea", icon: <Lightbulb size={12} />, label: "Idee" },
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
          {postsMode === "post" && !rightEditorVisible ? (
            <div style={{ display: "flex", flexDirection: "column", paddingTop: 16 }}>
              <ClientBlueButton type="button" onClick={startManualPost} wrapperStyle={{ width: "100%" }} style={{ width: "100%", minHeight: 54, fontSize: 16, padding: "0 22px" }}>
                Creer un post
              </ClientBlueButton>
            </div>
          ) : showCarouselBuilderSidebar ? (
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
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#121a2e" }}>Prompt global du carrousel</label>
                  <textarea
                    rows={14}
                    readOnly
                    value={selectedCarouselTemplate ? buildCarouselGlobalPrompt(selectedCarouselTemplate) : ""}
                    style={{ ...inp, background: "#f2f2f2", borderRadius: 12, resize: "vertical", lineHeight: 1.5, minHeight: 280, fontFamily: "monospace" }}
                  />
                  <p style={{ margin: 0, fontSize: 11, color: "rgba(18,26,46,0.45)" }}>Ce prompt est la concatenation automatique de tous les pre-prompts des pages du template.</p>
                </div>
              )}

            </div>
          ) : showCarouselGeneratedSidebar ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "100%" }}>
              {renderGeneratedCarouselSlideFields()}
              <button
                type="button"
                onClick={downloadCurrentCarousel}
                disabled={generatedSlides.length === 0}
                style={{ display: "none", width: "100%", minHeight: 46, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', alignItems: "center", justifyContent: "center", gap: 8, marginTop: "auto", opacity: generatedSlides.length === 0 ? 0.5 : 1 }}
              >
                <Download size={14} />
                Telecharger
              </button>
            </div>
          ) : postsMode === "carousel" ? (
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }} />
          ) : rightEditorVisible ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "none" }}>
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
              <div style={{ display: "none" }}>
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
                  Planifier
                </button>
              </div>
            </div>
          ) : (
          <>
          {/* Source input */}
          {sourceTab === "idea" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>S?lectionner une id?e</label>
              {ideas.filter(i => i.status === "new").length > 0 ? (
                <select value={selectedIdeaId} onChange={e => setSelectedIdeaId(e.target.value)} style={inp}>
                  <option value="">? Choisir une id?e ?</option>
                  {ideas.filter(i => i.status === "new").map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                </select>
              ) : (
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", fontStyle: "italic" }}>Aucune id?e disponible. Allez dans l&apos;onglet Id?es pour en g?n?rer.</p>
              )}
              <div style={{ marginTop: 8 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Ajouter des pr?cisions</label>
                <textarea rows={3} value={manualIdea} onChange={e => setManualIdea(e.target.value)}
                  placeholder="Ajoute un angle, une nuance, un exemple ? int?grer..."
                  style={{ ...inp, resize: "none", lineHeight: 1.6 }} />
              </div>
            </div>
          )}

          {(sourceTab === "url" || sourceTab === "youtube") && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>
                {sourceTab === "youtube" ? "URL de la vid?o YouTube" : "URL de l&apos;article"}
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
              <div style={{ marginTop: 8 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Ajouter du contexte</label>
                <textarea rows={3} value={sourceContext} onChange={e => setSourceContext(e.target.value)}
                  placeholder="Ajoute l'angle, l'objectif du post ou les infos importantes a garder..."
                  style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
              </div>
            </div>
          )}

          {sourceTab === "manual" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Votre id?e / contenu</label>
              <textarea rows={5} value={manualIdea} onChange={e => setManualIdea(e.target.value)}
                placeholder="D?crivez votre id?e, copiez un texte brut, vos notes..."
                style={{ ...inp, resize: "none", lineHeight: 1.6 }} />
            </div>
          )}

          {/* Style */}
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6 }}>Style de r?daction</label>
            {renderPostStyleSelector(selectedStyleId, setSelectedStyleId)}
          </div>

          {/* Generate button */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8 }}>
          <ClientBlueButton type="button" onClick={handleGenerate} loading={generating} icon={<Wand2 size={14} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%", fontSize: 14 }}>
            {generating ? "G?n?ration..." : "G?n?rer avec l&apos;IA"}
          </ClientBlueButton>
            {postsMode === "post" && (
              <button type="button" onClick={startManualPost} style={{ minHeight: 48, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 13, background: "#fff", color: "#121a2e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', boxShadow: "0px 4px 12px rgba(18,26,46,0.06)" }}>
                D?marrer manuellement
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
              T?l?charger
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
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#121a2e", marginBottom: 6, marginTop: 0 }}>Post g?n?r?</p>
                  <SmartSelectionTextarea
                    rows={10}
                    value={generatedContent}
                    onChange={setGeneratedContent}
                    contextLabel="post LinkedIn"
                    globalLabel="Am?liorer tout le post"
                    apiKey={settings?.openrouterApiKey || undefined}
                    model={settings?.model}
                    prompt={settings?.editActionGeneralPrompt}
                    aiCommands={smartSelectionCommands}
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
            { label: "Planifies", value: stats.scheduled, color: "#073e63" },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 12, color: "rgba(18,26,46,0.4)" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Posts grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: rightEditorVisible ? 0 : 24 }}>
          <div style={{ display: rightEditorVisible ? "none" : "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, borderRadius: 999, background: "#ededed" }}>
              {([
                ["draft", "Brouillons", stats.drafts],
                ["scheduled", "Planifies", stats.scheduled],
                ["auto", "Auto-planification", stats.auto],
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
            {postsView === "auto" ? (
              <button type="button" onClick={() => setAutoRecycleSettingsOpen(true)} style={{ minHeight: 36, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", padding: "0 13px", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: '"Plus Jakarta Sans", sans-serif', boxShadow: "0px 4px 12px rgba(18,26,46,0.05)" }}>
                <Settings size={14} />
                Parametres
              </button>
            ) : null}
            {postsView !== "auto" ? (
              <ClientBlueButton type="button" onClick={startManualPost} wrapperStyle={{ width: "auto" }} style={{ fontSize: 14, minHeight: 48, padding: "0 22px" }}>
                Creer un nouveau post
              </ClientBlueButton>
            ) : null}
          </div>

          {rightEditorVisible ? (
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "580px minmax(0, 1fr)", gridTemplateRows: "64px minmax(0, 1fr)", columnGap: 128, rowGap: 0, alignItems: "stretch", height: "100%", minHeight: 0, paddingRight: 0, paddingBottom: 0, boxSizing: "border-box", width: "100%" }}>
            {(editorChatLoading || editorApplyingEdit) ? (
              <img
                src="/linkedin-chat-loader.svg"
                alt=""
                aria-hidden="true"
                style={{ position: "absolute", top: -354, left: "calc(580px + 128px + (100% - 580px - 128px) / 2)", width: "calc(125% - 610px)", height: 888, transform: "translateX(-54%)", objectFit: "fill", pointerEvents: "none", opacity: 0, animation: "editorLoaderIn 0.42s ease-in-out forwards, editorLoaderPulse 2s ease-in-out 0.42s infinite alternate", zIndex: 2, transition: "opacity 0.28s ease" }}
              />
            ) : null}
            <div style={{ position: "relative", zIndex: 4, gridColumn: "1 / -1", gridRow: 1, minHeight: 64, borderBottom: "1px solid rgba(18,26,46,0.06)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 24px" }}>
              <button type="button" onClick={resetEditor} style={{ minHeight: 38, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                <ArrowLeft size={14} />
                Retourner a l&apos;accueil
              </button>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: STATUS_STYLES.draft.bg, color: STATUS_STYLES.draft.color }}>Brouillon</span>
                <button type="button" onClick={() => { setViralityOpen(true); if (!viralityResult && generatedContent.trim()) void analyzeVirality(); }} title="Statistiques predites" style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0px 4px 12px rgba(18,26,46,0.06)" }}>
                  <BarChart3 size={16} />
                </button>
                <ClientBlueButton compact type="button" onClick={() => openScheduleOverlay()} disabled={saving || !generatedContent.trim()} icon={<CalendarIcon size={15} />} wrapperStyle={{ width: "auto" }} style={{ minHeight: 40, padding: "0 18px", fontSize: 13, fontWeight: 650 }}>
                  Planifier
                </ClientBlueButton>
              </div>
            </div>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void handleDraftMedia(file);
              }}
              style={{ position: "relative", zIndex: 1, gridColumn: 2, gridRow: 2, background: "transparent", border: "none", borderRadius: 0, boxShadow: "none", padding: "24px 24px 24px 0", display: "flex", flexDirection: "column", gap: 18, maxWidth: "none", minWidth: 0, minHeight: 0 }}
            >
              <div style={{ display: "none" }}>
                <button type="button" onClick={resetEditor} style={{ minHeight: 38, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  <ArrowLeft size={14} />
                  Retourner a l&apos;accueil
                </button>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: STATUS_STYLES.draft.bg, color: STATUS_STYLES.draft.color, marginLeft: "auto" }}>Brouillon</span>
              </div>
              <div style={{ position: "relative", width: "100%", maxWidth: 700, flex: 1, minHeight: 0, border: "1px solid rgba(18,26,46,0.08)", borderRadius: 20, background: "#fff", boxShadow: "none", padding: 20, display: "flex", flexDirection: "column", overflowX: "hidden", overflowY: "auto", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#d9d9d9", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, letterSpacing: "-0.03em", flexShrink: 0 }}>LS</div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", minHeight: 42 }}>
                    <strong style={{ display: "block", fontSize: 15, fontWeight: 700, color: "#121a2e" }}>Louis Staub</strong>
                    <div style={{ display: "none" }} />
                  </div>
                </div>
                <SmartSelectionTextarea
                  rows={18}
                  value={generatedContent}
                  onChange={setGeneratedContent}
                  placeholder="Ecris ton post ici..."
                  contextLabel="post LinkedIn"
                  showGlobalAction={false}
                  autoFit={false}
                  onHistory={pushEditorHistory}
                  onAiAction={(entry) => {
                    if (entry.scope === "format") return;
                  }}
                  apiKey={settings?.openrouterApiKey || undefined}
                  model={settings?.model}
                  prompt={settings?.editActionGeneralPrompt}
                  aiCommands={smartSelectionCommands}
                  onUseSelection={(text) => {
                    setSelectedChatText(text);
                    setEditorPanelMode("conversation");
                  }}
                  style={{ ...inp, flex: 1, minHeight: 0, overflowY: "auto", background: "#fff", border: "none", lineHeight: 1.55, fontSize: 15, padding: "0 0 24px", resize: "none", whiteSpace: "pre-wrap", fontFamily: 'Arial, Helvetica, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif' }}
                />
                <div style={{ marginTop: 16, marginBottom: 16 }}>
                  {draftMedia ? (
                  <div onMouseEnter={() => setHoveredDraftImage(true)} onMouseLeave={() => setHoveredDraftImage(false)} style={{ position: "relative", width: "100%", borderRadius: 16, overflow: "hidden", background: "#f5f7fa" }}>
                    <img src={draftMedia.url} alt="Image du post" style={{ display: "block", width: "100%", height: "auto" }} />
                    <button type="button" onClick={() => setDraftMedia(null)} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(18,26,46,0.14)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: hoveredDraftImage ? 1 : 0, transform: hoveredDraftImage ? "translateY(0px)" : "translateY(-6px)", transition: "opacity 0.18s ease, transform 0.18s ease" }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: "none", width: 34, height: 34, borderRadius: 999, border: 0, background: "#F6F6F6", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.58)", cursor: "pointer" }}>
                    <ImageIcon size={16} />
                    <input type="file" accept="image/*,.pdf,application/pdf" style={{ display: "none" }} onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleDraftMedia(file);
                      event.currentTarget.value = "";
                    }} />
                  </label>
                )}
                </div>
                <div style={{ position: "sticky", bottom: 0, zIndex: 3, background: "#fff", paddingTop: 12 }}>
                <div style={{ height: 1, background: "rgba(18,26,46,0.04)", margin: "0 0 12px" }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: "#F6F6F6", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.58)", cursor: "pointer", flexShrink: 0 }}>
                      <ImageIcon size={14} />
                      <input type="file" accept="image/*,.pdf,application/pdf" style={{ display: "none" }} onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleDraftMedia(file);
                        event.currentTarget.value = "";
                      }} />
                    </label>
                    <button type="button" onClick={() => void copyGeneratedPost()} title="Copier le post" style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: postCopied ? "rgba(22,139,100,0.1)" : "#F6F6F6", display: "flex", alignItems: "center", justifyContent: "center", color: postCopied ? "#168b64" : "rgba(18,26,46,0.58)", cursor: "pointer", flexShrink: 0, transition: "background 0.18s ease, color 0.18s ease" }}>
                      {postCopied ? <Check size={15} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.42)" }}>{countWords(generatedContent)} mots</span>
                </div>
                </div>
              </div>
              <div style={{ display: "none" }}>
                {chatInput.startsWith("/") && slashCommands.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {slashCommands.slice(0, 6).map((command) => (
                      <button key={command.id} type="button" onClick={() => setChatInput(`/${command.id} `)} style={{ border: "1px solid rgba(18,26,46,0.1)", borderRadius: 999, background: "#f7f7f7", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#121a2e", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        /{command.id}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                  <button type="button" style={{ width: 40, height: 40, borderRadius: 34, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#F6F6F6"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}><Plus size={18} /></button>
                  <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void runEditorChat(); } }} placeholder="Taper un texte ici" style={{ flex: 1, border: 0, outline: "none", color: "rgba(18,26,46,0.7)", fontSize: 16, fontWeight: 500, lineHeight: "20px", letterSpacing: "-0.2px", fontFamily: "Inter, sans-serif" }} />
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
                        <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Rechercher un modele..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#121a2e" }} autoFocus />
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
            </div>
            <aside style={{ position: "relative", zIndex: 3, gridColumn: 1, gridRow: 2, borderRight: "1px solid rgba(18,26,46,0.12)", borderRadius: 0, background: "#fff", boxShadow: "none", padding: 0, display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden", alignSelf: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "24px 24px 16px" }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#121a2e" }}>{editorPanelMode === "history" ? "Historique" : "Conversation"}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {editorPanelMode === "history" ? (
                    <button type="button" onClick={createEditorSnapshot} disabled={!generatedContent.trim()} style={{ minHeight: 34, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", color: "#121a2e", display: "inline-flex", alignItems: "center", gap: 7, padding: "0 11px", cursor: generatedContent.trim() ? "pointer" : "not-allowed", opacity: generatedContent.trim() ? 1 : 0.55, fontSize: 12, fontWeight: 750, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                      <Plus size={14} />
                      Sauvegarde
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setEditorPanelMode((current) => current === "history" ? "conversation" : "history")} style={{ width: 38, height: 38, borderRadius: 999, border: "1px solid rgba(0,0,0,0.07)", background: editorPanelMode === "history" ? "#FBFBFB" : "#fff", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    <History size={16} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, padding: "0 24px 0" }}>
                {editorPanelMode === "history" ? (
                  editorHistory.length === 0 && editorSnapshots.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(18,26,46,0.42)" }}>Aucune modification pour le moment.</p>
                  ) : (
                    <>
                      {editorSnapshots.length > 0 ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 850, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(18,26,46,0.42)" }}>Sauvegardes</p>
                          {editorSnapshots.map((snapshot) => (
                            <div key={snapshot.id} style={{ width: "100%", border: "1px solid rgba(18,26,46,0.08)", borderRadius: 18, background: "#fff", padding: "13px 14px", display: "grid", gap: 9, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                              <button type="button" onClick={() => restoreEditorSnapshot(snapshot)} style={{ border: 0, background: "transparent", padding: 0, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                                <span style={{ display: "block", fontSize: 13, fontWeight: 800, color: "#121a2e", marginBottom: 4 }}>{snapshot.label}</span>
                                <span style={{ display: "block", fontSize: 11, color: "rgba(18,26,46,0.42)" }}>Revenir a cette sauvegarde</span>
                              </button>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                                <button type="button" onClick={() => renameEditorSnapshot(snapshot)} style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid rgba(18,26,46,0.08)", background: "#FBFBFB", color: "rgba(18,26,46,0.65)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Renommer">
                                  <Edit3 size={13} />
                                </button>
                                <button type="button" onClick={() => deleteEditorSnapshot(snapshot.id)} style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid rgba(18,26,46,0.08)", background: "#FBFBFB", color: "rgba(18,26,46,0.65)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} title="Supprimer">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {editorHistory.length > 0 ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 850, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(18,26,46,0.42)" }}>Modifications IA</p>
                          {editorHistory.map((entry) => (
                            <button key={entry.id} type="button" onClick={() => restoreEditorHistory(entry)} style={{ width: "100%", border: 0, borderRadius: 18, background: "#FBFBFB", padding: "14px 16px", textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                              <span style={{ display: "block", fontSize: 13, fontWeight: 750, color: "#121a2e", marginBottom: 4 }}>{entry.label}</span>
                              <span style={{ display: "block", fontSize: 11, color: "rgba(18,26,46,0.42)" }}>Cliquer pour revenir a cette version</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )
                ) : editorChat.map((entry) => {
                  const isUser = entry.role === "user";
                  return (
                    <div
                      key={entry.id}
                      style={{
                        width: "fit-content",
                        maxWidth: "75%",
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        borderRadius: 20,
                        background: isUser ? "#F4F4F4" : "transparent",
                        padding: isUser ? "14px 16px" : 0,
                      }}
                    >
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(18,26,46,0.82)", whiteSpace: "pre-wrap" }}>
                        {entry.content}
                      </p>
                      {entry.images?.length ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          {entry.images.map((image) => (
                            <img key={`${entry.id}-${image.fileName}`} src={image.url} alt={image.fileName} style={{ width: 76, height: 76, borderRadius: 14, objectFit: "cover", border: "1px solid rgba(18,26,46,0.08)" }} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: "auto", width: "100%", background: "transparent", display: "flex", flexDirection: "column", gap: 8, padding: "12px 24px 16px" }}>
                {chatInput.startsWith("/") && slashCommands.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {slashCommands.slice(0, 6).map((command) => (
                      <button key={command.id} type="button" onClick={() => setChatInput(`/${command.id} `)} style={{ border: "1px solid rgba(18,26,46,0.1)", borderRadius: 999, background: "#f7f7f7", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "#121a2e", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        /{command.id}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div ref={chatComposerRef} style={{ position: "relative", width: "100%", minHeight: 132, borderRadius: 28, border: editorChatLoading ? "1px solid rgba(1,71,255,0.24)" : "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: editorChatLoading ? "0px 0px 0px 1px rgba(1,71,255,0.08), 0px 18px 48px rgba(1,71,255,0.18), 0px 12px 32px rgba(78,126,250,0.14)" : carouselPanelShadow, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "space-between", gap: 10, padding: 12, transition: "box-shadow 0.28s ease, border-color 0.28s ease, min-height 0.18s ease, gap 0.18s ease" }}>
                  {chatActionsOpen ? (
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(100% + 10px)", borderRadius: 18, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: carouselPanelShadow, padding: 10, display: "grid", gap: 6, maxHeight: 280, overflowY: "auto", zIndex: 12 }}>
                      {chatCommandCategories.map((category) => (
                        <div key={category} style={{ display: "grid", gap: 4 }}>
                          <p style={{ margin: "8px 8px 4px", fontSize: 10, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(18,26,46,0.42)" }}>{category}</p>
                          {smartSelectionCommands.filter((command) => command.category === category).map((command) => {
                            const Icon = command.icon;
                            const active = selectedChatCommandId === command.id;
                            return (
                              <button key={command.id} type="button" onClick={() => { setSelectedChatCommandId(command.id); setChatActionsOpen(false); }} style={{ border: 0, borderRadius: 12, background: active ? "#FBFBFB" : "transparent", padding: "9px 10px", display: "flex", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                                <span style={{ width: 24, height: 24, borderRadius: 999, background: `${command.color}18`, color: command.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={13} /></span>
                                <span style={{ fontSize: 12, fontWeight: 750, color: "#121a2e" }}>{command.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ display: chatComposerExpanded ? "flex" : "none", flexDirection: "column", gap: 8, width: "100%" }}>
                      {selectedChatText ? (
                        <div style={{ borderRadius: 18, background: "#FBFBFB", padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <MoveRight size={16} style={{ color: "rgba(18,26,46,0.5)", flexShrink: 0, marginTop: 2 }} />
                          <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.45, color: "rgba(18,26,46,0.62)", whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{selectedChatText}</p>
                          <button type="button" onClick={() => setSelectedChatText("")} style={{ border: 0, background: "transparent", color: "rgba(18,26,46,0.42)", cursor: "pointer", display: "flex", padding: 2 }}><X size={15} /></button>
                        </div>
                      ) : null}
                      <div style={{ display: selectedChatCommand ? "flex" : "none", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {selectedChatCommand ? (() => {
                          const Icon = selectedChatCommand.icon;
                          return (
                            <button type="button" onClick={() => setSelectedChatCommandId("")} style={{ border: 0, borderRadius: 999, background: `${selectedChatCommand.color}14`, color: selectedChatCommand.color, minHeight: 24, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 800, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                              <Icon size={12} />
                              {selectedChatCommand.label}
                            </button>
                          );
                        })() : null}
                      </div>
                  </div>
                  {chatImageAttachments.length > 0 ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {chatImageAttachments.map((image) => (
                        <span key={image.id} style={{ position: "relative", width: 64, height: 64, borderRadius: 14, border: "1px solid rgba(18,26,46,0.1)", background: `url(${image.url}) center / cover`, boxShadow: "0 8px 18px rgba(18,26,46,0.08)" }}>
                          <button type="button" onClick={() => setChatImageAttachments((current) => current.filter((entry) => entry.id !== image.id))} style={{ position: "absolute", right: -6, top: -6, width: 22, height: 22, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", color: "#121a2e", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 5px 12px rgba(18,26,46,0.12)" }}><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px 12px", width: "100%", minWidth: 0 }}>
                    <button type="button" onClick={() => setChatActionsOpen((current) => !current)} style={{ width: 40, height: 40, borderRadius: 34, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.background = "#F6F6F6"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}><Plus size={18} /></button>
                    <label style={{ width: 40, height: 40, borderRadius: 34, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }} onMouseEnter={(e) => { e.currentTarget.style.background = "#F6F6F6"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <ImageIcon size={18} />
                      <input type="file" accept="image/*" multiple onChange={(event) => { if (event.target.files) void addChatImageFiles(event.target.files); event.currentTarget.value = ""; }} style={{ display: "none" }} />
                    </label>
                    <div style={{ order: chatComposerExpanded ? -1 : 0, flex: chatComposerExpanded ? "0 0 100%" : 1, width: chatComposerExpanded ? "100%" : "auto", minWidth: 0, display: "flex", flexDirection: chatComposerExpanded ? "column" : "row", alignItems: chatComposerExpanded ? "stretch" : "center", gap: chatComposerExpanded ? 7 : 8, transition: "gap 0.18s ease, flex-basis 0.18s ease" }}>
                      <div style={{ display: !chatComposerExpanded && selectedChatCommand ? "flex" : "none", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {selectedChatCommand ? (() => {
                          const Icon = selectedChatCommand.icon;
                          return (
                            <button type="button" onClick={() => setSelectedChatCommandId("")} style={{ border: 0, borderRadius: 999, background: `${selectedChatCommand.color}14`, color: selectedChatCommand.color, minHeight: 24, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, fontWeight: 800, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                              <Icon size={12} />
                              {selectedChatCommand.label}
                            </button>
                          );
                        })() : null}
                      </div>
                      <textarea wrap="soft" value={chatInput} disabled={editorChatLoading} rows={chatComposerRows} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void runEditorChat(); } }} placeholder="Taper un texte ici" style={{ width: "100%", minHeight: 48, maxHeight: 168, height: "auto", border: 0, outline: "none", color: "rgba(18,26,46,0.7)", fontSize: 16, fontWeight: 500, lineHeight: "22px", letterSpacing: "-0.2px", fontFamily: 'Inter, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif', resize: "none", overflowY: chatInput.split("\n").length > 7 || chatInput.length > 238 ? "auto" : "hidden", overflowX: "hidden", background: "transparent", padding: 0, opacity: editorChatLoading ? 0.55 : 1, transition: "height 0.18s ease, line-height 0.18s ease", whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" }} />
                    </div>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flex: "1 1 0", minWidth: 0, marginLeft: "auto" }}>
                    <button type="button" onClick={() => setModelPickerOpen((current) => !current)} style={{ border: 0, background: "transparent", padding: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "rgba(18,26,46,0.7)", fontSize: 14, fontWeight: 500, lineHeight: "18px", fontFamily: "Inter, sans-serif" }}>
                      <span>{activeModelLabel}</span>
                      <ChevronDown size={14} style={{ color: "rgba(18,26,46,0.52)" }} />
                    </button>
                    <button type="button" onClick={() => void runEditorChat()} disabled={editorChatLoading || !chatInput.trim()} style={{ width: 46, height: 46, borderRadius: 34, background: "#121a2e", color: "#fff", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: editorChatLoading || !chatInput.trim() ? "not-allowed" : "pointer", flexShrink: 0, opacity: editorChatLoading || !chatInput.trim() ? 0.72 : 1 }}>{editorChatLoading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={18} />}</button>
                    {modelPickerOpen ? (
                      <div style={{ position: "absolute", right: 58, bottom: 56, width: 300, borderRadius: 18, border: "1px solid rgba(18,26,46,0.12)", background: "rgba(255,255,255,0.96)", boxShadow: carouselPanelShadow, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40, borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", padding: "0 12px" }}>
                          <Search size={14} style={{ color: "#6f7887" }} />
                          <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="Rechercher un modele..." style={{ flex: 1, border: 0, outline: "none", background: "transparent", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#121a2e" }} autoFocus />
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
              </div>
            </aside>
            </div>
          ) : null}

          {!rightEditorVisible && (
          <>
          {filteredPosts.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 64 }}>
              <Edit3 size={32} style={{ color: "rgba(18,26,46,0.1)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.5)", margin: 0 }}>Aucun post</p>
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>Creez votre premier post depuis le panneau de gauche.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))" }}>
              {filteredPosts.map(post => {
                const ss = STATUS_STYLES[post.status];
                const analytics = normalizeAnalytics(post.analytics);
                const sourceAutoPost = post.analytics?.autoRecycleSourcePostId
                  ? posts.find((entry) => entry.id === post.analytics?.autoRecycleSourcePostId)
                  : null;
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
                        {sourceAutoPost ? (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f3e8ff", color: "#6d28d9", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Repeat2 size={11} />
                            Relance auto
                          </span>
                        ) : null}
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
                        {sourceAutoPost ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              openPostForEdit(post);
                              void generateAutoRecycleVariant(post);
                            }}
                            title="Generer une nouvelle version"
                            style={{ padding: "5px 8px", borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", cursor: "pointer", color: "#6d28d9", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                          >
                            {autoRecycleVariantLoadingId === post.id ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Wand2 size={12} />}
                            Nouvelle version
                          </button>
                        ) : null}
                        <button onClick={(event) => { event.stopPropagation(); deletePost(post.id); }} title="Supprimer" style={{ padding: 5, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.72)", display: "flex" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Content preview */}
                    {post.title ? (
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#121a2e", lineHeight: 1.4, margin: 0 }}>
                        {post.title}
                      </p>
                    ) : null}
                    <p style={{ fontSize: 13, color: "#121a2e", lineHeight: 1.6, margin: 0, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", whiteSpace: "pre-line" }}>
                      {post.content}
                    </p>
                    {sourceAutoPost ? (
                      <div style={{ borderRadius: 12, border: "1px solid rgba(109,40,217,0.12)", background: "rgba(109,40,217,0.04)", padding: 12 }}>
                        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.04em" }}>Ancien post source</p>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "rgba(18,26,46,0.68)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>
                          {sourceAutoPost.content}
                        </p>
                      </div>
                    ) : null}
                    {analytics.mediaPreviewUrl && (
                      <img
                        src={analytics.mediaPreviewUrl}
                        alt="Apercu image du post"
                        style={{ display: "block", width: "100%", height: "auto", borderRadius: 11, boxShadow: "0 12px 26px rgba(18,26,46,0.1)" }}
                      />
                    )}

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

      {autoRecycleSettingsOpen ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 46, background: "rgba(18,26,46,0.18)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setAutoRecycleSettingsOpen(false)}>
          <div style={{ width: "min(560px, 100%)", borderRadius: 24, background: "#fff", border: "1px solid rgba(18,26,46,0.12)", boxShadow: "0 24px 70px rgba(18,26,46,0.18)", padding: 24, display: "flex", flexDirection: "column", gap: 18 }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Settings size={17} style={{ color: "#6d28d9" }} />
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 750, color: "#121a2e" }}>Auto-planification</h3>
                </div>
                <p style={{ margin: "7px 0 0", fontSize: 13, lineHeight: 1.5, color: "rgba(18,26,46,0.52)" }}>Regle les conditions de relance automatique et le prompt de micro-variation.</p>
              </div>
              <button type="button" onClick={() => setAutoRecycleSettingsOpen(false)} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => updateAutoRecyclePreferences({ enabled: !autoRecycleEnabled })}
              style={{ minHeight: 44, borderRadius: 13, border: autoRecycleEnabled ? "1px solid #d8b4fe" : "1px solid rgba(18,26,46,0.1)", background: autoRecycleEnabled ? "#f3e8ff" : "#f6f6f6", color: autoRecycleEnabled ? "#6d28d9" : "rgba(18,26,46,0.62)", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              {autoRecycleEnabled ? "Auto-planification activee" : "Auto-planification desactivee"}
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                <span style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 750, color: "rgba(18,26,46,0.58)" }}>Temps avant relance (jours)</span>
                <input type="number" min={1} value={autoRecycleDelayDays} onChange={(event) => updateAutoRecyclePreferences({ delayDays: Number(event.target.value) || 1 })} style={{ ...inp, minHeight: 44 }} />
              </label>
              <label>
                <span style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 750, color: "rgba(18,26,46,0.58)" }}>Seuil minimum de likes</span>
                <input type="number" min={0} value={autoRecycleMinLikes} onChange={(event) => updateAutoRecyclePreferences({ minLikes: Number(event.target.value) || 0 })} style={{ ...inp, minHeight: 44 }} />
              </label>
            </div>

            <label>
              <span style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 750, color: "rgba(18,26,46,0.58)" }}>Prompt de nouvelle version</span>
              <textarea value={autoRecyclePrompt} onChange={(event) => updateAutoRecyclePreferences({ prompt: event.target.value })} rows={7} style={{ ...inp, padding: 12, lineHeight: 1.55, resize: "vertical" }} />
            </label>
          </div>
        </div>
      ) : null}

      {createPostOverlayOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 44, background: "rgba(18,26,46,0.18)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setCreatePostOverlayOpen(false)}>
          <div style={{ width: "min(560px, 100%)", borderRadius: 24, background: "#fff", border: "1px solid rgba(18,26,46,0.12)", boxShadow: "0 24px 70px rgba(18,26,46,0.18)", padding: 24, display: "flex", flexDirection: "column", gap: 18 }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#121a2e" }}>Creer un nouveau post</h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.5)" }}>Le brouillon est cree tout de suite avec ses parametres.</p>
              </div>
              <button type="button" onClick={() => setCreatePostOverlayOpen(false)} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            <input value={newPostTitle} onChange={(event) => setNewPostTitle(event.target.value)} placeholder="Nom du brouillon" style={{ ...inp, minHeight: 46 }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {([
                { id: "idea", label: "Idee" },
                { id: "url", label: "URL" },
                { id: "youtube", label: "YouTube" },
                { id: "manual", label: "Libre" },
              ] as Array<{ id: SourceTab; label: string }>).map((item) => (
                <button key={item.id} type="button" onClick={() => { setNewPostSourceTab(item.id); setNewPostSourceValue(""); setNewPostSourceContext(""); setNewPostIdeaId(""); }} style={{ minHeight: 38, padding: "0 14px", borderRadius: 999, border: newPostSourceTab === item.id ? "1px solid rgba(1,71,255,0.34)" : "1px solid rgba(18,26,46,0.1)", background: newPostSourceTab === item.id ? "rgba(45,110,253,0.1)" : "#fff", color: newPostSourceTab === item.id ? "#0147ff" : "#121a2e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                  {item.label}
                </button>
              ))}
            </div>
            {(newPostSourceTab === "url" || newPostSourceTab === "youtube") ? (
              <div style={{ display: "grid", gap: 10 }}>
                <input value={newPostSourceValue} onChange={(event) => setNewPostSourceValue(event.target.value)} placeholder={newPostSourceTab === "youtube" ? "URL YouTube" : "URL source"} style={{ ...inp, minHeight: 46 }} />
                <textarea value={newPostSourceContext} onChange={(event) => setNewPostSourceContext(event.target.value)} rows={3} placeholder="Ajouter du contexte pour guider l'IA..." style={{ ...inp, minHeight: 88, resize: "vertical", lineHeight: 1.55 }} />
              </div>
            ) : null}
            {newPostSourceTab === "idea" ? (
              <div style={{ display: "grid", gap: 10 }}>
                <select value={newPostIdeaId} onChange={(event) => setNewPostIdeaId(event.target.value)} style={{ ...inp, minHeight: 46 }}>
                  <option value="">Choisir une idee</option>
                  {ideas.filter((idea) => idea.status === "new").map((idea) => (
                    <option key={idea.id} value={idea.id}>{idea.title}</option>
                  ))}
                </select>
                <textarea value={newPostSourceContext} onChange={(event) => setNewPostSourceContext(event.target.value)} rows={3} placeholder="Ajouter du contexte, un angle ou des contraintes..." style={{ ...inp, minHeight: 88, resize: "vertical", lineHeight: 1.55 }} />
              </div>
            ) : null}
            {newPostSourceTab === "manual" ? (
              <textarea value={newPostSourceValue} onChange={(event) => setNewPostSourceValue(event.target.value)} rows={6} placeholder="Ecris librement ton idee, ton brouillon ou tes notes..." style={{ ...inp, minHeight: 140, resize: "vertical", lineHeight: 1.6 }} />
            ) : null}
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.58)" }}>Style de redaction</p>
              {renderPostStyleSelector(newPostStyleId, setNewPostStyleId)}
            </div>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.58)" }}>Format du post</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {MANUAL_POST_FORMATS.map((format) => {
                  const active = newPostFormat === format.value;
                  return (
                    <button key={format.value} type="button" onClick={() => setNewPostFormat(format.value)} style={{ padding: "6px 12px", borderRadius: 20, border: active ? "1px solid rgba(1,71,255,0.34)" : inactiveStyleTag.border, background: active ? "rgba(45,110,253,0.1)" : inactiveStyleTag.background, color: active ? "#0147ff" : inactiveStyleTag.color, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                      {format.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
              <button type="button" onClick={() => setCreatePostOverlayOpen(false)} style={{ width: "100%", minHeight: 48, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Annuler
              </button>
              <ClientBlueButton type="button" onClick={createManualDraft} wrapperStyle={{ width: "100%" }} style={{ width: "100%", minHeight: 48, fontSize: 16 }}>
                Commencer a rediger
              </ClientBlueButton>
            </div>
          </div>
        </div>
      )}

      {viralityOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 46, background: "rgba(18,26,46,0.16)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setViralityOpen(false)}>
          <div style={{ width: "min(760px, 100%)", maxHeight: "88vh", overflowY: "auto", borderRadius: 26, background: "#fff", border: "1px solid rgba(18,26,46,0.1)", boxShadow: "0px 30px 80px rgba(18,26,46,0.18)", padding: 24, fontFamily: '"Plus Jakarta Sans", sans-serif' }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#121a2e", letterSpacing: "-0.04em" }}>Statistiques predites</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.52)", lineHeight: 1.5 }}>Analyse du texte, de l'image et des signaux de viralite avant publication.</p>
              </div>
              <button type="button" onClick={() => setViralityOpen(false)} style={{ width: 36, height: 36, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><X size={16} /></button>
            </div>
            {!viralityConfigured && <div style={{ marginTop: 16, borderRadius: 16, background: "#fff7ed", border: "1px solid #fed7aa", padding: 12, color: "#c2410c", fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}>Modele fine-tune non configure: estimation locale provisoire. Ajoute la cle OpenAI et le modele dans Parametres LinkedIn.</div>}
            <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
              {draftMedia?.kind === "image" && (
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#121a2e" }}>Description de l'image</span>
                  <textarea value={viralityImageDescription} onChange={(event) => setViralityImageDescription(event.target.value)} rows={4} placeholder="L'IA de vision remplira ce champ automatiquement. Tu peux le corriger avant de relancer l'analyse." style={{ width: "100%", borderRadius: 16, border: "1px solid rgba(18,26,46,0.12)", background: "#fbfbfb", padding: 14, fontSize: 13, lineHeight: 1.5, color: "#121a2e", outline: "none", resize: "vertical", fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
                </label>
              )}
              <ClientBlueButton type="button" onClick={() => void analyzeVirality()} disabled={viralityLoading || !generatedContent.trim()} loading={viralityLoading} icon={<BarChart3 size={15} />} wrapperStyle={{ width: "100%" }} style={{ width: "100%", minHeight: 46, fontSize: 13, fontWeight: 800 }}>
                {viralityLoading ? "Analyse..." : "Analyser le post"}
              </ClientBlueButton>
              {viralityError && <p style={{ margin: 0, color: "#c53030", background: "#fff0f0", border: "1px solid #fcc", borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 700 }}>{viralityError}</p>}
              {viralityResult && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
                    {[
                      { label: "Likes", value: viralityResult.likes, icon: ThumbsUp },
                      { label: "Commentaires", value: viralityResult.comments, icon: MessageCircle },
                      { label: "Partages", value: viralityResult.shares, icon: Share2 },
                      { label: "Ratio", value: viralityResult.ratio, icon: Rocket },
                      { label: "Score", value: `${viralityResult.viralityScore}/100`, icon: BarChart3 },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} style={{ borderRadius: 18, border: "1px solid rgba(18,26,46,0.08)", background: "#fff", boxShadow: "0 14px 35px rgba(18,26,46,0.06)", padding: 14 }}>
                          <span style={{ width: 32, height: 32, borderRadius: 10, background: "#fbfbfb", border: "1px solid rgba(18,26,46,0.06)", display: "grid", placeItems: "center", color: "#0147ff", marginBottom: 12 }}><Icon size={15} /></span>
                          <strong style={{ display: "block", fontSize: 18, color: "#121a2e", letterSpacing: "-0.04em" }}>{item.value}</strong>
                          <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "rgba(18,26,46,0.48)", fontWeight: 700 }}>{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{ borderRadius: 18, background: "#fbfbfb", border: "1px solid rgba(18,26,46,0.07)", padding: 16 }}>
                      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 850, color: "#168b64" }}><Rocket size={15} /> Facteurs boostants</p>
                      <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "grid", gap: 8, color: "rgba(18,26,46,0.72)", fontSize: 13, lineHeight: 1.45 }}>{(viralityResult.boostingFactors ?? []).map((factor) => <li key={factor}>{factor}</li>)}</ul>
                    </div>
                    <div style={{ borderRadius: 18, background: "#fbfbfb", border: "1px solid rgba(18,26,46,0.07)", padding: 16 }}>
                      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 850, color: "#c2410c" }}><AlertTriangle size={15} /> Facteurs limitants</p>
                      <ul style={{ margin: "12px 0 0", paddingLeft: 18, display: "grid", gap: 8, color: "rgba(18,26,46,0.72)", fontSize: 13, lineHeight: 1.45 }}>{(viralityResult.limitingFactors ?? []).map((factor) => <li key={factor}>{factor}</li>)}</ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats modal */}
      {(scheduleOverlayPostId !== null || scheduleOverlayDate) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 45, background: "rgba(18,26,46,0.18)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={closeScheduleOverlay}>
          <div style={{ width: "min(420px, 100%)", borderRadius: 20, background: "#fff", border: "1px solid rgba(18,26,46,0.12)", boxShadow: "0 24px 70px rgba(18,26,46,0.18)", padding: 22, display: "flex", flexDirection: "column", gap: 16 }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>Planifier le post</h3>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.5)" }}>Choisis la date de programmation avant validation.</p>
              </div>
              <button type="button" onClick={closeScheduleOverlay} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            {(() => {
              const monthValue = scheduleCalendarMonth || scheduleOverlayDate.slice(0, 7) || new Date().toISOString().slice(0, 7);
              const monthDate = new Date(`${monthValue}-01T00:00`);
              const firstDay = (monthDate.getDay() + 6) % 7;
              const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
              const selectedDay = scheduleOverlayDate.startsWith(monthValue) ? Number(scheduleOverlayDate.slice(8, 10)) : 0;
              const monthLabel = monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <button type="button" onClick={() => moveScheduleCalendarMonth(-1)} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><ArrowLeft size={15} /></button>
                    <strong style={{ fontSize: 14, color: "#121a2e", textTransform: "capitalize" }}>{monthLabel}</strong>
                    <button type="button" onClick={() => moveScheduleCalendarMonth(1)} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}><ArrowRight size={15} /></button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                    {["L", "M", "M", "J", "V", "S", "D"].map((day) => <span key={day} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "rgba(18,26,46,0.38)" }}>{day}</span>)}
                    {Array.from({ length: firstDay }).map((_, index) => <span key={`empty-${index}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, index) => {
                      const day = index + 1;
                      const selected = selectedDay === day;
                      return (
                        <button key={day} type="button" onClick={() => selectScheduleCalendarDay(day)} style={{ height: 38, borderRadius: 12, border: selected ? "1px solid rgba(1,71,255,0.34)" : "1px solid rgba(18,26,46,0.08)", background: selected ? "rgba(1,71,255,0.1)" : "#fff", color: selected ? "#0147ff" : "#121a2e", fontSize: 13, fontWeight: 750, cursor: "pointer" }}>{day}</button>
                      );
                    })}
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, fontWeight: 700, color: "#121a2e" }}>
                    Heure
                    <input type="time" value={scheduleOverlayDate.includes("T") ? scheduleOverlayDate.slice(11, 16) : "09:00"} onChange={(event) => {
                      const datePart = scheduleOverlayDate.slice(0, 10) || `${monthValue}-01`;
                      setScheduleOverlayDate(`${datePart}T${event.target.value}`);
                    }} style={{ ...inp, minHeight: 46 }} />
                  </label>
                </div>
              );
            })()}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={closeScheduleOverlay} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Annuler
              </button>
              <ClientBlueButton type="button" onClick={confirmScheduleOverlay} wrapperStyle={{ flex: 1 }} style={{ width: "100%", minHeight: 44, fontSize: 13 }} disabled={!scheduleOverlayDate}>
                Planifier
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
                ["reactions", "Reactions"],
                ["comments", "Commentaires"],
                ["impressions", "Impressions"],
                ["reach", "Membres touches"],
                ["profileViews", "Vues profil"],
                ["followersGained", "Abonnes gagnes"],
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
              Ouvrir l'onglet Statistiques pour l'import `.xlsx/.csv` complet
            </a>
            <ClientBlueButton compact type="button" onClick={() => saveStats(statsPost.id)} wrapperStyle={{ width: "100%" }} style={{ width: "100%", minHeight: 40, fontSize: 13 }}>
              Sauvegarder
            </ClientBlueButton>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes editorLoaderIn { from { opacity: 0; } to { opacity: 1; } } @keyframes editorLoaderPulse { from { opacity: 1; } to { opacity: 0.75; } } .carousel-editor-strip::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

// Slide preview component

const SLIDE_FIELD_LABELS: Record<string, { label: string; color: string }> = {
  TITRE: { label: "Titre", color: "font-semibold" },
  "SOUS-TITRE": { label: "Sous-titre", color: "" },
  TEXTE: { label: "Texte", color: "" },
  VISUEL: { label: "Visuel suggere", color: "" },
  CTA: { label: "CTA", color: "" },
  EXEMPLE: { label: "Exemple", color: "" },
  STAT: { label: "Statistique", color: "" },
  PROBLEMATIQUE: { label: "Problematique", color: "" },
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

function LegacyCarouselSlideCanvas({ payload, raw, scale = 1 }: { payload: CarouselSlidePayload | null; raw: string; scale?: number }) {
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
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        <img src="/linkedin/slide-cta-reference.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }

  if (data.kind === "before-after" || data.kind === "avis") {
    return (
      <div style={card} data-carousel-slide-inner>
        {leftBars}
        {rightBars}
        {logo}
        {data.kind === "avis" && <div style={{ position: "absolute", left: 68, right: 68, top: 82, height: 69, borderRadius: 15, background: "#fff", border: "1px solid rgba(0,0,0,0.16)", boxShadow: "0 9px 4px rgba(26,26,26,0.01), 0 5px 3px rgba(26,26,26,0.03), 0 2px 2px rgba(26,26,26,0.04), 0 1px 1px rgba(26,26,26,0.05)", display: "grid", placeItems: "center", fontSize: 31, fontWeight: 700 }}>{data.title || "Tu preferes quelle version ?"}</div>}
        <div style={{ position: "absolute", left: 86, right: 86, top: data.kind === "avis" ? 184 : 92, height: data.kind === "avis" ? 204 : 243, borderRadius: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.18)", boxShadow: "0 17px 17px rgba(59,59,59,0.01), 0 10px 6px rgba(59,59,59,0.03), 0 4px 4px rgba(59,59,59,0.05), 0 1px 2px rgba(59,59,59,0.06)", overflow: "hidden" }}>
          {data.beforeImage ? <img src={data.beforeImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
        <div style={{ position: "absolute", left: 86, right: 86, top: data.kind === "avis" ? 405 : 353, height: data.kind === "avis" ? 204 : 243, borderRadius: 16, background: "#fff", border: "1px solid rgba(0,0,0,0.18)", boxShadow: "0 17px 17px rgba(59,59,59,0.01), 0 10px 6px rgba(59,59,59,0.03), 0 4px 4px rgba(59,59,59,0.05), 0 1px 2px rgba(59,59,59,0.06)", overflow: "hidden" }}>
          {data.afterImage ? <img src={data.afterImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
        {data.kind === "before-after" && <span style={{ position: "absolute", right: 72, top: 300, border: "1px solid #0147FF", borderRadius: 999, background: "#fff", padding: "10px 16px", fontWeight: 700, fontSize: 12, boxShadow: "0 17px 17px rgba(59,59,59,0.01), 0 10px 6px rgba(59,59,59,0.03), 0 4px 4px rgba(59,59,59,0.05), 0 1px 2px rgba(59,59,59,0.06)", whiteSpace: "nowrap", zIndex: 5 }}>Ancienne version du site</span>}
        {data.kind === "before-after" && <span style={{ position: "absolute", right: 72, top: 563, border: "1px solid #0147FF", borderRadius: 999, background: "#fff", padding: "10px 16px", fontWeight: 700, fontSize: 12, boxShadow: "0 17px 17px rgba(59,59,59,0.01), 0 10px 6px rgba(59,59,59,0.03), 0 4px 4px rgba(59,59,59,0.05), 0 1px 2px rgba(59,59,59,0.06)", whiteSpace: "nowrap", zIndex: 5 }}>Nouvelle version du site</span>}
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
        <div style={{ position: "absolute", left: 86, top: 184, width: 403, minHeight: 178, borderRadius: 21, background: "#0147FF", color: "#fff", padding: 24, boxShadow: "0 2px 3.96px rgba(0,0,0,0.19)" }}>
          <h2 style={{ margin: 0, fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 32, lineHeight: 1.06, letterSpacing: "-0.02em", textAlign: "left", fontWeight: 700 }}>{data.body || data.title}</h2>
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
            height: 97,
            borderRadius: 26,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.22)",
            padding: "0 26px",
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 56,
            fontWeight: 700,
            color: "#121A2E",
            letterSpacing: "-0.02em",
            boxShadow: "0 9px 4px rgba(26,26,26,0.01), 0 5px 3px rgba(26,26,26,0.03), 0 2px 2px rgba(26,26,26,0.04), 0 1px 1px rgba(26,26,26,0.05)",
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
        <div style={{ position: "absolute", left: 86, top: 98, width: 403, display: "flex", flexDirection: "column", alignItems: "stretch", overflow: "visible" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Case numero */}
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
                boxShadow: "inset 0 2.93px 2.93px rgba(255,255,255,0.25), inset 0 -2.93px 1.61px rgba(0,0,0,0.09), 0 5.87px 2.2px rgba(0,0,0,0.02), 0 2.93px 2.2px rgba(0,0,0,0.08), 0 1.47px 1.47px rgba(0,0,0,0.13)",
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
            }}>{data.title || ""}</span>
          </div>
          <p style={{
            margin: "12px 0 0",
            height: "auto",
            minHeight: 0,
            maxHeight: "none",
            overflow: "visible",
            flex: "0 0 auto",
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: 21,
            lineHeight: 1.58,
            fontWeight: 700,
            letterSpacing: 0,
            color: "rgba(18,26,46,0.8)",
            textAlign: "left",
            whiteSpace: "pre-line",
          }}>{data.subtitle}</p>
          <div style={{
            position: "relative",
            marginTop: 12,
            height: 264,
            borderRadius: data.imageMode === "full" ? 0 : 16,
            background: "#fff",
            border: data.imageMode === "full" ? "none" : "1px solid rgba(0,0,0,0.1)",
            overflow: data.showCheck === false ? "hidden" : "visible",
            flex: "0 0 auto",
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
            <button onClick={() => setRawMode(false)} style={{ fontSize: 11, color: "rgba(18,26,46,0.5)", background: "none", border: "none", cursor: "pointer", ...jkSlide }}>Vue structuree</button>
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
        <button onClick={() => setRawMode(true)} style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", background: "none", border: "none", cursor: "pointer", ...jkSlide }}>Editer brut</button>
      </div>
      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 10, background: "#fff" }}>
        {fields.map(f => (
          <div key={f.key}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(18,26,46,0.35)", margin: 0, marginBottom: 2, ...jkSlide }}>
              {SLIDE_FIELD_LABELS[f.key]?.label || f.key}
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0, color: SLIDE_FIELD_COLORS[f.key] || "rgba(18,26,46,0.7)", ...jkSlide }}>
              {f.value || <span style={{ color: "rgba(18,26,46,0.2)", fontStyle: "italic" }}>-</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
