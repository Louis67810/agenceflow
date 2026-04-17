"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Circle, CheckCircle2, Target, CalendarDays } from "lucide-react";
import type { AgendaObjective } from "@/types/agenda";

interface ObjectiveWithChildren extends AgendaObjective {
  children: ObjectiveWithChildren[];
}

export default function ObjectivesPage() {
  const [objectives, setObjectives] = useState<ObjectiveWithChildren[]>([]);
  const [flat, setFlat] = useState<AgendaObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    title: "", description: "", parent_id: "", target_date: "", color: "#6366f1",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await agendaFetch("/api/agenda/objectives").then(r => r.json());
    setObjectives(res.objectives ?? []);
    setFlat(res.flat ?? []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    const res = await agendaFetch("/api/agenda/objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, parent_id: form.parent_id || null, target_date: form.target_date || null }),
    });
    const data = await res.json();
    if (data.objective) {
      load();
      setForm({ title: "", description: "", parent_id: "", target_date: "", color: "#6366f1" });
      setShowForm(false);
    }
  }

  async function handleDelete(id: string) {
    await agendaFetch(`/api/agenda/objectives/${id}`, { method: "DELETE" });
    load();
  }

  async function handleComplete(id: string) {
    await agendaFetch(`/api/agenda/objectives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", progress: 100 }),
    });
    load();
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Objectifs</h1>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus size={16} />
          Nouvel objectif
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-indigo-200 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Nouvel objectif</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Titre *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: Augmenter le CA de 30%"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Objectif parent</label>
              <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Aucun (objectif racine)</option>
                {flat.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date cible</label>
              <input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Couleur</label>
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-full h-10 border border-gray-200 rounded-lg cursor-pointer" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500">Annuler</button>
            <button onClick={handleCreate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Créer</button>
          </div>
        </div>
      )}

      {objectives.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Target size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucun objectif</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-indigo-500 hover:underline">
            + Créer votre premier objectif
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {objectives.map(obj => (
            <ObjectiveCard
              key={obj.id}
              objective={obj}
              expanded={expanded}
              onToggle={id => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
              onDelete={handleDelete}
              onComplete={handleComplete}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectiveCard({
  objective, expanded, onToggle, onDelete, onComplete, depth,
}: {
  objective: ObjectiveWithChildren;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  depth: number;
}) {
  const isExpanded = expanded.has(objective.id);
  const hasChildren = objective.children.length > 0;
  const isCompleted = objective.status === "completed";

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 pl-3" : ""} style={depth > 0 ? { borderColor: objective.color + "60" } : {}}>
      <div className={`bg-white rounded-xl border p-4 ${isCompleted ? "opacity-70" : ""}`} style={{ borderColor: objective.color + "40" }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: objective.color + "20" }}>
            {isCompleted
              ? <CheckCircle2 size={20} style={{ color: objective.color }} />
              : <Circle size={20} style={{ color: objective.color }} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button onClick={() => onToggle(objective.id)} className="text-gray-400 hover:text-gray-600">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              )}
              <h3 className={`font-semibold text-gray-800 ${isCompleted ? "line-through text-gray-500" : ""}`}>
                {objective.title}
              </h3>
              {objective.target_date && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <CalendarDays size={12} />
                  {new Date(objective.target_date).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
            {objective.description && (
              <p className="text-sm text-gray-500 mt-1">{objective.description}</p>
            )}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Progression</span>
                <span className="text-xs font-medium" style={{ color: objective.color }}>{objective.progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${objective.progress}%`, background: objective.color }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Progression automatique selon les sous-objectifs et les tâches reliées.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!isCompleted && (
              <button
                onClick={() => onComplete(objective.id)}
                className="p-1.5 text-green-400 hover:bg-green-50 rounded-lg transition-colors text-xs"
                title="Marquer comme complété"
              >
                <CheckCircle2 size={14} />
              </button>
            )}
            <button onClick={() => onDelete(objective.id)} className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="mt-2 space-y-2">
          {objective.children.map(child => (
            <ObjectiveCard
              key={child.id}
              objective={child as ObjectiveWithChildren}
              expanded={expanded}
              onToggle={onToggle}
              onDelete={onDelete}
              onComplete={onComplete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
