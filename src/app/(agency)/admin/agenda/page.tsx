"use client";

import ClientBlueButton from "@/components/shared/ClientBlueButton";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { calculateDayScore } from "@/lib/agenda/points";
import type { AgendaHabit, AgendaTask } from "@/types/agenda";
import { Calendar, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Plus, Star, Target, Timer } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

type PeriodKey = "week" | "month" | "twoMonths" | "threeMonths" | "year";

interface DashboardData {
  todayTasks: AgendaTask[];
  habits: (AgendaHabit & { done_today: boolean })[];
  recentRecap?: { day_score: number; recap_date: string; mood?: string };
}

interface HabitLog {
  habit_id: string;
  logged_date: string;
}

interface RecapData {
  recap_date: string;
  day_score: number;
  tasks_completed: number;
  tasks_planned?: number;
  habits_done: number;
  mood?: string;
}

interface StatsData {
  monthlyData: Record<string, { done: number; total: number; score: number }>;
  habitLogs: HabitLog[];
  recaps: RecapData[];
}

const cardShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";
const panelShadow = "0px 10px 24px rgba(18,26,46,0.035)";
const softBorder = "1px solid rgba(18,26,46,0.12)";
const blue = "#0147ff";
const jk = '"Plus Jakarta Sans", sans-serif';

const periodOptions: Array<{ key: PeriodKey; label: string; days: number }> = [
  { key: "week", label: "Cette semaine", days: 7 },
  { key: "month", label: "Ce mois", days: 30 },
  { key: "twoMonths", label: "2 mois", days: 60 },
  { key: "threeMonths", label: "3 mois", days: 90 },
  { key: "year", label: "Annee entiere", days: 365 },
];

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#fbfbfb",
  padding: "34px 48px 42px",
  color: "#121a2e",
};

const panelStyle: CSSProperties = {
  background: "#fff",
  border: softBorder,
  borderRadius: 12,
  boxShadow: panelShadow,
};

function formatDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function getMonthDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => new Date(year, month, index + 1, 12));
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }).replace(".", "");
}

function getPeriodDates(periodKey: PeriodKey) {
  const option = periodOptions.find((item) => item.key === periodKey) ?? periodOptions[1];
  const today = new Date();
  return Array.from({ length: option.days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (option.days - 1 - index));
    return date;
  });
}

function getMoodColor(mood?: string) {
  const normalized = (mood ?? "").toLowerCase();
  if (normalized === "exhausted") return "#ff5a61";
  if (normalized === "hard") return "#ff8b5b";
  if (normalized === "okay") return "#ffc957";
  if (normalized === "good") return "#93d95e";
  if (normalized === "excellent") return "#4dc84a";
  return "#f1f1f1";
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

export default function AgendaDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodKey, setPeriodKey] = useState<PeriodKey>("month");
  const [habitFilter, setHabitFilter] = useState("");
  const [openMenu, setOpenMenu] = useState<"period" | "habit" | null>(null);
  const [moodMonth, setMoodMonth] = useState(() => new Date());
  const [scoreMonth, setScoreMonth] = useState(() => new Date());
  const [completionMonth, setCompletionMonth] = useState(() => new Date());

  const today = formatDateKey(new Date());

  useEffect(() => {
    async function load() {
      try {
        const [tasksRes, habitsRes, recapRes, statsRes] = await Promise.all([
          agendaFetch(`/api/agenda/tasks?date=${today}`).then((response) => response.json()),
          agendaFetch("/api/agenda/habits").then((response) => response.json()),
          agendaFetch(`/api/agenda/recap?date=${today}`).then((response) => response.json()),
          agendaFetch("/api/agenda/stats").then((response) => response.json()).catch(() => null),
        ]);

        setData({
          todayTasks: tasksRes.tasks ?? [],
          habits: habitsRes.habits ?? [],
          recentRecap: recapRes.recap
            ? {
                day_score: recapRes.recap.day_score,
                recap_date: recapRes.recap.recap_date,
                mood: recapRes.recap.mood,
              }
            : undefined,
        });

        if (statsRes && !statsRes.error) {
          setStats({
            monthlyData: statsRes.monthlyData ?? {},
            habitLogs: statsRes.habitLogs ?? [],
            recaps: statsRes.recaps ?? [],
          });
        }
        if ((habitsRes.habits ?? []).length > 0) {
          setHabitFilter((current) => current || habitsRes.habits[0].id);
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [today]);

  const doneTasks = data?.todayTasks.filter((task) => task.status === "done").length ?? 0;
  const totalTasks = data?.todayTasks.length ?? 0;
  const doneHabits = data?.habits.filter((habit) => habit.done_today).length ?? 0;
  const totalHabits = data?.habits.length ?? 0;
  const currentDayScore = data?.recentRecap?.day_score ?? calculateDayScore(doneTasks, totalTasks, doneHabits, totalHabits);
  const bestStreak = Math.max(...(data?.habits.map((habit) => habit.streak_current) ?? [0]), 0);

  const periodSeries = useMemo(() => {
    const dates = getPeriodDates(periodKey);
    const logSet = new Set((stats?.habitLogs ?? []).filter((log) => log.habit_id === habitFilter).map((log) => log.logged_date));
    return dates.map((date, index) => {
      const key = formatDateKey(date);
      const score = habitFilter ? (logSet.has(key) ? 100 : 0) : 0;
      return { date, key, score };
    });
  }, [periodKey, stats, habitFilter]);

  const selectedPeriodLabel = periodOptions.find((option) => option.key === periodKey)?.label ?? "Ce mois";
  const selectedHabitLabel = data?.habits.find((habit) => habit.id === habitFilter)?.title ?? "Habitude";

  if (loading) {
    return (
      <div style={pageStyle}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "rgba(18,26,46,0.55)" }}>Chargement...</p>
      </div>
    );
  }

  return (
    <main className="agenda-dashboard-page" style={pageStyle} onClick={() => setOpenMenu(null)}>
      <div className="agenda-dashboard-container" style={{ maxWidth: 1110, margin: "0 auto" }}>
        <header className="agenda-dashboard-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, paddingBottom: 28, borderBottom: "1px solid rgba(18,26,46,0.08)" }}>
          <h1 style={{ margin: 0, fontFamily: jk, fontSize: 26, lineHeight: "32px", fontWeight: 700, letterSpacing: "-0.45px" }}>
            Centre d&apos;activit&eacute;
          </h1>
          <Link href="/admin/agenda/tasks" style={{ textDecoration: "none" }}>
            <ClientBlueButton wrapperStyle={{ width: "auto" }} style={{ minHeight: 48, padding: "0 22px", fontSize: 14 }} icon={<Plus size={16} />}>
              Ajouter une t&acirc;che
            </ClientBlueButton>
          </Link>
        </header>

        <section className="agenda-dashboard-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginTop: 28 }}>
          <DashboardMetricCard icon={<CheckSquare size={17} />} value={`${doneTasks}/${totalTasks}`} label="Taches realisees" />
          <DashboardMetricCard icon={<Timer size={17} />} value={`${doneHabits}/${totalHabits}`} label="Habitudes completees" />
          <DashboardMetricCard icon={<Star size={17} />} value={`${currentDayScore}/100`} label="Score de journee" />
          <DashboardMetricCard icon={<Target size={17} />} value={`${bestStreak}j`} label="Meilleure serie" />
        </section>

        <section className="agenda-dashboard-main-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 304px", gap: 16, marginTop: 18 }}>
          <article className="agenda-dashboard-card agenda-dashboard-chart-card" style={{ ...panelStyle, minHeight: 388, padding: "18px 24px 24px", boxSizing: "border-box" }}>
            <div className="agenda-dashboard-card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
              <h2 style={{ margin: 0, fontFamily: jk, fontSize: 16, lineHeight: "22px", fontWeight: 700, letterSpacing: "-0.25px" }}>
                Evolution du score par habitude
              </h2>
              <div className="agenda-dashboard-filters" style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }} onClick={(event) => event.stopPropagation()}>
                <FilterTag icon={<Calendar size={15} />} label={selectedPeriodLabel} active={openMenu === "period"} onClick={() => setOpenMenu(openMenu === "period" ? null : "period")} />
                <FilterTag label={selectedHabitLabel} active={openMenu === "habit"} onClick={() => setOpenMenu(openMenu === "habit" ? null : "habit")} />
                {openMenu === "period" ? (
                  <Dropdown right={154}>
                    {periodOptions.map((option) => (
                      <DropdownItem key={option.key} active={periodKey === option.key} onClick={() => { setPeriodKey(option.key); setOpenMenu(null); }}>
                        {option.label}
                      </DropdownItem>
                    ))}
                  </Dropdown>
                ) : null}
                {openMenu === "habit" ? (
                  <Dropdown right={0}>
                    {(data?.habits ?? []).map((habit) => (
                      <DropdownItem key={habit.id} active={habitFilter === habit.id} onClick={() => { setHabitFilter(habit.id); setOpenMenu(null); }}>
                        {habit.title}
                      </DropdownItem>
                    ))}
                  </Dropdown>
                ) : null}
              </div>
            </div>
            <div style={{ height: 1, background: "rgba(18,26,46,0.06)", marginTop: 20 }} />
            <ScoreAreaChart data={periodSeries} />
          </article>

          <article className="agenda-dashboard-card" style={{ ...panelStyle, minHeight: 388, padding: "24px 24px 22px", boxSizing: "border-box" }}>
            <PanelTitleWithMonth title="Niveau d'humeur" month={moodMonth} onPrev={() => setMoodMonth((current) => addMonths(current, -1))} onNext={() => setMoodMonth((current) => addMonths(current, 1))} />
            <MoodHeatmap month={moodMonth} stats={stats} />
          </article>
        </section>

        <section className="agenda-dashboard-secondary-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16, marginTop: 18 }}>
          <article className="agenda-dashboard-card" style={{ ...panelStyle, minHeight: 304, padding: "24px 24px 22px", boxSizing: "border-box" }}>
            <PanelTitleWithMonth title="Evolution du score" month={scoreMonth} onPrev={() => setScoreMonth((current) => addMonths(current, -1))} onNext={() => setScoreMonth((current) => addMonths(current, 1))} />
            <MiniScoreChart month={scoreMonth} stats={stats} currentDayScore={currentDayScore} />
          </article>
          <article className="agenda-dashboard-card" style={{ ...panelStyle, minHeight: 304, padding: "24px 24px 22px", boxSizing: "border-box" }}>
            <PanelTitleWithMonth title="Completion des taches" month={completionMonth} onPrev={() => setCompletionMonth((current) => addMonths(current, -1))} onNext={() => setCompletionMonth((current) => addMonths(current, 1))} />
            <TaskCompletionBars month={completionMonth} stats={stats} />
          </article>
        </section>
      </div>
    </main>
  );
}

function DashboardMetricCard({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <article style={{ minHeight: 160, borderRadius: 18, border: softBorder, background: "#fff", boxShadow: cardShadow, padding: "24px 24px", boxSizing: "border-box" }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, background: "#ececec", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(18,26,46,0.28)", marginBottom: 18 }}>
        {icon}
      </div>
      <strong style={{ display: "block", fontFamily: jk, fontSize: 28, lineHeight: "32px", fontWeight: 700, letterSpacing: "-0.5px", color: "#121a2e" }}>
        {value}
      </strong>
      <span style={{ display: "block", marginTop: 8, fontFamily: jk, fontSize: 13, lineHeight: "18px", fontWeight: 700, color: "rgba(18,26,46,0.56)" }}>
        {label}
      </span>
    </article>
  );
}

function FilterTag({ icon, label, active, onClick }: { icon?: ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className="agenda-filter-tag"
      type="button"
      onClick={onClick}
      style={{
        minHeight: 36,
        borderRadius: 8,
        border: active ? "1px solid rgba(1,71,255,0.28)" : "1px solid rgba(18,26,46,0.12)",
        background: "#fff",
        boxShadow: "0px 4px 8px rgba(18,26,46,0.03)",
        padding: "0 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        fontWeight: 700,
        color: "rgba(18,26,46,0.7)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
      <ChevronDown size={15} />
    </button>
  );
}

function Dropdown({ children, right }: { children: ReactNode; right: number }) {
  return (
    <div className="agenda-dropdown" style={{ position: "absolute", top: 44, right, zIndex: 10, minWidth: 190, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 14, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(14px)", boxShadow: "0 18px 38px rgba(18,26,46,0.12)", padding: 6 }}>
      {children}
    </div>
  );
}

function DropdownItem({ children, active, onClick }: { children: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: "100%", border: 0, borderRadius: 10, background: active ? "rgba(0,0,0,0.04)" : "transparent", padding: "10px 11px", textAlign: "left", fontSize: 13, fontWeight: 700, color: "rgba(18,26,46,0.78)", cursor: "pointer" }}>
      {children}
    </button>
  );
}

function ScoreAreaChart({ data }: { data: Array<{ date: Date; key: string; score: number }> }) {
  const width = 920;
  const chartLeft = 42;
  const chartRight = 900;
  const chartTop = 32;
  const chartBottom = 232;
  const maxValue = 100;
  const points = data.map((item, index) => {
    const x = chartLeft + (index / Math.max(data.length - 1, 1)) * (chartRight - chartLeft);
    const y = chartBottom - (Math.min(maxValue, Math.max(0, item.score)) / maxValue) * (chartBottom - chartTop);
    return { x, y };
  });
  const linePath = buildSmoothPath(points);
  const areaPath = points.length > 0 ? `${linePath} L ${points[points.length - 1].x} ${chartBottom} L ${points[0].x} ${chartBottom} Z` : "";
  const labelIndexes = Array.from(new Set([0, Math.floor(data.length * 0.25), Math.floor(data.length * 0.5), Math.floor(data.length * 0.75), data.length - 1])).filter((index) => index >= 0);
  const toPercentX = (x: number) => `${(x / width) * 100}%`;
  const toPercentY = (y: number) => `${(y / 285) * 100}%`;

  return (
    <div className="agenda-score-chart" style={{ position: "relative", width: "100%", height: 300, marginTop: 12 }}>
      <svg viewBox={`0 0 ${width} 285`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}>
        <defs>
          <linearGradient id="agendaScoreFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7d9fff" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#7d9fff" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        {[100, 80, 60, 40, 20, 0].map((value) => {
          const y = chartBottom - (value / maxValue) * (chartBottom - chartTop);
          return value > 0 ? <line key={value} x1={chartLeft} x2={chartRight} y1={y} y2={y} stroke="rgba(18,26,46,0.04)" strokeWidth="1" /> : null;
        })}
        {areaPath ? <path d={areaPath} fill="url(#agendaScoreFill)" /> : null}
        {linePath ? <path d={linePath} fill="none" stroke="#7b9cff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
      </svg>
      {[100, 80, 60, 40, 20, 0].map((value) => {
        const y = chartBottom - (value / maxValue) * (chartBottom - chartTop);
        return (
          <span key={value} style={{ position: "absolute", left: 0, top: `calc(${toPercentY(y)} - 11px)`, width: 48, fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(18,26,46,0.58)", lineHeight: "22px", whiteSpace: "nowrap", fontStretch: "normal", transform: "none" }}>
            {value === 0 ? "0" : `${value}%`}
          </span>
        );
      })}
      {labelIndexes.map((index) => {
        const item = data[index];
        const x = chartLeft + (index / Math.max(data.length - 1, 1)) * (chartRight - chartLeft);
        return (
          <span key={index} style={{ position: "absolute", left: toPercentX(x), bottom: 0, width: 78, transform: "translateX(-34px)", fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 600, color: "rgba(18,26,46,0.58)", lineHeight: "22px", whiteSpace: "nowrap", fontStretch: "normal" }}>
            {formatShortDate(item.date)}
          </span>
        );
      })}
    </div>
  );
}

function PanelTitleWithMonth({ title, month, onPrev, onNext }: { title: string; month: Date; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="agenda-panel-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: 16, borderBottom: "1px solid rgba(18,26,46,0.08)" }}>
      <h2 style={{ margin: 0, fontFamily: jk, fontSize: 16, lineHeight: "22px", fontWeight: 700, letterSpacing: "-0.25px" }}>{title}</h2>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#121a2e", textTransform: "capitalize" }}>
          {month.toLocaleDateString("fr-FR", { month: "long" })}
        </span>
        <MonthButton ariaLabel="Mois precedent" onClick={onPrev}><ChevronLeft size={13} /></MonthButton>
        <MonthButton ariaLabel="Mois suivant" onClick={onNext}><ChevronRight size={13} /></MonthButton>
      </div>
    </div>
  );
}

function MoodHeatmap({ month, stats }: { month: Date; stats: StatsData | null }) {
  const todayKey = formatDateKey(new Date());
  const days = getMonthDays(month);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 7, paddingTop: 18 }}>
      {days.map((date) => {
        const key = formatDateKey(date);
        const recap = stats?.recaps.find((item) => item.recap_date === key);
        const isToday = key === todayKey;
        return (
          <span
            key={key}
            title={key}
            style={{
              aspectRatio: "1 / 1",
              minHeight: 30,
              borderRadius: 4,
              background: getMoodColor(recap?.mood),
              border: isToday ? "1px solid rgba(0,0,0,0.3)" : "1px solid transparent",
              boxShadow: recap?.mood ? "inset 0 0 0 1px rgba(0,0,0,0.04)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

function MiniScoreChart({ month, stats, currentDayScore }: { month: Date; stats: StatsData | null; currentDayScore: number }) {
  const days = getMonthDays(month).map((date) => {
    const key = formatDateKey(date);
    const score = stats?.monthlyData?.[key]?.score ?? stats?.recaps.find((recap) => recap.recap_date === key)?.day_score ?? (key === formatDateKey(new Date()) ? currentDayScore : 0);
    return { date, key, score };
  });
  return <ScoreAreaChart data={days} />;
}

function TaskCompletionBars({ month, stats }: { month: Date; stats: StatsData | null }) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const days = getMonthDays(month).map((date) => {
    const key = formatDateKey(date);
    const day = stats?.monthlyData?.[key];
    const percent = day && day.total > 0 ? Math.round((day.done / day.total) * 100) : 0;
    return { key, date, percent, done: day?.done ?? 0, total: day?.total ?? 0 };
  });

  return (
    <div style={{ height: 236, display: "grid", gridTemplateRows: "1fr 18px", padding: "8px 0 0" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, position: "relative", minHeight: 0, alignSelf: "end" }}>
        {days.map((day, index) => {
          const hovered = hoveredKey === day.key;
          return (
            <div
              key={day.key}
              onMouseEnter={() => setHoveredKey(day.key)}
              onMouseLeave={() => setHoveredKey((current) => (current === day.key ? null : current))}
              style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", position: "relative" }}
            >
              {hovered ? (
                <div style={{ position: "absolute", bottom: `calc(${Math.max(8, day.percent)}% + 12px)`, left: "50%", transform: "translateX(-50%)", zIndex: 4, width: 176, borderRadius: 8, background: "rgba(18,18,18,0.88)", color: "#fff", padding: "10px 11px", boxShadow: "0px 12px 24px rgba(0,0,0,0.22)", pointerEvents: "none" }}>
                  <strong style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700 }}>Jour {dateDayNumber(day.date)}</strong>
                  <span style={{ display: "block", fontSize: 11, lineHeight: 1.45, color: "rgba(255,255,255,0.78)" }}>{day.done} taches realisees</span>
                  <span style={{ display: "block", fontSize: 11, lineHeight: 1.45, color: "rgba(255,255,255,0.78)" }}>{day.total} taches prevues</span>
                  <span style={{ display: "block", fontSize: 11, lineHeight: 1.45, color: "rgba(255,255,255,0.78)" }}>{day.percent}% complete</span>
                  <span style={{ position: "absolute", left: "50%", bottom: -6, width: 12, height: 12, background: "rgba(18,18,18,0.88)", transform: "translateX(-50%) rotate(45deg)" }} />
                </div>
              ) : null}
              <span
                style={{
                  width: "100%",
                  maxWidth: 16,
                  minHeight: day.percent > 0 ? 10 : 5,
                  height: `${Math.max(5, day.percent)}%`,
                  borderRadius: 6,
                  background: blue,
                  border: "1px solid rgba(0,0,0,0.05)",
                  boxShadow: hovered ? "0px 4px 10px rgba(1,71,255,0.22)" : "0px 2px 4px rgba(18,26,46,0.08)",
                  opacity: day.percent > 0 ? 0.9 : 0.08,
                  transition: "height 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "end", paddingTop: 2 }}>
        {days.map((day, index) => (
          <span key={day.key} style={{ flex: 1, textAlign: "center", fontFamily: "Inter, sans-serif", fontSize: 12, lineHeight: "16px", fontWeight: 600, color: "rgba(18,26,46,0.48)" }}>
            {index % 4 === 0 ? day.date.getDate() : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function dateDayNumber(date: Date) {
  return date.getDate();
}

function MonthButton({ children, ariaLabel, onClick }: { children: ReactNode; ariaLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 5,
        border: "1px solid rgba(18,26,46,0.1)",
        background: "#fff",
        color: "#121a2e",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
