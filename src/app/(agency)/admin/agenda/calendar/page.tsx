"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Lock } from "lucide-react";
import type { AgendaTask, AgendaBlockedSlot } from "@/types/agenda";
import { SqlMissingBanner } from "@/components/agenda/SqlMissingBanner";

const PX_PER_HOUR = 72;
const WORK_START = 7; // 7h
const WORK_END = 20;  // 20h
const TOTAL_HOURS = WORK_END - WORK_START;
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => WORK_START + i);

function getWeekDates(base: Date): Date[] {
  const day = base.getDay();
  const diff = base.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(base);
  monday.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date) { return d.toISOString().split("T")[0]; }

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function minutesToPx(minutes: number): number {
  return ((minutes - WORK_START * 60) / 60) * PX_PER_HOUR;
}

function pxToMinutes(px: number): number {
  return Math.round((px / PX_PER_HOUR * 60 + WORK_START * 60) / 15) * 15;
}

function addMins(time: string, mins: number): string {
  return minutesToTime(timeToMinutes(time) + mins);
}

// Auto-push: given a dropped task, rearrange other tasks to avoid overlap
function computePushedLayout(
  allTasks: AgendaTask[],
  draggingId: string,
  targetDate: string,
  newStartMins: number
): Record<string, number> {
  const dragging = allTasks.find(t => t.id === draggingId);
  if (!dragging) return {};

  const draggingDur = dragging.duration_minutes ?? 30;
  const result: Record<string, number> = { [draggingId]: newStartMins };

  // Other tasks on the same day with a start time, sorted
  const others = allTasks
    .filter(t => t.id !== draggingId && t.date === targetDate && t.start_time)
    .map(t => ({ id: t.id, start: timeToMinutes(t.start_time!), dur: t.duration_minutes ?? 30 }))
    .sort((a, b) => a.start - b.start);

  let currentEnd = newStartMins + draggingDur;

  for (const t of others) {
    const tEnd = t.start + t.dur;
    if (t.start < currentEnd && tEnd > newStartMins) {
      // overlap with dropped block → push forward
      result[t.id] = currentEnd;
      currentEnd = currentEnd + t.dur;
    }
  }

  return result;
}

interface DragState {
  taskId: string;
  taskTitle: string;
  duration: number;
  offsetY: number;
  sourceDate: string;
}

interface GhostState {
  x: number;
  y: number;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [slots, setSlots] = useState<AgendaBlockedSlot[]>([]);
  const [error, setError] = useState("");

  // Drag state
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [preview, setPreview] = useState<Record<string, number>>({}); // taskId → start_minutes (during drag)
  const [previewDate, setPreviewDate] = useState<string>("");
  const gridRef = useRef<HTMLDivElement>(null);

  // Forms
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [clickDate, setClickDate] = useState("");
  const [clickHour, setClickHour] = useState(9);
  const [slotForm, setSlotForm] = useState({ title: "", date: "", start_time: "", end_time: "", color: "#ef4444", recurrence: "none" });
  const [taskForm, setTaskForm] = useState({ title: "", importance: 3, duration_minutes: 30 });

  const weekDates = getWeekDates(currentDate);
  const weekStart = toDateStr(weekDates[0]);
  const weekEnd = toDateStr(weekDates[6]);

  useEffect(() => { load(); }, [weekStart, weekEnd]);

  async function load() {
    try {
      const [tasksRes, slotsRes] = await Promise.all([
        agendaFetch(`/api/agenda/tasks?week_start=${weekStart}&week_end=${weekEnd}`).then(r => r.json()),
        agendaFetch(`/api/agenda/blocked-slots?week_start=${weekStart}&week_end=${weekEnd}`).then(r => r.json()),
      ]);
      if (tasksRes.error) { setError(tasksRes.error); return; }
      setTasks(tasksRes.tasks ?? []);
      setSlots(slotsRes.slots ?? []);
    } catch (e) { setError(String(e)); }
  }

  // ──────────────── DRAG & DROP ────────────────

  const handleTaskPointerDown = useCallback((e: React.PointerEvent, task: AgendaTask) => {
    if (!task.start_time) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    setDragging({
      taskId: task.id,
      taskTitle: task.title,
      duration: task.duration_minutes ?? 30,
      offsetY: e.clientY - rect.top,
      sourceDate: task.date ?? "",
    });
    setGhost({ x: e.clientX, y: e.clientY });
    setPreview({ [task.id]: timeToMinutes(task.start_time) });
    setPreviewDate(task.date ?? "");
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !gridRef.current) return;

    setGhost({ x: e.clientX, y: e.clientY });

    // Determine which day column the cursor is over
    const gridRect = gridRef.current.getBoundingClientRect();
    const relX = e.clientX - gridRect.left - 56; // subtract time label width
    const colWidth = (gridRect.width - 56) / 7;
    const colIndex = Math.max(0, Math.min(6, Math.floor(relX / colWidth)));
    const targetDate = toDateStr(weekDates[colIndex]);

    // Determine the time from cursor Y
    const relY = e.clientY - gridRect.top;
    const rawMins = pxToMinutes(relY);
    const snappedMins = Math.max(WORK_START * 60, Math.min((WORK_END - 1) * 60, rawMins));

    setPreviewDate(targetDate);
    const layout = computePushedLayout(tasks, dragging.taskId, targetDate, snappedMins);
    setPreview(layout);
  }, [dragging, tasks, weekDates]);

  const handlePointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Commit the preview layout
    const updates = Object.entries(preview);
    if (updates.length > 0) {
      await Promise.all(updates.map(([taskId, startMins]) => {
        const task = tasks.find(t => t.id === taskId);
        const dur = task?.duration_minutes ?? 30;
        return agendaFetch(`/api/agenda/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_time: minutesToTime(startMins),
            end_time: minutesToTime(startMins + dur),
            date: previewDate,
          }),
        });
      }));
      setTasks(prev => prev.map(t => {
        if (preview[t.id] !== undefined) {
          return {
            ...t,
            start_time: minutesToTime(preview[t.id]),
            end_time: minutesToTime(preview[t.id] + (t.duration_minutes ?? 30)),
            date: previewDate,
          };
        }
        return t;
      }));
    }

    setDragging(null);
    setGhost(null);
    setPreview({});
    setPreviewDate("");
  }, [dragging, preview, previewDate, tasks]);

  // ──────────────── ACTIONS ────────────────

  async function handleCreateSlot() {
    if (!slotForm.title || !slotForm.date || !slotForm.start_time || !slotForm.end_time) return;
    const res = await agendaFetch("/api/agenda/blocked-slots", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(slotForm),
    });
    const data = await res.json();
    if (data.slot) { setSlots(p => [...p, data.slot]); setShowSlotForm(false); }
  }

  async function handleCreateTask() {
    if (!taskForm.title || !clickDate) return;
    const startTime = minutesToTime(clickHour * 60);
    const payload = {
      title: taskForm.title, date: clickDate,
      start_time: startTime, end_time: addMins(startTime, taskForm.duration_minutes),
      duration_minutes: taskForm.duration_minutes, importance: taskForm.importance, status: "todo",
    };
    const res = await agendaFetch("/api/agenda/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.task) { setTasks(p => [...p, data.task]); setShowTaskForm(false); setTaskForm({ title: "", importance: 3, duration_minutes: 30 }); }
    if (data.error) setError(data.error);
  }

  async function handleToggleTask(task: AgendaTask) {
    const newStatus = task.status === "done" ? "todo" : "done";
    await agendaFetch(`/api/agenda/tasks/${task.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }),
    });
    setTasks(p => p.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
  }

  async function handleDeleteSlot(id: string) {
    await agendaFetch(`/api/agenda/blocked-slots/${id}`, { method: "DELETE" });
    setSlots(p => p.filter(s => s.id !== id));
  }

  // ──────────────── RENDER HELPERS ────────────────

  const totalHeight = TOTAL_HOURS * PX_PER_HOUR;
  const today = toDateStr(new Date());
  const weekLabel = `${weekDates[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${weekDates[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="p-4 select-none">
      {error && <SqlMissingBanner error={error} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; })} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-base font-semibold text-gray-800">{weekLabel}</h2>
          <button onClick={() => setCurrentDate(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; })} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="text-xs text-indigo-500 hover:underline">
            Aujourd&apos;hui
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setSlotForm(f => ({ ...f, date: today })); setShowSlotForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100"
          >
            <Lock size={13} /> Bloquer
          </button>
          <button
            onClick={() => { setClickDate(today); setClickHour(9); setShowTaskForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            <Plus size={13} /> Tâche
          </button>
        </div>
      </div>

      {/* Quick forms */}
      {showSlotForm && (
        <div className="bg-white border border-red-200 rounded-xl p-4 mb-3 shadow-sm">
          <div className="flex justify-between mb-3"><h3 className="font-medium text-sm">Bloquer un créneau</h3><button onClick={() => setShowSlotForm(false)}><X size={14} /></button></div>
          <div className="grid grid-cols-4 gap-2">
            <input value={slotForm.title} onChange={e => setSlotForm(f => ({ ...f, title: e.target.value }))} className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-sm" placeholder="Titre" />
            <input type="date" value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))} className="border border-gray-200 rounded px-2 py-1.5 text-sm" />
            <input type="color" value={slotForm.color} onChange={e => setSlotForm(f => ({ ...f, color: e.target.value }))} className="border border-gray-200 rounded h-9 cursor-pointer" />
            <input type="time" value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} className="border border-gray-200 rounded px-2 py-1.5 text-sm" />
            <input type="time" value={slotForm.end_time} onChange={e => setSlotForm(f => ({ ...f, end_time: e.target.value }))} className="border border-gray-200 rounded px-2 py-1.5 text-sm" />
            <button onClick={handleCreateSlot} className="col-span-2 bg-red-500 text-white rounded py-1.5 text-sm">Bloquer</button>
          </div>
        </div>
      )}
      {showTaskForm && (
        <div className="bg-white border border-indigo-200 rounded-xl p-4 mb-3 shadow-sm">
          <div className="flex justify-between mb-3"><h3 className="font-medium text-sm">Ajouter une tâche · {clickDate}</h3><button onClick={() => setShowTaskForm(false)}><X size={14} /></button></div>
          <div className="flex gap-2">
            <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm" placeholder="Titre" onKeyDown={e => e.key === "Enter" && handleCreateTask()} />
            <select value={taskForm.importance} onChange={e => setTaskForm(f => ({ ...f, importance: parseInt(e.target.value) }))} className="border border-gray-200 rounded px-2 text-sm">
              {[1,2,3,4,5].map(i => <option key={i} value={i}>⭐ {i}</option>)}
            </select>
            <input type="number" value={taskForm.duration_minutes} onChange={e => setTaskForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 30 }))} className="w-20 border border-gray-200 rounded px-2 text-sm" min={15} step={15} />
            <button onClick={handleCreateTask} className="px-3 py-2 bg-indigo-600 text-white rounded text-sm">Créer</button>
          </div>
        </div>
      )}

      {/* Ghost element (dragging visual) */}
      {dragging && ghost && (
        <div
          className="fixed pointer-events-none z-50 bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-2xl"
          style={{
            left: ghost.x + 10,
            top: ghost.y - 10,
            transform: "rotate(16deg) scale(1.08)",
            opacity: 0.92,
            transition: "transform 0.05s ease",
            maxWidth: 160,
          }}
        >
          <div className="truncate">{dragging.taskTitle}</div>
          <div className="text-indigo-200 text-xs">{dragging.duration}min</div>
        </div>
      )}

      {/* Calendar grid */}
      <div
        ref={gridRef}
        className="bg-white rounded-xl border border-gray-200 overflow-hidden relative"
        onPointerMove={dragging ? handlePointerMove : undefined}
        onPointerUp={dragging ? handlePointerUp : undefined}
        style={{ cursor: dragging ? "grabbing" : "default" }}
      >
        {/* Day headers */}
        <div className="grid sticky top-0 z-10 bg-white border-b border-gray-100" style={{ gridTemplateColumns: "56px repeat(7, 1fr)" }}>
          <div />
          {weekDates.map((date, i) => {
            const isToday = toDateStr(date) === today;
            return (
              <div key={i} className={`p-2 text-center border-l border-gray-100 ${isToday ? "bg-indigo-50" : ""}`}>
                <p className="text-xs text-gray-400">{DAYS[i]}</p>
                <p className={`text-sm font-bold ${isToday ? "text-indigo-600" : "text-gray-700"}`}>{date.getDate()}</p>
              </div>
            );
          })}
        </div>

        {/* Time grid + tasks */}
        <div className="overflow-y-auto" style={{ maxHeight: "65vh" }}>
          <div className="relative" style={{ height: totalHeight }}>
            {/* Hour lines */}
            {HOURS.map(hour => (
              <div
                key={hour}
                className="absolute left-0 right-0 border-t border-gray-100 flex"
                style={{ top: (hour - WORK_START) * PX_PER_HOUR, height: PX_PER_HOUR }}
              >
                <div className="w-14 shrink-0 text-xs text-gray-400 text-right pr-2 pt-0.5 leading-none">
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div className="flex-1 grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                  {weekDates.map((date, di) => (
                    <div
                      key={di}
                      className="border-l border-gray-100 relative hover:bg-indigo-50/20 transition-colors cursor-pointer group"
                      onClick={() => { setClickDate(toDateStr(date)); setClickHour(hour); setShowTaskForm(true); }}
                    >
                      <button className="absolute top-1 right-1 hidden group-hover:flex items-center justify-center w-4 h-4 bg-indigo-100 rounded text-indigo-500">
                        <Plus size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Blocked slots */}
            {slots.map(slot => {
              const colIndex = weekDates.findIndex(d => toDateStr(d) === slot.date);
              if (colIndex === -1) return null;
              const startMins = timeToMinutes(slot.start_time);
              const endMins = timeToMinutes(slot.end_time);
              const top = minutesToPx(startMins);
              const height = Math.max(20, ((endMins - startMins) / 60) * PX_PER_HOUR);
              const colWidth = `calc((100% - 56px) / 7)`;
              const left = `calc(56px + ${colIndex} * (100% - 56px) / 7 + 2px)`;

              return (
                <div
                  key={slot.id}
                  className="absolute rounded-md text-xs px-1.5 py-0.5 flex items-start justify-between group/slot overflow-hidden"
                  style={{ top, height, left, width: `calc(${colWidth} - 4px)`, background: slot.color + "30", borderLeft: `3px solid ${slot.color}` }}
                  onClick={e => e.stopPropagation()}
                >
                  <span className="truncate font-medium" style={{ color: slot.color }}>{slot.title}</span>
                  <button onClick={() => handleDeleteSlot(slot.id)} className="hidden group-hover/slot:block text-gray-400 hover:text-red-500 shrink-0">
                    <X size={10} />
                  </button>
                </div>
              );
            })}

            {/* Tasks */}
            {tasks.filter(t => t.start_time && t.date).map(task => {
              const colIndex = weekDates.findIndex(d => toDateStr(d) === task.date);
              if (colIndex === -1) return null;

              const isDragging = dragging?.taskId === task.id;
              // Use preview position if available
              const startMins = preview[task.id] !== undefined && previewDate
                ? preview[task.id]
                : timeToMinutes(task.start_time!);
              const dur = task.duration_minutes ?? 30;

              // If task was pushed to a different day, find that column
              let displayColIndex = colIndex;
              if (preview[task.id] !== undefined && previewDate && previewDate !== task.date) {
                displayColIndex = weekDates.findIndex(d => toDateStr(d) === previewDate);
                if (displayColIndex === -1) displayColIndex = colIndex;
              }

              const top = minutesToPx(startMins);
              const height = Math.max(24, (dur / 60) * PX_PER_HOUR);
              const left = `calc(56px + ${displayColIndex} * (100% - 56px) / 7 + 4px)`;
              const width = `calc((100% - 56px) / 7 - 8px)`;

              return (
                <div
                  key={task.id}
                  className={`absolute rounded-lg text-xs overflow-hidden border transition-all ${
                    isDragging
                      ? "opacity-30 border-indigo-300"
                      : task.status === "done"
                      ? "bg-green-50 border-green-200 opacity-60"
                      : "bg-indigo-100 border-indigo-200 hover:bg-indigo-200 cursor-grab active:cursor-grabbing"
                  }`}
                  style={{
                    top,
                    height,
                    left,
                    width,
                    transition: dragging && !isDragging ? "top 0.18s ease, left 0.18s ease" : "none",
                  }}
                  onPointerDown={e => handleTaskPointerDown(e, task)}
                  onClick={e => { if (!dragging) { e.stopPropagation(); handleToggleTask(task); } }}
                >
                  <div className="p-1 h-full flex flex-col">
                    <span className={`font-medium leading-tight truncate ${task.status === "done" ? "line-through text-green-600" : "text-indigo-800"}`}>
                      {task.title}
                    </span>
                    {height > 40 && (
                      <span className="text-indigo-500 text-xs mt-0.5">
                        {task.start_time?.slice(0, 5)}{task.end_time ? ` - ${task.end_time.slice(0, 5)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Drop preview indicator */}
            {dragging && Object.entries(preview).map(([tid, startMins]) => {
              if (tid !== dragging.taskId) return null;
              const colIndex = weekDates.findIndex(d => toDateStr(d) === previewDate);
              if (colIndex === -1) return null;
              const top = minutesToPx(startMins);
              const height = Math.max(24, (dragging.duration / 60) * PX_PER_HOUR);
              const left = `calc(56px + ${colIndex} * (100% - 56px) / 7 + 4px)`;
              const width = `calc((100% - 56px) / 7 - 8px)`;
              return (
                <div
                  key="drop-preview"
                  className="absolute rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/50 pointer-events-none"
                  style={{ top, height, left, width }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-2 text-center">
        💡 Glissez une tâche pour la déplacer · Cliquez pour créer/terminer
      </p>
    </div>
  );
}
