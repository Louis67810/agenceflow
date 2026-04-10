export interface LinkedInPost {
  id: string;
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
  status: "draft" | "scheduled" | "published";
  tags: string[];
  createdAt: string;
}

export interface LinkedInStyle {
  id: string;
  name: string;
  category: "storytelling" | "valeur" | "educatif" | "viral" | "engagement" | "data" | "custom";
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
  styleId?: string;
  styleName?: string;
  status: "new" | "used" | "dismissed";
  generatedAt: string;
  usedAt?: string;
}

export interface LinkedInProspect {
  id: string;
  name: string;
  profileUrl?: string;
  actionType: "liked" | "commented" | "visited_profile";
  context?: string;
  generatedMessage: string;
  customMessage?: string;
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
}

export const DEFAULT_STYLES: LinkedInStyle[] = [
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
];

export const STYLE_CATEGORY_COLORS: Record<string, string> = {
  storytelling: "bg-purple-100 text-purple-700",
  valeur: "bg-blue-100 text-blue-700",
  educatif: "bg-teal-100 text-teal-700",
  viral: "bg-red-100 text-red-700",
  engagement: "bg-orange-100 text-orange-700",
  data: "bg-indigo-100 text-indigo-700",
  custom: "bg-gray-100 text-gray-700",
};

export const ACTION_LABELS: Record<string, string> = {
  liked: "a liké votre post",
  commented: "a commenté votre post",
  visited_profile: "a visité votre profil",
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
