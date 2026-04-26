"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Plus, X, Lock,
  Check, CheckCircle2, Trash2, Clock, Calendar as CalendarIcon,
  GripVertical, ArrowRight
} from "lucide-react";
import type { AgendaTask, AgendaBlockedSlot } from "@/types/agenda";
import { SqlMissingBanner } from "@/components/agenda/SqlMissingBanner";

const PX_PER_HOUR = 72;
const WORK_START = 7;
const WORK_END = 24;
const TOTAL_HOURS = WORK_END - WORK_START;
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOURS = Array.from({ length: TOTAL_HOURS }, (_, i) => WORK_START + i);

const IMPORTANCE_LEVELS = [
  { label: "Faible", color: "#22c55e", bg: "#f0fdf4" },
  { label: "Moyen", color: "#3b82f6", bg: "#eff6ff" },
  { label: "Important", color: "#f59e0b", bg: "#fffbeb" },
  { label: "Urgent", color: "#f97316", bg: "#fff7ed" },
  { label: "Critique", color: "#ef4444", bg: "#fef2f2" },
];

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

function computePushedLayout(
  allTasks: AgendaTask[],
  allSlots: AgendaBlockedSlot[],
  draggingId: string,
  targetDate: string,
  newStartMins: number
): Record<string, number> {
  const dragging = allTasks.find(t => t.id === draggingId);
  if (!dragging) return {};
  const draggingDur = dragging.duration_minutes ?? 30;
  const result: Record<string, number> = { [draggingId]: newStartMins };
  const others = allTasks
    .filter(t => t.id !== draggingId && t.date === targetDate && t.start_time)
    .map(t => ({ id: t.id, start: timeToMinutes(t.start_time!), dur: t.duration_minutes ?? 30 }))
    .sort((a, b) => a.start - b.start);
  const blocked = allSlots
    .filter(s => s.date === targetDate)
    .map(s => ({ start: timeToMinutes(s.start_time), end: timeToMinutes(s.end_time) }))
    .sort((a, b) => a.start - b.start);
  let currentEnd = newStartMins + draggingDur;
  for (const t of others) {
    const tEnd = t.start + t.dur;
    if (t.start < currentEnd && tEnd > newStartMins) {
      result[t.id] = currentEnd;
      currentEnd = currentEnd + t.dur;
    }
  }
  for (const b of blocked) {
    if (newStartMins < b.end && currentEnd > b.start) {
      const push = b.end;
      result[draggingId] = push;
      currentEnd = push + draggingDur;
      for (const t of others) {
        if (result[t.id] !== undefined) {
          const tStart = result[t.id];
          const tEnd = tStart + t.dur;
          if (tStart < currentEnd && tEnd > push) {
            result[t.id] = currentEnd;
            currentEnd = currentEnd + t.dur;
          }
        }
      }
    }
  }
  return result;
}

// ─── Types ───
interface DragState {
  taskId: string; taskTitle: string; duration: number;
  offsetY: number; sourceDate: string; sourceStartMins: number;
  startX: number; startY: number; hasMoved: boolean;
}
interface GhostState { x: number; y: number; }

interface ContextMenuState {
  x: number; y: number;
  type: "empty" | "task" | "slot";
  task?: AgendaTask;
  slot?: AgendaBlockedSlot;
  date?: string; hour?: number;
}

interface TaskFormState {
  open: boolean; mode: "create" | "edit";
  id?: string; title: string; date: string;
  startTime: string; endTime: string;
  importance: number; durationMinutes: number;
}

interface SlotFormState {
  open: boolean; mode: "create" | "edit";
  id?: string; title: string; date: string;
  startTime: string; endTime: string; color: string;
}

// ─── Component ───
export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [slots, setSlots] = useState<AgendaBlockedSlot[]>([]);
  const [error, setError] = useState("");

  // Drag
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [preview, setPreview] = useState<Record<string, number>>({});
  const [previewDate, setPreviewDate] = useState<string>("");
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressClickRef = useRef<string | null>(null);

  // Resize
  const [resizing, setResizing] = useState<{ taskId: string; startY: number; startDuration: number } | null>(null);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  // Forms
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    open: false, mode: "create", title: "", date: "", startTime: "09:00", endTime: "09:30", importance: 3, durationMinutes: 30,
  });
  const [slotForm, setSlotForm] = useState<SlotFormState>({
    open: false, mode: "create", title: "", date: "", startTime: "09:00", endTime: "10:00", color: "#ef4444",
  });

  const weekDates = getWeekDates(currentDate);
  const weekStart = toDateStr(weekDates[0]);
  const weekEnd = toDateStr(weekDates[6]);
  const today = toDateStr(new Date());

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

  // ─── Drag & Drop ───
  const handleTaskPointerDown = useCallback((e: React.PointerEvent, task: AgendaTask) => {
    if (!task.start_time) return;
    if (e.button !== 0) return;
    // Ignore if clicking resize handle
    const target = e.target as HTMLElement;
    if (target.dataset.resizeHandle) return;
    e.preventDefault();
    setCtxMenu(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const startMins = timeToMinutes(task.start_time);
    setDragging({
      taskId: task.id, taskTitle: task.title, duration: task.duration_minutes ?? 30,
      offsetY: e.clientY - rect.top, sourceDate: task.date ?? "", sourceStartMins: startMins,
      startX: e.clientX, startY: e.clientY, hasMoved: false,
    });
    setGhost({ x: e.clientX, y: e.clientY });
    setPreview({ [task.id]: startMins });
    setPreviewDate(task.date ?? "");
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (resizing) {
      const deltaPx = e.clientY - resizing.startY;
      const deltaMins = Math.round((deltaPx / PX_PER_HOUR) * 60 / 15) * 15;
      const newDuration = Math.max(15, resizing.startDuration + deltaMins);
      setTasks(prev => prev.map(t => t.id === resizing.taskId ? { ...t, duration_minutes: newDuration, end_time: addMins(t.start_time ?? "09:00", newDuration) } : t));
      return;
    }
    if (!dragging || !gridRef.current || !scrollRef.current) return;
    const deltaX = e.clientX - dragging.startX;
    const deltaY = e.clientY - dragging.startY;
    const movedEnough = Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4;
    setGhost({ x: e.clientX, y: e.clientY });
    if (!movedEnough && !dragging.hasMoved) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const relX = e.clientX - gridRect.left - 56;
    const colWidth = (gridRect.width - 56) / 7;
    const colIndex = Math.max(0, Math.min(6, Math.floor(relX / colWidth)));
    const targetDate = toDateStr(weekDates[colIndex]);
    const scrollRect = scrollRef.current.getBoundingClientRect();
    const relY = e.clientY - scrollRect.top + scrollRef.current.scrollTop - dragging.offsetY;
    const rawMins = pxToMinutes(relY);
    const latestStart = WORK_END * 60 - dragging.duration;
    const snappedMins = Math.max(WORK_START * 60, Math.min(latestStart, rawMins));
    if (!dragging.hasMoved) setDragging(prev => prev ? { ...prev, hasMoved: true } : prev);
    setPreviewDate(targetDate);
    setPreview(computePushedLayout(tasks, slots, dragging.taskId, targetDate, snappedMins));
  }, [dragging, tasks, weekDates, resizing]);

  const handlePointerUp = useCallback(async () => {
    if (resizing) {
      const task = tasks.find(t => t.id === resizing.taskId);
      if (task) {
        await agendaFetch(`/api/agenda/tasks/${task.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration_minutes: task.duration_minutes, end_time: task.end_time }),
        });
      }
      setResizing(null);
      return;
    }
    if (!dragging) return;
    const didMove = dragging.hasMoved;
    const updates = didMove ? Object.entries(preview) : [];
    if (updates.length > 0) {
      await Promise.all(updates.map(([taskId, startMins]) => {
        const task = tasks.find(t => t.id === taskId);
        const dur = task?.duration_minutes ?? 30;
        return agendaFetch(`/api/agenda/tasks/${taskId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start_time: minutesToTime(startMins), end_time: minutesToTime(startMins + dur), date: previewDate }),
        });
      }));
      setTasks(prev => prev.map(t => {
        if (preview[t.id] !== undefined) {
          return { ...t, start_time: minutesToTime(preview[t.id]), end_time: minutesToTime(preview[t.id] + (t.duration_minutes ?? 30)), date: previewDate };
        }
        return t;
      }));
      suppressClickRef.current = dragging.taskId;
      window.setTimeout(() => { if (suppressClickRef.current === dragging.taskId) suppressClickRef.current = null; }, 120);
    }
    setDragging(null); setGhost(null); setPreview({}); setPreviewDate("");
  }, [dragging, preview, previewDate, tasks, resizing]);

  useEffect(() => {
    if (!dragging && !resizing) return;
    const onMove = (e: PointerEvent) => { void handlePointerMove(e); };
    const onUp = () => { void handlePointerUp(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [dragging, resizing, handlePointerMove, handlePointerUp]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  useEffect(() => {
    if (!ctxMenu) return;
    const x = ctxMenu.x + 200 > window.innerWidth ? window.innerWidth - 200 - 16 : ctxMenu.x;
    const y = ctxMenu.y + 150 > window.innerHeight ? window.innerHeight - 150 - 16 : ctxMenu.y;
    if (x !== ctxMenu.x || y !== ctxMenu.y) {
      setCtxMenu(prev => prev ? { ...prev, x, y } : prev);
    }
  }, [ctxMenu]);

  // ─── Actions ───
  async function saveTask() {
    if (!taskForm.title || !taskForm.date) return;
    const payload = {
      title: taskForm.title, date: taskForm.date,
      start_time: taskForm.startTime, end_time: taskForm.endTime,
      duration_minutes: taskForm.durationMinutes,
      importance: taskForm.importance, status: "todo" as const,
    };
    if (taskForm.mode === "edit" && taskForm.id) {
      const res = await agendaFetch(`/api/agenda/tasks/${taskForm.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.task) setTasks(p => p.map(t => t.id === taskForm.id ? data.task : t));
    } else {
      const res = await agendaFetch("/api/agenda/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.task) setTasks(p => [...p, data.task]);
    }
    setTaskForm(f => ({ ...f, open: false }));
  }

  async function saveSlot() {
    if (!slotForm.title || !slotForm.date || !slotForm.startTime || !slotForm.endTime) return;
    const payload = { title: slotForm.title, date: slotForm.date, start_time: slotForm.startTime, end_time: slotForm.endTime, color: slotForm.color, recurrence: "none" };
    if (slotForm.mode === "edit" && slotForm.id) {
      const res = await agendaFetch(`/api/agenda/blocked-slots/${slotForm.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.slot) setSlots(p => p.map(s => s.id === slotForm.id ? data.slot : s));
    } else {
      const res = await agendaFetch("/api/agenda/blocked-slots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.slot) setSlots(p => [...p, data.slot]);
    }
    setSlotForm(f => ({ ...f, open: false }));
  }

  async function deleteTask(taskId: string) {
    await agendaFetch(`/api/agenda/tasks/${taskId}`, { method: "DELETE" });
    setTasks(p => p.filter(t => t.id !== taskId));
    setCtxMenu(null);
  }

  async function deleteSlot(slotId: string) {
    await agendaFetch(`/api/agenda/blocked-slots/${slotId}`, { method: "DELETE" });
    setSlots(p => p.filter(s => s.id !== slotId));
    setCtxMenu(null);
  }

  async function toggleTaskStatus(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === "done" ? "todo" : "done";
    await agendaFetch(`/api/agenda/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    setTasks(p => p.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setCtxMenu(null);
  }

  function openCreateTask(date: string, hour: number) {
    const start = minutesToTime(hour * 60);
    setTaskForm({ open: true, mode: "create", title: "", date, startTime: start, endTime: addMins(start, 30), importance: 3, durationMinutes: 30 });
    setCtxMenu(null);
  }

  function openEditTask(task: AgendaTask) {
    setTaskForm({
      open: true, mode: "edit", id: task.id, title: task.title,
      date: task.date ?? today, startTime: task.start_time ?? "09:00",
      endTime: task.end_time ?? "09:30", importance: task.importance ?? 3,
      durationMinutes: task.duration_minutes ?? 30,
    });
    setCtxMenu(null);
  }

  function openCreateSlot(date: string, hour: number) {
    const start = minutesToTime(hour * 60);
    setSlotForm({ open: true, mode: "create", title: "", date, startTime: start, endTime: addMins(start, 60), color: "#ef4444" });
    setCtxMenu(null);
  }

  // ─── Context Menu Handlers ───
  function handleGridContextMenu(e: React.MouseEvent, date: Date, hour: number) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "empty", date: toDateStr(date), hour });
  }

  function handleTaskContextMenu(e: React.MouseEvent, task: AgendaTask) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type: "task", task });
  }

  // ─── Render ───
  const totalHeight = TOTAL_HOURS * PX_PER_HOUR;
  const weekLabel = `${weekDates[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${weekDates[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="p-4 select-none" style={{ background: "#fbfbfb", minHeight: "100vh" }}>
      {error && <SqlMissingBanner error={error} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentDate(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; })} className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-base font-semibold" style={{ color: "#121A2E" }}>{weekLabel}</h2>
          <button onClick={() => setCurrentDate(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; })} className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight size={16} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="text-xs hover:underline transition-colors" style={{ color: "#0147FF" }}>
            Aujourd&apos;hui
          </button>
        </div>
      </div>

      {/* Ghost drag */}
      {dragging && ghost && (
        <div className="fixed pointer-events-none z-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-2xl"
          style={{ left: ghost.x + 10, top: ghost.y - 10, transform: "rotate(16deg) scale(1.08)", opacity: 0.92, transition: "transform 0.05s ease", maxWidth: 160, background: "#0147FF" }}>
          <div className="truncate">{dragging.taskTitle}</div>
          <div className="text-white/70 text-xs">{dragging.duration}min</div>
        </div>
      )}

      {/* Calendar grid */}
      <div ref={gridRef} className="bg-white rounded-xl border overflow-hidden relative" style={{ borderColor: "rgba(18,26,46,0.1)" }}>
        {/* Day headers */}
        <div className="grid sticky top-0 z-10 bg-white border-b" style={{ gridTemplateColumns: "56px repeat(7, 1fr)", borderColor: "rgba(18,26,46,0.06)" }}>
          <div />
          {weekDates.map((date, i) => {
            const isToday = toDateStr(date) === today;
            return (
              <div key={i} className="p-2 text-center border-l" style={{ borderColor: "rgba(18,26,46,0.06)", background: isToday ? "rgba(1,71,255,0.04)" : undefined }}>
                <p className="text-xs" style={{ color: "rgba(18,26,46,0.4)" }}>{DAYS[i]}</p>
                <p className={`text-sm font-bold ${isToday ? "" : ""}`} style={{ color: isToday ? "#0147FF" : "#121A2E" }}>{date.getDate()}</p>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "65vh" }}>
          <div className="relative" style={{ height: totalHeight }}>
            {/* Hour lines */}
            {HOURS.map(hour => (
              <div key={hour} className="absolute left-0 right-0 border-t flex" style={{ top: (hour - WORK_START) * PX_PER_HOUR, height: PX_PER_HOUR, borderColor: "rgba(18,26,46,0.06)" }}>
                <div className="w-14 shrink-0 text-xs text-right pr-2 pt-0.5 leading-none" style={{ color: "rgba(18,26,46,0.4)" }}>
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div className="flex-1 grid" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                  {weekDates.map((date, di) => (
                    <div
                      key={di}
                      className="border-l relative transition-colors"
                      style={{ borderColor: "rgba(18,26,46,0.06)" }}
                      onContextMenu={e => handleGridContextMenu(e, date, hour)}
                    />
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
                <div key={slot.id} className="absolute rounded-md text-xs px-1.5 py-0.5 flex items-start justify-between group/slot overflow-hidden"
                  style={{ top, height, left, width: `calc(${colWidth} - 4px)`, background: `repeating-linear-gradient(45deg, #e5e5e5, #e5e5e5 4px, #f0f0f0 4px, #f0f0f0 8px)`, borderLeft: `2px solid #9ca3af` }}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, type: "slot", slot }); }}
                >
                  <span className="truncate font-medium" style={{ color: "#6b7280" }}>{slot.title}</span>
                </div>
              );
            })}

            {/* Tasks */}
            {tasks.filter(t => t.start_time && t.date).map(task => {
              const colIndex = weekDates.findIndex(d => toDateStr(d) === task.date);
              if (colIndex === -1) return null;
              const isDragging = dragging?.taskId === task.id;
              const startMins = preview[task.id] !== undefined && previewDate ? preview[task.id] : timeToMinutes(task.start_time!);
              const dur = task.duration_minutes ?? 30;
              let displayColIndex = colIndex;
              if (preview[task.id] !== undefined && previewDate && previewDate !== task.date) {
                displayColIndex = weekDates.findIndex(d => toDateStr(d) === previewDate);
                if (displayColIndex === -1) displayColIndex = colIndex;
              }
              const top = minutesToPx(startMins);
              const height = Math.max(24, (dur / 60) * PX_PER_HOUR);
              const left = `calc(56px + ${displayColIndex} * (100% - 56px) / 7 + 4px)`;
              const width = `calc((100% - 56px) / 7 - 8px)`;
              const imp = IMPORTANCE_LEVELS[(task.importance ?? 3) - 1] ?? IMPORTANCE_LEVELS[2];

              return (
                <div key={task.id}
                  className="absolute rounded-lg text-xs overflow-hidden border transition-all"
                  style={{
                    top, height, left, width,
                    background: task.status === "done" ? "#f0fdf4" : imp.bg,
                    borderColor: task.status === "done" ? "#86efac" : imp.color + "40",
                    opacity: isDragging ? 0.3 : task.status === "done" ? 0.6 : 1,
                    transition: dragging && !isDragging ? "top 0.18s ease, left 0.18s ease" : "none",
                    cursor: dragging ? "grabbing" : "grab",
                  }}
                  onPointerDown={e => handleTaskPointerDown(e, task)}
                  onContextMenu={e => handleTaskContextMenu(e, task)}
                >
                  <div className="p-1.5 h-full flex flex-col relative">
                    <span className="font-medium leading-tight truncate" style={{ color: task.status === "done" ? "#16a34a" : imp.color, textDecoration: task.status === "done" ? "line-through" : "none" }}>
                      {task.title}
                    </span>
                    {height > 40 && (
                      <span className="text-xs mt-0.5" style={{ color: imp.color + "99" }}>
                        {task.start_time?.slice(0, 5)}{task.end_time ? ` - ${task.end_time.slice(0, 5)}` : ""}
                      </span>
                    )}
                    {/* Resize handle */}
                    <div
                      data-resize-handle="1"
                      className="absolute left-0 right-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity"
                      style={{ background: imp.color + "60" }}
                      onPointerDown={e => {
                        e.stopPropagation();
                        setResizing({ taskId: task.id, startY: e.clientY, startDuration: task.duration_minutes ?? 30 });
                      }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Drop preview */}
            {dragging && Object.entries(preview).map(([tid, startMins]) => {
              if (tid !== dragging.taskId) return null;
              const colIndex = weekDates.findIndex(d => toDateStr(d) === previewDate);
              if (colIndex === -1) return null;
              const top = minutesToPx(startMins);
              const height = Math.max(24, (dragging.duration / 60) * PX_PER_HOUR);
              const left = `calc(56px + ${colIndex} * (100% - 56px) / 7 + 4px)`;
              const width = `calc((100% - 56px) / 7 - 8px)`;
              return (
                <div key="drop-preview" className="absolute rounded-lg border-2 border-dashed pointer-events-none"
                  style={{ top, height, left, width, borderColor: "#0147FF", background: "rgba(1,71,255,0.05)" }} />
              );
            })}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div className="fixed z-50 rounded-2xl border bg-white shadow-2xl overflow-hidden"
          style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: 200, borderColor: "rgba(18,26,46,0.1)" }}
          onClick={e => e.stopPropagation()}>
          {ctxMenu.type === "empty" && (
            <div className="py-1">
              <button onClick={() => openCreateTask(ctxMenu.date ?? today, ctxMenu.hour ?? 9)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left" style={{ color: "#121A2E" }}>
                <Plus size={15} style={{ color: "#0147FF" }} /> Ajouter une tâche
              </button>
              <button onClick={() => openCreateSlot(ctxMenu.date ?? today, ctxMenu.hour ?? 9)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left" style={{ color: "#121A2E" }}>
                <Lock size={15} style={{ color: "#ef4444" }} /> Bloquer un créneau
              </button>
            </div>
          )}
          {ctxMenu.type === "task" && ctxMenu.task && (
            <div className="py-1">
              <button onClick={() => toggleTaskStatus(ctxMenu.task!.id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left" style={{ color: "#121A2E" }}>
                <CheckCircle2 size={15} style={{ color: "#22c55e" }} /> {ctxMenu.task.status === "done" ? "Rouvrir" : "Valider"}
              </button>
              <button onClick={() => openEditTask(ctxMenu.task!)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left" style={{ color: "#121A2E" }}>
                <Clock size={15} style={{ color: "#0147FF" }} /> Modifier
              </button>
              <div className="my-1 border-t" style={{ borderColor: "rgba(18,26,46,0.06)" }} />
              <button onClick={() => deleteTask(ctxMenu.task!.id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-red-50 transition-colors text-left" style={{ color: "#ef4444" }}>
                <Trash2 size={15} /> Supprimer
              </button>
            </div>
          )}
          {ctxMenu.type === "slot" && ctxMenu.slot && (
            <div className="py-1">
              <button onClick={() => deleteSlot(ctxMenu.slot!.id)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-red-50 transition-colors text-left" style={{ color: "#ef4444" }}>
                <Trash2 size={15} /> Supprimer le blocage
              </button>
            </div>
          )}
        </div>
      )}

      {/* Task Form Modal */}
      {taskForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }} onClick={() => setTaskForm(f => ({ ...f, open: false }))}>
          <div className="bg-white rounded-[22px] shadow-2xl p-6 w-full max-w-md" style={{ border: "1px solid rgba(18,26,46,0.1)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold" style={{ color: "#121A2E" }}>{taskForm.mode === "create" ? "Nouvelle tâche" : "Modifier la tâche"}</h3>
              <button onClick={() => setTaskForm(f => ({ ...f, open: false }))} className="p-1 rounded-full hover:bg-gray-100 transition-colors"><X size={16} style={{ color: "rgba(18,26,46,0.5)" }} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(18,26,46,0.5)" }}>Titre</label>
                <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                  style={{ borderColor: "rgba(18,26,46,0.12)" }} placeholder="Nom de la tâche" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(18,26,46,0.5)" }}>Date</label>
                  <input type="date" value={taskForm.date} onChange={e => setTaskForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                    style={{ borderColor: "rgba(18,26,46,0.12)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(18,26,46,0.5)" }}>Importance</label>
                  <div className="flex gap-1">
                    {IMPORTANCE_LEVELS.map((level, i) => (
                      <button key={i} onClick={() => setTaskForm(f => ({ ...f, importance: i + 1 }))}
                        className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-all"
                        style={{
                          background: taskForm.importance === i + 1 ? level.color : level.bg,
                          color: taskForm.importance === i + 1 ? "#fff" : level.color,
                          border: `1px solid ${taskForm.importance === i + 1 ? level.color : level.color + "30"}`,
                        }}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(18,26,46,0.5)" }}>Début</label>
                  <input type="time" value={taskForm.startTime} onChange={e => {
                    const st = e.target.value;
                    setTaskForm(f => ({ ...f, startTime: st, endTime: addMins(st, f.durationMinutes) }));
                  }} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                    style={{ borderColor: "rgba(18,26,46,0.12)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(18,26,46,0.5)" }}>Fin</label>
                  <input type="time" value={taskForm.endTime} onChange={e => {
                    const et = e.target.value;
                    const dur = Math.max(15, timeToMinutes(et) - timeToMinutes(taskForm.startTime));
                    setTaskForm(f => ({ ...f, endTime: et, durationMinutes: dur }));
                  }} className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                    style={{ borderColor: "rgba(18,26,46,0.12)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(18,26,46,0.5)" }}>Durée : {taskForm.durationMinutes} min</label>
                <input type="range" min={15} max={240} step={15} value={taskForm.durationMinutes}
                  onChange={e => {
                    const dur = parseInt(e.target.value);
                    setTaskForm(f => ({ ...f, durationMinutes: dur, endTime: addMins(f.startTime, dur) }));
                  }}
                  className="w-full" style={{ accentColor: "#0147FF" }} />
              </div>
              <button onClick={saveTask}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-full transition-colors hover:opacity-90"
                style={{ background: "#121A2E" }}>
                {taskForm.mode === "create" ? "Créer la tâche" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Form Modal */}
      {slotForm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }} onClick={() => setSlotForm(f => ({ ...f, open: false }))}>
          <div className="bg-white rounded-[22px] shadow-2xl p-6 w-full max-w-md" style={{ border: "1px solid rgba(18,26,46,0.1)" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold" style={{ color: "#121A2E" }}>{slotForm.mode === "create" ? "Bloquer un créneau" : "Modifier le blocage"}</h3>
              <button onClick={() => setSlotForm(f => ({ ...f, open: false }))} className="p-1 rounded-full hover:bg-gray-100 transition-colors"><X size={16} style={{ color: "rgba(18,26,46,0.5)" }} /></button>
            </div>
            <div className="space-y-4">
              <input value={slotForm.title} onChange={e => setSlotForm(f => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                style={{ borderColor: "rgba(18,26,46,0.12)" }} placeholder="Titre" />
              <div className="grid grid-cols-3 gap-3">
                <input type="date" value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                  style={{ borderColor: "rgba(18,26,46,0.12)" }} />
                <input type="time" value={slotForm.startTime} onChange={e => setSlotForm(f => ({ ...f, startTime: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                  style={{ borderColor: "rgba(18,26,46,0.12)" }} />
                <input type="time" value={slotForm.endTime} onChange={e => setSlotForm(f => ({ ...f, endTime: e.target.value }))}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-gray-400 transition-colors"
                  style={{ borderColor: "rgba(18,26,46,0.12)" }} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium" style={{ color: "rgba(18,26,46,0.5)" }}>Couleur</label>
                <input type="color" value={slotForm.color} onChange={e => setSlotForm(f => ({ ...f, color: e.target.value }))}
                  className="w-10 h-10 rounded-lg cursor-pointer border" style={{ borderColor: "rgba(18,26,46,0.12)" }} />
              </div>
              <button onClick={saveSlot}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-full transition-colors hover:opacity-90"
                style={{ background: "#ef4444" }}>
                {slotForm.mode === "create" ? "Bloquer" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs mt-3 text-center" style={{ color: "rgba(18,26,46,0.4)" }}>
        Clic gauche pour déplacer · clic droit pour les actions · tirez le bas pour redimensionner
      </p>
    </div>
  );
}
