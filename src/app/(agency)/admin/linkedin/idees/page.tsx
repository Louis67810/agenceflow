"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, Check, X, ArrowRight, Lightbulb, Clock } from "lucide-react";
import { LinkedInIdea, LinkedInPost, LinkedInStyle, DEFAULT_STYLES, STYLE_CATEGORY_COLORS } from "@/types/linkedin";
import { loadLinkedInSettings } from "../layout";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

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

    if (savedIdeas) { try { setIdeas(JSON.parse(savedIdeas)); } catch { setIdeas([]); } }
    if (savedStyles) { try { setStyles(JSON.parse(savedStyles)); } catch { setStyles(DEFAULT_STYLES); } }
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
    } catch { return []; }
  }, []);

  const shouldAutoGenerate = useCallback((): boolean => {
    if (!lastGenerated) return true;
    const diff = Date.now() - new Date(lastGenerated).getTime();
    return diff > 3 * 24 * 60 * 60 * 1000;
  }, [lastGenerated]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const topPosts = getTopPosts();
      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: 9,
          topPosts: topPosts.map((p) => ({ content: p.content, likes: p.likes, comments: p.comments, impressions: p.impressions, styleName: p.styleName })),
          styles: styles.map((st) => ({ name: st.name, category: st.category })),
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
          styleName: idea.styleCategory ? STYLE_CATEGORY_LABELS[idea.styleCategory] : undefined,
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
    sessionStorage.setItem("linkedin_idea_prefill", JSON.stringify(idea));
    window.location.href = "/admin/linkedin/posts";
  };

  const filtered = ideas.filter((i) => activeFilter === "all" || i.status === activeFilter);
  const newCount = ideas.filter((i) => i.status === "new").length;
  const usedCount = ideas.filter((i) => i.status === "used").length;
  const autoDue = shouldAutoGenerate();

  const btnGradient = {
    background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
    border: "1px solid #2f4d9d",
    color: "#fff",
    cursor: "pointer",
    borderRadius: 9,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#fbfbfb", ...jakartaSans }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "16px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.4px", margin: 0 }}>Idées de posts</h2>
            <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", marginTop: 2, marginBottom: 0 }}>
              {newCount} nouvelles · {usedCount} utilisées
              {lastGenerated && <span style={{ marginLeft: 8, color: "rgba(18,26,46,0.35)" }}>· Générées {daysAgo(lastGenerated)}</span>}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <select
              value={language}
              onChange={(e) => { setLanguage(e.target.value as "fr" | "en"); localStorage.setItem("linkedin_ideas_language", e.target.value); }}
              style={{ border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "7px 12px", fontSize: 13, color: "#121a2e", background: "#f6f6f6", outline: "none", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>

            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                ...btnGradient,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                opacity: generating ? 0.7 : 1,
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                ...(autoDue ? {} : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "#121a2e" }),
              }}
            >
              {generating ? <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={16} />}
              {generating ? "Génération..." : autoDue ? "Générer des idées" : "Régénérer"}
            </button>
          </div>
        </div>

        {autoDue && ideas.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#663b12", background: "#fee6d0", padding: "8px 12px", borderRadius: 9, border: "1px solid #f59e0b" }}>
            <Clock size={13} />
            Votre dernière génération remonte à plus de 3 jours — de nouvelles idées vous attendent !
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16 }}>
          {CATEGORIES.map((cat) => {
            const count = cat.value === "all" ? ideas.length : ideas.filter((i) => i.status === cat.value).length;
            const isActive = activeFilter === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveFilter(cat.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  ...(isActive
                    ? { background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff" }
                    : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
                }}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {ideas.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", gap: 16 }}>
            <div style={{ width: 64, height: 64, background: "rgba(18,26,46,0.06)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Lightbulb size={28} style={{ color: "rgba(18,26,46,0.3)" }} />
            </div>
            <div>
              <p style={{ fontWeight: 600, color: "#121a2e", margin: 0, fontSize: 15 }}>Aucune idée pour l&apos;instant</p>
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", marginTop: 6 }}>
                Cliquez sur &quot;Générer des idées&quot; pour obtenir 9 idées personnalisées basées sur vos meilleurs posts
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{ ...btnGradient, display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, fontFamily: '"Plus Jakarta Sans", sans-serif', opacity: generating ? 0.7 : 1 }}
            >
              <Sparkles size={16} />
              {generating ? "Génération en cours..." : "Générer 9 idées"}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, textAlign: "center" }}>
            <p style={{ color: "rgba(18,26,46,0.4)", fontSize: 13 }}>Aucune idée dans cette catégorie</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
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

function IdeaCard({ idea, onUse, onDismiss, onRestore }: {
  idea: LinkedInIdea;
  onUse: () => void;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const colorClass = idea.styleName
    ? STYLE_CATEGORY_COLORS[
        Object.entries(STYLE_CATEGORY_LABELS).find(([, v]) => v === idea.styleName)?.[0] || "custom"
      ]
    : "bg-gray-100 text-gray-600";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 13,
        border: idea.status === "dismissed" ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(0,0,0,0.1)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: idea.status === "dismissed" ? 0.6 : 1,
        boxShadow: idea.status === "dismissed" ? "none" : "0px 2px 8px rgba(0,0,0,0.04)",
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: idea.status === "dismissed" ? "rgba(18,26,46,0.4)" : "#121a2e", margin: 0, flex: 1, lineHeight: 1.4, letterSpacing: "-0.2px" }}>
          {idea.title}
        </h3>
        {idea.status === "new" && (
          <span style={{ flexShrink: 0, fontSize: 11, background: "#d5eeff", color: "#073e63", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>Nouvelle</span>
        )}
        {idea.status === "used" && (
          <span style={{ flexShrink: 0, fontSize: 11, background: "#d1fae5", color: "#168b64", padding: "2px 8px", borderRadius: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <Check size={10} />Utilisée
          </span>
        )}
      </div>

      {idea.styleName && (
        <span className={`text-xs px-2 py-0.5 rounded-full self-start ${colorClass}`}>
          {idea.styleName}
        </span>
      )}

      <p style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", lineHeight: 1.6, flex: 1, margin: 0 }}>
        {idea.description}
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 4 }}>
        <span style={{ fontSize: 12, color: "rgba(18,26,46,0.35)" }}>{daysAgo(idea.generatedAt)}</span>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {idea.status !== "used" && (
            <>
              {idea.status === "dismissed" ? (
                <button
                  onClick={onRestore}
                  style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", padding: "4px 8px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.09)", background: "#f6f6f6", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  Restaurer
                </button>
              ) : (
                <button
                  onClick={onDismiss}
                  style={{ padding: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.3)", display: "flex" }}
                >
                  <X size={14} />
                </button>
              )}
            </>
          )}

          {idea.status !== "dismissed" && (
            <button
              onClick={onUse}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
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
