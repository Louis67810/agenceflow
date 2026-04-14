"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, GripVertical, Save, FileText, Loader2,
  Type, AlignLeft, Mail, Link2, Phone, Hash, Calendar,
  ChevronDown, CircleDot, CheckSquare, Image, Paperclip,
  X, Check, AlertCircle,
} from "lucide-react";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface BuilderField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface BuilderPage {
  id: string;
  title: string;
  fields: BuilderField[];
}

interface FormMeta {
  id: string;
  name: string;
  pages: BuilderPage[];
  created_at: string;
}

// ─── Field type config ────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { type: "text",     label: "Texte court",     icon: Type,        defaultLabel: "Votre réponse" },
  { type: "textarea", label: "Texte long",       icon: AlignLeft,   defaultLabel: "Décrivez..." },
  { type: "email",    label: "Email",            icon: Mail,        defaultLabel: "Votre email" },
  { type: "url",      label: "Lien / URL",       icon: Link2,       defaultLabel: "https://..." },
  { type: "phone",    label: "Téléphone",        icon: Phone,       defaultLabel: "Votre téléphone" },
  { type: "number",   label: "Nombre",           icon: Hash,        defaultLabel: "Nombre" },
  { type: "date",     label: "Date",             icon: Calendar,    defaultLabel: "Date" },
  { type: "select",   label: "Liste déroulante", icon: ChevronDown, defaultLabel: "Choisissez une option" },
  { type: "radio",    label: "Choix unique",     icon: CircleDot,   defaultLabel: "Sélectionnez une option" },
  { type: "checkbox", label: "Choix multiples",  icon: CheckSquare, defaultLabel: "Sélectionnez les options" },
  { type: "photo",    label: "Photo",            icon: Image,       defaultLabel: "Uploader une photo" },
  { type: "file",     label: "Fichier",          icon: Paperclip,   defaultLabel: "Télécharger un fichier" },
];

const typeConfig = Object.fromEntries(FIELD_TYPES.map((t) => [t.type, t]));
const needsOptions = (t: string) => ["select", "radio", "checkbox"].includes(t);

const inputStyle = {
  width: "100%", fontSize: 13, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9,
  padding: "8px 12px", background: "#f6f6f6", color: "#121a2e", outline: "none",
  boxSizing: "border-box" as const,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormsPage() {
  const [forms, setForms]           = useState<FormMeta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [editorName, setEditorName]   = useState("");
  const [editorPages, setEditorPages] = useState<BuilderPage[]>([]);
  const [pageIdx, setPageIdx]         = useState(0);
  const [hasChanges, setHasChanges]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveOk, setSaveOk]           = useState(false);

  const [showTypePicker, setShowTypePicker] = useState(false);
  const [expandedField, setExpandedField]   = useState<string | null>(null);
  const [editingPageTitle, setEditingPageTitle] = useState<number | null>(null);

  const dragId  = useRef<string | null>(null);
  const dragOver = useRef<string | null>(null);

  useEffect(() => { loadForms(); }, []);

  async function loadForms() {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/forms");
      const d = await r.json();
      if (!r.ok) { setLoadError(d.error ?? "Erreur chargement"); setLoading(false); return; }
      const list: FormMeta[] = d.forms ?? [];
      setForms(list);
      setLoading(false);
      if (list.length > 0 && !selectedId) selectForm(list[0]);
    } catch (e) {
      setLoadError("Impossible de contacter l'API : " + String(e));
      setLoading(false);
    }
  }

  function selectForm(form: FormMeta) {
    setSelectedId(form.id);
    setEditorName(form.name);
    const pages = form.pages?.length ? form.pages : [{ id: "p0", title: "Page 1", fields: [] }];
    setEditorPages(pages);
    setPageIdx(0);
    setHasChanges(false);
    setExpandedField(null);
    setShowTypePicker(false);
  }

  async function createForm() {
    setCreating(true);
    setCreateError(null);
    try {
      const r = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nouveau formulaire" }),
      });
      const d = await r.json();
      if (!r.ok || !d.form) {
        setCreateError(d.error ?? "Erreur création. Vérifie que la table 'forms' existe dans Supabase.");
        setCreating(false);
        return;
      }
      await loadForms();
      selectForm(d.form);
    } catch (e) {
      setCreateError("Erreur réseau : " + String(e));
    }
    setCreating(false);
  }

  async function deleteForm(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Supprimer ce formulaire ?")) return;
    await fetch(`/api/forms/${id}`, { method: "DELETE" });
    const next = forms.filter((f) => f.id !== id);
    setForms(next);
    if (selectedId === id) {
      if (next.length > 0) selectForm(next[0]);
      else { setSelectedId(null); setEditorPages([]); }
    }
  }

  async function saveForm() {
    if (!selectedId) return;
    setSaving(true);
    await fetch(`/api/forms/${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editorName, pages: editorPages }),
    });
    setSaving(false);
    setSaveOk(true);
    setHasChanges(false);
    setTimeout(() => setSaveOk(false), 2000);
    setForms((prev) => prev.map((f) => f.id === selectedId ? { ...f, name: editorName, pages: editorPages } : f));
  }

  function addPage() {
    const newPage: BuilderPage = {
      id: crypto.randomUUID().replace(/-/g, ""),
      title: `Page ${editorPages.length + 1}`,
      fields: [],
    };
    setEditorPages((p) => [...p, newPage]);
    setPageIdx(editorPages.length);
    setHasChanges(true);
  }

  function deletePage(idx: number) {
    if (editorPages.length === 1) return;
    if (!confirm("Supprimer cette page ?")) return;
    const next = editorPages.filter((_, i) => i !== idx);
    setEditorPages(next);
    setPageIdx(Math.min(pageIdx, next.length - 1));
    setHasChanges(true);
  }

  function updatePageTitle(idx: number, title: string) {
    setEditorPages((p) => p.map((pg, i) => i === idx ? { ...pg, title } : pg));
    setHasChanges(true);
  }

  const currentFields = editorPages[pageIdx]?.fields ?? [];

  function updatePageFields(fields: BuilderField[]) {
    setEditorPages((p) => p.map((pg, i) => i === pageIdx ? { ...pg, fields } : pg));
    setHasChanges(true);
  }

  function addField(type: string) {
    const cfg = typeConfig[type];
    const newField: BuilderField = {
      id: `f_${Date.now()}`,
      type,
      label: cfg?.defaultLabel ?? "Nouvelle question",
      required: false,
      options: needsOptions(type) ? ["Option 1", "Option 2"] : undefined,
    };
    updatePageFields([...currentFields, newField]);
    setExpandedField(newField.id);
    setShowTypePicker(false);
  }

  function updateField(id: string, updates: Partial<BuilderField>) {
    updatePageFields(currentFields.map((f) => f.id === id ? { ...f, ...updates } : f));
  }

  function deleteField(id: string) {
    updatePageFields(currentFields.filter((f) => f.id !== id));
    if (expandedField === id) setExpandedField(null);
  }

  function onDragStart(id: string) { dragId.current = id; }
  function onDragOver(e: React.DragEvent, id: string) { e.preventDefault(); dragOver.current = id; }
  function onDrop() {
    const from = dragId.current;
    const to   = dragOver.current;
    if (!from || !to || from === to) return;
    const arr  = [...currentFields];
    const fi   = arr.findIndex((f) => f.id === from);
    const ti   = arr.findIndex((f) => f.id === to);
    const [moved] = arr.splice(fi, 1);
    arr.splice(ti, 0, moved);
    updatePageFields(arr);
    dragId.current = null;
    dragOver.current = null;
  }
  function onDragEnd() { dragId.current = null; dragOver.current = null; }

  function addOption(fieldId: string) {
    const f = currentFields.find((x) => x.id === fieldId);
    if (!f) return;
    updateField(fieldId, { options: [...(f.options ?? []), `Option ${(f.options?.length ?? 0) + 1}`] });
  }

  function updateOption(fieldId: string, idx: number, val: string) {
    const f = currentFields.find((x) => x.id === fieldId);
    if (!f?.options) return;
    const opts = [...f.options];
    opts[idx] = val;
    updateField(fieldId, { options: opts });
  }

  function removeOption(fieldId: string, idx: number) {
    const f = currentFields.find((x) => x.id === fieldId);
    if (!f?.options) return;
    updateField(fieldId, { options: f.options.filter((_, i) => i !== idx) });
  }

  const btnGradient = {
    background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
    border: "1px solid #2f4d9d",
    color: "#fff",
    cursor: "pointer",
    borderRadius: 9,
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#fbfbfb", ...jakartaSans }}>

      {/* ── Left sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{ width: 256, flexShrink: 0, background: "#fff", borderRight: "1px solid rgba(0,0,0,0.08)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>Formulaires</h1>
          <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", marginTop: 2, marginBottom: 0 }}>Gérez vos templates</p>
        </div>

        <div style={{ padding: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <button
            onClick={createForm}
            disabled={creating}
            style={{
              ...btnGradient,
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: 600,
              opacity: creating ? 0.6 : 1,
            }}
          >
            {creating ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
            {creating ? "Création..." : "Nouveau formulaire"}
          </button>
          {createError && (
            <div style={{ marginTop: 8, padding: 8, background: "#fee6d0", border: "1px solid #f59e0b", borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: "#663b12", margin: 0 }}>{createError}</p>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
              <Loader2 size={20} style={{ color: "rgba(18,26,46,0.2)", animation: "spin 1s linear infinite" }} />
            </div>
          ) : loadError ? (
            <div style={{ margin: 4, padding: 12, background: "#fee6d0", border: "1px solid #f59e0b", borderRadius: 9 }}>
              <p style={{ fontSize: 12, color: "#663b12", margin: 0 }}>{loadError}</p>
            </div>
          ) : forms.length === 0 ? (
            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", textAlign: "center", padding: "32px 8px" }}>Aucun formulaire.<br />Crée-en un ci-dessus.</p>
          ) : (
            forms.map((form) => (
              <div
                key={form.id}
                onClick={() => selectForm(form)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 9,
                  marginBottom: 2,
                  cursor: "pointer",
                  background: selectedId === form.id ? "#e8edff" : "transparent",
                  border: selectedId === form.id ? "1px solid #c7d3ff" : "1px solid transparent",
                }}
              >
                <FileText size={14} style={{ color: "rgba(18,26,46,0.4)", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: selectedId === form.id ? 600 : 400, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selectedId === form.id ? "#0147ff" : "rgba(18,26,46,0.7)" }}>{form.name}</span>
                <button
                  onClick={(e) => deleteForm(form.id, e)}
                  style={{ padding: 2, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.3)", opacity: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main editor ──────────────────────────────────────────────────────── */}
      {!selectedId ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <FileText size={40} style={{ color: "rgba(18,26,46,0.15)", margin: "0 auto 12px" }} />
            <p style={{ color: "rgba(18,26,46,0.4)", fontSize: 14, margin: 0 }}>Sélectionne ou crée un formulaire</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top bar */}
          <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
            <input
              value={editorName}
              onChange={(e) => { setEditorName(e.target.value); setHasChanges(true); }}
              style={{ flex: 1, fontSize: 17, fontWeight: 700, color: "#121a2e", background: "transparent", border: "none", outline: "none", fontFamily: '"Plus Jakarta Sans", sans-serif', letterSpacing: "-0.3px" }}
              placeholder="Nom du formulaire"
            />
            {hasChanges && <span style={{ fontSize: 12, color: "#d97706", fontWeight: 500 }}>Modifications non sauvegardées</span>}
            <button
              onClick={saveForm}
              disabled={saving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                opacity: saving ? 0.6 : 1,
                ...(saveOk
                  ? { background: "#d1fae5", border: "1px solid #86efac", color: "#168b64", borderRadius: 9, cursor: "not-allowed" }
                  : { ...btnGradient, cursor: saving ? "not-allowed" : "pointer" }),
              }}
            >
              {saving ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Enregistrement...</>
               : saveOk ? <><Check size={14} />Enregistré</>
               : <><Save size={14} />Sauvegarder</>}
            </button>
          </div>

          {/* Page tabs */}
          <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 24px", display: "flex", alignItems: "center", gap: 4, overflowX: "auto" }}>
            {editorPages.map((page, idx) => (
              <div key={page.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                {editingPageTitle === idx ? (
                  <input
                    autoFocus
                    value={page.title}
                    onChange={(e) => updatePageTitle(idx, e.target.value)}
                    onBlur={() => setEditingPageTitle(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingPageTitle(null)}
                    style={{ padding: "8px 8px", fontSize: 13, borderBottom: "2px solid #0147ff", background: "transparent", border: "none", outline: "none", width: 112, fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                  />
                ) : (
                  <button
                    onClick={() => setPageIdx(idx)}
                    onDoubleClick={() => setEditingPageTitle(idx)}
                    title="Double-cliquer pour renommer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "12px 16px",
                      fontSize: 13,
                      fontWeight: pageIdx === idx ? 600 : 400,
                      background: "none",
                      border: "none",
                      borderBottom: pageIdx === idx ? "2px solid #0147ff" : "2px solid transparent",
                      color: pageIdx === idx ? "#0147ff" : "rgba(18,26,46,0.5)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                    }}
                  >
                    {page.title}
                    {editorPages.length > 1 && pageIdx === idx && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePage(idx); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.3)", padding: 0, display: "flex" }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addPage}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "12px", fontSize: 12, color: "rgba(18,26,46,0.4)", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              <Plus size={13} />Ajouter une page
            </button>
          </div>

          {/* Fields area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
            <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>

              {currentFields.length === 0 && !showTypePicker && (
                <div style={{ textAlign: "center", padding: "48px 0", border: "2px dashed rgba(0,0,0,0.1)", borderRadius: 13 }}>
                  <p style={{ color: "rgba(18,26,46,0.4)", fontSize: 13, marginBottom: 12 }}>Cette page est vide</p>
                  <button
                    onClick={() => setShowTypePicker(true)}
                    style={{ ...btnGradient, display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600 }}
                  >
                    <Plus size={14} />Ajouter un champ
                  </button>
                </div>
              )}

              {currentFields.map((field) => {
                const cfg = typeConfig[field.type];
                const Icon = cfg?.icon ?? Type;
                const expanded = expandedField === field.id;

                return (
                  <div
                    key={field.id}
                    draggable
                    onDragStart={() => onDragStart(field.id)}
                    onDragOver={(e) => onDragOver(e, field.id)}
                    onDrop={onDrop}
                    onDragEnd={onDragEnd}
                    style={{
                      background: "#fff",
                      border: "1px solid rgba(0,0,0,0.09)",
                      borderRadius: 11,
                      overflow: "hidden",
                    }}
                  >
                    {/* Field header */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer" }}
                      onClick={() => setExpandedField(expanded ? null : field.id)}
                    >
                      <div style={{ cursor: "grab", color: "rgba(18,26,46,0.25)" }} onClick={(e) => e.stopPropagation()}>
                        <GripVertical size={16} />
                      </div>
                      <div style={{ padding: 6, background: "#e8edff", borderRadius: 8 }}>
                        <Icon size={14} style={{ color: "#0147ff", display: "block" }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(18,26,46,0.4)", width: 96, flexShrink: 0 }}>{cfg?.label ?? field.type}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#121a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.label}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(18,26,46,0.4)", cursor: "pointer", userSelect: "none" }}>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(field.id, { required: e.target.checked })}
                            style={{ accentColor: "#0147ff" }}
                          />
                          Requis
                        </label>
                        <button onClick={() => deleteField(field.id)} style={{ padding: 4, background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.25)", display: "flex" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded editor */}
                    {expanded && (
                      <div style={{ padding: "12px 16px 16px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "#f9f9f9", display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Label de la question</label>
                          <input value={field.label} onChange={(e) => updateField(field.id, { label: e.target.value })} style={{ ...inputStyle, background: "#fff" }} />
                        </div>
                        {!needsOptions(field.type) && (
                          <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.5)", marginBottom: 6 }}>Texte d&apos;aide (optionnel)</label>
                            <input
                              value={field.placeholder ?? ""}
                              onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                              placeholder="Ex : Entrez votre réponse..."
                              style={{ ...inputStyle, background: "#fff" }}
                            />
                          </div>
                        )}
                        {needsOptions(field.type) && (
                          <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.5)", marginBottom: 8 }}>Options</label>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {(field.options ?? []).map((opt, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <input value={opt} onChange={(e) => updateOption(field.id, i, e.target.value)} style={{ ...inputStyle, flex: 1, background: "#fff" }} />
                                  <button onClick={() => removeOption(field.id, i)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.3)", display: "flex" }}>
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => addOption(field.id)}
                                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0147ff", background: "none", border: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 500, padding: "4px 0" }}
                              >
                                <Plus size={12} />Ajouter une option
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Type picker */}
              {showTypePicker ? (
                <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 13, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#121a2e", margin: 0 }}>Choisir un type de champ</p>
                    <button onClick={() => setShowTypePicker(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}>
                      <X size={16} />
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {FIELD_TYPES.map((ft) => {
                      const Ic = ft.icon;
                      return (
                        <button
                          key={ft.type}
                          onClick={() => addField(ft.type)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            border: "1px solid rgba(0,0,0,0.09)",
                            borderRadius: 9,
                            fontSize: 12,
                            color: "#121a2e",
                            background: "#f6f6f6",
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: '"Plus Jakarta Sans", sans-serif',
                          }}
                        >
                          <Ic size={15} style={{ color: "rgba(18,26,46,0.4)", flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{ft.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : currentFields.length > 0 && (
                <button
                  onClick={() => setShowTypePicker(true)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, border: "2px dashed rgba(0,0,0,0.1)", borderRadius: 11, fontSize: 13, color: "rgba(18,26,46,0.4)", background: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  <Plus size={15} />Ajouter un champ
                </button>
              )}
            </div>
          </div>

          {/* Bottom hint */}
          <div style={{ background: "#fff", borderTop: "1px solid rgba(0,0,0,0.06)", padding: "8px 24px", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={12} style={{ color: "rgba(18,26,46,0.25)" }} />
            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>
              Double-cliquez sur un onglet de page pour le renommer · Glissez les champs pour les réordonner
            </p>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(18,26,46,0.3)" }}>{currentFields.length} champ{currentFields.length !== 1 ? "s" : ""} · {editorPages.length} page{editorPages.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}
