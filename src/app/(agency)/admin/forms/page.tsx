"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
import type { FormField } from "@/types/agency";

type FieldType = FormField["type"];

const fieldTypeLabels: Record<FieldType, string> = {
  text: "Texte court",
  textarea: "Texte long",
  select: "Liste déroulante",
  radio: "Choix unique",
  checkbox: "Choix multiples",
  file: "Fichier",
  inspiration: "Inspirations visuelles",
};

const defaultFields: FormField[] = [
  { id: "f1", type: "text", label: "Nom de votre entreprise", required: true, order: 1 },
  { id: "f2", type: "textarea", label: "Décrivez votre projet en quelques mots", placeholder: "Ex : Site vitrine pour une startup tech...", required: true, order: 2 },
  { id: "f3", type: "select", label: "Quel est votre secteur d'activité ?", options: ["Tech / SaaS", "E-commerce", "Consulting", "Santé", "Autre"], required: true, order: 3 },
  { id: "f4", type: "radio", label: "Avez-vous une charte graphique ?", options: ["Oui, complète", "Partielle", "Non, à créer"], required: true, order: 4 },
  { id: "f5", type: "inspiration", label: "Sélectionnez des styles d'inspiration", required: false, order: 5 },
];

export default function AdminFormsPage() {
  const [fields, setFields] = useState<FormField[]>(defaultFields);
  const [formName, setFormName] = useState("Formulaire de brief projet");
  const [selectedType, setSelectedType] = useState<FieldType>("text");
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const addField = () => {
    if (!newLabel.trim()) return;
    const newField: FormField = {
      id: `f${Date.now()}`,
      type: selectedType,
      label: newLabel,
      required: false,
      order: fields.length + 1,
    };
    setFields((prev) => [...prev, newField]);
    setNewLabel("");
    setShowAdd(false);
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Formulaires</h1>
          <p className="text-gray-500 mt-1">Créez des formulaires de brief dynamiques pour vos clients</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} />
          Nouveau formulaire
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Form Builder */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Form Header */}
            <div className="p-6 border-b border-gray-200">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Nom du formulaire
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full text-xl font-bold text-gray-900 border-none outline-none focus:ring-0 bg-transparent"
              />
            </div>

            {/* Fields */}
            <div className="p-4 space-y-2">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-200 transition-colors group"
                >
                  <div className="cursor-grab text-gray-300 hover:text-gray-500 mt-0.5">
                    <GripVertical size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-medium">
                        {fieldTypeLabels[field.type]}
                      </span>
                      {field.required && (
                        <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded font-medium">
                          Requis
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{field.label}</p>
                    {field.placeholder && (
                      <p className="text-xs text-gray-400 mt-0.5">Placeholder : {field.placeholder}</p>
                    )}
                    {field.options && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {field.options.map((opt) => (
                          <span key={opt} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {opt}
                          </span>
                        ))}
                      </div>
                    )}
                    {field.type === "inspiration" && (
                      <div className="flex gap-2 mt-2">
                        {["Minimaliste", "Coloré", "Dark", "Corporate", "Playful"].map((style) => (
                          <span key={style} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full border border-indigo-200">
                            {style}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeField(field.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Add Field */}
              {showAdd ? (
                <div className="p-4 border-2 border-dashed border-indigo-300 rounded-lg bg-indigo-50">
                  <div className="flex gap-3 mb-3">
                    <div className="relative flex-1">
                      <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value as FieldType)}
                        className="w-full appearance-none px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        {(Object.entries(fieldTypeLabels) as [FieldType, string][]).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addField()}
                      placeholder="Label du champ..."
                      autoFocus
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addField} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                      Ajouter
                    </button>
                    <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-gray-500 hover:text-gray-700 text-sm">
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAdd(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  <Plus size={16} />
                  Ajouter un champ
                </button>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300">
                Prévisualiser
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 font-medium">
                Enregistrer
              </button>
            </div>
          </div>
        </div>

        {/* Forms List */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Formulaires existants</h3>
            <div className="space-y-2">
              {[
                { name: "Brief projet standard", fields: 8, used: 12 },
                { name: "Brief identité visuelle", fields: 6, used: 5 },
                { name: "Brief app mobile", fields: 10, used: 3 },
              ].map((form) => (
                <div
                  key={form.name}
                  className="p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer transition-all"
                >
                  <p className="text-sm font-medium text-gray-900">{form.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {form.fields} champs · Utilisé {form.used}x
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
