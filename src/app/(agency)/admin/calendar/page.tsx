"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

interface EventColors { bg: string; text: string; }

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "stage_start" | "stage_end" | "project_start";
  colors: EventColors;
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

    if (idx === project.current_stage_index && !stage.completed) {
      events.push({
        id: `${project.id}-s-${idx}`,
        title: `${stage.label} — ${project.name}`,
        date: stageStart,
        type: "stage_start",
        colors: { bg: "#e8edff", text: "#0147ff" },
        projectId: project.id,
      });
    }
    events.push({
      id: `${project.id}-e-${idx}`,
      title: `Fin ${stage.label} — ${project.name}`,
      date: stageEnd,
      type: "stage_end",
      colors: stage.completed
        ? { bg: "#d1fae5", text: "#168b64" }
        : { bg: "#fee6d0", text: "#663b12" },
      projectId: project.id,
    });

    offset += stage.duration_days;
  });

  return events;
}

export default function AdminCalendarPage() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

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

  const cardStyle = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.13)",
    borderRadius: 13,
    boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
    overflow: "hidden",
  };

  return (
    <div style={{ padding: 32, background: "#fbfbfb", minHeight: "100vh", ...jakartaSans }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.5px", margin: 0 }}>Calendrier</h1>
          <p style={{ color: "rgba(18,26,46,0.5)", marginTop: 4, fontSize: 14, margin: "4px 0 0" }}>Étapes et deadlines de vos projets</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 10px", background: "#e8edff", color: "#0147ff", borderRadius: 20, fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, background: "#0147ff", borderRadius: "50%", display: "inline-block" }} /> Étape en cours
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 10px", background: "#fee6d0", color: "#663b12", borderRadius: 20, fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, background: "#d97706", borderRadius: "50%", display: "inline-block" }} /> Fin d&apos;étape
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 10px", background: "#d1fae5", color: "#168b64", borderRadius: 20, fontWeight: 500 }}>
            <span style={{ width: 8, height: 8, background: "#168b64", borderRadius: "50%", display: "inline-block" }} /> Étape validée
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <Loader2 size={28} style={{ color: "#0147ff", animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          {/* Calendar card */}
          <div style={cardStyle}>
            {/* Month navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <button onClick={prevMonth} style={{ padding: 8, background: "none", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronLeft size={18} style={{ color: "#121a2e" }} />
              </button>
              <h2 style={{ fontWeight: 700, color: "#121a2e", fontSize: 16, margin: 0, letterSpacing: "-0.3px" }}>{MONTHS[currentMonth]} {currentYear}</h2>
              <button onClick={nextMonth} style={{ padding: 8, background: "none", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChevronRight size={18} style={{ color: "#121a2e" }} />
              </button>
            </div>

            {/* Days header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              {DAYS.map((day) => (
                <div key={day} style={{ padding: "12px 0", textAlign: "center", fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {cells.map((day, index) => {
                const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                const dayEvents = day ? getEventsForDay(day) : [];
                const isLastInRow = index % 7 === 6;
                return (
                  <div
                    key={index}
                    style={{
                      minHeight: 96,
                      padding: 8,
                      borderRight: isLastInRow ? "none" : "1px solid rgba(0,0,0,0.05)",
                      borderBottom: "1px solid rgba(0,0,0,0.05)",
                      background: day ? "#fff" : "#fbfbfb",
                    }}
                  >
                    {day && (
                      <>
                        <div style={{
                          width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                          borderRadius: "50%", fontSize: 13, marginBottom: 4,
                          background: isToday ? "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)" : "transparent",
                          color: isToday ? "#fff" : "#121a2e",
                          fontWeight: isToday ? 700 : 500,
                        }}>
                          {day}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {dayEvents.slice(0, 2).map((event) => (
                            <Link key={event.id} href={`/admin/projects/${event.projectId}`}>
                              <div style={{
                                fontSize: 11, padding: "2px 6px", borderRadius: 5,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                fontWeight: 500, background: event.colors.bg, color: event.colors.text,
                                cursor: "pointer",
                              }} title={event.title}>
                                {event.title}
                              </div>
                            </Link>
                          ))}
                          {dayEvents.length > 2 && (
                            <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", padding: "0 4px", margin: 0 }}>+{dayEvents.length - 2} autres</p>
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
          <div style={{ ...cardStyle, marginTop: 24, padding: 24 }}>
            <h2 style={{ fontWeight: 700, color: "#121a2e", fontSize: 15, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.3px" }}>
              <Calendar size={16} style={{ color: "#0147ff" }} />
              Prochaines échéances
            </h2>
            {upcomingEvents.length === 0 ? (
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)", textAlign: "center", padding: "24px 0", margin: 0 }}>
                Aucune échéance à venir. Créez des projets avec des prestations pour voir les étapes ici.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {upcomingEvents.map((event) => (
                  <Link key={event.id} href={`/admin/projects/${event.projectId}`} style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px", borderRadius: 9, textDecoration: "none" }}>
                    <div style={{ textAlign: "center", width: 48, flexShrink: 0 }}>
                      <p style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", textTransform: "uppercase", margin: 0 }}>{MONTHS[parseInt(event.date.split("-")[1]) - 1].slice(0, 3)}</p>
                      <p style={{ fontSize: 22, fontWeight: 700, color: "#121a2e", lineHeight: 1, margin: "2px 0 0" }}>{parseInt(event.date.split("-")[2])}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#121a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{event.title}</p>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 500, background: event.colors.bg, color: event.colors.text, display: "inline-block", marginTop: 4 }}>
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
