"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, GripVertical, Save, FileText, Loader2,
  Type, AlignLeft, Mail, Link2, Phone, Hash, Calendar,
  ChevronDown, CircleDot, CheckSquare, Image, Paperclip,
  X, Check, AlertCircle, Pencil,
} from "lucide-react";

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormsPage() {
  const [forms, setForms]           = useState<FormMeta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState<string | null>(null);
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Editor
  const [editorName, setEditorName]   = useState("");
  const [editorPages, setEditorPages] = useState<BuilderPage[]>([]);
  const [pageIdx, setPageIdx]         = useState(0);
  const [hasChanges, setHasChanges]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveOk, setSaveOk]           = useState(false);

  // Field UI
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [expandedField, setExpandedField]   = useState<string | null>(null);
  const [editingPageTitle, setEditingPageTitle] = useState<number | null>(null);

  // Drag & drop
  const dragId  = useRef<string | null>(null);
  const dragOver = useRef<string | null>(null);

  useEffect(() => { loadForms(); }, []);

  // ── API ────────────────────────────────────────────────────────────────────

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
        setCreateError(d.error ?? "Erreur création. Vérifie que la table 'forms' existe dans Supabase (exécute le SQL fourni).");
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

  // ── Pages ──────────────────────────────────────────────────────────────────

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

  // ── Fields ─────────────────────────────────────────────────────────────────

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

  // ── Drag & Drop ────────────────────────────────────────────────────────────

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

  // ── Options editor helpers ─────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Left sidebar: forms list ───────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-100">
          <h1 className="text-base font-bold text-gray-900">Formulaires</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gérez vos templates</p>
        </div>

        <div className="p-3 space-y-2">
          <button
            onClick={createForm}
            disabled={creating}
            className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {creating ? "Création..." : "Nouveau formulaire"}
          </button>
          {createError && (
            <div className="px-1 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{createError}</p>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
          ) : loadError ? (
            <div className="px-2 py-3 bg-red-50 border border-red-200 rounded-lg mx-1">
              <p className="text-xs text-red-600">{loadError}</p>
              <p className="text-xs text-red-400 mt-1">Exécute le SQL fourni dans Supabase SQL Editor.</p>
            </div>
          ) : forms.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Aucun formulaire.<br/>Crée-en un ci-dessus.</p>
          ) : (
            forms.map((form) => (
              <div
                key={form.id}
                onClick={() => selectForm(form)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${selectedId === form.id ? "bg-indigo-50 text-indigo-800 border border-indigo-200" : "hover:bg-gray-50 text-gray-700"}`}
              >
                <FileText size={14} className="shrink-0 text-gray-400" />
                <span className="text-sm font-medium flex-1 truncate">{form.name}</span>
                <button
                  onClick={(e) => deleteForm(form.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main editor ────────────────────────────────────────────────────── */}
      {!selectedId ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Sélectionne ou crée un formulaire</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top bar */}
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
            <input
              value={editorName}
              onChange={(e) => { setEditorName(e.target.value); setHasChanges(true); }}
              className="text-lg font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 flex-1"
              placeholder="Nom du formulaire"
            />
            {hasChanges && <span className="text-xs text-amber-500 font-medium">Modifications non sauvegardées</span>}
            <button
              onClick={saveForm}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${saveOk ? "bg-green-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"} disabled:opacity-60`}
            >
              {saving ? <><Loader2 size={14} className="animate-spin" />Enregistrement...</>
               : saveOk ? <><Check size={14} />Enregistré</>
               : <><Save size={14} />Sauvegarder</>}
            </button>
          </div>

          {/* Page tabs */}
          <div className="bg-white border-b border-gray-100 px-6 flex items-center gap-1 overflow-x-auto">
            {editorPages.map((page, idx) => (
              <div key={page.id} className="flex items-center shrink-0">
                {editingPageTitle === idx ? (
                  <input
                    autoFocus
                    value={page.title}
                    onChange={(e) => updatePageTitle(idx, e.target.value)}
                    onBlur={() => setEditingPageTitle(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingPageTitle(null)}
                    className="px-2 py-2 text-sm border-b-2 border-indigo-400 outline-none bg-transparent w-28"
                  />
                ) : (
                  <button
                    onClick={() => setPageIdx(idx)}
                    onDoubleClick={() => setEditingPageTitle(idx)}
                    title="Double-cliquer pour renommer"
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${pageIdx === idx ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                  >
                    {page.title}
                    {editorPages.length > 1 && pageIdx === idx && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deletePage(idx); }}
                        className="ml-1 text-gray-300 hover:text-red-400 transition-colors"
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
              className="flex items-center gap-1 px-3 py-3 text-xs text-gray-400 hover:text-indigo-600 transition-colors whitespace-nowrap"
            >
              <Plus size={13} />Ajouter une page
            </button>
          </div>

          {/* Fields area */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-2xl mx-auto space-y-2">

              {currentFields.length === 0 && !showTypePicker && (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <p className="text-gray-400 text-sm mb-3">Cette page est vide</p>
                  <button
                    onClick={() => setShowTypePicker(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
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
                    className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-indigo-200 transition-colors"
                  >
                    {/* Field header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => setExpandedField(expanded ? null : field.id)}
                    >
                      <div className="cursor-grab text-gray-300 hover:text-gray-400" onClick={(e) => e.stopPropagation()}>
                        <GripVertical size={16} />
                      </div>
                      <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-500">
                        <Icon size={14} />
                      </div>
                      <span className="text-xs font-medium text-gray-400 w-24 shrink-0">{cfg?.label ?? field.type}</span>
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{field.label}</span>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(field.id, { required: e.target.checked })}
                            className="accent-indigo-600 rounded"
                          />
                          Requis
                        </label>
                        <button onClick={() => deleteField(field.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded editor */}
                    {expanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3 bg-gray-50">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Label de la question</label>
                          <input
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                          />
                        </div>
                        {!needsOptions(field.type) && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Texte d&apos;aide (optionnel)</label>
                            <input
                              value={field.placeholder ?? ""}
                              onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                              placeholder="Ex : Entrez votre réponse..."
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                            />
                          </div>
                        )}
                        {needsOptions(field.type) && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2">Options</label>
                            <div className="space-y-1.5">
                              {(field.options ?? []).map((opt, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <input
                                    value={opt}
                                    onChange={(e) => updateOption(field.id, i, e.target.value)}
                                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                                  />
                                  <button onClick={() => removeOption(field.id, i)} className="text-gray-300 hover:text-red-400 transition-colors">
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => addOption(field.id)}
                                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1"
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
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-gray-700">Choisir un type de champ</p>
                    <button onClick={() => setShowTypePicker(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {FIELD_TYPES.map((ft) => {
                      const Ic = ft.icon;
                      return (
                        <button
                          key={ft.type}
                          onClick={() => addField(ft.type)}
                          className="flex items-center gap-2.5 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors text-left"
                        >
                          <Ic size={15} className="shrink-0 text-gray-400" />
                          <span className="text-xs font-medium">{ft.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : currentFields.length > 0 && (
                <button
                  onClick={() => setShowTypePicker(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                >
                  <Plus size={15} />Ajouter un champ
                </button>
              )}
            </div>
          </div>

          {/* Bottom hint */}
          <div className="bg-white border-t border-gray-100 px-6 py-2 flex items-center gap-2">
            <AlertCircle size={12} className="text-gray-300" />
            <p className="text-xs text-gray-400">
              Double-cliquez sur un onglet de page pour le renommer · Glissez les champs pour les réordonner
            </p>
            <span className="ml-auto text-xs text-gray-300">{currentFields.length} champ{currentFields.length !== 1 ? "s" : ""} · {editorPages.length} page{editorPages.length !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}
