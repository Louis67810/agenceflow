"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock, Plus, Repeat2, Settings, X } from "lucide-react";
import type { LinkedInPost } from "@/types/linkedin";
import Link from "next/link";
import ClientBlueButton from "@/components/shared/ClientBlueButton";
import {
  ensureAutoRecyclePosts,
  getTopQuartilePublishedPosts,
  loadLinkedInPosts,
  saveLinkedInPosts,
} from "@/lib/linkedin/posts";
import {
  fetchRemoteLinkedInPosts,
  flushPendingRemoteLinkedInPosts,
  persistRemoteLinkedInPosts,
} from "@/lib/linkedin/remote";
import {
  DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES,
  fetchRemoteLinkedInWorkspace,
  loadLinkedInWorkspaceCache,
  persistLinkedInWorkspacePatch,
} from "@/lib/linkedin/workspace";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
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

function getPostCalendarDateKey(post: LinkedInPost): string | null {
  if (post.status === "scheduled" && post.scheduledAt) return isoToDateKey(post.scheduledAt);
  if (post.status !== "published") return null;
  if (post.analytics?.publishedDate) return post.analytics.publishedDate;
  if (post.publishedAt) return isoToDateKey(post.publishedAt);
  return null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  draft: { bg: "rgba(18,26,46,0.05)", border: "rgba(18,26,46,0.1)", color: "rgba(18,26,46,0.55)", dot: "rgba(18,26,46,0.4)" },
  scheduled: { bg: "#d5eeff", border: "#a5d4f5", color: "#073e63", dot: "#0147ff" },
  published: { bg: "#d1fae5", border: "#86efac", color: "#168b64", dot: "#168b64" },
};

export default function LinkedInPlanificationPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [today] = useState(new Date());
  const [current, setCurrent] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoRecycleEnabled, setAutoRecycleEnabled] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.autoRecycleEnabled);
  const [autoRecycleDelayDays, setAutoRecycleDelayDays] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.autoRecycleDelayDays);

  useEffect(() => {
    const localPosts = loadLinkedInPosts();
    const cachedWorkspace = loadLinkedInWorkspaceCache();
    setPosts(localPosts);
    setAutoRecycleEnabled(cachedWorkspace.preferences.autoRecycleEnabled);
    setAutoRecycleDelayDays(cachedWorkspace.preferences.autoRecycleDelayDays);

    void (async () => {
      try {
        await flushPendingRemoteLinkedInPosts();
        const remotePosts = await fetchRemoteLinkedInPosts();
        if (remotePosts.length > 0) {
          setPosts(remotePosts);
          saveLinkedInPosts(remotePosts);
        } else if (localPosts.length > 0) {
          await persistRemoteLinkedInPosts(localPosts, true);
        }
      } catch {}
    })();

    void (async () => {
      try {
        const remoteWorkspace = await fetchRemoteLinkedInWorkspace();
        setAutoRecycleEnabled(remoteWorkspace.workspace.preferences.autoRecycleEnabled);
        setAutoRecycleDelayDays(remoteWorkspace.workspace.preferences.autoRecycleDelayDays);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const updated = ensureAutoRecyclePosts(posts, {
      enabled: autoRecycleEnabled,
      delayDays: autoRecycleDelayDays,
    });
    if (updated.length === posts.length) return;
    setPosts(updated);
    saveLinkedInPosts(updated);
    void persistRemoteLinkedInPosts(updated, true);
  }, [autoRecycleDelayDays, autoRecycleEnabled, posts]);

  const updateAutoRecyclePreferences = (patch: { enabled?: boolean; delayDays?: number }) => {
    const nextEnabled = patch.enabled ?? autoRecycleEnabled;
    const nextDelayDays = patch.delayDays ?? autoRecycleDelayDays;
    setAutoRecycleEnabled(nextEnabled);
    setAutoRecycleDelayDays(nextDelayDays);
    persistLinkedInWorkspacePatch({
      preferences: {
        autoRecycleEnabled: nextEnabled,
        autoRecycleDelayDays: nextDelayDays,
      },
    });
  };

  const prevMonth = () => {
    setCurrent((value) => (value.month === 0 ? { year: value.year - 1, month: 11 } : { year: value.year, month: value.month - 1 }));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrent((value) => (value.month === 11 ? { year: value.year + 1, month: 0 } : { year: value.year, month: value.month + 1 }));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrent({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDate(null);
  };

  const postsByDate = useMemo(() => {
    const map: Record<string, LinkedInPost[]> = {};
    for (const post of posts) {
      const dateKey = getPostCalendarDateKey(post);
      if (!dateKey) continue;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(post);
    }
    return map;
  }, [posts]);

  const firstDay = getFirstDayOfMonth(current.year, current.month);
  const daysInMonth = getDaysInMonth(current.year, current.month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const todayKey = isoToDateKey(today.toISOString());
  const selectedPosts = selectedDate ? postsByDate[selectedDate] || [] : [];
  const topQuartilePosts = getTopQuartilePublishedPosts(posts);
  const autoRecyclePosts = posts.filter((post) => Boolean(post.analytics?.autoRecycleSourcePostId));

  const monthKey = `${current.year}-${String(current.month + 1).padStart(2, "0")}`;
  const monthPosts = posts.filter((post) => {
    const dateKey = getPostCalendarDateKey(post);
    return Boolean(dateKey && dateKey.startsWith(monthKey));
  });
  const scheduledThisMonth = monthPosts.filter((post) => post.status === "scheduled").length;
  const publishedThisMonth = monthPosts.filter((post) => post.status === "published").length;

  const upcomingPosts = posts
    .filter((post) => post.status === "scheduled" && post.scheduledAt && new Date(post.scheduledAt) > today && !post.analytics?.autoRecycleSourcePostId)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 5);
  const upcomingAutoRecyclePosts = posts
    .filter((post) => post.status === "scheduled" && post.scheduledAt && new Date(post.scheduledAt) > today && post.analytics?.autoRecycleSourcePostId)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#fbfbfb", ...jakartaSans }}>
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
              <span style={{ color: "rgba(18,26,46,0.6)" }}>{scheduledThisMonth} planifies</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#168b64" }} />
              <span style={{ color: "rgba(18,26,46,0.6)" }}>{publishedThisMonth} publies</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed" }} />
              <span style={{ color: "rgba(18,26,46,0.6)" }}>{autoRecyclePosts.length} relances auto</span>
            </div>
            <Link href="/admin/linkedin/posts" style={{ textDecoration: "none" }}>
              <ClientBlueButton compact type="button" icon={<Plus size={14} />}>
                Nouveau post
              </ClientBlueButton>
            </Link>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
            {DAYS.map((day) => (
              <div key={day} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", padding: "8px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {day}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: `repeat(${totalCells / 7}, minmax(0, 1fr))`, gap: 4, flex: 1 }}>
            {Array.from({ length: totalCells }).map((_, index) => {
              const dayNumber = index - firstDay + 1;
              const isValid = dayNumber >= 1 && dayNumber <= daysInMonth;
              if (!isValid) return <div key={index} style={{ borderRadius: 11 }} />;

              const dateKey = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
              const dayPosts = postsByDate[dateKey] || [];
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;

              return (
                <button
                  key={index}
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
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      width: 24,
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      background: isToday ? "#0147ff" : "transparent",
                      color: isToday ? "#fff" : isSelected ? "#0147ff" : "rgba(18,26,46,0.7)",
                    }}
                  >
                    {dayNumber}
                  </span>

                  {dayPosts.slice(0, 3).map((post) => {
                    const style = STATUS_STYLES[post.status] || STATUS_STYLES.draft;
                    const isAutoRecycle = Boolean(post.analytics?.autoRecycleSourcePostId);
                    return (
                      <div key={post.id} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 6, border: `1px solid ${style.border}`, background: isAutoRecycle ? "#f3e8ff" : style.bg, color: isAutoRecycle ? "#6d28d9" : style.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: isAutoRecycle ? "#7c3aed" : style.dot, marginRight: 4, verticalAlign: "middle" }} />
                        {post.content.slice(0, 20)}...
                      </div>
                    );
                  })}
                  {dayPosts.length > 3 && <span style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", paddingLeft: 4 }}>+{dayPosts.length - 3}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ width: 320, background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
          {selectedDate ? (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontWeight: 700, color: "#121a2e", fontSize: 14, margin: 0, letterSpacing: "-0.3px" }}>
                  {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
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
                    <Link href="/admin/linkedin/posts" style={{ marginTop: 8, fontSize: 12, color: "#0147ff" }}>Creer un post</Link>
                  </div>
                ) : (
                  selectedPosts.map((post) => <PostSideCard key={post.id} post={post} />)
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
              <Calendar size={24} style={{ color: "rgba(18,26,46,0.2)", marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.5)", margin: 0 }}>Selectionnez un jour</p>
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>Cliquez sur une date pour voir les posts planifies</p>
            </div>
          )}

          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Prochains posts
            </p>
            {upcomingPosts.length === 0 ? (
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", padding: "8px 0", margin: 0 }}>Aucun post planifie</p>
            ) : (
              upcomingPosts.map((post) => (
                <div key={post.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: post.analytics?.autoRecycleSourcePostId ? "#7c3aed" : "#0147ff", marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#121a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                      {post.content.slice(0, 42)}...
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Clock size={10} style={{ color: "rgba(18,26,46,0.35)" }} />
                      <span style={{ fontSize: 11, color: "rgba(18,26,46,0.4)" }}>
                        {new Date(post.scheduledAt!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} a {formatTime(post.scheduledAt!)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
            {upcomingAutoRecyclePosts.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.35)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Relances auto
                </p>
                {upcomingAutoRecyclePosts.map((post) => (
                  <div key={post.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: "#6d28d9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                        {post.content.slice(0, 42)}...
                      </p>
                      <span style={{ fontSize: 11, color: "rgba(109,40,217,0.62)" }}>
                        {new Date(post.scheduledAt!).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} a {formatTime(post.scheduledAt!)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 40,
          padding: "0 15px",
          borderRadius: 18,
          border: "1px solid rgba(18,26,46,0.12)",
          background: "#fff",
          boxShadow: "0px 4.71px 3px rgba(0,0,0,0.02), 0px 2.12px 2.12px rgba(0,0,0,0.03), 0px 0.47px 1.18px rgba(0,0,0,0.03)",
          color: "rgba(18,26,46,0.72)",
          cursor: "pointer",
          fontFamily: '"Inter", sans-serif',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <Settings size={15} style={{ color: "rgba(18,26,46,0.5)" }} />
        Auto-republication
      </button>

      {settingsOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(18,26,46,0.18)",
            backdropFilter: "blur(12px)",
            animation: "planOverlayIn 0.18s ease-out",
          }}
        >
          <style jsx global>{`
            @keyframes planOverlayIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
          <div
            style={{
              width: 420,
              borderRadius: 20,
              border: "1px solid rgba(18,26,46,0.12)",
              background: "rgba(255,255,255,0.94)",
              boxShadow: "0 24px 70px rgba(18,26,46,0.18)",
              padding: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Repeat2 size={16} style={{ color: "#7c3aed" }} />
                  <h3 style={{ margin: 0, color: "#121a2e", fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" }}>
                    Auto-republication
                  </h3>
                </div>
                <p style={{ margin: 0, color: "rgba(18,26,46,0.52)", fontSize: 12, lineHeight: 1.5 }}>
                  Replanifie automatiquement les posts du top 25% apres le delai choisi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                aria-label="Fermer les reglages"
              >
                <X size={15} style={{ color: "rgba(18,26,46,0.55)" }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <button
                type="button"
                onClick={() => updateAutoRecyclePreferences({ enabled: !autoRecycleEnabled })}
                style={{
                  width: "100%",
                  minHeight: 48,
                  borderRadius: 13,
                  border: autoRecycleEnabled ? "1px solid #7c3aed" : "1px solid rgba(18,26,46,0.1)",
                  background: autoRecycleEnabled ? "#f3e8ff" : "rgba(0,0,0,0.03)",
                  color: autoRecycleEnabled ? "#6d28d9" : "rgba(18,26,46,0.62)",
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {autoRecycleEnabled ? "Auto-republication activee" : "Auto-republication desactivee"}
              </button>

              <label style={{ display: "block" }}>
                <span style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.62)" }}>
                  Delai avant relance
                </span>
                <input
                  type="number"
                  min={30}
                  max={365}
                  value={autoRecycleDelayDays}
                  onChange={(event) => updateAutoRecyclePreferences({ delayDays: Number(event.target.value) || 120 })}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    background: "#fff",
                    border: "1px solid rgba(18,26,46,0.12)",
                    borderRadius: 12,
                    padding: "0 13px",
                    fontSize: 14,
                    color: "#121a2e",
                    outline: "none",
                    boxSizing: "border-box",
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                  }}
                />
              </label>
              <p style={{ margin: 0, color: "rgba(18,26,46,0.45)", fontSize: 12, lineHeight: 1.55 }}>
                {topQuartilePosts.length} post(s) dans le top 25%. {autoRecyclePosts.length} relance(s) auto deja creee(s).
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PostSideCard({ post }: { post: LinkedInPost }) {
  const date = post.status === "scheduled"
    ? post.scheduledAt
    : post.analytics?.publishedDate
      ? new Date(`${post.analytics.publishedDate}T${post.analytics.publishedTime || "12:00"}:00`).toISOString()
      : post.publishedAt;
  const style = STATUS_STYLES[post.status] || STATUS_STYLES.draft;
  const statusLabel = post.status === "scheduled" ? "Planifie" : post.status === "published" ? "Publie" : "Brouillon";
  const isAutoRecycle = Boolean(post.analytics?.autoRecycleSourcePostId);

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${isAutoRecycle ? "#d8b4fe" : style.border}`, background: isAutoRecycle ? "#faf5ff" : style.bg, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: isAutoRecycle ? "#7c3aed" : style.dot }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: isAutoRecycle ? "#6d28d9" : style.color }}>{statusLabel}</span>
        {date && <span style={{ fontSize: 12, color: isAutoRecycle ? "#6d28d9" : style.color, opacity: 0.7, marginLeft: "auto" }}>{formatTime(date)}</span>}
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: isAutoRecycle ? "#6d28d9" : style.color, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {post.content}
      </p>
      {post.styleName && <p style={{ fontSize: 12, opacity: 0.6, margin: "6px 0 0", color: isAutoRecycle ? "#6d28d9" : style.color }}>Style: {post.styleName}</p>}
      {post.type === "carousel" && <span style={{ fontSize: 12, opacity: 0.6, color: isAutoRecycle ? "#6d28d9" : style.color }}>Carrousel · {post.slides?.length || 0} slides</span>}
      {isAutoRecycle && <p style={{ fontSize: 12, opacity: 0.78, margin: "6px 0 0", color: "#6d28d9" }}>Relance automatique top 25%</p>}
    </div>
  );
}
