"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Circle,
  CheckCircle2,
  Target,
  CalendarDays,
  Link2,
  X,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { AgendaObjective, AgendaTask } from "@/types/agenda";

interface ObjectiveWithChildren extends AgendaObjective {
  children: ObjectiveWithChildren[];
}

export default function ObjectivesPage() {
  const [objectives, setObjectives] = useState<ObjectiveWithChildren[]>([]);
  const [flat, setFlat] = useState<AgendaObjective[]>([]);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [linkModalObjectiveId, setLinkModalObjectiveId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    parent_id: "",
    target_date: "",
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const [objRes, tasksRes] = await Promise.all([
      agendaFetch("/api/agenda/objectives").then(r => r.json()),
      agendaFetch("/api/agenda/tasks").then(r => r.json()),
    ]);
    setObjectives(objRes.objectives ?? []);
    setFlat(objRes.flat ?? []);
    setTasks(tasksRes.tasks ?? []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    const res = await agendaFetch("/api/agenda/objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        parent_id: form.parent_id || null,
        target_date: form.target_date || null,
        color: "#0147FF",
      }),
    });
    const data = await res.json();
    if (data.objective) {
      load();
      setForm({ title: "", description: "", parent_id: "", target_date: "" });
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

  async function handleLinkTasks(objectiveId: string, taskIds: string[]) {
    await Promise.all(
      taskIds.map(id =>
        agendaFetch(`/api/agenda/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective_id: objectiveId }),
        })
      )
    );
    load();
  }

  async function handleUnlinkTask(taskId: string) {
    await agendaFetch(`/api/agenda/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective_id: null }),
    });
    load();
  }

  async function handleToggleTaskStatus(task: AgendaTask) {
    const newStatus = task.status === "done" ? "todo" : "done";
    await agendaFetch(`/api/agenda/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  }

  const availableTasks = useMemo(() => {
    return tasks.filter(t => !t.objective_id && !t.parent_task_id);
  }, [tasks]);

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto bg-[#fbfbfb] min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Objectifs</h1>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-[#121A2E] text-white rounded-full text-sm font-medium hover:bg-[#1a243a] transition-colors"
        >
          <Plus size={16} />
          Nouvel objectif
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 shadow-sm">
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
              <select
                value={form.parent_id}
                onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Aucun (objectif racine)</option>
                {flat.map(o => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date cible</label>
              <input
                type="date"
                value={form.target_date}
                onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
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
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Annuler
            </button>
            <button onClick={handleCreate} className="px-4 py-2 bg-[#121A2E] text-white rounded-full text-sm font-medium hover:bg-[#1a2540]">
              Créer
            </button>
          </div>
        </div>
      )}

      {objectives.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Target size={40} className="mx-auto mb-3 opacity-30" />
          <p>Aucun objectif</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-[#0147FF] hover:underline">
            + Créer votre premier objectif
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {objectives.map(obj => (
            <ObjectiveCard
              key={obj.id}
              objective={obj}
              tasks={tasks}
              expanded={expanded}
              onToggle={id => setExpanded(prev => {
                const n = new Set(prev);
                if (n.has(id)) n.delete(id); else n.add(id);
                return n;
              })}
              onDelete={handleDelete}
              onComplete={handleComplete}
              onLinkTasks={handleLinkTasks}
              onUnlinkTask={handleUnlinkTask}
              onToggleTaskStatus={handleToggleTaskStatus}
              onOpenLinkModal={setLinkModalObjectiveId}
            />
          ))}
        </div>
      )}

      {linkModalObjectiveId && (
        <LinkTasksModal
          objectiveId={linkModalObjectiveId}
          objectiveTitle={flat.find(o => o.id === linkModalObjectiveId)?.title ?? ""}
          availableTasks={availableTasks}
          onClose={() => setLinkModalObjectiveId(null)}
          onLink={handleLinkTasks}
        />
      )}
    </div>
  );
}

function ObjectiveCard({
  objective,
  tasks,
  expanded,
  onToggle,
  onDelete,
  onComplete,
  onLinkTasks,
  onUnlinkTask,
  onToggleTaskStatus,
  onOpenLinkModal,
}: {
  objective: ObjectiveWithChildren;
  tasks: AgendaTask[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onLinkTasks: (objectiveId: string, taskIds: string[]) => void;
  onUnlinkTask: (taskId: string) => void;
  onToggleTaskStatus: (task: AgendaTask) => void;
  onOpenLinkModal: (id: string) => void;
}) {
  const isExpanded = expanded.has(objective.id);
  const hasChildren = objective.children.length > 0;
  const isCompleted = objective.status === "completed";
  const linkedTasks = tasks.filter(t => t.objective_id === objective.id && !t.parent_task_id);
  const progress = objective.progress ?? 0;

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 transition-opacity ${isCompleted ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-[#0147FF]/10">
          {isCompleted
            ? <CheckCircle2 size={20} className="text-[#0147FF]" />
            : <Circle size={20} className="text-[#0147FF]" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
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
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">
                <Check size={10} /> Terminé
              </span>
            )}
          </div>
          {objective.description && (
            <p className="text-sm text-gray-500 mt-1">{objective.description}</p>
          )}

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Progression</span>
              <span className="text-xs font-medium text-[#0147FF]">{progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "#0147FF" }}
              />
            </div>
          </div>

          {/* Linked tasks */}
          {linkedTasks.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {linkedTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 text-sm group">
                  <button
                    onClick={() => onToggleTaskStatus(task)}
                    className="shrink-0"
                  >
                    {task.status === "done"
                      ? <CheckCircle2 size={14} className="text-green-500" />
                      : <Circle size={14} className="text-gray-300 hover:text-[#0147FF]" />
                    }
                  </button>
                  <span className={`flex-1 min-w-0 truncate ${task.status === "done" ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {task.title}
                  </span>
                  <button
                    onClick={() => onUnlinkTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity"
                    title="Délier la tâche"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onOpenLinkModal(objective.id)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-[#0147FF] hover:bg-[#0147FF]/5 rounded-lg transition-colors"
            title="Lier des tâches"
          >
            <Link2 size={12} />
            Lier des tâches
          </button>
          {!isCompleted && progress === 100 && (
            <button
              onClick={() => onComplete(objective.id)}
              className="px-2 py-1.5 text-xs bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
              title="Marquer comme terminé"
            >
              Marquer comme terminé
            </button>
          )}
          <button onClick={() => onDelete(objective.id)} className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Children objectives */}
      {isExpanded && hasChildren && (
        <div className="mt-4 ml-4 pl-4 border-l-2 border-gray-100 space-y-3">
          {objective.children.map(child => (
            <ChildObjectiveCard
              key={child.id}
              objective={child}
              tasks={tasks}
              onDelete={onDelete}
              onComplete={onComplete}
              onLinkTasks={onLinkTasks}
              onUnlinkTask={onUnlinkTask}
              onToggleTaskStatus={onToggleTaskStatus}
              onOpenLinkModal={onOpenLinkModal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildObjectiveCard({
  objective,
  tasks,
  onDelete,
  onComplete,
  onLinkTasks,
  onUnlinkTask,
  onToggleTaskStatus,
  onOpenLinkModal,
}: {
  objective: ObjectiveWithChildren;
  tasks: AgendaTask[];
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onLinkTasks: (objectiveId: string, taskIds: string[]) => void;
  onUnlinkTask: (taskId: string) => void;
  onToggleTaskStatus: (task: AgendaTask) => void;
  onOpenLinkModal: (id: string) => void;
}) {
  const isCompleted = objective.status === "completed";
  const linkedTasks = tasks.filter(t => t.objective_id === objective.id && !t.parent_task_id);
  const progress = objective.progress ?? 0;

  return (
    <div className={`bg-gray-50 border border-gray-100 rounded-lg p-3 transition-opacity ${isCompleted ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 bg-[#0147FF]/10">
          {isCompleted
            ? <CheckCircle2 size={16} className="text-[#0147FF]" />
            : <Circle size={16} className="text-[#0147FF]" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`font-medium text-sm text-gray-800 ${isCompleted ? "line-through text-gray-500" : ""}`}>
              {objective.title}
            </h4>
            {objective.target_date && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <CalendarDays size={10} />
                {new Date(objective.target_date).toLocaleDateString("fr-FR")}
              </span>
            )}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">
                <Check size={8} /> Terminé
              </span>
            )}
          </div>
          {objective.description && (
            <p className="text-xs text-gray-500 mt-0.5">{objective.description}</p>
          )}

          {/* Progress bar */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-gray-400">Progression</span>
              <span className="text-[10px] font-medium text-[#0147FF]">{progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: "#0147FF" }}
              />
            </div>
          </div>

          {/* Linked tasks */}
          {linkedTasks.length > 0 && (
            <div className="mt-2 space-y-1">
              {linkedTasks.map(task => (
                <div key={task.id} className="flex items-center gap-2 text-xs group">
                  <button onClick={() => onToggleTaskStatus(task)} className="shrink-0">
                    {task.status === "done"
                      ? <CheckCircle2 size={12} className="text-green-500" />
                      : <Circle size={12} className="text-gray-300 hover:text-[#0147FF]" />
                    }
                  </button>
                  <span className={`flex-1 min-w-0 truncate ${task.status === "done" ? "line-through text-gray-400" : "text-gray-600"}`}>
                    {task.title}
                  </span>
                  <button
                    onClick={() => onUnlinkTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity"
                    title="Délier la tâche"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onOpenLinkModal(objective.id)}
            className="flex items-center gap-1 px-1.5 py-1 text-[10px] text-[#0147FF] hover:bg-[#0147FF]/5 rounded transition-colors"
            title="Lier des tâches"
          >
            <Link2 size={10} />
            Lier
          </button>
          {!isCompleted && progress === 100 && (
            <button
              onClick={() => onComplete(objective.id)}
              className="px-1.5 py-1 text-[10px] bg-green-50 text-green-600 hover:bg-green-100 rounded transition-colors"
            >
              Terminer
            </button>
          )}
          <button onClick={() => onDelete(objective.id)} className="p-1 text-gray-300 hover:text-red-400 rounded transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LinkTasksModal({
  objectiveId,
  objectiveTitle,
  availableTasks,
  onClose,
  onLink,
}: {
  objectiveId: string;
  objectiveTitle: string;
  availableTasks: AgendaTask[];
  onClose: () => void;
  onLink: (objectiveId: string, taskIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onLink(objectiveId, Array.from(selected));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-800">Lier des tâches</h3>
            <p className="text-xs text-gray-400 mt-0.5">{objectiveTitle}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {availableTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Aucune tâche disponible</p>
          ) : (
            <div className="space-y-2">
              {availableTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => toggle(task.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                    selected.has(task.id)
                      ? "border-[#0147FF] bg-[#0147FF]/5"
                      : "border-gray-100 hover:border-gray-200 bg-white"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    selected.has(task.id) ? "bg-[#0147FF] border-[#0147FF]" : "border-gray-300"
                  }`}>
                    {selected.has(task.id) && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                    {task.date && (
                      <p className="text-xs text-gray-400">{new Date(task.date).toLocaleDateString("fr-FR")}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="px-4 py-2 bg-[#121A2E] text-white rounded-full text-sm font-medium hover:bg-[#1a2540] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Lier {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
