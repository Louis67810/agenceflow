"use client";

import ClientBlueButton from "@/components/shared/ClientBlueButton";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import type { AgendaObjective, AgendaTask } from "@/types/agenda";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  Link2,
  Plus,
  Search,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ObjectiveWithChildren extends AgendaObjective {
  children: ObjectiveWithChildren[];
}

type ObjectiveFilter = "active" | "completed" | "all";

const filterLabels: Record<ObjectiveFilter, string> = {
  active: "Objectifs actifs",
  completed: "Objectifs termines",
  all: "Tous les objectifs",
};

export default function ObjectivesPage() {
  const [objectives, setObjectives] = useState<ObjectiveWithChildren[]>([]);
  const [flat, setFlat] = useState<AgendaObjective[]>([]);
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ObjectiveFilter>("active");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [linkModalObjectiveId, setLinkModalObjectiveId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    parent_id: "",
    target_date: "",
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [objRes, tasksRes] = await Promise.all([
      agendaFetch("/api/agenda/objectives").then((response) => response.json()),
      agendaFetch("/api/agenda/tasks").then((response) => response.json()),
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
      setForm({ title: "", description: "", parent_id: "", target_date: "" });
      setShowForm(false);
      setSelectedObjectiveId(data.objective.id);
      await load();
    }
  }

  async function handleCreateChild(parentId: string, title: string) {
    if (!title.trim()) return;

    const res = await agendaFetch("/api/agenda/objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: "",
        parent_id: parentId,
        target_date: null,
        color: "#0147FF",
      }),
    });

    const data = await res.json();
    if (data.objective) await load();
  }

  async function handleDelete(id: string) {
    await agendaFetch(`/api/agenda/objectives/${id}`, { method: "DELETE" });
    if (selectedObjectiveId === id) setSelectedObjectiveId(null);
    await load();
  }

  async function handleComplete(id: string) {
    await agendaFetch(`/api/agenda/objectives/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", progress: 100 }),
    });
    await load();
  }

  async function handleLinkTasks(objectiveId: string, taskIds: string[]) {
    await Promise.all(
      taskIds.map((id) =>
        agendaFetch(`/api/agenda/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective_id: objectiveId }),
        })
      )
    );
    await load();
  }

  async function handleUnlinkTask(taskId: string) {
    await agendaFetch(`/api/agenda/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective_id: null }),
    });
    await load();
  }

  async function handleToggleTaskStatus(task: AgendaTask) {
    await agendaFetch(`/api/agenda/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: task.status === "done" ? "todo" : "done" }),
    });
    await load();
  }

  const visibleObjectives = useMemo(() => {
    const query = search.trim().toLowerCase();
    return flat
      .filter((objective) => {
        if (filter === "active") return objective.status !== "completed";
        if (filter === "completed") return objective.status === "completed";
        return true;
      })
      .filter((objective) => {
        if (!query) return true;
        return [objective.title, objective.description ?? ""].some((value) =>
          value.toLowerCase().includes(query)
        );
      });
  }, [filter, flat, search]);

  const selectedObjective = flat.find((objective) => objective.id === selectedObjectiveId) ?? null;
  const availableTasks = tasks.filter((task) => !task.objective_id && !task.parent_task_id);

  if (loading) {
    return <div className="min-h-screen bg-[#fbfbfb] p-8 text-sm text-slate-400">Chargement...</div>;
  }

  return (
    <main className="min-h-screen bg-[#fbfbfb] px-10 py-8">
      <div className="mx-auto max-w-[1230px]">
        <header className="mb-8 flex items-center justify-between border-b border-black/[0.06] pb-8">
          <h1
            className="text-[28px] font-bold tracking-[-0.02em] text-[#121A2E]"
            style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            Objectifs
          </h1>
          <ClientBlueButton
            type="button"
            onClick={() => setShowForm((current) => !current)}
            icon={<Plus size={16} />}
            wrapperStyle={{ width: "auto" }}
            style={{ minHeight: 42, padding: "0 18px", fontSize: 14 }}
          >
            Ajouter un objectif
          </ClientBlueButton>
        </header>

        <div className="mb-6 flex items-center gap-6">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#121A2E]/45" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Recherche"
              className="h-12 w-full rounded-[7px] border border-black/10 bg-[#f2f2f2] pl-12 pr-4 text-sm font-medium text-[#121A2E] outline-none transition focus:border-black/10 focus:bg-[#f2f2f2]"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((current) => !current)}
              className="flex h-10 min-w-[140px] items-center justify-between gap-5 rounded-[7px] border border-black/10 bg-white px-4 text-sm font-medium text-slate-600 shadow-[0_8px_18px_rgba(18,26,46,0.06)]"
            >
              {filterLabels[filter]}
              <ChevronDown size={16} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-xl border border-black/10 bg-white p-1 shadow-[0_18px_40px_rgba(18,26,46,0.12)]">
                {(Object.keys(filterLabels) as ObjectiveFilter[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFilter(key);
                      setFilterOpen(false);
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-[#f6f6f6]"
                  >
                    {filterLabels[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {showForm && (
          <ObjectiveFormOverlay
            form={form}
            objectives={flat}
            onChange={setForm}
            onCancel={() => setShowForm(false)}
            onCreate={handleCreate}
          />
        )}

        {visibleObjectives.length === 0 ? (
          <EmptyState onCreate={() => setShowForm(true)} />
        ) : (
          <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleObjectives.map((objective) => (
              <ObjectiveCard
                key={objective.id}
                objective={objective}
                tasks={tasks}
                onOpen={() => setSelectedObjectiveId(objective.id)}
              />
            ))}
          </section>
        )}
      </div>

      {selectedObjective && (
        <ObjectiveDetailsPanel
          objective={selectedObjective}
          objectives={objectives}
          tasks={tasks}
          onClose={() => setSelectedObjectiveId(null)}
          onCreateChild={handleCreateChild}
          onOpenLinkModal={setLinkModalObjectiveId}
          onDelete={handleDelete}
          onUnlinkTask={handleUnlinkTask}
          onToggleTaskStatus={handleToggleTaskStatus}
        />
      )}

      {linkModalObjectiveId && (
        <LinkTasksModal
          objectiveId={linkModalObjectiveId}
          objectiveTitle={flat.find((objective) => objective.id === linkModalObjectiveId)?.title ?? ""}
          availableTasks={availableTasks}
          onClose={() => setLinkModalObjectiveId(null)}
          onLink={handleLinkTasks}
        />
      )}
    </main>
  );
}

function ObjectiveFormOverlay({
  form,
  objectives,
  onChange,
  onCancel,
  onCreate,
}: {
  form: { title: string; description: string; parent_id: string; target_date: string };
  objectives: AgendaObjective[];
  onChange: (form: { title: string; description: string; parent_id: string; target_date: string }) => void;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-[560px] rounded-[24px] border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(18,26,46,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-[-0.02em] text-[#121A2E]">Nouvel objectif</h2>
          <button type="button" onClick={onCancel} className="rounded-full p-2 text-slate-400 hover:bg-[#f6f6f6] hover:text-[#121A2E]">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Nom</span>
            <input
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder="Ex: Finir le porteur client"
              className="h-11 w-full rounded-xl border border-black/10 bg-[#fbfbfb] px-4 text-sm font-medium text-[#121A2E] outline-none focus:border-black/20"
              autoFocus
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Objectif parent</span>
            <select
              value={form.parent_id}
              onChange={(event) => onChange({ ...form, parent_id: event.target.value })}
              className="h-11 w-full rounded-xl border border-black/10 bg-[#fbfbfb] px-4 text-sm font-medium text-[#121A2E] outline-none focus:border-black/20"
            >
              <option value="">Aucun</option>
              {objectives.map((objective) => (
                <option key={objective.id} value={objective.id}>
                  {objective.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Date cible</span>
            <input
              type="date"
              value={form.target_date}
              onChange={(event) => onChange({ ...form, target_date: event.target.value })}
              className="h-11 w-full rounded-xl border border-black/10 bg-[#fbfbfb] px-4 text-sm font-medium text-[#121A2E] outline-none focus:border-black/20"
            />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              rows={3}
              className="w-full resize-none rounded-xl border border-black/10 bg-[#fbfbfb] px-4 py-3 text-sm font-medium text-[#121A2E] outline-none focus:border-black/20"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:bg-[#f6f6f6]">
            Annuler
          </button>
          <ClientBlueButton
            type="button"
            onClick={onCreate}
            wrapperStyle={{ width: "auto" }}
            style={{ minHeight: 42, padding: "0 18px", fontSize: 13 }}
          >
            Creer
          </ClientBlueButton>
        </div>
      </div>
    </div>
  );
}

function ObjectiveCard({
  objective,
  tasks,
  onOpen,
}: {
  objective: AgendaObjective;
  tasks: AgendaTask[];
  onOpen: () => void;
}) {
  const linkedTasks = getLinkedTasks(objective.id, tasks);
  const progress = getObjectiveProgress(objective, tasks);
  const doneCount = linkedTasks.filter((task) => task.status === "done").length;
  const progressLabel = linkedTasks.length > 0 ? `${doneCount}/${linkedTasks.length} taches realisees` : `${progress}% complete`;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      className="min-h-[218px] rounded-[21px] border border-black/10 bg-white p-[26px] shadow-[0_20px_12px_rgba(0,0,0,0.02),0_9px_9px_rgba(0,0,0,0.03),0_2px_5px_rgba(0,0,0,0.03)] transition hover:-translate-y-0.5"
    >
      <div className="mb-5 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-black/10 bg-[#ededed] text-[#a5a5a5] shadow-[0_20px_12px_rgba(0,0,0,0.02),0_9px_9px_rgba(0,0,0,0.03),0_2px_5px_rgba(0,0,0,0.03)]">
          <CheckCircle2 size={19} strokeWidth={2.2} />
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-[7px] border border-black/10 bg-white text-slate-300 transition hover:text-[#0147FF]"
          aria-label="Ouvrir l'objectif"
        >
          <ExternalLink size={17} />
        </button>
      </div>
      <h2 className="line-clamp-1 text-[19px] font-bold leading-tight tracking-[-0.02em] text-[#121A2E]">{objective.title}</h2>
      <p className="mt-2 line-clamp-1 text-[28px] font-bold leading-none tracking-[-0.02em] text-[#121A2E]">{progress}%</p>
      <p className="mt-2 line-clamp-1 text-[14px] font-medium text-slate-400">{progressLabel}</p>
      <div className="mt-6 h-4 overflow-hidden rounded-[5px] bg-[#f3f3f3]">
        <div
          className="h-full rounded-[4px] bg-[#0147FF] transition-all duration-500"
          style={{ width: `${Math.max(3, progress)}%` }}
        />
      </div>
    </article>
  );
}

function ObjectiveDetailsPanel({
  objective,
  objectives,
  tasks,
  onClose,
  onCreateChild,
  onOpenLinkModal,
  onDelete,
  onUnlinkTask,
  onToggleTaskStatus,
}: {
  objective: AgendaObjective;
  objectives: ObjectiveWithChildren[];
  tasks: AgendaTask[];
  onClose: () => void;
  onCreateChild: (parentId: string, title: string) => Promise<void>;
  onOpenLinkModal: (objectiveId: string) => void;
  onDelete: (id: string) => void;
  onUnlinkTask: (taskId: string) => void;
  onToggleTaskStatus: (task: AgendaTask) => void;
}) {
  const linkedTasks = getLinkedTasks(objective.id, tasks);
  const children = findChildren(objective.id, objectives);
  const progress = getObjectiveProgress(objective, tasks);
  const [childTitle, setChildTitle] = useState("");

  async function submitChild() {
    if (!childTitle.trim()) return;
    await onCreateChild(objective.id, childTitle);
    setChildTitle("");
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20" onClick={onClose}>
      <aside
        className="h-full w-full max-w-[420px] overflow-y-auto border-l border-black/10 bg-[#fbfbfb] p-6 shadow-[-24px_0_50px_rgba(18,26,46,0.14)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.02em] text-[#121A2E]">{objective.title}</h2>
            {objective.description && <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{objective.description}</p>}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onDelete(objective.id)} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-red-500" aria-label="Supprimer">
              <Trash2 size={18} />
            </button>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-[#121A2E]" aria-label="Fermer">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-[18px] border border-black/10 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Progression globale</span>
            <span className="text-xl font-bold text-[#0147FF]">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#f1f1f1]">
            <div className="h-full rounded-full bg-[#0147FF]" style={{ width: `${Math.max(3, progress)}%` }} />
          </div>
        </div>

        <div className="mb-6">
          <button
            type="button"
            onClick={() => onOpenLinkModal(objective.id)}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[#121A2E] hover:bg-[#f6f6f6]"
          >
            <Link2 size={15} />
            Lier des taches
          </button>
        </div>

        <div className="mb-6">
          {linkedTasks.length === 0 ? (
            <p className="text-sm font-medium text-slate-400">Aucune tache liee.</p>
          ) : (
            <div className="space-y-2">
              {linkedTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3">
                  <button type="button" onClick={() => onToggleTaskStatus(task)}>
                    {task.status === "done" ? (
                      <CheckCircle2 size={18} className="text-[#0147FF]" />
                    ) : (
                      <Circle size={18} className="text-slate-300" />
                    )}
                  </button>
                  <span className={`flex-1 text-sm font-medium ${task.status === "done" ? "text-slate-400 line-through" : "text-[#121A2E]"}`}>
                    {task.title}
                  </span>
                  <button type="button" onClick={() => onUnlinkTask(task.id)} className="text-slate-300 hover:text-red-500">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <input
              value={childTitle}
              onChange={(event) => setChildTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitChild();
              }}
              placeholder="Ajouter un sous-objectif"
              className="h-10 flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-[#121A2E] outline-none focus:border-black/20"
            />
            <button
              type="button"
              onClick={submitChild}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-[#121A2E] hover:bg-[#f6f6f6]"
              aria-label="Ajouter le sous-objectif"
            >
              <Plus size={16} />
            </button>
          </div>
          {children.length > 0 && (
            <div className="space-y-2">
              {children.map((child) => (
                <ChildObjectiveRow
                  key={child.id}
                  objective={child}
                  tasks={tasks}
                  onOpenLinkModal={onOpenLinkModal}
                  onUnlinkTask={onUnlinkTask}
                  onToggleTaskStatus={onToggleTaskStatus}
                />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ChildObjectiveRow({
  objective,
  tasks,
  onOpenLinkModal,
  onUnlinkTask,
  onToggleTaskStatus,
}: {
  objective: AgendaObjective;
  tasks: AgendaTask[];
  onOpenLinkModal: (objectiveId: string) => void;
  onUnlinkTask: (taskId: string) => void;
  onToggleTaskStatus: (task: AgendaTask) => void;
}) {
  const linkedTasks = getLinkedTasks(objective.id, tasks);
  const progress = getObjectiveProgress(objective, tasks);

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-[#121A2E]">{objective.title}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#0147FF]">{progress}%</span>
          <button
            type="button"
            onClick={() => onOpenLinkModal(objective.id)}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-[#f6f6f6] hover:text-[#0147FF]"
            aria-label="Lier des taches"
          >
            <Link2 size={14} />
          </button>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f1f1f1]">
        <div className="h-full rounded-full bg-[#0147FF]" style={{ width: `${Math.max(3, progress)}%` }} />
      </div>
      {linkedTasks.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {linkedTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 text-sm">
              <button type="button" onClick={() => onToggleTaskStatus(task)}>
                {task.status === "done" ? <CheckCircle2 size={16} className="text-[#0147FF]" /> : <Circle size={16} className="text-slate-300" />}
              </button>
              <span className={`flex-1 truncate font-medium ${task.status === "done" ? "text-slate-400 line-through" : "text-[#121A2E]"}`}>
                {task.title}
              </span>
              <button type="button" onClick={() => onUnlinkTask(task.id)} className="text-slate-300 hover:text-red-500">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
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

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onLink(objectiveId, Array.from(selected));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-black/10 bg-white shadow-[0_24px_70px_rgba(18,26,46,0.18)]">
        <div className="flex items-center justify-between border-b border-black/[0.06] p-5">
          <div>
            <h3 className="font-bold text-[#121A2E]">Lier des taches</h3>
            <p className="mt-1 text-xs font-medium text-slate-400">{objectiveTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-[#f6f6f6]">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {availableTasks.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-slate-400">Aucune tache disponible</p>
          ) : (
            <div className="space-y-2">
              {availableTasks.map((task) => {
                const isSelected = selected.has(task.id);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(task.id)) next.delete(task.id);
                        else next.add(task.id);
                        return next;
                      })
                    }
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isSelected ? "border-[#0147FF] bg-[#0147FF]/5" : "border-black/10 bg-white hover:bg-[#f6f6f6]"
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded border ${isSelected ? "border-[#0147FF] bg-[#0147FF]" : "border-slate-300"}`}>
                      {isSelected && <Check size={12} className="text-white" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#121A2E]">{task.title}</span>
                      {task.date && <span className="text-xs font-medium text-slate-400">{formatDate(task.date)}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-black/[0.06] p-5">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:bg-[#f6f6f6]">
            Annuler
          </button>
          <ClientBlueButton
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0}
            wrapperStyle={{ width: "auto" }}
            style={{ minHeight: 42, padding: "0 18px", fontSize: 13 }}
          >
            Lier {selected.size > 0 ? `(${selected.size})` : ""}
          </ClientBlueButton>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-[21px] border border-black/10 bg-white py-16 text-center shadow-[0_18px_35px_rgba(18,26,46,0.06)]">
      <Target size={38} className="mx-auto mb-3 text-slate-300" />
      <p className="text-sm font-semibold text-slate-500">Aucun objectif pour ce filtre.</p>
      <button type="button" onClick={onCreate} className="mt-3 text-sm font-semibold text-[#0147FF] hover:underline">
        Creer un objectif
      </button>
    </div>
  );
}

function getLinkedTasks(objectiveId: string, tasks: AgendaTask[]) {
  return tasks.filter((task) => task.objective_id === objectiveId && !task.parent_task_id);
}

function getObjectiveProgress(objective: AgendaObjective, tasks: AgendaTask[]) {
  const linkedTasks = getLinkedTasks(objective.id, tasks);
  if (linkedTasks.length > 0) {
    return Math.round((linkedTasks.filter((task) => task.status === "done").length / linkedTasks.length) * 100);
  }
  return Math.max(0, Math.min(100, Math.round(objective.progress ?? 0)));
}

function findChildren(objectiveId: string, objectives: ObjectiveWithChildren[]): AgendaObjective[] {
  for (const objective of objectives) {
    if (objective.id === objectiveId) return objective.children ?? [];
    const nested = findChildren(objectiveId, objective.children ?? []);
    if (nested.length > 0) return nested;
  }
  return [];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
