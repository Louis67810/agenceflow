"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, Check, X, ArrowRight, Lightbulb, Clock } from "lucide-react";
import { LinkedInIdea, LinkedInPost, LinkedInStyle, DEFAULT_STYLES, STYLE_CATEGORY_COLORS } from "@/types/linkedin";
import { loadLinkedInSettings } from "../layout";

const CATEGORIES = [
  { value: "all", label: "Toutes" },
  { value: "new", label: "Nouvelles" },
  { value: "used", label: "Utilisées" },
  { value: "dismissed", label: "Ignorées" },
];

const STYLE_CATEGORY_LABELS: Record<string, string> = {
  storytelling: "Storytelling",
  valeur: "Valeur / Liste",
  educatif: "Éducatif",
  viral: "Opinion forte",
  engagement: "Engagement",
  data: "Data / Chiffres",
  custom: "Personnalisé",
};

function daysAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

export default function LinkedInIdeesPage() {
  const [ideas, setIdeas] = useState<LinkedInIdea[]>([]);
  const [styles, setStyles] = useState<LinkedInStyle[]>(DEFAULT_STYLES);
  const [generating, setGenerating] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [language, setLanguage] = useState<"fr" | "en">("fr");

  useEffect(() => {
    const savedIdeas = localStorage.getItem("linkedin_ideas");
    const savedStyles = localStorage.getItem("linkedin_styles");
    const savedLang = localStorage.getItem("linkedin_ideas_language");
    const savedLastGen = localStorage.getItem("linkedin_ideas_last_generated");

    if (savedIdeas) {
      try {
        setIdeas(JSON.parse(savedIdeas));
      } catch {
        setIdeas([]);
      }
    }
    if (savedStyles) {
      try {
        setStyles(JSON.parse(savedStyles));
      } catch {
        setStyles(DEFAULT_STYLES);
      }
    }
    if (savedLang) setLanguage(savedLang as "fr" | "en");
    if (savedLastGen) setLastGenerated(savedLastGen);
  }, []);

  const saveIdeas = (updated: LinkedInIdea[]) => {
    setIdeas(updated);
    localStorage.setItem("linkedin_ideas", JSON.stringify(updated));
  };

  const getTopPosts = useCallback((): LinkedInPost[] => {
    const saved = localStorage.getItem("linkedin_posts");
    if (!saved) return [];
    try {
      const posts: LinkedInPost[] = JSON.parse(saved);
      return posts
        .filter((p) => p.status === "published")
        .sort((a, b) => b.likes + b.comments * 2 - (a.likes + a.comments * 2))
        .slice(0, 5);
    } catch {
      return [];
    }
  }, []);

  const shouldAutoGenerate = useCallback((): boolean => {
    if (!lastGenerated) return true;
    const diff = Date.now() - new Date(lastGenerated).getTime();
    return diff > 3 * 24 * 60 * 60 * 1000; // 3 days
  }, [lastGenerated]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const topPosts = getTopPosts();
      const stylesSummary = styles.map((s) => ({
        name: s.name,
        category: s.category,
      }));

      const postSummaries = topPosts.map((p) => ({
        content: p.content,
        likes: p.likes,
        comments: p.comments,
        impressions: p.impressions,
        styleName: p.styleName,
      }));

      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: 9,
          topPosts: postSummaries,
          styles: stylesSummary,
          language,
          openrouterApiKey: s.openrouterApiKey || undefined,
          model: s.model,
        }),
      });

      if (!res.ok) throw new Error("Erreur génération");
      const data = await res.json();

      const newIdeas: LinkedInIdea[] = (data.ideas || []).map(
        (idea: { title: string; description: string; styleCategory?: string }) => ({
          id: `idea_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          title: idea.title,
          description: idea.description,
          styleName: idea.styleCategory
            ? STYLE_CATEGORY_LABELS[idea.styleCategory]
            : undefined,
          status: "new" as const,
          generatedAt: new Date().toISOString(),
        })
      );

      const now = new Date().toISOString();
      saveIdeas([...newIdeas, ...ideas]);
      setLastGenerated(now);
      localStorage.setItem("linkedin_ideas_last_generated", now);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = (id: string, status: LinkedInIdea["status"]) => {
    saveIdeas(ideas.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const useIdea = (idea: LinkedInIdea) => {
    updateStatus(idea.id, "used");
    // Store in sessionStorage to pre-fill post creation
    sessionStorage.setItem("linkedin_idea_prefill", JSON.stringify(idea));
    window.location.href = "/admin/linkedin/posts";
  };

  const filtered = ideas.filter(
    (i) => activeFilter === "all" || i.status === activeFilter
  );

  const newCount = ideas.filter((i) => i.status === "new").length;
  const usedCount = ideas.filter((i) => i.status === "used").length;
  const autoDue = shouldAutoGenerate();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Idées de posts</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {newCount} nouvelles · {usedCount} utilisées
              {lastGenerated && (
                <span className="ml-2 text-gray-400">
                  · Générées {daysAgo(lastGenerated)}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value as "fr" | "en");
                localStorage.setItem("linkedin_ideas_language", e.target.value);
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>

            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                autoDue
                  ? "bg-[#0A66C2] text-white hover:bg-[#0057a3]"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {generating ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {generating ? "Génération..." : autoDue ? "Générer des idées" : "Régénérer"}
            </button>
          </div>
        </div>

        {autoDue && ideas.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
            <Clock size={13} />
            Votre dernière génération remonte à plus de 3 jours — de nouvelles idées vous attendent !
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mt-4">
          {CATEGORIES.map((cat) => {
            const count =
              cat.value === "all"
                ? ideas.length
                : ideas.filter((i) => i.status === cat.value).length;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveFilter(cat.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === cat.value
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {ideas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center">
              <Lightbulb size={28} className="text-gray-400" />
            </div>
            <div>
              <p className="text-gray-600 font-medium">Aucune idée pour l'instant</p>
              <p className="text-sm text-gray-400 mt-1">
                Cliquez sur "Générer des idées" pour obtenir 9 idées personnalisées
                basées sur vos meilleurs posts
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-[#0A66C2] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0057a3] disabled:opacity-50 transition-colors"
            >
              <Sparkles size={16} />
              {generating ? "Génération en cours..." : "Générer 9 idées"}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-gray-400 text-sm">
              Aucune idée dans cette catégorie
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onUse={() => useIdea(idea)}
                onDismiss={() => updateStatus(idea.id, "dismissed")}
                onRestore={() => updateStatus(idea.id, "new")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  onUse,
  onDismiss,
  onRestore,
}: {
  idea: LinkedInIdea;
  onUse: () => void;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const colorClass = idea.styleName
    ? STYLE_CATEGORY_COLORS[
        Object.entries(STYLE_CATEGORY_LABELS).find(
          ([, v]) => v === idea.styleName
        )?.[0] || "custom"
      ]
    : "bg-gray-100 text-gray-600";

  return (
    <div
      className={`bg-white rounded-xl border p-5 flex flex-col gap-3 transition-all ${
        idea.status === "dismissed"
          ? "border-gray-100 opacity-60"
          : idea.status === "used"
          ? "border-gray-200"
          : "border-gray-200 hover:shadow-md hover:border-[#0A66C2]/30"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={`text-sm font-semibold leading-snug flex-1 ${
            idea.status === "dismissed" ? "text-gray-400" : "text-gray-900"
          }`}
        >
          {idea.title}
        </h3>
        {idea.status === "new" && (
          <span className="shrink-0 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            Nouvelle
          </span>
        )}
        {idea.status === "used" && (
          <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Check size={10} />
            Utilisée
          </span>
        )}
      </div>

      {idea.styleName && (
        <span className={`text-xs px-2 py-0.5 rounded-full self-start ${colorClass}`}>
          {idea.styleName}
        </span>
      )}

      <p className="text-sm text-gray-500 leading-relaxed flex-1">
        {idea.description}
      </p>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-gray-400">{daysAgo(idea.generatedAt)}</span>

        <div className="flex items-center gap-1">
          {idea.status !== "used" && (
            <>
              {idea.status === "dismissed" ? (
                <button
                  onClick={onRestore}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Restaurer
                </button>
              ) : (
                <button
                  onClick={onDismiss}
                  className="p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </>
          )}

          {idea.status !== "dismissed" && (
            <button
              onClick={onUse}
              className="flex items-center gap-1.5 text-xs bg-[#0A66C2] text-white px-3 py-1.5 rounded-lg hover:bg-[#0057a3] transition-colors"
            >
              Créer un post
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
