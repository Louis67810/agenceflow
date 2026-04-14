"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, Check, X, ArrowRight, Lightbulb, Clock, Plus, Bot, PenLine } from "lucide-react";
import { LinkedInIdea, LinkedInPost, LinkedInStyle, DEFAULT_STYLES } from "@/types/linkedin";
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

const STYLE_CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  storytelling: { bg: "#E1D1FA", color: "#6236AA" },
  valeur:       { bg: "#d5eeff", color: "#073e63" },
  educatif:     { bg: "#ccfbf1", color: "#0f766e" },
  viral:        { bg: "#ffe4e4", color: "#c53030" },
  engagement:   { bg: "#fee6d0", color: "#663b12" },
  data:         { bg: "#e0e7ff", color: "#3730a3" },
  custom:       { bg: "#f6f6f6", color: "rgba(18,26,46,0.55)" },
};

function daysAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

// ── Modal Ajouter manuellement ──────────────────────────────────────────────
function AddManualModal({
  styles,
  onSave,
  onClose,
}: {
  styles: LinkedInStyle[];
  onSave: (idea: LinkedInIdea) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const inp = {
    background: "#f6f6f6",
    border: "1px solid rgba(0,0,0,0.09)",
    borderRadius: 9,
    padding: "9px 12px",
    fontSize: 13,
    color: "#121a2e",
    outline: "none",
    width: "100%",
    fontFamily: '"Plus Jakarta Sans", sans-serif',
  } as const;

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const category = selectedCategory || undefined;
    const idea: LinkedInIdea = {
      id: `idea_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      description: description.trim(),
      styleName: category ? STYLE_CATEGORY_LABELS[category] : undefined,
      status: "new",
      generatedAt: new Date().toISOString(),
    };
    onSave(idea);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden", ...jakartaSans }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#e8edff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PenLine size={16} style={{ color: "#0147ff" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>Ajouter une idée</h3>
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", margin: 0, marginTop: 1 }}>Saisie manuelle</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.35)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Titre */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 6 }}>Titre de l&apos;idée *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Comment j'ai doublé mon taux d'engagement en 30 jours"
              style={inp}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 6 }}>Description <span style={{ fontWeight: 400, opacity: 0.7 }}>(optionnel)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décris l'angle, les points clés, l'idée générale..."
              rows={3}
              style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>

          {/* Style */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 8 }}>Style de post <span style={{ fontWeight: 400, opacity: 0.7 }}>(optionnel)</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                onClick={() => setSelectedCategory("")}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  ...(selectedCategory === ""
                    ? { background: "#e8edff", border: "1px solid #c7d3ff", color: "#0147ff" }
                    : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.55)" }),
                }}
              >
                Aucun
              </button>
              {styles.map((s) => {
                const ss = STYLE_CATEGORY_STYLES[s.category] ?? STYLE_CATEGORY_STYLES.custom;
                const isActive = selectedCategory === s.category;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedCategory(s.category)}
                    style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                      background: isActive ? ss.bg : "#f6f6f6",
                      border: isActive ? `1px solid ${ss.color}40` : "1px solid rgba(0,0,0,0.09)",
                      color: isActive ? ss.color : "rgba(18,26,46,0.55)",
                    }}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "#121a2e", cursor: "pointer", ...jakartaSans }}>
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
              border: "1px solid #2f4d9d", color: "#fff", cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.5, ...jakartaSans,
            }}
          >
            <Plus size={14} />
            Ajouter l&apos;idée
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Générer avec l'IA ────────────────────────────────────────────────
function GenerateModal({
  styles,
  language,
  onLanguageChange,
  generating,
  onGenerate,
  onClose,
}: {
  styles: LinkedInStyle[];
  language: "fr" | "en";
  onLanguageChange: (l: "fr" | "en") => void;
  generating: boolean;
  onGenerate: (selectedStyleIds: string[]) => void;
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(styles.map((s) => s.id));
  const [count, setCount] = useState(9);

  const toggleStyle = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const allSelected = selectedIds.length === styles.length;
  const toggleAll = () => setSelectedIds(allSelected ? [] : styles.map((s) => s.id));

  const canGenerate = selectedIds.length > 0 && !generating;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden", ...jakartaSans }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "#e8edff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bot size={16} style={{ color: "#0147ff" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>Générer avec l&apos;IA</h3>
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", margin: 0, marginTop: 1 }}>Personnalisez la génération</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.35)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Styles à utiliser */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)" }}>Styles à utiliser</label>
              <button onClick={toggleAll} style={{ fontSize: 11, color: "#0147ff", background: "none", border: "none", cursor: "pointer", fontWeight: 600, ...jakartaSans }}>
                {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {styles.map((s) => {
                const ss = STYLE_CATEGORY_STYLES[s.category] ?? STYLE_CATEGORY_STYLES.custom;
                const isSelected = selectedIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStyle(s.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      borderRadius: 10, border: isSelected ? "1px solid #c7d3ff" : "1px solid rgba(0,0,0,0.09)",
                      background: isSelected ? "#f0f4ff" : "#f9f9f9", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, border: isSelected ? "none" : "1.5px solid rgba(0,0,0,0.15)",
                      background: isSelected ? "#0147ff" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {isSelected && <Check size={11} style={{ color: "#fff" }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#121a2e" }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(18,26,46,0.45)", marginTop: 1 }}>{s.description}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500, background: ss.bg, color: ss.color, flexShrink: 0 }}>
                      {STYLE_CATEGORY_LABELS[s.category] ?? s.category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 6 }}>Nombre d&apos;idées</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                style={{ background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "#121a2e", outline: "none", width: "100%", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
              >
                {[3, 5, 6, 9, 12].map((n) => <option key={n} value={n}>{n} idées</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 6 }}>Langue</label>
              <select
                value={language}
                onChange={(e) => { onLanguageChange(e.target.value as "fr" | "en"); localStorage.setItem("linkedin_ideas_language", e.target.value); }}
                style={{ background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "8px 12px", fontSize: 13, color: "#121a2e", outline: "none", width: "100%", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>

          {selectedIds.length === 0 && (
            <div style={{ fontSize: 12, color: "#c53030", background: "#ffe4e4", border: "1px solid #fca5a5", borderRadius: 9, padding: "8px 12px" }}>
              Sélectionne au moins un style pour générer des idées.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "#121a2e", cursor: "pointer", ...jakartaSans }}>
            Annuler
          </button>
          <button
            onClick={() => canGenerate && onGenerate(selectedIds)}
            disabled={!canGenerate}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
              border: "1px solid #2f4d9d", color: "#fff", cursor: canGenerate ? "pointer" : "not-allowed",
              opacity: canGenerate ? 1 : 0.5, ...jakartaSans,
            }}
          >
            {generating ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
            {generating ? "Génération..." : `Générer ${count} idées`}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Page principale ─────────────────────────────────────────────────────────
export default function LinkedInIdeesPage() {
  const [ideas, setIdeas] = useState<LinkedInIdea[]>([]);
  const [styles, setStyles] = useState<LinkedInStyle[]>(DEFAULT_STYLES);
  const [generating, setGenerating] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

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

  const handleGenerate = async (selectedStyleIds: string[]) => {
    setGenerating(true);
    setShowGenerateModal(false);
    try {
      const topPosts = getTopPosts();
      const s = loadLinkedInSettings();
      const selectedStyles = styles.filter((st) => selectedStyleIds.includes(st.id));
      const res = await fetch("/api/linkedin/generate-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: 9,
          topPosts: topPosts.map((p) => ({ content: p.content, likes: p.likes, comments: p.comments, impressions: p.impressions, styleName: p.styleName })),
          styles: selectedStyles.map((st) => ({ name: st.name, category: st.category })),
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

  const handleAddManual = (idea: LinkedInIdea) => {
    saveIdeas([idea, ...ideas]);
    setShowAddModal(false);
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

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Bouton manuel */}
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer",
                background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "#121a2e",
                ...jakartaSans,
              }}
            >
              <PenLine size={14} />
              Ajouter
            </button>

            {/* Bouton IA */}
            <button
              onClick={() => setShowGenerateModal(true)}
              disabled={generating}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
                fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: generating ? "not-allowed" : "pointer",
                background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                border: "1px solid #2f4d9d", color: "#fff", opacity: generating ? 0.7 : 1,
                ...jakartaSans,
              }}
            >
              {generating ? <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Bot size={15} />}
              {generating ? "Génération..." : "Générer avec l'IA"}
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
                  padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  ...jakartaSans,
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
                Ajoutez une idée manuellement ou laissez l&apos;IA en générer basées sur vos meilleurs posts
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowAddModal(true)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer", background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "#121a2e", ...jakartaSans }}
              >
                <PenLine size={15} />
                Ajouter manuellement
              </button>
              <button
                onClick={() => setShowGenerateModal(true)}
                disabled={generating}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer", background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff", ...jakartaSans }}
              >
                <Bot size={15} />
                Générer avec l&apos;IA
              </button>
            </div>
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

      {/* Modals */}
      {showAddModal && (
        <AddManualModal
          styles={styles}
          onSave={handleAddManual}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {showGenerateModal && (
        <GenerateModal
          styles={styles}
          language={language}
          onLanguageChange={setLanguage}
          generating={generating}
          onGenerate={handleGenerate}
          onClose={() => setShowGenerateModal(false)}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function IdeaCard({ idea, onUse, onDismiss, onRestore }: {
  idea: LinkedInIdea;
  onUse: () => void;
  onDismiss: () => void;
  onRestore: () => void;
}) {
  const categoryKey = idea.styleName
    ? Object.entries(STYLE_CATEGORY_LABELS).find(([, v]) => v === idea.styleName)?.[0]
    : undefined;
  const ss = categoryKey ? STYLE_CATEGORY_STYLES[categoryKey] : undefined;

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

      {idea.styleName && ss && (
        <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 500, alignSelf: "flex-start", background: ss.bg, color: ss.color }}>
          {idea.styleName}
        </span>
      )}

      {idea.description && (
        <p style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", lineHeight: 1.6, flex: 1, margin: 0 }}>
          {idea.description}
        </p>
      )}

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
