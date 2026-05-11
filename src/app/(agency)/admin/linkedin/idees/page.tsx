"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, RefreshCw, Check, X, ArrowRight, Lightbulb, Plus, Bot, PenLine, Trash2, Repeat, Image as ImageIcon } from "lucide-react";
import { LinkedInConcept, LinkedInIdea, LinkedInPost, LinkedInStyle, DEFAULT_STYLES } from "@/types/linkedin";
import { loadLinkedInSettings } from "@/lib/linkedin/settings";
import { computeLinkedInPostScore, loadLinkedInPosts } from "@/lib/linkedin/posts";
import {
  fetchRemoteLinkedInWorkspace,
  hasMeaningfulLinkedInWorkspaceData,
  loadLinkedInWorkspaceCache,
  patchRemoteLinkedInWorkspace,
  persistLinkedInWorkspacePatch,
} from "@/lib/linkedin/workspace";

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

const STYLE_CATEGORY_LABEL_MAP: Record<string, string> = {
  ...STYLE_CATEGORY_LABELS,
  educatif: "Educatif",
  educatif_carrousel: "Educatif carrousel",
  presentation_projet: "Presentation de projet",
  data: "Data chiffres",
  lead_magnet: "Lead magnet",
  custom: "Personnalise",
};

const STYLE_CATEGORY_STYLE_MAP: Record<string, { bg: string; color: string }> = {
  ...STYLE_CATEGORY_STYLES,
  educatif_carrousel: { bg: "#dff7ff", color: "#036782" },
  presentation_projet: { bg: "#e9edf5", color: "#334155" },
  lead_magnet: { bg: "#d1fae5", color: "#047857" },
};

function daysAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Image illisible"));
    reader.readAsDataURL(file);
  });
}

const RECURRENCE_UNITS = [
  { value: "days", label: "jour(s)" },
  { value: "weeks", label: "semaine(s)" },
  { value: "months", label: "mois" },
];

function getNextRecurringDate(every: number, unit: LinkedInConcept["recurrenceUnit"], index: number) {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  const amount = Math.max(1, every) * index;
  if (unit === "days") date.setDate(date.getDate() + amount);
  if (unit === "weeks") date.setDate(date.getDate() + amount * 7);
  if (unit === "months") date.setMonth(date.getMonth() + amount);
  return date;
}

function createRecurringIdeasFromConcept(concept: LinkedInConcept, existingIdeas: LinkedInIdea[], occurrences = 8) {
  const existingKeys = new Set(
    existingIdeas
      .filter((idea) => idea.conceptId === concept.id && idea.scheduledAt)
      .map((idea) => idea.scheduledAt!.slice(0, 10))
  );

  const nextIdeas: LinkedInIdea[] = [];
  for (let index = 0; index < occurrences; index += 1) {
    const scheduledAt = getNextRecurringDate(
      concept.recurrenceEvery,
      concept.recurrenceUnit,
      index
    ).toISOString();
    const dateKey = scheduledAt.slice(0, 10);
    if (existingKeys.has(dateKey)) continue;
    nextIdeas.push({
      id: `idea_${Date.now()}_${index}_${Math.random().toString(36).slice(2)}`,
      title: concept.title,
      description: concept.description,
      conceptId: concept.id,
      styleId: concept.styleId,
      styleName: concept.styleName,
      scheduledAt,
      status: "new",
      generatedAt: new Date().toISOString(),
    });
  }
  return nextIdeas;
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
  const [imageUrl, setImageUrl] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<string>(styles[0]?.id ?? "");
  const [scheduledAt, setScheduledAt] = useState("");

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

  const canSave = title.trim().length > 0 && selectedStyleId.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const selectedStyle = styles.find((style) => style.id === selectedStyleId);
    const idea: LinkedInIdea = {
      id: `idea_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl || undefined,
      styleId: selectedStyle?.id,
      styleName: selectedStyle?.name,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      status: "new",
      generatedAt: new Date().toISOString(),
    };
    onSave(idea);
  };

  const importImage = async (file?: File) => {
    if (!file) return;
    const dataUrl = await readImageAsDataUrl(file);
    setImageUrl(dataUrl);
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

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 6 }}>Image <span style={{ fontWeight: 400, opacity: 0.7 }}>(optionnel)</span></label>
            {imageUrl ? (
              <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(18,26,46,0.1)", background: "#f6f6f6" }}>
                <img src={imageUrl} alt="" style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
                <button type="button" onClick={() => setImageUrl("")} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 999, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0px 6px 14px rgba(18,26,46,0.14)" }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label style={{ minHeight: 82, borderRadius: 14, border: "1px dashed rgba(18,26,46,0.18)", background: "#f8f8f8", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, color: "rgba(18,26,46,0.56)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                <ImageIcon size={17} />
                Ajouter une image a l'idee
                <input type="file" accept="image/*" onChange={(event) => { void importImage(event.target.files?.[0]); event.currentTarget.value = ""; }} style={{ display: "none" }} />
              </label>
            )}
          </div>

          {/* Style */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 8 }}>Style de post *</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {styles.map((s) => {
                const ss = STYLE_CATEGORY_STYLE_MAP[s.category] ?? STYLE_CATEGORY_STYLE_MAP.custom;
                const isActive = selectedStyleId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyleId(s.id)}
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

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 6 }}>Date prévue <span style={{ fontWeight: 400, opacity: 0.7 }}>(optionnel)</span></label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              style={inp}
            />
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
function AddConceptModal({
  styles,
  onSave,
  onClose,
}: {
  styles: LinkedInStyle[];
  onSave: (concept: LinkedInConcept) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<string>(styles[0]?.id ?? "");
  const [recurrenceEvery, setRecurrenceEvery] = useState(1);
  const [recurrenceUnit, setRecurrenceUnit] = useState<LinkedInConcept["recurrenceUnit"]>("weeks");

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
    boxSizing: "border-box" as const,
  };

  const canSave = title.trim().length > 0 && selectedStyleId.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const selectedStyle = styles.find((style) => style.id === selectedStyleId);
    onSave({
      id: `concept_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: title.trim(),
      description: description.trim(),
      styleId: selectedStyle?.id,
      styleName: selectedStyle?.name,
      recurrenceEvery: Math.max(1, recurrenceEvery),
      recurrenceUnit,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden", ...jakartaSans }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#121a2e", margin: 0 }}>Concept recurrent</h3>
            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", margin: "3px 0 0" }}>Ajoute ce concept au planning selon son intervalle.</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 6 }}>Concept *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex: Audit SEO d'une page en 5 minutes" style={inp} autoFocus />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 6 }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Angle, structure recurrente, exemples a reprendre..." rows={3} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", display: "block", marginBottom: 8 }}>Style</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {styles.map((style) => {
                const ss = STYLE_CATEGORY_STYLE_MAP[style.category] ?? STYLE_CATEGORY_STYLE_MAP.custom;
                const isActive = selectedStyleId === style.id;
                return (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyleId(style.id)}
                    style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", background: isActive ? ss.bg : "#f6f6f6", border: isActive ? `1px solid ${ss.color}40` : "1px solid rgba(0,0,0,0.09)", color: isActive ? ss.color : "rgba(18,26,46,0.55)" }}
                  >
                    {style.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)" }}>
              Tous les
              <input
                type="number"
                min={1}
                value={recurrenceEvery}
                onChange={(e) => setRecurrenceEvery(Math.max(1, Number(e.target.value) || 1))}
                style={{ ...inp, marginTop: 6 }}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)" }}>
              Periode
              <select
                value={recurrenceUnit}
                onChange={(e) => setRecurrenceUnit(e.target.value as LinkedInConcept["recurrenceUnit"])}
                style={{ ...inp, marginTop: 6 }}
              >
                {RECURRENCE_UNITS.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.65)", cursor: "pointer", ...jakartaSans }}>Annuler</button>
          <button onClick={handleSave} disabled={!canSave} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff", cursor: canSave ? "pointer" : "not-allowed", opacity: canSave ? 1 : 0.5, ...jakartaSans }}>
            <Repeat size={14} />
            Ajouter au planning
          </button>
        </div>
      </div>
    </div>
  );
}

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
                const ss = STYLE_CATEGORY_STYLE_MAP[s.category] ?? STYLE_CATEGORY_STYLE_MAP.custom;
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
                      {STYLE_CATEGORY_LABEL_MAP[s.category] ?? s.category}
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
  const [concepts, setConcepts] = useState<LinkedInConcept[]>([]);
  const [styles, setStyles] = useState<LinkedInStyle[]>(DEFAULT_STYLES);
  const [generating, setGenerating] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  useEffect(() => {
    const cachedWorkspace = loadLinkedInWorkspaceCache();
    setIdeas(cachedWorkspace.ideas);
    setConcepts(cachedWorkspace.concepts);
    setStyles(cachedWorkspace.styles);
    setLanguage(cachedWorkspace.preferences.ideasLanguage);
    setLastGenerated(cachedWorkspace.preferences.ideasLastGenerated);

    void (async () => {
      try {
        const remote = await fetchRemoteLinkedInWorkspace();
        if (remote.hasStoredData) {
          setIdeas(remote.workspace.ideas);
          setConcepts(remote.workspace.concepts);
          setStyles(remote.workspace.styles);
          setLanguage(remote.workspace.preferences.ideasLanguage);
          setLastGenerated(remote.workspace.preferences.ideasLastGenerated);
        } else if (hasMeaningfulLinkedInWorkspaceData(cachedWorkspace)) {
          await patchRemoteLinkedInWorkspace(cachedWorkspace);
        }
      } catch {
        setStyles(cachedWorkspace.styles.length > 0 ? cachedWorkspace.styles : DEFAULT_STYLES);
      }
    })();
  }, []);

  const saveIdeas = (updated: LinkedInIdea[]) => {
    setIdeas(updated);
    persistLinkedInWorkspacePatch({ ideas: updated });
  };

  const saveConceptsAndIdeas = (updatedConcepts: LinkedInConcept[], updatedIdeas: LinkedInIdea[]) => {
    setConcepts(updatedConcepts);
    setIdeas(updatedIdeas);
    persistLinkedInWorkspacePatch({ concepts: updatedConcepts, ideas: updatedIdeas });
  };

  const getTopPosts = useCallback((): LinkedInPost[] => {
    try {
      return loadLinkedInPosts()
        .filter((p) => p.status === "published")
        .sort((a, b) => computeLinkedInPostScore(b) - computeLinkedInPostScore(a))
        .slice(0, 5);
    } catch {
      return [];
    }
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
          topPosts: topPosts.map((p) => ({
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
          })),
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
          styleName: idea.styleCategory ? STYLE_CATEGORY_LABEL_MAP[idea.styleCategory] : undefined,
          status: "new" as const,
          generatedAt: new Date().toISOString(),
        })
      );

      const now = new Date().toISOString();
      saveIdeas([...newIdeas, ...ideas]);
      setLastGenerated(now);
      persistLinkedInWorkspacePatch({
        preferences: { ideasLastGenerated: now },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    persistLinkedInWorkspacePatch({
      preferences: {
        ideasLanguage: language,
        ideasLastGenerated: lastGenerated,
      },
    });
  }, [language, lastGenerated]);

  const handleAddManual = (idea: LinkedInIdea) => {
    saveIdeas([idea, ...ideas]);
    setShowAddModal(false);
  };

  const handleAddConcept = (concept: LinkedInConcept) => {
    const plannedIdeas = createRecurringIdeasFromConcept(concept, ideas, 8);
    saveConceptsAndIdeas([concept, ...concepts], [...plannedIdeas, ...ideas]);
    setShowConceptModal(false);
  };

  const updateStatus = (id: string, status: LinkedInIdea["status"]) => {
    saveIdeas(ideas.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const useIdea = (idea: LinkedInIdea) => {
    sessionStorage.setItem("linkedin_idea_prefill", JSON.stringify(idea));
    window.location.href = "/admin/linkedin/posts";
  };
  const deleteIdea = (id: string) => {
    saveIdeas(ideas.filter((idea) => idea.id !== id));
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

            <button
              onClick={() => setShowConceptModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
                fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer",
                background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "#121a2e",
                ...jakartaSans,
              }}
            >
              <Repeat size={14} />
              Concept
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
        {concepts.length > 0 && (
          <div style={{ marginBottom: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {concepts.map((concept) => {
              const unitLabel = RECURRENCE_UNITS.find((unit) => unit.value === concept.recurrenceUnit)?.label ?? "semaine(s)";
              return (
                <div key={concept.id} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 13, padding: 14, boxShadow: "0px 2px 8px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#121a2e", letterSpacing: "-0.2px" }}>{concept.title}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(18,26,46,0.45)" }}>Tous les {concept.recurrenceEvery} {unitLabel}</p>
                    </div>
                    <span style={{ flexShrink: 0, fontSize: 11, background: "#e0e7ff", color: "#3730a3", padding: "3px 8px", borderRadius: 999, fontWeight: 700 }}>Recurrence</span>
                  </div>
                  {concept.description && <p style={{ margin: "9px 0 0", color: "rgba(18,26,46,0.56)", fontSize: 12, lineHeight: 1.5 }}>{concept.description}</p>}
                </div>
              );
            })}
          </div>
        )}

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
                onDelete={() => deleteIdea(idea.id)}
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
      {showConceptModal && (
        <AddConceptModal
          styles={styles}
          onSave={handleAddConcept}
          onClose={() => setShowConceptModal(false)}
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

function IdeaCard({ idea, onUse, onDelete, onRestore }: {
  idea: LinkedInIdea;
  onUse: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const categoryKey = idea.styleName
    ? Object.entries(STYLE_CATEGORY_LABEL_MAP).find(([, v]) => v === idea.styleName)?.[0]
    : undefined;
  const ss = categoryKey ? STYLE_CATEGORY_STYLE_MAP[categoryKey] : undefined;

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
        position: "relative",
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

      {idea.imageUrl ? (
        <img
          src={idea.imageUrl}
          alt=""
          style={{ width: "100%", height: 142, objectFit: "cover", borderRadius: 12, border: "1px solid rgba(18,26,46,0.08)", background: "#f6f6f6" }}
        />
      ) : null}

      {idea.styleName && ss && (
        <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 500, alignSelf: "flex-start", background: ss.bg, color: ss.color }}>
          {idea.styleName}
        </span>
      )}

      {idea.scheduledAt && (
        <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600, alignSelf: "flex-start", background: "#f6f6f6", color: "rgba(18,26,46,0.58)" }}>
          Prévue le {new Date(idea.scheduledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      )}

      {idea.description && (
        <p style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", lineHeight: 1.6, flex: 1, margin: 0 }}>
          {idea.description}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 4 }}>
        <button
          onClick={onDelete}
          title="Supprimer"
          style={{ padding: 6, background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, cursor: "pointer", color: "rgba(18,26,46,0.35)", display: "flex" }}
        >
          <Trash2 size={14} />
        </button>

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
              ) : null}
            </>
          )}

          {idea.status !== "dismissed" && (
            <button
              onClick={onUse}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              L’utiliser dans un post
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
