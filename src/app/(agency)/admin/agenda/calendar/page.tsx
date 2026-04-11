"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Lock } from "lucide-react";
import type { AgendaTask, AgendaBlockedSlot } from "@/types/agenda";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7h-19h
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getWeekDates(baseDate: Date): Date[] {
  const day = baseDate.getDay();
  const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(baseDate);
  monday.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function timeToRow(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h - 7) * 2 + Math.floor(m / 30);
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<AgendaTask[]>([]);
  const [slots, setSlots] = useState<AgendaBlockedSlot[]>([]);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedHour, setSelectedHour] = useState("");

  const [slotForm, setSlotForm] = useState({
    title: "", date: "", start_time: "", end_time: "", color: "#ef4444", recurrence: "none",
  });
  const [taskForm, setTaskForm] = useState({
    title: "", importance: 3, duration_minutes: 30,
  });

  const weekDates = getWeekDates(currentDate);
  const weekStart = toDateStr(weekDates[0]);
  const weekEnd = toDateStr(weekDates[6]);

  useEffect(() => {
    load();
  }, [weekStart, weekEnd]);

  async function load() {
    const [tasksRes, slotsRes] = await Promise.all([
      fetch(`/api/agenda/tasks?week_start=${weekStart}&week_end=${weekEnd}`).then(r => r.json()),
      fetch(`/api/agenda/blocked-slots?week_start=${weekStart}&week_end=${weekEnd}`).then(r => r.json()),
    ]);
    setTasks(tasksRes.tasks ?? []);
    setSlots(slotsRes.slots ?? []);
  }

  async function handleCreateSlot() {
    if (!slotForm.title || !slotForm.date || !slotForm.start_time || !slotForm.end_time) return;
    const res = await fetch("/api/agenda/blocked-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slotForm),
    });
    const data = await res.json();
    if (data.slot) {
      setSlots(prev => [...prev, data.slot]);
      setShowSlotForm(false);
      setSlotForm({ title: "", date: "", start_time: "", end_time: "", color: "#ef4444", recurrence: "none" });
    }
  }

  async function handleCreateTask() {
    if (!taskForm.title || !selectedDate) return;
    const payload = {
      title: taskForm.title,
      date: selectedDate,
      start_time: selectedHour || null,
      end_time: selectedHour ? addMinutes(selectedHour, taskForm.duration_minutes) : null,
      duration_minutes: taskForm.duration_minutes,
      importance: taskForm.importance,
      status: "todo",
    };
    const res = await fetch("/api/agenda/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.task) {
      setTasks(prev => [...prev, data.task]);
      setShowTaskForm(false);
      setTaskForm({ title: "", importance: 3, duration_minutes: 30 });
    }
  }

  async function handleDeleteSlot(id: string) {
    await fetch(`/api/agenda/blocked-slots/${id}`, { method: "DELETE" });
    setSlots(prev => prev.filter(s => s.id !== id));
  }

  function handleCellClick(date: string, hour: number) {
    setSelectedDate(date);
    setSelectedHour(`${String(hour).padStart(2, "0")}:00`);
    setShowTaskForm(true);
  }

  const weekLabel = `${weekDates[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${weekDates[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="p-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
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
        <button
          onClick={() => { setSlotForm(f => ({ ...f, date: toDateStr(weekDates[0]) })); setShowSlotForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100"
        >
          <Lock size={13} />
          Bloquer créneau
        </button>
      </div>

      {/* Slot form */}
      {showSlotForm && (
        <div className="bg-white border border-red-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex justify-between mb-3">
            <h3 className="font-medium text-gray-800">Bloquer un créneau</h3>
            <button onClick={() => setShowSlotForm(false)}><X size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-xs text-gray-500 mb-1">Titre</label>
              <input value={slotForm.title} onChange={e => setSlotForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" placeholder="Réunion, Déjeuner..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">De - À</label>
              <div className="flex gap-1">
                <input type="time" value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs" />
                <input type="time" value={slotForm.end_time} onChange={e => setSlotForm(f => ({ ...f, end_time: e.target.value }))} className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Couleur</label>
              <input type="color" value={slotForm.color} onChange={e => setSlotForm(f => ({ ...f, color: e.target.value }))} className="w-full h-9 border border-gray-200 rounded cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Récurrence</label>
              <select value={slotForm.recurrence} onChange={e => setSlotForm(f => ({ ...f, recurrence: e.target.value }))} className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm">
                <option value="none">Aucune</option>
                <option value="daily">Quotidienne</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuelle</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowSlotForm(false)} className="px-3 py-1.5 text-sm text-gray-500">Annuler</button>
            <button onClick={handleCreateSlot} className="px-3 py-1.5 bg-red-500 text-white rounded text-sm">Bloquer</button>
          </div>
        </div>
      )}

      {/* Task quick-add */}
      {showTaskForm && (
        <div className="bg-white border border-indigo-200 rounded-xl p-4 mb-4 shadow-sm">
          <div className="flex justify-between mb-3">
            <h3 className="font-medium text-gray-800">Ajouter une tâche · {selectedDate} {selectedHour && `à ${selectedHour}`}</h3>
            <button onClick={() => setShowTaskForm(false)}><X size={16} /></button>
          </div>
          <div className="flex gap-3">
            <input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm" placeholder="Titre de la tâche" />
            <select value={taskForm.importance} onChange={e => setTaskForm(f => ({ ...f, importance: parseInt(e.target.value) }))} className="border border-gray-200 rounded px-2 py-2 text-sm">
              {[1,2,3,4,5].map(i => <option key={i} value={i}>Imp. {i}</option>)}
            </select>
            <button onClick={handleCreateTask} className="px-3 py-2 bg-indigo-600 text-white rounded text-sm">Créer</button>
          </div>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header row */}
        <div className="grid" style={{ gridTemplateColumns: "60px repeat(7, 1fr)" }}>
          <div className="border-b border-r border-gray-100 p-2" />
          {weekDates.map((date, i) => {
            const isToday = toDateStr(date) === toDateStr(new Date());
            return (
              <div key={i} className={`border-b border-r border-gray-100 p-2 text-center ${isToday ? "bg-indigo-50" : ""}`}>
                <p className="text-xs text-gray-400">{DAYS[i]}</p>
                <p className={`text-sm font-semibold ${isToday ? "text-indigo-600" : "text-gray-700"}`}>
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Time rows */}
        <div className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
          {HOURS.map(hour => (
            <div key={hour} className="grid" style={{ gridTemplateColumns: "60px repeat(7, 1fr)", minHeight: "60px" }}>
              <div className="border-r border-b border-gray-100 px-2 py-1 text-xs text-gray-400 text-right">
                {String(hour).padStart(2, "0")}:00
              </div>
              {weekDates.map((date, di) => {
                const dateStr = toDateStr(date);
                const dayTasks = tasks.filter(t =>
                  t.date === dateStr && t.start_time &&
                  parseInt(t.start_time.split(":")[0]) === hour
                );
                const daySlots = slots.filter(s =>
                  s.date === dateStr &&
                  parseInt(s.start_time.split(":")[0]) === hour
                );
                return (
                  <div
                    key={di}
                    className="border-r border-b border-gray-100 p-0.5 relative cursor-pointer hover:bg-indigo-50/30 transition-colors group"
                    onClick={() => handleCellClick(dateStr, hour)}
                  >
                    <button
                      className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center w-5 h-5 bg-indigo-100 rounded text-indigo-500 hover:bg-indigo-200"
                      onClick={e => { e.stopPropagation(); handleCellClick(dateStr, hour); }}
                    >
                      <Plus size={10} />
                    </button>
                    {daySlots.map(slot => (
                      <div
                        key={slot.id}
                        className="rounded text-xs px-1 py-0.5 mb-0.5 flex items-center justify-between group/slot"
                        style={{ background: slot.color + "30", borderLeft: `3px solid ${slot.color}` }}
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="truncate" style={{ color: slot.color }}>{slot.title}</span>
                        <button
                          onClick={() => handleDeleteSlot(slot.id)}
                          className="hidden group-hover/slot:block text-gray-400 hover:text-red-500"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                    {dayTasks.map(task => (
                      <div
                        key={task.id}
                        className={`rounded text-xs px-1 py-0.5 mb-0.5 truncate ${
                          task.status === "done"
                            ? "bg-green-100 text-green-600 line-through"
                            : "bg-indigo-100 text-indigo-700"
                        }`}
                        onClick={e => e.stopPropagation()}
                      >
                        {task.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
