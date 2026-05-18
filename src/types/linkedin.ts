import { DEFAULT_LINKEDIN_PROMPT_STYLES } from "@/lib/linkedin/post-style-prompts";

export interface LinkedInPostAnalytics {
  postUrl?: string;
  publishedDate?: string;
  publishedTime?: string;
  linkUrl?: string;
  format?: "text" | "image" | "carousel" | "video" | "poll" | "document" | "other";
  topic?: string;
  mediaPreviewUrl?: string;
  mediaPreviewKind?: "image" | "pdf" | "none";
  mediaFileName?: string;
  mediaStorageBytes?: number;
  autoRecycleSourcePostId?: string;
  autoRecycleCreatedAt?: string;
  videoViews: number;
  watchTime: string;
  averageWatchTime: string;
  impressions: number;
  reach: number;
  profileViews: number;
  followersGained: number;
  socialEngagement: number;
  reactions: number;
  comments: number;
  reposts: number;
  saves: number;
  sends: number;
  linkClicks: number;
  customButtonClicks: number;
  engagementRate: number;
  demographics: Array<{
    category: string;
    value: string;
    percentage: string;
  }>;
  importedAt?: string;
  sourceFileName?: string;
}

export interface LinkedInPost {
  id: string;
  title?: string;
  content: string;
  type: "post" | "carousel";
  slides?: string[];
  sourceType: "manual" | "url" | "youtube" | "idea";
  sourceUrl?: string;
  sourceTitle?: string;
  styleId?: string;
  styleName?: string;
  scheduledAt?: string;
  publishedAt?: string;
  likes: number;
  comments: number;
  impressions: number;
  postUrl?: string;
  analytics?: LinkedInPostAnalytics;
  status: "draft" | "scheduled" | "published";
  tags: string[];
  createdAt: string;
  editorHistory?: Array<{
    id: string;
    label: string;
    before: string;
    after: string;
    createdAt: string;
  }>;
  editorChat?: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    images?: Array<{ url: string; fileName: string }>;
    createdAt: string;
  }>;
  editorSnapshots?: Array<{
    id: string;
    label: string;
    content: string;
    createdAt: string;
    updatedAt?: string;
  }>;
}

export interface LinkedInStyle {
  id: string;
  name: string;
  category: "storytelling" | "valeur" | "educatif" | "educatif_carrousel" | "presentation_projet" | "engagement" | "data" | "lead_magnet" | "viral" | "custom";
  description: string;
  example: string;
  prompt: string;
  isDefault: boolean;
  createdAt: string;
}

export interface LinkedInIdea {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  conceptId?: string;
  styleId?: string;
  styleName?: string;
  scheduledAt?: string;
  status: "new" | "used" | "dismissed";
  generatedAt: string;
  usedAt?: string;
}

export interface LinkedInConcept {
  id: string;
  title: string;
  description: string;
  styleId?: string;
  styleName?: string;
  recurrenceEvery: number;
  recurrenceUnit: "days" | "weeks" | "months";
  isActive: boolean;
  createdAt: string;
}

export interface LinkedInCarouselFieldTemplate {
  id: string;
  label: string;
  kind: "text" | "image";
  required: boolean;
  aiPrompt: string;
  defaultValue?: string;
}

export interface LinkedInCarouselPageTemplate {
  id: string;
  name: string;
  description: string;
  figmaNodeId?: string;
  pagePrompt: string;
  imagePrompt: string;
  fields: LinkedInCarouselFieldTemplate[];
  createdAt: string;
}

export interface LinkedInCarouselTemplateItem {
  id: string;
  pageTemplateId: string;
  mode: "single" | "repeat_ai";
  label?: string;
}

export interface LinkedInCarouselTemplate {
  id: string;
  name: string;
  description: string;
  items: LinkedInCarouselTemplateItem[];
  createdAt: string;
}

export interface LinkedInWorkspacePreferences {
  ideasLanguage: "fr" | "en";
  ideasLastGenerated: string | null;
  prospectionLanguage: "fr" | "en";
  autoRecycleEnabled: boolean;
  autoRecycleDelayDays: number;
  autoRecycleMinLikes: number;
  autoRecyclePrompt: string;
  userWritingStylePrompt: string;
}

export interface LinkedInWorkspaceData {
  styles: LinkedInStyle[];
  ideas: LinkedInIdea[];
  concepts: LinkedInConcept[];
  carouselPageTemplates: LinkedInCarouselPageTemplate[];
  carouselTemplates: LinkedInCarouselTemplate[];
  prospects: LinkedInProspect[];
  skeletons: ProspectionSkeleton[];
  preferences: LinkedInWorkspacePreferences;
}

export interface ConversationMessage {
  id: string;
  sender: "me" | "them";
  content: string;
  images?: string[];
  links?: string[];
  externalId?: string;
  senderName?: string;
  rawHash?: string;
  source?: "manual" | "linkedin_chrome_extension" | "agenceflow";
  pendingLinkedInSend?: boolean;
  confirmedSentAt?: string;
  sentAt: string;
}

export interface ProspectionSkeleton {
  id: string;
  name: string;
  description: string;
  actionTypes: string[]; // ["liked"] | ["commented"] | ["visited_profile"] | multiple
  structure: string;     // template with placeholders [NOM], [ACTION], [CONTEXTE], [QUESTION]
  promptFragment: string; // injected into generate-prospection system prompt
  timesUsed: number;
  timesSuccess: number;
  createdAt: string;
  createdBy: "ai" | "manual";
  isActive: boolean;
}

export interface LinkedInProspect {
  id: string;
  leadId?: string; // ID dans la table centrale leads (Supabase)
  name: string;
  profileUrl?: string;
  siteUrl?: string;
  actionType: "liked" | "commented" | "visited_profile" | "none";
  context?: string;
  generatedMessage: string;
  customMessage?: string;
  avatarUrl?: string;
  headline?: string;
  pendingLinkedInSend?: {
    id: string;
    text: string;
    createdAt: string;
  };
  isManual?: boolean; // true if the message was written manually
  skeletonId?: string; // skeleton used when generating this message
  status:
    | "draft"
    | "sent"
    | "accepted"
    | "rejected"
    | "replied"
    | "conversation"
    | "deal_closed"
    | "deal_lost";
  sentAt?: string;
  createdAt: string;
  notes?: string;
  conversation?: ConversationMessage[];
}

// Mapping statut LinkedIn → statut CRM leads
export const PROSPECT_TO_LEAD_STATUS: Record<string, string> = {
  draft: "new",
  sent: "contacted",
  accepted: "responded",
  replied: "responded",
  conversation: "responded",
  deal_closed: "converted",
  rejected: "lost",
  deal_lost: "lost",
};

const LEGACY_DEFAULT_STYLES: LinkedInStyle[] = [
  {
    id: "storytelling",
    name: "Storytelling",
    category: "storytelling",
    description: "Récit personnel qui crée un lien émotionnel fort avec l'audience",
    example: "Il y a 3 ans, j'ai tout perdu.\n\nMon business venait de s'effondrer...",
    prompt:
      "Crée un post LinkedIn narratif de type storytelling. Commence par une accroche personnelle et émotionnelle (ex: 'Il y a X ans...', 'J'ai commis une erreur...'). Structure : situation initiale → problème → moment clé → leçon tirée. Termine par une question ou un appel à l'action. Utilise des phrases courtes, des sauts de ligne fréquents, pas de hashtags en excès.",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "valeur",
    name: "Valeur / Liste",
    category: "valeur",
    description: "Tips pratiques en liste numérotée — fort taux de sauvegarde",
    example: "7 choses que j'aurais aimé savoir avant de lancer mon agence :\n\n1. ...",
    prompt:
      "Crée un post LinkedIn orienté valeur avec une liste numérotée. Commence par une accroche forte du type 'X choses que...' ou 'X erreurs que...' ou 'X façons de...'. Chaque point doit être actionnable et concret. Conclusion : une phrase de punch qui résume la leçon. Format avec emoji discrets en début de point.",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "educatif",
    name: "Éducatif",
    category: "educatif",
    description: "How-to / tutoriel court qui apporte de la valeur directe",
    example: "Comment doubler son taux d'engagement LinkedIn en 30 jours :\n\nLa méthode est simple...",
    prompt:
      "Crée un post LinkedIn éducatif de type 'Comment faire X'. Commence par le résultat promis dans l'accroche. Explique le processus en étapes claires et courtes. Inclus un exemple concret ou une statistique. Termine par une invitation à partager ou commenter. Ton professionnel mais accessible.",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "viral",
    name: "Opinion forte",
    category: "viral",
    description: "Prise de position tranchée qui génère des réactions et du débat",
    example: "Opinion impopulaire :\n\nLe networking ne sert à rien si tu n'as pas de valeur à offrir.",
    prompt:
      "Crée un post LinkedIn avec une opinion forte et polarisante sur le sujet. Commence par 'Opinion impopulaire :' ou 'Tout le monde dit X. C'est faux.' ou une affirmation contre-intuitive. Développe l'argument avec 2-3 points solides. Invite au débat à la fin. Ce post doit faire réagir, même négativement. Pas de modération excessive.",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "educatif_carrousel",
    name: "Educatif carrousel",
    category: "educatif_carrousel",
    description: "Structure pedagogique slide par slide, pensee pour les carrousels LinkedIn",
    example: "Slide 1: Le probleme\nSlide 2: L'erreur\nSlide 3: La methode\nSlide 4: L'exemple",
    prompt:
      "Cree un contenu educatif pense pour un carrousel LinkedIn. Structure la logique en slides courtes, chacune avec une seule idee claire. Commence par un probleme ou une promesse concrete, puis deroule une methode simple, progressive et actionnable. Garde des titres courts, un ton expert accessible, et termine par une synthese ou un CTA.",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "presentation_projet",
    name: "Presentation de projet",
    category: "presentation_projet",
    description: "Met en avant un projet, une realisation ou un cas client avec un angle business",
    example: "On a repris une landing qui convertissait peu.\n\nObjectif: clarifier l'offre et augmenter les demandes entrantes.",
    prompt:
      "Cree un post LinkedIn de presentation de projet. Structure: contexte du projet, probleme initial, decisions prises, resultat ou enseignement, puis CTA. Mets l'accent sur la clarte, les choix concrets et la valeur business. Evite le ton portfolio froid: raconte ce que le projet prouve.",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "engagement",
    name: "Question / Engagement",
    category: "engagement",
    description: "Post-question qui invite directement à la réponse",
    example: "Quelle est la meilleure décision professionnelle que vous ayez jamais prise ?\n\nPour moi, c'est...",
    prompt:
      "Crée un post LinkedIn centré sur l'engagement avec une question directe. Commence par la question principale comme premier paragraphe. Donne ta propre réponse courte pour montrer l'exemple. Invite les gens à répondre avec leur expérience. Post court (150 mots max). Le but est de générer le maximum de commentaires.",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "data",
    name: "Data / Chiffres",
    category: "data",
    description: "Statistique choc comme accroche — très partagé",
    example: "94% des créateurs de contenu LinkedIn abandonnent après 3 mois.\n\nVoici pourquoi et comment faire partie des 6%.",
    prompt:
      "Crée un post LinkedIn basé sur des données et statistiques. Commence par un chiffre surprenant ou contre-intuitif en première ligne. Explique ce que ce chiffre signifie concrètement. Donne 2-3 insights tirés de cette donnée. Termine par une action concrète à mener. Utilise des chiffres réels si disponibles, sinon des estimations réalistes.",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "lead_magnet",
    name: "Lead magnet",
    category: "lead_magnet",
    description: "Post concu pour donner envie de recuperer une ressource ou un contenu premium",
    example: "J'ai cree une checklist pour auditer une landing page en 12 minutes.\n\nSi tu la veux, commente CHECKLIST.",
    prompt:
      "Cree un post LinkedIn oriente lead magnet. Commence par un probleme concret ou un resultat desirable, montre la valeur de la ressource, liste ce que la personne va obtenir, puis termine par un CTA clair pour demander la ressource. Le ton doit rester utile et credible, pas agressif.",
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
];

void LEGACY_DEFAULT_STYLES;

export const DEFAULT_STYLES = DEFAULT_LINKEDIN_PROMPT_STYLES as LinkedInStyle[];

export const STYLE_CATEGORY_COLORS: Record<string, string> = {
  storytelling: "bg-purple-100 text-purple-700",
  valeur: "bg-blue-100 text-blue-700",
  educatif: "bg-teal-100 text-teal-700",
  educatif_carrousel: "bg-cyan-100 text-cyan-700",
  presentation_projet: "bg-slate-100 text-slate-700",
  viral: "bg-red-100 text-red-700",
  engagement: "bg-orange-100 text-orange-700",
  data: "bg-indigo-100 text-indigo-700",
  lead_magnet: "bg-emerald-100 text-emerald-700",
  custom: "bg-gray-100 text-gray-700",
};

export const ACTION_LABELS: Record<string, string> = {
  liked: "a liké votre post",
  commented: "a commenté votre post",
  visited_profile: "a visité votre profil",
  none: "",
};

export const PROSPECT_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  replied: "A répondu",
  conversation: "En conversation",
  deal_closed: "Deal conclu",
  deal_lost: "Deal perdu",
};

export const PROSPECT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  replied: "bg-teal-100 text-teal-700",
  conversation: "bg-indigo-100 text-indigo-700",
  deal_closed: "bg-emerald-100 text-emerald-700",
  deal_lost: "bg-slate-100 text-slate-600",
};
