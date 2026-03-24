"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "deadline" | "milestone" | "meeting";
  color: string;
}

const mockEvents: CalendarEvent[] = [
  { id: "e1", title: "Deadline — Site web XYZ", date: "2026-03-28", type: "deadline", color: "bg-red-100 text-red-700" },
  { id: "e2", title: "Design V2 — Brand Co", date: "2026-03-25", type: "milestone", color: "bg-indigo-100 text-indigo-700" },
  { id: "e3", title: "Call client — TechStart", date: "2026-03-24", type: "meeting", color: "bg-green-100 text-green-700" },
  { id: "e4", title: "Deadline — Brand Co", date: "2026-03-30", type: "deadline", color: "bg-red-100 text-red-700" },
  { id: "e5", title: "Livraison finale — AM Consulting", date: "2026-04-10", type: "milestone", color: "bg-purple-100 text-purple-700" },
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export default function AdminCalendarPage() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else setCurrentMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else setCurrentMonth((m) => m + 1);
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return mockEvents.filter((e) => e.date === dateStr);
  };

  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendrier</h1>
          <p className="text-gray-500 mt-1">Deadlines et jalons de vos projets</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-full font-medium">
            <span className="w-2 h-2 bg-red-400 rounded-full" /> Deadline
          </span>
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded-full font-medium">
            <span className="w-2 h-2 bg-indigo-400 rounded-full" /> Jalon
          </span>
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 bg-green-50 text-green-600 rounded-full font-medium">
            <span className="w-2 h-2 bg-green-400 rounded-full" /> Réunion
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={18} />
          </button>
          <h2 className="font-semibold text-gray-900">
            {MONTHS[currentMonth]} {currentYear}
          </h2>
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
            const isToday =
              day === today.getDate() &&
              currentMonth === today.getMonth() &&
              currentYear === today.getFullYear();
            const events = day ? getEventsForDay(day) : [];

            return (
              <div
                key={index}
                className={`min-h-24 p-2 border-r border-b border-gray-100 ${
                  day ? "hover:bg-gray-50 transition-colors" : "bg-gray-50"
                } ${index % 7 === 6 ? "border-r-0" : ""}`}
              >
                {day && (
                  <>
                    <div
                      className={`w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1 ${
                        isToday
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-gray-700 font-medium"
                      }`}
                    >
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {events.map((event) => (
                        <div
                          key={event.id}
                          className={`text-xs px-1.5 py-0.5 rounded truncate font-medium ${event.color}`}
                          title={event.title}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming events list */}
      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar size={16} />
          Prochains événements
        </h2>
        <div className="space-y-3">
          {mockEvents
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((event) => (
              <div key={event.id} className="flex items-center gap-4">
                <div className="text-center w-12">
                  <p className="text-xs text-gray-400 uppercase">
                    {MONTHS[parseInt(event.date.split("-")[1]) - 1].slice(0, 3)}
                  </p>
                  <p className="text-xl font-bold text-gray-900 leading-none">
                    {parseInt(event.date.split("-")[2])}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{event.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${event.color}`}>
                    {event.type === "deadline" ? "Deadline" : event.type === "milestone" ? "Jalon" : "Réunion"}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
