"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle, ChevronDown, ChevronRight, Star } from "lucide-react";
import type { AgendaTask, AgendaObjective } from "@/types/agenda";

type SortBy = "date" | "importance" | "status";

const IMPORTANCE_LABELS: Record<number, string> = { 1: "Très faible", 2: "Faible", 3: "Normale", 4: "Haute", 5: "Critique" };
const IMPORTANCE_COLORS: Record<number, string> = { 1: "text-gray-400", 2: "text-blue-400", 3: "text-yellow-500", 4: "text-orange-500", 5: "text-red-500" };

export default function TasksPage() {
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [objectives, setObjectives] = useState<AgendaObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    title: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    start_time: "",
    duration_minutes: 30,
    importance: 3,
    objective_id: "",
    parent_task_id: "",
    tags: "",
    recurrence: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [tasksRes, objRes] = await Promise.all([
      fetch("/api/agenda/tasks").then(r => r.json()),
      fetch("/api/agenda/objectives").then(r => r.json()),
    ]);
    setTasks(tasksRes.tasks ?? []);
    setObjectives(objRes.flat ?? []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()) : [],
      objective_id: form.objective_id || null,
      parent_task_id: form.parent_task_id || null,
      recurrence: form.recurrence || null,
      start_time: form.start_time || null,
    };
    const res = await fetch("/api/agenda/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.task) {
      setTasks(prev => [data.task, ...prev]);
      setForm(f => ({ ...f, title: "", description: "" }));
      setShowForm(false);
    }
  }

  async function handleToggle(task: AgendaTask) {
    const newStatus = task.status === "done" ? "todo" : "done";
    await fetch(`/api/agenda/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/agenda/tasks/${id}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function handleAutoSchedule() {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch("/api/agenda/auto-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today }),
    });
    const data = await res.json();
    if (data.scheduled > 0) {
      load();
      alert(`${data.scheduled} tâche(s) planifiée(s) automatiquement`);
    } else {
      alert("Aucune tâche à planifier");
    }
  }

  const filtered = tasks
    .filter(t => filterStatus === "all" || t.status === filterStatus)
    .filter(t => !t.parent_task_id); // Show only root tasks

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "importance") return b.importance - a.importance;
    if (sortBy === "status") return a.status.localeCompare(b.status);
    return (a.date ?? "9999").localeCompare(b.date ?? "9999");
  });

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tâches</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoSchedule}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            🤖 Auto-planifier aujourd&apos;hui
          </button>
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus size={16} />
            Nouvelle tâche
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
        >
          <option value="all">Tous les statuts</option>
          <option value="todo">À faire</option>
          <option value="in_progress">En cours</option>
          <option value="done">Terminées</option>
          <option value="cancelled">Annulées</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortBy)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white"
        >
          <option value="date">Trier par date</option>
          <option value="importance">Trier par importance</option>
          <option value="status">Trier par statut</option>
        </select>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} tâche(s)</span>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-indigo-200 rounded-xl p-5 mb-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Nouvelle tâche</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Titre *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: Préparer la présentation client"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Heure de début</label>
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Durée (min)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 30 }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                min={5}
                step={5}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Importance (1-5)</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <button
                    key={i}
                    onClick={() => setForm(f => ({ ...f, importance: i }))}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                      form.importance === i ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-500 hover:border-indigo-300"
                    }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">{IMPORTANCE_LABELS[form.importance]} · +{form.importance * 10} pts</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Objectif lié</label>
              <select
                value={form.objective_id}
                onChange={e => setForm(f => ({ ...f, objective_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Aucun</option>
                {objectives.map(o => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tâche parente</label>
              <select
                value={form.parent_task_id}
                onChange={e => setForm(f => ({ ...f, parent_task_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Aucune</option>
                {tasks.filter(t => !t.parent_task_id).map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tags (séparés par virgule)</label>
              <input
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="dev, urgent, client"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Récurrence</label>
              <select
                value={form.recurrence}
                onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Pas de récurrence</option>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                rows={2}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Annuler
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Créer la tâche (+{form.importance * 10} pts)
            </button>
          </div>
        </div>
      )}

      {/* Tasks list */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucune tâche</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-indigo-500 hover:underline"
          >
            + Créer votre première tâche
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map(task => {
            const subtasks = tasks.filter(t => t.parent_task_id === task.id);
            const isExpanded = expandedParents.has(task.id);
            return (
              <li key={task.id}>
                <TaskRow
                  task={task}
                  subtasks={subtasks}
                  isExpanded={isExpanded}
                  onToggleExpand={() => setExpandedParents(prev => {
                    const n = new Set(prev);
                    if (n.has(task.id)) n.delete(task.id); else n.add(task.id);
                    return n;
                  })}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  objectives={objectives}
                  importanceColors={IMPORTANCE_COLORS}
                  importanceLabels={IMPORTANCE_LABELS}
                />
                {isExpanded && subtasks.length > 0 && (
                  <ul className="ml-8 mt-1 space-y-1">
                    {subtasks.map(sub => (
                      <TaskRow
                        key={sub.id}
                        task={sub}
                        subtasks={[]}
                        isExpanded={false}
                        onToggleExpand={() => {}}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        objectives={objectives}
                        importanceColors={IMPORTANCE_COLORS}
                        importanceLabels={IMPORTANCE_LABELS}
                        isSubtask
                      />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TaskRow({
  task, subtasks, isExpanded, onToggleExpand, onToggle, onDelete,
  objectives, importanceColors, importanceLabels, isSubtask = false,
}: {
  task: AgendaTask;
  subtasks: AgendaTask[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggle: (t: AgendaTask) => void;
  onDelete: (id: string) => void;
  objectives: AgendaObjective[];
  importanceColors: Record<number, string>;
  importanceLabels: Record<number, string>;
  isSubtask?: boolean;
}) {
  const objective = objectives.find(o => o.id === task.objective_id);
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-indigo-100 transition-colors ${
        task.status === "done" ? "opacity-60" : ""
      } ${isSubtask ? "border-l-2 border-l-indigo-200" : ""}`}
    >
      <button onClick={() => onToggle(task)} className="shrink-0">
        {task.status === "done"
          ? <CheckCircle2 size={18} className="text-green-500" />
          : <Circle size={18} className="text-gray-300 hover:text-indigo-400" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {subtasks.length > 0 && (
            <button onClick={onToggleExpand} className="text-gray-400 hover:text-gray-600">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
          <span className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>
            {task.title}
          </span>
          {objective && (
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: objective.color + "20", color: objective.color }}>
              {objective.title}
            </span>
          )}
          {task.tags?.map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">{tag}</span>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {task.date && <span className="text-xs text-gray-400">{new Date(task.date).toLocaleDateString("fr-FR")}</span>}
          {task.start_time && <span className="text-xs text-gray-400">⏰ {task.start_time.slice(0,5)}{task.end_time ? ` - ${task.end_time.slice(0,5)}` : ""}</span>}
          {subtasks.length > 0 && <span className="text-xs text-gray-400">{subtasks.filter(s => s.status === "done").length}/{subtasks.length} sous-tâches</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: task.importance }).map((_, i) => (
            <Star key={i} size={10} className={`fill-current ${importanceColors[task.importance]}`} />
          ))}
        </div>
        <span className="text-xs text-yellow-500 font-medium hidden sm:block">+{task.points}pts</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          task.status === "done" ? "bg-green-100 text-green-600" :
          task.status === "in_progress" ? "bg-blue-100 text-blue-600" :
          task.status === "cancelled" ? "bg-red-100 text-red-500" :
          "bg-gray-100 text-gray-500"
        }`}>
          {task.status === "done" ? "✓" : task.status === "in_progress" ? "⏳" : task.status === "cancelled" ? "✗" : "·"}
        </span>
        <button onClick={() => onDelete(task.id)} className="text-gray-300 hover:text-red-400 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
