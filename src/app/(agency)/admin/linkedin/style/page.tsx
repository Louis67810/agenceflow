"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, X, Check, Sparkles, ChevronDown,
  ChevronUp, Loader2, FileText, AlignLeft,
} from "lucide-react";
import { LinkedInStyle, DEFAULT_STYLES, STYLE_CATEGORY_COLORS } from "@/types/linkedin";
import {
  fetchRemoteLinkedInWorkspace,
  hasMeaningfulLinkedInWorkspaceData,
  loadLinkedInWorkspaceCache,
  patchRemoteLinkedInWorkspace,
  persistLinkedInWorkspacePatch,
} from "@/lib/linkedin/workspace";
import ClientBlueButton from "@/components/shared/ClientBlueButton";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

const CATEGORIES = [
  { value: "storytelling", label: "Storytelling" },
  { value: "valeur",       label: "Valeur / Liste" },
  { value: "educatif",     label: "Éducatif" },
  { value: "educatif_carrousel", label: "Educatif carrousel" },
  { value: "presentation_projet", label: "Presentation de projet" },
  { value: "engagement",   label: "Engagement" },
  { value: "data",         label: "Data chiffres" },
  { value: "lead_magnet",  label: "Lead magnet" },
  { value: "viral",        label: "Opinion forte" },
  { value: "custom",       label: "Personnalisé" },
];

const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  storytelling: "Storytelling",
  valeur: "Valeur / Liste",
  educatif: "Educatif",
  educatif_carrousel: "Educatif carrousel",
  presentation_projet: "Presentation de projet",
  engagement: "Engagement",
  data: "Data chiffres",
  lead_magnet: "Lead magnet",
  viral: "Opinion forte",
  custom: "Personnalise",
};

interface StyleExample {
  id: string;
  style_id: string;
  content: string;
  created_at: string;
}

const EMPTY_STYLE: Omit<LinkedInStyle, "id" | "createdAt" | "isDefault"> = {
  name: "",
  category: "custom",
  description: "",
  example: "",
  prompt: "",
};

const inputStyle = {
  width: "100%", fontSize: 13, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9,
  padding: "9px 12px", background: "#f6f6f6", color: "#121a2e", outline: "none",
  boxSizing: "border-box" as const, fontFamily: '"Plus Jakarta Sans", sans-serif',
};

const btnGradient = {
  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
  border: "1px solid #2f4d9d",
  color: "#fff",
  cursor: "pointer",
  borderRadius: 9,
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

export default function LinkedInStylePage() {
  const [styles, setStyles] = useState<LinkedInStyle[]>([]);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingStyle, setEditingStyle] = useState<LinkedInStyle | null>(null);
  const [form, setForm] = useState(EMPTY_STYLE);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [expandedExamples, setExpandedExamples] = useState<string | null>(null);
  const [examplesByStyle, setExamplesByStyle] = useState<Record<string, StyleExample[]>>({});
  const [loadingExamples, setLoadingExamples] = useState<Record<string, boolean>>({});
  const [newExampleText, setNewExampleText] = useState<Record<string, string>>({});
  const [addingExample, setAddingExample] = useState<Record<string, boolean>>({});
  const [showAddExample, setShowAddExample] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const cachedWorkspace = loadLinkedInWorkspaceCache();
    setStyles(cachedWorkspace.styles);

    void (async () => {
      try {
        const remote = await fetchRemoteLinkedInWorkspace();
        if (remote.hasStoredData) {
          setStyles(remote.workspace.styles);
        } else if (hasMeaningfulLinkedInWorkspaceData(cachedWorkspace)) {
          await patchRemoteLinkedInWorkspace({ styles: cachedWorkspace.styles });
        }
      } catch {
        setStyles(cachedWorkspace.styles.length > 0 ? cachedWorkspace.styles : DEFAULT_STYLES);
      }
    })();
  }, []);

  const save = (updated: LinkedInStyle[]) => {
    setStyles(updated);
    persistLinkedInWorkspacePatch({ styles: updated });
  };

  const loadExamples = useCallback(async (styleId: string) => {
    if (examplesByStyle[styleId] !== undefined) return;
    setLoadingExamples((prev) => ({ ...prev, [styleId]: true }));
    try {
      const res = await fetch(`/api/linkedin/style-examples?styleId=${encodeURIComponent(styleId)}`);
      const data = await res.json();
      setExamplesByStyle((prev) => ({ ...prev, [styleId]: data.examples ?? [] }));
    } catch {
      setExamplesByStyle((prev) => ({ ...prev, [styleId]: [] }));
    } finally {
      setLoadingExamples((prev) => ({ ...prev, [styleId]: false }));
    }
  }, [examplesByStyle]);

  const toggleExamples = (styleId: string) => {
    if (expandedExamples === styleId) setExpandedExamples(null);
    else { setExpandedExamples(styleId); loadExamples(styleId); }
  };

  const handleAddExample = async (styleId: string) => {
    const text = newExampleText[styleId]?.trim();
    if (!text) return;
    setAddingExample((prev) => ({ ...prev, [styleId]: true }));
    try {
      const res = await fetch("/api/linkedin/style-examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId, content: text }),
      });
      const data = await res.json();
      if (data.example) {
        setExamplesByStyle((prev) => ({ ...prev, [styleId]: [data.example, ...(prev[styleId] ?? [])] }));
        setNewExampleText((prev) => ({ ...prev, [styleId]: "" }));
        setShowAddExample((prev) => ({ ...prev, [styleId]: false }));
      }
    } catch {} finally {
      setAddingExample((prev) => ({ ...prev, [styleId]: false }));
    }
  };

  const handleDeleteExample = async (styleId: string, exampleId: string) => {
    try {
      await fetch(`/api/linkedin/style-examples?id=${exampleId}`, { method: "DELETE" });
      setExamplesByStyle((prev) => ({ ...prev, [styleId]: (prev[styleId] ?? []).filter((e) => e.id !== exampleId) }));
    } catch {}
  };

  const openCreate = () => { setForm(EMPTY_STYLE); setEditingStyle(null); setModal("create"); };
  const openEdit = (style: LinkedInStyle) => {
    setForm({ name: style.name, category: style.category, description: style.description, example: style.example, prompt: style.prompt });
    setEditingStyle(style);
    setModal("edit");
  };
  const closeModal = () => { setModal(null); setEditingStyle(null); setForm(EMPTY_STYLE); };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.prompt.trim()) return;
    if (modal === "create") {
      save([...styles, { ...form, id: `custom_${Date.now()}`, isDefault: false, createdAt: new Date().toISOString() }]);
    } else if (modal === "edit" && editingStyle) {
      save(styles.map((s) => s.id === editingStyle.id ? { ...s, ...form } : s));
    }
    closeModal();
  };

  const handleDelete = (id: string) => { save(styles.filter((s) => s.id !== id)); setDeleteId(null); };

  const filtered = activeCategory === "all" ? styles : styles.filter((s) => s.category === activeCategory);
  const customCount = styles.filter((s) => !s.isDefault).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#fbfbfb", ...jakartaSans }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "16px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.4px", margin: 0 }}>Styles d&apos;écriture</h2>
            <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", marginTop: 2, marginBottom: 0 }}>{styles.length} styles · {customCount} personnalisés</p>
          </div>
          <ClientBlueButton compact type="button" onClick={openCreate} icon={<Plus size={16} />}>
            Nouveau style
          </ClientBlueButton>
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveCategory("all")}
            style={{
              padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
              ...(activeCategory === "all"
                ? { background: btnGradient.background, border: btnGradient.border, color: btnGradient.color }
                : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
            }}
          >
            Tous ({styles.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = styles.filter((s) => s.category === cat.value).length;
            if (count === 0) return null;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                style={{
                  padding: "6px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer",
                  ...(activeCategory === cat.value
                    ? { background: btnGradient.background, border: btnGradient.border, color: btnGradient.color }
                    : { background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", color: "rgba(18,26,46,0.6)" }),
                }}
              >
                {CATEGORY_LABEL_OVERRIDES[cat.value] ?? cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))", gap: 16 }}>
          {filtered.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              onEdit={() => openEdit(style)}
              onDelete={() => setDeleteId(style.id)}
              examplesExpanded={expandedExamples === style.id}
              onToggleExamples={() => toggleExamples(style.id)}
              examples={examplesByStyle[style.id] ?? null}
              loadingExamples={!!loadingExamples[style.id]}
              showAdd={!!showAddExample[style.id]}
              onToggleAdd={() => setShowAddExample((prev) => ({ ...prev, [style.id]: !prev[style.id] }))}
              newExampleText={newExampleText[style.id] ?? ""}
              onChangeExampleText={(text) => setNewExampleText((prev) => ({ ...prev, [style.id]: text }))}
              onAddExample={() => handleAddExample(style.id)}
              addingExample={!!addingExample[style.id]}
              onDeleteExample={(exId) => handleDeleteExample(style.id, exId)}
            />
          ))}

          {/* Add card */}
          <button
            onClick={openCreate}
            style={{ border: "2px dashed rgba(0,0,0,0.1)", borderRadius: 13, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(18,26,46,0.35)", background: "none", cursor: "pointer", minHeight: 200 }}
          >
            <Plus size={24} />
            <span style={{ fontSize: 13, fontWeight: 500, fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Créer un style</span>
          </button>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <h3 style={{ fontWeight: 700, color: "#121a2e", fontSize: 17, margin: 0, letterSpacing: "-0.3px" }}>
                {modal === "create" ? "Nouveau style" : "Modifier le style"}
              </h3>
              <button onClick={closeModal} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, maxHeight: "70vh", overflowY: "auto" }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Nom du style</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Mon style signature" style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Catégorie</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as LinkedInStyle["category"] })} style={inputStyle}>
                  {CATEGORIES.map((cat) => <option key={cat.value} value={cat.value}>{CATEGORY_LABEL_OVERRIDES[cat.value] ?? cat.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Description courte</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Posts engageants avec des questions directes" style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Exemple d&apos;accroche</label>
                <textarea value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} placeholder="Montre les premières lignes typiques de ce style..." rows={3} style={{ ...inputStyle, resize: "none" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Sparkles size={14} style={{ color: "#0147ff" }} />
                    Instructions pour l&apos;IA
                  </span>
                </label>
                <textarea value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="Décris précisément comment l'IA doit écrire avec ce style : structure, ton, format, longueur, ce qu'il faut éviter..." rows={5} style={{ ...inputStyle, resize: "none" }} />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, padding: "16px 24px", borderTop: "1px solid rgba(0,0,0,0.07)" }}>
              <button onClick={closeModal} style={{ padding: "8px 16px", fontSize: 13, color: "rgba(18,26,46,0.6)", background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.name.trim() || !form.prompt.trim()}
                style={{ ...btnGradient, display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, opacity: !form.name.trim() || !form.prompt.trim() ? 0.4 : 1 }}
              >
                <Check size={16} />
                {modal === "create" ? "Créer" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", padding: 24 }}>
            <h3 style={{ fontWeight: 700, color: "#121a2e", margin: "0 0 8px", letterSpacing: "-0.3px" }}>Supprimer ce style ?</h3>
            <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", marginBottom: 24 }}>Cette action est irréversible.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "9px 16px", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, fontSize: 13, color: "rgba(18,26,46,0.6)", background: "#f6f6f6", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Annuler
              </button>
              <button onClick={() => handleDelete(deleteId)} style={{ flex: 1, padding: "9px 16px", background: "#ef4444", border: "1px solid #dc2626", color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StyleCard({
  style, onEdit, onDelete, examplesExpanded, onToggleExamples,
  examples, loadingExamples, showAdd, onToggleAdd,
  newExampleText, onChangeExampleText, onAddExample, addingExample, onDeleteExample,
}: {
  style: LinkedInStyle;
  onEdit: () => void;
  onDelete: () => void;
  examplesExpanded: boolean;
  onToggleExamples: () => void;
  examples: StyleExample[] | null;
  loadingExamples: boolean;
  showAdd: boolean;
  onToggleAdd: () => void;
  newExampleText: string;
  onChangeExampleText: (text: string) => void;
  onAddExample: () => void;
  addingExample: boolean;
  onDeleteExample: (id: string) => void;
}) {
  const colorClass = STYLE_CATEGORY_COLORS[style.category] || "bg-gray-100 text-gray-700";
  const exampleCount = examples?.length ?? 0;
  const catLabel = CATEGORY_LABEL_OVERRIDES[style.category] ?? CATEGORIES.find((c) => c.value === style.category)?.label ?? style.category;

  return (
    <div style={{ background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0px 2px 8px rgba(0,0,0,0.04)", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      {/* Card header */}
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ display: "none" }}>{style.name}</h3>
              {style.isDefault && null}
            </div>
            <span className={`inline-block rounded-full ${colorClass}`} style={{ padding: "10px 14px", lineHeight: 1, fontSize: 14, fontWeight: 800, letterSpacing: "-0.15px" }}>
              {catLabel}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button onClick={onEdit} style={{ padding: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex", borderRadius: 8 }}>
              <Pencil size={14} />
            </button>
            {!style.isDefault && (
              <button onClick={onDelete} style={{ padding: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.3)", display: "flex", borderRadius: 8 }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {style.description && <p style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", lineHeight: 1.5, margin: 0 }}>{style.description}</p>}

        {style.example && (
          <div style={{ background: "#f6f6f6", borderRadius: 9, padding: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
            <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Exemple</p>
            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.65)", whiteSpace: "pre-line", margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{style.example}</p>
          </div>
        )}

        <div style={{ background: "#e8edff", borderRadius: 9, padding: 12, border: "1px solid #c7d3ff" }}>
          <p style={{ fontSize: 11, color: "#0147ff", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", display: "flex", alignItems: "center", gap: 4 }}>
            <Sparkles size={11} /> Prompt IA
          </p>
          <p style={{ fontSize: 12, color: "#073e63", margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{style.prompt}</p>
        </div>
      </div>

      {/* Examples section toggle */}
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <button
          onClick={onToggleExamples}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.5)", background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FileText size={13} />
            Posts d&apos;exemple
            {examples !== null && (
              <span style={{ background: "#f6f6f6", color: "rgba(18,26,46,0.5)", padding: "1px 6px", borderRadius: 20, fontSize: 11 }}>{exampleCount}</span>
            )}
          </span>
          {examplesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {examplesExpanded && (
          <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>
              Ajoutez des posts réels qui correspondent à ce style. L&apos;IA les utilisera comme référence lors de la génération.
            </p>

            {loadingExamples ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                <Loader2 size={16} style={{ color: "rgba(18,26,46,0.3)", animation: "spin 1s linear infinite" }} />
              </div>
            ) : (
              <>
                {examples && examples.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 256, overflowY: "auto", paddingRight: 4 }}>
                    {examples.map((ex) => (
                      <div key={ex.id} style={{ position: "relative", background: "#f6f6f6", borderRadius: 9, padding: 12, border: "1px solid rgba(0,0,0,0.06)" }}>
                        <p style={{ fontSize: 12, color: "rgba(18,26,46,0.6)", whiteSpace: "pre-line", margin: 0, paddingRight: 24, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ex.content}</p>
                        <button
                          onClick={() => onDeleteExample(ex.id)}
                          style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.25)", display: "flex", padding: 2 }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(18,26,46,0.4)", padding: "8px 0" }}>
                    <AlignLeft size={13} />
                    Aucun exemple — ajoutez vos meilleurs posts dans ce style
                  </div>
                )}

                {showAdd ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea
                      value={newExampleText}
                      onChange={(e) => onChangeExampleText(e.target.value)}
                      placeholder="Collez ici un post LinkedIn qui représente bien ce style..."
                      rows={6}
                      autoFocus
                      style={{ width: "100%", fontSize: 12, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "9px 12px", background: "#f6f6f6", color: "#121a2e", outline: "none", resize: "none", boxSizing: "border-box", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={onToggleAdd} style={{ padding: "6px 12px", fontSize: 12, color: "rgba(18,26,46,0.5)", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, background: "#f6f6f6", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                        Annuler
                      </button>
                      <button
                        onClick={onAddExample}
                        disabled={!newExampleText.trim() || addingExample}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", border: "1px solid #2f4d9d", color: "#fff", borderRadius: 8, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', opacity: !newExampleText.trim() || addingExample ? 0.5 : 1 }}
                      >
                        {addingExample ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={12} />}
                        Ajouter
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={onToggleAdd} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0147ff", background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 500 }}>
                    <Plus size={13} />Ajouter un post d&apos;exemple
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
