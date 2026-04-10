"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Check, Sparkles } from "lucide-react";
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
      save(
        styles.map((s) =>
          s.id === editingStyle.id ? { ...s, ...form } : s
        )
      );
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              onEdit={() => openEdit(style)}
              onDelete={() => setDeleteId(style.id)}
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
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nom du style
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Mon style signature"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Catégorie
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value as LinkedInStyle["category"],
                    })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2]"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Description courte
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Ex: Posts engageants avec des questions directes"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Exemple d'accroche
                </label>
                <textarea
                  value={form.example}
                  onChange={(e) =>
                    setForm({ ...form, example: e.target.value })
                  }
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
                  onChange={(e) =>
                    setForm({ ...form, prompt: e.target.value })
                  }
                  placeholder="Décris précisément comment l'IA doit écrire avec ce style : structure, ton, format, longueur, ce qu'il faut éviter..."
                  rows={5}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Ces instructions seront transmises à l'IA lors de la génération de posts avec ce style.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
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
            <h3 className="font-semibold text-gray-900 mb-2">
              Supprimer ce style ?
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
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
}: {
  style: LinkedInStyle;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colorClass =
    STYLE_CATEGORY_COLORS[style.category] || "bg-gray-100 text-gray-700";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm">{style.name}</h3>
            {style.isDefault && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Défaut
              </span>
            )}
          </div>
          <span
            className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${colorClass}`}
          >
            {CATEGORIES.find((c) => c.value === style.category)?.label ||
              style.category}
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
        <p className="text-sm text-gray-500 leading-relaxed">
          {style.description}
        </p>
      )}

      {style.example && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">
            Exemple
          </p>
          <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">
            {style.example}
          </p>
        </div>
      )}

      <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
        <p className="text-xs text-blue-600 mb-1 font-medium uppercase tracking-wide flex items-center gap-1">
          <Sparkles size={11} />
          Prompt IA
        </p>
        <p className="text-xs text-blue-700 line-clamp-3">{style.prompt}</p>
      </div>
    </div>
  );
}
