"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "stage_start" | "stage_end" | "project_start";
  color: string;
  projectId: string;
}

interface Project {
  id: string;
  name: string;
  stages: { id: string; label: string; duration_days: number; completed: boolean }[];
  current_stage_index: number;
  start_date: string | null;
  created_at: string;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function projectToEvents(project: Project): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const startDate = project.start_date ?? project.created_at.split("T")[0];
  const stages = project.stages ?? [];

  if (stages.length === 0) return events;

  let offset = 0;
  stages.forEach((stage, idx) => {
    const stageStart = addDays(startDate, offset);
    const stageEnd = addDays(startDate, offset + stage.duration_days);

    // Start of stage (milestone)
    if (idx === project.current_stage_index && !stage.completed) {
      events.push({
        id: `${project.id}-s-${idx}`,
        title: `${stage.label} — ${project.name}`,
        date: stageStart,
        type: "stage_start",
        color: "bg-indigo-100 text-indigo-700",
        projectId: project.id,
      });
    }
    // End of stage (deadline)
    events.push({
      id: `${project.id}-e-${idx}`,
      title: `Fin ${stage.label} — ${project.name}`,
      date: stageEnd,
      type: "stage_end",
      color: stage.completed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
      projectId: project.id,
    });

    offset += stage.duration_days;
  });

  return events;
}

export default function AdminCalendarPage() {
  const today = new Date();
  const [currentYear, setCurrentYear]   = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [events, setEvents]             = useState<CalendarEvent[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        const allEvents = (d.projects ?? []).flatMap(projectToEvents);
        setEvents(allEvents);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.date === dateStr);
  };

  const upcomingEvents = events
    .filter((e) => e.date >= today.toISOString().split("T")[0])
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendrier</h1>
          <p className="text-gray-500 mt-1">Étapes et deadlines de vos projets</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full font-medium">
            <span className="w-2 h-2 bg-indigo-400 rounded-full" /> Étape en cours
          </span>
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full font-medium">
            <span className="w-2 h-2 bg-red-400 rounded-full" /> Fin d&apos;étape
          </span>
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-green-50 text-green-600 rounded-full font-medium">
            <span className="w-2 h-2 bg-green-400 rounded-full" /> Étape validée
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-500" size={28} /></div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft size={18} />
              </button>
              <h2 className="font-semibold text-gray-900">{MONTHS[currentMonth]} {currentYear}</h2>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Days header */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {DAYS.map((day) => (
                <div key={day} className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7">
              {cells.map((day, index) => {
                const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                const dayEvents = day ? getEventsForDay(day) : [];
                return (
                  <div
                    key={index}
                    className={`min-h-24 p-2 border-r border-b border-gray-100 ${day ? "hover:bg-gray-50 transition-colors" : "bg-gray-50"} ${index % 7 === 6 ? "border-r-0" : ""}`}
                  >
                    {day && (
                      <>
                        <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1 ${isToday ? "bg-indigo-600 text-white font-bold" : "text-gray-700 font-medium"}`}>
                          {day}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 2).map((event) => (
                            <Link key={event.id} href={`/admin/projects/${event.projectId}`}>
                              <div className={`text-xs px-1.5 py-0.5 rounded truncate font-medium cursor-pointer hover:opacity-80 ${event.color}`} title={event.title}>
                                {event.title}
                              </div>
                            </Link>
                          ))}
                          {dayEvents.length > 2 && (
                            <p className="text-xs text-gray-400 px-1">+{dayEvents.length - 2} autres</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming events */}
          <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar size={16} />
              Prochaines échéances
            </h2>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucune échéance à venir. Créez des projets avec des prestations pour voir les étapes ici.</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Link key={event.id} href={`/admin/projects/${event.projectId}`} className="flex items-center gap-4 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors">
                    <div className="text-center w-12 shrink-0">
                      <p className="text-xs text-gray-400 uppercase">{MONTHS[parseInt(event.date.split("-")[1]) - 1].slice(0, 3)}</p>
                      <p className="text-xl font-bold text-gray-900 leading-none">{parseInt(event.date.split("-")[2])}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${event.color}`}>
                        {event.type === "stage_start" ? "Début d'étape" : event.type === "stage_end" ? "Fin d'étape" : "Démarrage"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
