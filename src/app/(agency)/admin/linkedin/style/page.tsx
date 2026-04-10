"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, X, Check, Sparkles, ChevronDown,
  ChevronUp, Loader2, FileText, AlignLeft,
} from "lucide-react";
import {
  LinkedInStyle,
  DEFAULT_STYLES,
  STYLE_CATEGORY_COLORS,
} from "@/types/linkedin";

const CATEGORIES = [
  { value: "storytelling", label: "Storytelling" },
  { value: "valeur", label: "Valeur / Liste" },
  { value: "educatif", label: "Éducatif" },
  { value: "viral", label: "Opinion forte" },
  { value: "engagement", label: "Engagement" },
  { value: "data", label: "Data / Chiffres" },
  { value: "custom", label: "Personnalisé" },
];

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

export default function LinkedInStylePage() {
  const [styles, setStyles] = useState<LinkedInStyle[]>([]);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editingStyle, setEditingStyle] = useState<LinkedInStyle | null>(null);
  const [form, setForm] = useState(EMPTY_STYLE);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // Examples state per style
  const [expandedExamples, setExpandedExamples] = useState<string | null>(null);
  const [examplesByStyle, setExamplesByStyle] = useState<Record<string, StyleExample[]>>({});
  const [loadingExamples, setLoadingExamples] = useState<Record<string, boolean>>({});
  const [newExampleText, setNewExampleText] = useState<Record<string, string>>({});
  const [addingExample, setAddingExample] = useState<Record<string, boolean>>({});
  const [showAddExample, setShowAddExample] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem("linkedin_styles");
    if (saved) {
      try {
        setStyles(JSON.parse(saved));
      } catch {
        setStyles(DEFAULT_STYLES);
      }
    } else {
      setStyles(DEFAULT_STYLES);
    }
  }, []);

  const save = (updated: LinkedInStyle[]) => {
    setStyles(updated);
    localStorage.setItem("linkedin_styles", JSON.stringify(updated));
  };

  const loadExamples = useCallback(async (styleId: string) => {
    if (examplesByStyle[styleId] !== undefined) return; // already loaded
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
    if (expandedExamples === styleId) {
      setExpandedExamples(null);
    } else {
      setExpandedExamples(styleId);
      loadExamples(styleId);
    }
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
        setExamplesByStyle((prev) => ({
          ...prev,
          [styleId]: [data.example, ...(prev[styleId] ?? [])],
        }));
        setNewExampleText((prev) => ({ ...prev, [styleId]: "" }));
        setShowAddExample((prev) => ({ ...prev, [styleId]: false }));
      }
    } catch {
      // ignore
    } finally {
      setAddingExample((prev) => ({ ...prev, [styleId]: false }));
    }
  };

  const handleDeleteExample = async (styleId: string, exampleId: string) => {
    try {
      await fetch(`/api/linkedin/style-examples?id=${exampleId}`, { method: "DELETE" });
      setExamplesByStyle((prev) => ({
        ...prev,
        [styleId]: (prev[styleId] ?? []).filter((e) => e.id !== exampleId),
      }));
    } catch {
      // ignore
    }
  };

  const openCreate = () => {
    setForm(EMPTY_STYLE);
    setEditingStyle(null);
    setModal("create");
  };

  const openEdit = (style: LinkedInStyle) => {
    setForm({
      name: style.name,
      category: style.category,
      description: style.description,
      example: style.example,
      prompt: style.prompt,
    });
    setEditingStyle(style);
    setModal("edit");
  };

  const closeModal = () => {
    setModal(null);
    setEditingStyle(null);
    setForm(EMPTY_STYLE);
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.prompt.trim()) return;
    if (modal === "create") {
      const newStyle: LinkedInStyle = {
        ...form,
        id: `custom_${Date.now()}`,
        isDefault: false,
        createdAt: new Date().toISOString(),
      };
      save([...styles, newStyle]);
    } else if (modal === "edit" && editingStyle) {
      save(styles.map((s) => (s.id === editingStyle.id ? { ...s, ...form } : s)));
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    save(styles.filter((s) => s.id !== id));
    setDeleteId(null);
  };

  const filtered =
    activeCategory === "all"
      ? styles
      : styles.filter((s) => s.category === activeCategory);

  const customCount = styles.filter((s) => !s.isDefault).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Styles d'écriture</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {styles.length} styles · {customCount} personnalisés
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#0A66C2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0057a3] transition-colors"
          >
            <Plus size={16} />
            Nouveau style
          </button>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeCategory === "all"
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
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
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat.value
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

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              onEdit={() => openEdit(style)}
              onDelete={() => setDeleteId(style.id)}
              // Examples
              examplesExpanded={expandedExamples === style.id}
              onToggleExamples={() => toggleExamples(style.id)}
              examples={examplesByStyle[style.id] ?? null}
              loadingExamples={!!loadingExamples[style.id]}
              showAdd={!!showAddExample[style.id]}
              onToggleAdd={() =>
                setShowAddExample((prev) => ({ ...prev, [style.id]: !prev[style.id] }))
              }
              newExampleText={newExampleText[style.id] ?? ""}
              onChangeExampleText={(text) =>
                setNewExampleText((prev) => ({ ...prev, [style.id]: text }))
              }
              onAddExample={() => handleAddExample(style.id)}
              addingExample={!!addingExample[style.id]}
              onDeleteExample={(exId) => handleDeleteExample(style.id, exId)}
            />
          ))}

          {/* Add card */}
          <button
            onClick={openCreate}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-[#0A66C2] hover:text-[#0A66C2] transition-colors min-h-[200px]"
          >
            <Plus size={24} />
            <span className="text-sm font-medium">Créer un style</span>
          </button>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-lg">
                {modal === "create" ? "Nouveau style" : "Modifier le style"}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du style</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Mon style signature"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie</label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as LinkedInStyle["category"] })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2]"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description courte</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Posts engageants avec des questions directes"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Exemple d'accroche</label>
                <textarea
                  value={form.example}
                  onChange={(e) => setForm({ ...form, example: e.target.value })}
                  placeholder="Montre les premières lignes typiques de ce style..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#0A66C2]" />
                    Instructions pour l'IA
                  </span>
                </label>
                <textarea
                  value={form.prompt}
                  onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                  placeholder="Décris précisément comment l'IA doit écrire avec ce style : structure, ton, format, longueur, ce qu'il faut éviter..."
                  rows={5}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.name.trim() || !form.prompt.trim()}
                className="flex items-center gap-2 bg-[#0A66C2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0057a3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Supprimer ce style ?</h3>
            <p className="text-sm text-gray-500 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
              >
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
  style,
  onEdit,
  onDelete,
  examplesExpanded,
  onToggleExamples,
  examples,
  loadingExamples,
  showAdd,
  onToggleAdd,
  newExampleText,
  onChangeExampleText,
  onAddExample,
  addingExample,
  onDeleteExample,
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden hover:shadow-md transition-shadow group">
      {/* Card header */}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 text-sm">{style.name}</h3>
              {style.isDefault && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Défaut</span>
              )}
            </div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${colorClass}`}>
              {CATEGORIES.find((c) => c.value === style.category)?.label || style.category}
            </span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Pencil size={14} />
            </button>
            {!style.isDefault && (
              <button
                onClick={onDelete}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {style.description && (
          <p className="text-sm text-gray-500 leading-relaxed">{style.description}</p>
        )}

        {style.example && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Exemple</p>
            <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">{style.example}</p>
          </div>
        )}

        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <p className="text-xs text-blue-600 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
            <Sparkles size={11} /> Prompt IA
          </p>
          <p className="text-xs text-blue-700 line-clamp-3">{style.prompt}</p>
        </div>
      </div>

      {/* Examples section toggle */}
      <div className="border-t border-gray-100">
        <button
          onClick={onToggleExamples}
          className="w-full flex items-center justify-between px-5 py-3 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText size={13} />
            Posts d'exemple
            {examples !== null && (
              <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs">
                {exampleCount}
              </span>
            )}
          </span>
          {examplesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {examplesExpanded && (
          <div className="px-5 pb-4 space-y-3">
            <p className="text-xs text-gray-400">
              Ajoutez des posts réels qui correspondent à ce style. L'IA les utilisera comme référence lors de la génération.
            </p>

            {loadingExamples ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={16} className="animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {/* Example list */}
                {examples && examples.length > 0 ? (
                  <div className="space-y-2">
                    {examples.map((ex) => (
                      <div
                        key={ex.id}
                        className="group/ex relative bg-gray-50 rounded-lg p-3 border border-gray-100"
                      >
                        <p className="text-xs text-gray-600 whitespace-pre-line line-clamp-4 pr-6">
                          {ex.content}
                        </p>
                        <button
                          onClick={() => onDeleteExample(ex.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover/ex:opacity-100 p-1 text-gray-300 hover:text-red-500 hover:bg-white rounded transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <AlignLeft size={13} />
                    Aucun exemple — ajoutez vos meilleurs posts dans ce style
                  </div>
                )}

                {/* Add example */}
                {showAdd ? (
                  <div className="space-y-2">
                    <textarea
                      value={newExampleText}
                      onChange={(e) => onChangeExampleText(e.target.value)}
                      placeholder="Collez ici un post LinkedIn qui représente bien ce style..."
                      rows={6}
                      autoFocus
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={onToggleAdd}
                        className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={onAddExample}
                        disabled={!newExampleText.trim() || addingExample}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#0A66C2] text-white rounded-lg hover:bg-[#0057a3] disabled:opacity-50 transition-colors"
                      >
                        {addingExample ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Ajouter
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={onToggleAdd}
                    className="flex items-center gap-1.5 text-xs text-[#0A66C2] hover:text-[#0057a3] transition-colors"
                  >
                    <Plus size={13} />
                    Ajouter un post d'exemple
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
