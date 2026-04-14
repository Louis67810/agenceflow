"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock, Plus } from "lucide-react";
import { LinkedInPost } from "@/types/linkedin";
import Link from "next/link";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function getFirstDayOfMonth(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isoToDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  draft:     { bg: "rgba(18,26,46,0.05)", border: "rgba(18,26,46,0.1)", color: "rgba(18,26,46,0.55)", dot: "rgba(18,26,46,0.4)" },
  scheduled: { bg: "#d5eeff",             border: "#a5d4f5",             color: "#073e63",             dot: "#0147ff" },
  published: { bg: "#d1fae5",             border: "#86efac",             color: "#168b64",             dot: "#168b64" },
};

export default function LinkedInPlanificationPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [today] = useState(new Date());
  const [current, setCurrent] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredPost, setHoveredPost] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("linkedin_posts");
    if (saved) {
      try { setPosts(JSON.parse(saved)); } catch { setPosts([]); }
    }
  }, []);

  const prevMonth = () => {
    setCurrent((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrent((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrent({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDate(null);
  };

  const postsByDate: Record<string, LinkedInPost[]> = {};
  posts.forEach((p) => {
    const dateKey = p.status === "scheduled" && p.scheduledAt
      ? isoToDateKey(p.scheduledAt)
      : p.status === "published" && p.publishedAt
      ? isoToDateKey(p.publishedAt)
      : null;
    if (dateKey) {
      if (!postsByDate[dateKey]) postsByDate[dateKey] = [];
      postsByDate[dateKey].push(p);
    }
  });

  const firstDay = getFirstDayOfMonth(current.year, current.month);
  const daysInMonth = getDaysInMonth(current.year, current.month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const todayKey = isoToDateKey(today.toISOString());
  const selectedPosts = selectedDate ? (postsByDate[selectedDate] || []) : [];

  const monthKey = `${current.year}-${String(current.month + 1).padStart(2, "0")}`;
  const monthPosts = posts.filter((p) => {
    const date = p.status === "scheduled" ? p.scheduledAt : p.status === "published" ? p.publishedAt : null;
    return date && date.startsWith(monthKey);
  });
  const scheduledThisMonth = monthPosts.filter((p) => p.status === "scheduled").length;
  const publishedThisMonth = monthPosts.filter((p) => p.status === "published").length;

  const btnGradient = {
    background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
    border: "1px solid #2f4d9d",
    color: "#fff",
    cursor: "pointer",
    borderRadius: 9,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#fbfbfb", ...jakartaSans }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "16px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={prevMonth} style={{ padding: 6, background: "none", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, cursor: "pointer", display: "flex" }}>
                <ChevronLeft size={18} style={{ color: "#121a2e" }} />
              </button>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.3px", margin: 0, width: 176, textAlign: "center" }}>
                {MONTHS[current.month]} {current.year}
              </h2>
              <button onClick={nextMonth} style={{ padding: 6, background: "none", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, cursor: "pointer", display: "flex" }}>
                <ChevronRight size={18} style={{ color: "#121a2e" }} />
              </button>
            </div>
            <button
              onClick={goToToday}
              style={{ padding: "6px 12px", fontSize: 12, fontWeight: 500, color: "rgba(18,26,46,0.6)", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 8, background: "none", cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              Aujourd&apos;hui
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0147ff" }} />
              <span style={{ color: "rgba(18,26,46,0.6)" }}>{scheduledThisMonth} planifiés</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#168b64" }} />
              <span style={{ color: "rgba(18,26,46,0.6)" }}>{publishedThisMonth} publiés</span>
            </div>
            <Link
              href="/admin/linkedin/posts"
              style={{ ...btnGradient, display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
            >
              <Plus size={14} />
              Nouveau post
            </Link>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Calendar */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 16 }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
            {DAYS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", padding: "8px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `repeat(${totalCells / 7}, minmax(0, 1fr))`, gap: 4, flex: 1 }}>
            {Array.from({ length: totalCells }).map((_, i) => {
              const dayNum = i - firstDay + 1;
              const isValid = dayNum >= 1 && dayNum <= daysInMonth;
              if (!isValid) return <div key={i} style={{ borderRadius: 11 }} />;

              const dateKey = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const dayPosts = postsByDate[dateKey] || [];
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  style={{
                    borderRadius: 11,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    textAlign: "left",
                    border: isSelected ? "1px solid #0147ff" : isToday ? "1px solid rgba(1,71,255,0.3)" : "1px solid transparent",
                    background: isSelected ? "#e8edff" : isToday ? "rgba(1,71,255,0.04)" : "#fff",
                    cursor: "pointer",
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                  }}
                >
                  <span style={{
                    fontSize: 12, fontWeight: 500, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%",
                    background: isToday ? "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)" : "transparent",
                    color: isToday ? "#fff" : isSelected ? "#0147ff" : "rgba(18,26,46,0.7)",
                  }}>
                    {dayNum}
                  </span>

                  {dayPosts.slice(0, 3).map((p) => {
                    const s = STATUS_STYLES[p.status] || STATUS_STYLES.draft;
                    return (
                      <div key={p.id} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6, border: `1px solid ${s.border}`, background: s.bg, color: s.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: s.dot, marginRight: 4, verticalAlign: "middle" }} />
                        {p.content.slice(0, 20)}...
                      </div>
                    );
                  })}
                  {dayPosts.length > 3 && (
                    <span style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", paddingLeft: 4 }}>+{dayPosts.length - 3}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ width: 288, background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
          {selectedDate ? (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontWeight: 700, color: "#121a2e", fontSize: 14, margin: 0, letterSpacing: "-0.3px" }}>
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                </h3>
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", marginTop: 2, marginBottom: 0 }}>
                  {selectedPosts.length} post{selectedPosts.length > 1 ? "s" : ""}
                </p>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedPosts.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 128, textAlign: "center" }}>
                    <Calendar size={20} style={{ color: "rgba(18,26,46,0.2)", marginBottom: 8 }} />
                    <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>Aucun post ce jour</p>
                    <Link href="/admin/linkedin/posts" style={{ marginTop: 8, fontSize: 12, color: "#0147ff" }}>Créer un post</Link>
                  </div>
                ) : (
                  selectedPosts.map((p) => <PostSideCard key={p.id} post={p} />)
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
              <Calendar size={24} style={{ color: "rgba(18,26,46,0.2)", marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.5)", margin: 0 }}>Sélectionnez un jour</p>
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>Cliquez sur une date pour voir les posts planifiés</p>
            </div>
          )}

          {/* Upcoming */}
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Prochains posts
            </p>
            {posts
              .filter((p) => p.status === "scheduled" && p.scheduledAt && new Date(p.scheduledAt) > today)
              .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
              .slice(0, 4)
              .map((p) => (
                <div
                  key={p.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                  onMouseEnter={() => setHoveredPost(p.id)}
                  onMouseLeave={() => setHoveredPost(null)}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0147ff", marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#121a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                      {p.content.slice(0, 40)}...
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Clock size={10} style={{ color: "rgba(18,26,46,0.35)" }} />
                      <span style={{ fontSize: 11, color: "rgba(18,26,46,0.4)" }}>
                        {new Date(p.scheduledAt!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à {formatTime(p.scheduledAt!)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            {posts.filter((p) => p.status === "scheduled" && p.scheduledAt && new Date(p.scheduledAt) > today).length === 0 && (
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", padding: "8px 0", margin: 0 }}>Aucun post planifié</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PostSideCard({ post }: { post: LinkedInPost }) {
  const date = post.status === "scheduled" ? post.scheduledAt : post.publishedAt;
  const s = STATUS_STYLES[post.status] || STATUS_STYLES.draft;
  const statusLabel = post.status === "scheduled" ? "Planifié" : post.status === "published" ? "Publié" : "Brouillon";

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${s.border}`, background: s.bg, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{statusLabel}</span>
        {date && <span style={{ fontSize: 12, color: s.color, opacity: 0.7, marginLeft: "auto" }}>{formatTime(date)}</span>}
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: s.color, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.content}</p>
      {post.styleName && <p style={{ fontSize: 12, opacity: 0.6, marginTop: 6, margin: "6px 0 0", color: s.color }}>Style: {post.styleName}</p>}
      {post.type === "carousel" && <span style={{ fontSize: 12, opacity: 0.6, color: s.color }}>Carrousel · {post.slides?.length || 0} slides</span>}
    </div>
  );
}
