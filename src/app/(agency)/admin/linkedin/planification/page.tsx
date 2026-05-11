"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Calendar, Plus, Repeat2, X, CalendarPlus, PenLine, MoreVertical, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { LinkedInIdea, LinkedInPost, LinkedInStyle } from "@/types/linkedin";
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

function getIdeaCalendarDateKey(idea: LinkedInIdea): string | null {
  return idea.scheduledAt ? isoToDateKey(idea.scheduledAt) : null;
}

function createScheduledAt(dateKey: string, hour = 9, minute = 0): string {
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`).toISOString();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  draft: { bg: "rgba(18,26,46,0.05)", border: "rgba(18,26,46,0.1)", color: "rgba(18,26,46,0.55)", dot: "rgba(18,26,46,0.4)" },
  scheduled: { bg: "#d5eeff", border: "#a5d4f5", color: "#073e63", dot: "#0147ff" },
  published: { bg: "#d1fae5", border: "#86efac", color: "#168b64", dot: "#168b64" },
};

const STYLE_TONES: Record<LinkedInStyle["category"] | "fallback", { bg: string; border: string; color: string; dot: string }> = {
  storytelling: { bg: "#f1eaff", border: "#d8c3ff", color: "#6236AA", dot: "#8b5cf6" },
  valeur: { bg: "#e8f6ff", border: "#bfe2fa", color: "#073e63", dot: "#0ea5e9" },
  educatif: { bg: "#dcfaf5", border: "#99f6e4", color: "#0f766e", dot: "#14b8a6" },
  educatif_carrousel: { bg: "#e6faff", border: "#bae6fd", color: "#036782", dot: "#06b6d4" },
  presentation_projet: { bg: "#f1f5f9", border: "#cbd5e1", color: "#334155", dot: "#64748b" },
  viral: { bg: "#ffecec", border: "#fecaca", color: "#c53030", dot: "#ef4444" },
  engagement: { bg: "#fff0df", border: "#fed7aa", color: "#663b12", dot: "#f97316" },
  data: { bg: "#eef2ff", border: "#c7d2fe", color: "#3730a3", dot: "#6366f1" },
  lead_magnet: { bg: "#e4fff1", border: "#a7f3d0", color: "#047857", dot: "#10b981" },
  custom: { bg: "#f6f6f6", border: "rgba(18,26,46,0.12)", color: "rgba(18,26,46,0.65)", dot: "rgba(18,26,46,0.38)" },
  fallback: { bg: "#f6f6f6", border: "rgba(18,26,46,0.12)", color: "rgba(18,26,46,0.65)", dot: "rgba(18,26,46,0.38)" },
};

export default function LinkedInPlanificationPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [ideas, setIdeas] = useState<LinkedInIdea[]>([]);
  const [today] = useState(new Date());
  const [current, setCurrent] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [styles, setStyles] = useState<LinkedInStyle[]>([]);
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [draggedIdeaId, setDraggedIdeaId] = useState<string | null>(null);
  const [dayMenu, setDayMenu] = useState<{ dateKey: string; x: number; y: number } | null>(null);
  const [draftPickerDate, setDraftPickerDate] = useState<string | null>(null);
  const [draftPickerTime, setDraftPickerTime] = useState("09:00");
  const [draftPickerPostId, setDraftPickerPostId] = useState<string | null>(null);
  const [reschedulePostId, setReschedulePostId] = useState<string | null>(null);
  const [ideaModalDate, setIdeaModalDate] = useState<string | null>(null);
  const [ideaTitle, setIdeaTitle] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [ideaStyleId, setIdeaStyleId] = useState("");
  const [autoRecycleEnabled, setAutoRecycleEnabled] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.autoRecycleEnabled);
  const [autoRecycleDelayDays, setAutoRecycleDelayDays] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.autoRecycleDelayDays);
  const [autoRecycleMinLikes, setAutoRecycleMinLikes] = useState(DEFAULT_LINKEDIN_WORKSPACE_PREFERENCES.autoRecycleMinLikes);

  useEffect(() => {
    const localPosts = loadLinkedInPosts();
    const cachedWorkspace = loadLinkedInWorkspaceCache();
    setPosts(localPosts);
    setStyles(cachedWorkspace.styles);
    setIdeas(cachedWorkspace.ideas);
    setAutoRecycleEnabled(cachedWorkspace.preferences.autoRecycleEnabled);
    setAutoRecycleDelayDays(cachedWorkspace.preferences.autoRecycleDelayDays);
    setAutoRecycleMinLikes(cachedWorkspace.preferences.autoRecycleMinLikes);

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
        setStyles(remoteWorkspace.workspace.styles);
        setIdeas(remoteWorkspace.workspace.ideas);
        setAutoRecycleEnabled(remoteWorkspace.workspace.preferences.autoRecycleEnabled);
        setAutoRecycleDelayDays(remoteWorkspace.workspace.preferences.autoRecycleDelayDays);
        setAutoRecycleMinLikes(remoteWorkspace.workspace.preferences.autoRecycleMinLikes);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const updated = ensureAutoRecyclePosts(posts, {
      enabled: autoRecycleEnabled,
      delayDays: autoRecycleDelayDays,
      minLikes: autoRecycleMinLikes,
    });
    if (JSON.stringify(updated) === JSON.stringify(posts)) return;
    setPosts(updated);
    saveLinkedInPosts(updated);
    void persistRemoteLinkedInPosts(updated, true);
  }, [autoRecycleDelayDays, autoRecycleEnabled, autoRecycleMinLikes, posts]);

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

  const persistPosts = (nextPosts: LinkedInPost[]) => {
    setPosts(nextPosts);
    saveLinkedInPosts(nextPosts);
    void persistRemoteLinkedInPosts(nextPosts, true);
  };

  const movePostToDate = (postId: string, dateKey: string) => {
    const updated = posts.map((post) => {
      if (post.id !== postId) return post;
      const previous = post.scheduledAt ? new Date(post.scheduledAt) : new Date(`${dateKey}T09:00:00`);
      const hours = String(previous.getHours()).padStart(2, "0");
      const minutes = String(previous.getMinutes()).padStart(2, "0");
      return {
        ...post,
        status: "scheduled" as const,
        scheduledAt: new Date(`${dateKey}T${hours}:${minutes}:00`).toISOString(),
        publishedAt: undefined,
      };
    });
    persistPosts(updated);
    setDraggedPostId(null);
  };

  const moveIdeaToDate = (ideaId: string, dateKey: string) => {
    const updated = ideas.map((idea) => idea.id === ideaId ? { ...idea, scheduledAt: createScheduledAt(dateKey) } : idea);
    setIdeas(updated);
    persistLinkedInWorkspacePatch({ ideas: updated });
    setDraggedIdeaId(null);
  };

  const openPostComposer = (dateKey: string) => {
    sessionStorage.setItem("linkedin_post_schedule_prefill", JSON.stringify({
      scheduledAt: createScheduledAt(dateKey),
      content: "",
    }));
    setDayMenu(null);
    router.push("/admin/linkedin/posts");
  };

  const startPostFromIdea = (idea: LinkedInIdea) => {
    sessionStorage.setItem("linkedin_idea_prefill", JSON.stringify(idea));
    router.push("/admin/linkedin/posts");
  };

  const scheduleExistingDraft = (postId: string, dateKey: string, time = "09:00") => {
    const [hour = "09", minute = "00"] = time.split(":");
    const updated = posts.map((post) => {
      if (post.id !== postId) return post;
      return {
        ...post,
        status: "scheduled" as const,
        scheduledAt: createScheduledAt(dateKey, Number(hour), Number(minute)),
        publishedAt: undefined,
      };
    });
    persistPosts(updated);
    setDraftPickerDate(null);
    setDraftPickerPostId(null);
    setReschedulePostId(null);
    setDayMenu(null);
  };

  const openDraftScheduler = (dateKey: string) => {
    setDraftPickerDate(dateKey);
    setDraftPickerTime("09:00");
    setDraftPickerPostId(null);
    setReschedulePostId(null);
    setSelectedDate(dateKey);
    setDayMenu(null);
  };

  const openReschedulePost = (post: LinkedInPost) => {
    const dateKey = post.scheduledAt
      ? isoToDateKey(post.scheduledAt)
      : selectedDate ?? todayKey;
    const sourceDate = post.scheduledAt ? new Date(post.scheduledAt) : new Date(`${dateKey}T09:00:00`);
    setDraftPickerDate(dateKey);
    setDraftPickerTime(`${String(sourceDate.getHours()).padStart(2, "0")}:${String(sourceDate.getMinutes()).padStart(2, "0")}`);
    setDraftPickerPostId(post.id);
    setReschedulePostId(post.id);
    setSelectedDate(dateKey);
  };

  const closeSchedulePanel = () => {
    setDraftPickerDate(null);
    setDraftPickerTime("09:00");
    setDraftPickerPostId(null);
    setReschedulePostId(null);
  };

  const saveSchedulePanel = () => {
    if (!draftPickerDate || !draftPickerPostId) return;
    scheduleExistingDraft(draftPickerPostId, draftPickerDate, draftPickerTime);
  };

  const createIdeaForDate = (dateKey: string) => {
    setIdeaModalDate(dateKey);
    setIdeaTitle("");
    setIdeaDescription("");
    setIdeaStyleId(styles[0]?.id ?? "");
    setDayMenu(null);
  };

  const saveIdeaForDate = () => {
    if (!ideaModalDate || !ideaTitle.trim() || !ideaStyleId) return;
    const selectedStyle = styles.find((style) => style.id === ideaStyleId);
    const idea: LinkedInIdea = {
      id: `idea_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: ideaTitle.trim(),
      description: ideaDescription.trim(),
      styleId: selectedStyle?.id,
      styleName: selectedStyle?.name,
      status: "new",
      scheduledAt: createScheduledAt(ideaModalDate),
      generatedAt: new Date().toISOString(),
    };
    const updated = [idea, ...ideas];
    setIdeas(updated);
    persistLinkedInWorkspacePatch({ ideas: updated });
    setIdeaModalDate(null);
  };

  const validateScheduledPost = (postId: string) => {
    const updated = posts.map((post) => {
      if (post.id !== postId) return post;
      const publicationDate = post.scheduledAt ?? new Date().toISOString();
      return {
        ...post,
        status: "published" as const,
        publishedAt: publicationDate,
      };
    });
    persistPosts(updated);
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

  const ideasByDate = useMemo(() => {
    const map: Record<string, LinkedInIdea[]> = {};
    for (const idea of ideas) {
      const dateKey = getIdeaCalendarDateKey(idea);
      if (!dateKey) continue;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(idea);
    }
    return map;
  }, [ideas]);

  const firstDay = getFirstDayOfMonth(current.year, current.month);
  const daysInMonth = getDaysInMonth(current.year, current.month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const todayKey = isoToDateKey(today.toISOString());
  const selectedPosts = selectedDate ? postsByDate[selectedDate] || [] : [];
  const selectedIdeas = selectedDate ? ideasByDate[selectedDate] || [] : [];
  const topQuartilePosts = getTopQuartilePublishedPosts(posts);
  const autoRecyclePosts = posts.filter((post) => Boolean(post.analytics?.autoRecycleSourcePostId));
  const unscheduledDrafts = posts.filter((post) => post.status === "draft" && !post.scheduledAt);
  const selectedSchedulePost = posts.find((post) => post.id === draftPickerPostId) ?? null;

  const monthKey = `${current.year}-${String(current.month + 1).padStart(2, "0")}`;
  const monthPosts = posts.filter((post) => {
    const dateKey = getPostCalendarDateKey(post);
    return Boolean(dateKey && dateKey.startsWith(monthKey));
  });
  const scheduledThisMonth = monthPosts.filter((post) => post.status === "scheduled").length;
  const publishedThisMonth = monthPosts.filter((post) => post.status === "published").length;

  const getPostTone = (post: LinkedInPost) => {
    if (post.analytics?.autoRecycleSourcePostId) return { ...STYLE_TONES.storytelling, bg: "#f3e8ff", border: "#d8b4fe", color: "#6d28d9", dot: "#7c3aed" };
    if (post.status === "published") return STATUS_STYLES.published;
    const style = styles.find((item) => item.id === post.styleId || item.name === post.styleName);
    return STYLE_TONES[style?.category ?? "fallback"];
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#f6f6f6", ...jakartaSans }}>
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

          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <PlanTag color="#0147ff">{scheduledThisMonth} planifies</PlanTag>
            <PlanTag color="#168b64">{publishedThisMonth} publies</PlanTag>
            <PlanTag color="#7c3aed">{autoRecyclePosts.length} relances auto</PlanTag>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", marginBottom: 8, minWidth: 0 }}>
            {DAYS.map((day) => (
              <div key={day} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", padding: "8px 0", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {day}
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gridTemplateRows: `repeat(${totalCells / 7}, minmax(0, 1fr))`, gap: 4, flex: 1, minWidth: 0 }}>
            {Array.from({ length: totalCells }).map((_, index) => {
              const dayNumber = index - firstDay + 1;
              const isValid = dayNumber >= 1 && dayNumber <= daysInMonth;
              if (!isValid) return <div key={index} style={{ borderRadius: 11 }} />;

              const dateKey = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
              const dayPosts = postsByDate[dateKey] || [];
              const dayIdeas = ideasByDate[dateKey] || [];
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;
              const isPast = dateKey < todayKey;

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedDate(dateKey);
                    setDayMenu({ dateKey, x: event.clientX, y: event.clientY });
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const postId = draggedPostId || event.dataTransfer.getData("text/plain");
                    if (postId) movePostToDate(postId, dateKey);
                    const ideaId = draggedIdeaId || event.dataTransfer.getData("application/x-linkedin-idea");
                    if (ideaId) moveIdeaToDate(ideaId, dateKey);
                  }}
                  style={{
                    position: "relative",
                    borderRadius: 11,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    textAlign: "left",
                    border: "1px solid rgba(0,0,0,0.05)",
                    background: isSelected ? "#fbfbfb" : "#fff",
                    cursor: "pointer",
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    minWidth: 0,
                    width: "100%",
                    overflow: "hidden",
                  }}
                >
                  {isPast ? (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        backgroundImage: "repeating-linear-gradient(135deg, rgba(0,0,0,0.045) 0px, rgba(0,0,0,0.045) 1px, transparent 1px, transparent 8px)",
                        zIndex: 0,
                      }}
                    />
                  ) : null}
                  <span
                    style={{
                      position: "relative",
                      zIndex: 1,
                      fontSize: 12,
                      fontWeight: 500,
                      width: 24,
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      background: isToday ? "#0147ff" : "transparent",
                      color: isToday ? "#fff" : isSelected ? "#121a2e" : "rgba(18,26,46,0.7)",
                    }}
                  >
                    {dayNumber}
                  </span>

                  {dayPosts.slice(0, 2).map((post) => {
                    const tone = getPostTone(post);
                    const analytics = post.analytics;
                    return (
                      <div
                        key={post.id}
                        draggable
                        onClick={(event) => {
                          event.stopPropagation();
                          openReschedulePost(post);
                        }}
                        onDragStart={(event) => {
                          setDraggedPostId(post.id);
                          event.dataTransfer.setData("text/plain", post.id);
                        }}
                        style={{ position: "relative", zIndex: 1, borderRadius: 8, border: `1px solid ${tone.border}`, background: tone.bg, color: tone.color, overflow: "hidden", cursor: "grab", display: "grid", gridTemplateRows: "1fr auto" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 6, minHeight: 34 }}>
                          {analytics?.mediaPreviewUrl ? (
                            <span style={{ width: 28, height: 28, borderRadius: 5, background: `url(${analytics.mediaPreviewUrl}) center / cover`, flexShrink: 0 }} />
                          ) : null}
                          <span style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.25, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {post.content.slice(0, 42)}...
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "5px 7px", borderTop: `1px solid ${tone.border}`, background: "rgba(255,255,255,0.34)" }}>
                          <CheckCircle2 size={11} />
                          <MoreVertical size={12} style={{ opacity: 0.55 }} />
                        </div>
                      </div>
                    );
                  })}
                  {dayIdeas.slice(0, 1).map((idea) => (
                    <div
                      key={idea.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggedIdeaId(idea.id);
                        event.dataTransfer.setData("application/x-linkedin-idea", idea.id);
                      }}
                      style={{ position: "relative", zIndex: 1, fontSize: 11, padding: "4px 7px", borderRadius: 7, border: "1px dashed rgba(18,26,46,0.15)", background: "#fff", color: "rgba(18,26,46,0.62)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "grab" }}
                    >
                      Idée: {idea.title}
                    </div>
                  ))}
                  {dayPosts.length + dayIdeas.length > 3 && <span style={{ position: "relative", zIndex: 1, fontSize: 11, color: "rgba(18,26,46,0.4)", paddingLeft: 4 }}>+{dayPosts.length + dayIdeas.length - 3}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ width: 320, background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
          {draftPickerDate ? (
            <ScheduleSidePanel
              dateKey={draftPickerDate}
              time={draftPickerTime}
              drafts={unscheduledDrafts}
              selectedPost={selectedSchedulePost}
              selectedTone={selectedSchedulePost ? getPostTone(selectedSchedulePost) : undefined}
              isRescheduling={Boolean(reschedulePostId)}
              onDateChange={setDraftPickerDate}
              onTimeChange={setDraftPickerTime}
              onSelectPost={setDraftPickerPostId}
              onClose={closeSchedulePanel}
              onSave={saveSchedulePanel}
            />
          ) : selectedDate ? (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div>
                  <h3 style={{ fontWeight: 700, color: "#121a2e", fontSize: 14, margin: 0, letterSpacing: "-0.3px" }}>
                    {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </h3>
                  <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", marginTop: 2, marginBottom: 0 }}>
                    {selectedPosts.length} post{selectedPosts.length > 1 ? "s" : ""} · {selectedIdeas.length} idée{selectedIdeas.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedPosts.length === 0 && selectedIdeas.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 128, textAlign: "center" }}>
                    <Calendar size={20} style={{ color: "rgba(18,26,46,0.2)", marginBottom: 8 }} />
                    <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: 0 }}>Aucun post ce jour</p>
                    <Link href="/admin/linkedin/posts" style={{ marginTop: 8, fontSize: 12, color: "#0147ff" }}>Creer un post</Link>
                  </div>
                ) : (
                  <>
                    {selectedPosts.map((post) => (
                      <PostSideCard
                        key={post.id}
                        post={post}
                        tone={getPostTone(post)}
                        onOpen={() => openReschedulePost(post)}
                        onValidate={() => validateScheduledPost(post.id)}
                      />
                    ))}
                    {selectedIdeas.map((idea) => (
                      <div
                        key={idea.id}
                        draggable
                        onDragStart={(event) => {
                          setDraggedIdeaId(idea.id);
                          event.dataTransfer.setData("application/x-linkedin-idea", idea.id);
                        }}
                        style={{ borderRadius: 10, border: "1px dashed rgba(18,26,46,0.16)", background: "#fff", padding: 12, cursor: "grab" }}
                      >
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#121a2e" }}>{idea.title}</p>
                        <p style={{ margin: "5px 0 0", fontSize: 12, color: "rgba(18,26,46,0.48)" }}>Idée planifiée</p>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            startPostFromIdea(idea);
                          }}
                          style={{ marginTop: 10, width: "100%", minHeight: 34, borderRadius: 9, border: "1px solid rgba(18,26,46,0.1)", background: "#f6f6f6", color: "#121a2e", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                        >
                          Démarrer un post avec cette idée
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
              <Calendar size={24} style={{ color: "rgba(18,26,46,0.2)", marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "rgba(18,26,46,0.5)", margin: 0 }}>Selectionnez un jour</p>
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.35)", marginTop: 4 }}>Cliquez sur une date pour voir les posts planifies</p>
            </div>
          )}

        </div>
      </div>

      {dayMenu ? (
        <>
          <button type="button" aria-label="Fermer le menu" onClick={() => setDayMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 25, border: "none", background: "transparent", cursor: "default" }} />
          <div
            style={{
              position: "fixed",
              zIndex: 26,
              left: dayMenu.x,
              top: dayMenu.y,
              width: 198,
              borderRadius: 14,
              border: "1px solid rgba(18,26,46,0.12)",
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 22px 70px rgba(18,26,46,0.16)",
              padding: 6,
              backdropFilter: "blur(12px)",
            }}
          >
            {[
              { label: "Nouveau post", icon: <Plus size={15} />, onClick: () => openPostComposer(dayMenu.dateKey) },
              { label: "Planifier un post", icon: <CalendarPlus size={15} />, onClick: () => openDraftScheduler(dayMenu.dateKey) },
              { label: "Ajouter une idée", icon: <PenLine size={15} />, onClick: () => createIdeaForDate(dayMenu.dateKey) },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                style={{
                  width: "100%",
                  minHeight: 38,
                  border: "none",
                  borderRadius: 10,
                  background: "transparent",
                  color: "#121a2e",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 10px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
                onMouseEnter={(event) => { event.currentTarget.style.background = "rgba(18,26,46,0.04)"; }}
                onMouseLeave={(event) => { event.currentTarget.style.background = "transparent"; }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {ideaModalDate ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 31,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(18,26,46,0.18)",
            backdropFilter: "blur(10px)",
          }}
          onClick={() => setIdeaModalDate(null)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 480,
              borderRadius: 18,
              border: "1px solid rgba(18,26,46,0.12)",
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 24px 70px rgba(18,26,46,0.18)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(18,26,46,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: "#121a2e", fontSize: 16, fontWeight: 800 }}>Ajouter une idée</h3>
                <p style={{ margin: "4px 0 0", color: "rgba(18,26,46,0.48)", fontSize: 12 }}>
                  Date prévue : {new Date(`${ideaModalDate}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                </p>
              </div>
              <button type="button" onClick={() => setIdeaModalDate(null)} style={{ width: 32, height: 32, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.58)" }}>Titre de l'idée *</label>
                <input value={ideaTitle} onChange={(event) => setIdeaTitle(event.target.value)} placeholder="Ex: Le système qui m'a apporté..." style={{ width: "100%", minHeight: 42, background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "0 12px", fontSize: 13, color: "#121a2e", outline: "none", boxSizing: "border-box", fontFamily: '"Plus Jakarta Sans", sans-serif' }} autoFocus />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.58)" }}>Description</label>
                <textarea value={ideaDescription} onChange={(event) => setIdeaDescription(event.target.value)} rows={3} placeholder="Angle, points clés, exemple..." style={{ width: "100%", background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, padding: "9px 12px", fontSize: 13, color: "#121a2e", outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.58)" }}>Style *</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {styles.map((style) => {
                    const tone = STYLE_TONES[style.category] ?? STYLE_TONES.fallback;
                    const active = ideaStyleId === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => setIdeaStyleId(style.id)}
                        style={{ padding: "6px 12px", borderRadius: 20, border: active ? `1px solid ${tone.border}` : "1px solid rgba(0,0,0,0.09)", background: active ? tone.bg : "#f6f6f6", color: active ? tone.color : "rgba(18,26,46,0.55)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                      >
                        {style.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(18,26,46,0.08)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setIdeaModalDate(null)} style={{ minHeight: 38, padding: "0 14px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.09)", background: "#fff", color: "#121a2e", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                Annuler
              </button>
              <ClientBlueButton compact type="button" onClick={saveIdeaForDate} disabled={!ideaTitle.trim() || !ideaStyleId}>
                Enregistrer
              </ClientBlueButton>
            </div>
          </div>
        </div>
      ) : null}

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

function PlanTag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 28,
        padding: "5px 12px",
        borderRadius: 999,
        background: hexToRgba(color, 0.12),
        color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function ScheduleSidePanel({
  dateKey,
  time,
  drafts,
  selectedPost,
  selectedTone,
  isRescheduling,
  onDateChange,
  onTimeChange,
  onSelectPost,
  onClose,
  onSave,
}: {
  dateKey: string;
  time: string;
  drafts: LinkedInPost[];
  selectedPost: LinkedInPost | null;
  selectedTone?: { bg: string; border: string; color: string; dot: string };
  isRescheduling: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onSelectPost: (postId: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#121a2e", letterSpacing: "-0.3px" }}>
            {isRescheduling ? "Modifier la date" : "Planifier un post"}
          </h3>
          <p style={{ margin: "4px 0 0", color: "rgba(18,26,46,0.45)", fontSize: 12, lineHeight: 1.4 }}>
            {isRescheduling ? "Change la date du post selectionne." : "Choisis un brouillon sans date, puis la date cible."}
          </p>
        </div>
        <button type="button" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 104px", gap: 8 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 7, color: "rgba(18,26,46,0.55)", fontSize: 12, fontWeight: 750 }}>Date</span>
            <input
              type="date"
              value={dateKey}
              onChange={(event) => onDateChange(event.target.value)}
              style={{ width: "100%", minHeight: 40, borderRadius: 11, border: "1px solid rgba(0,0,0,0.09)", background: "#f6f6f6", color: "#121a2e", padding: "0 12px", fontSize: 13, fontWeight: 650, boxSizing: "border-box", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", marginBottom: 7, color: "rgba(18,26,46,0.55)", fontSize: 12, fontWeight: 750 }}>Heure</span>
            <input
              type="time"
              value={time}
              onChange={(event) => onTimeChange(event.target.value)}
              style={{ width: "100%", minHeight: 40, borderRadius: 11, border: "1px solid rgba(0,0,0,0.09)", background: "#f6f6f6", color: "#121a2e", padding: "0 10px", fontSize: 13, fontWeight: 650, boxSizing: "border-box", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            />
          </label>
        </div>

        {selectedPost ? (
          <div style={{ border: `1px solid ${selectedTone?.border ?? "rgba(0,0,0,0.08)"}`, borderRadius: 14, background: selectedTone?.bg ?? "#fbfbfb", color: selectedTone?.color ?? "#121a2e", padding: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
            {selectedPost.analytics?.mediaPreviewUrl ? (
              <div style={{ width: 58, height: 58, borderRadius: 10, background: `url(${selectedPost.analytics.mediaPreviewUrl}) center / cover`, flexShrink: 0 }} />
            ) : null}
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: "inherit", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {selectedPost.content || "Brouillon sans titre"}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 11, color: "inherit", opacity: 0.58 }}>{selectedPost.type === "carousel" ? "Carrousel" : "Post"} · {selectedPost.styleName ?? "Sans style"}</p>
            </div>
          </div>
        ) : null}

        {!isRescheduling ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 800, color: "rgba(18,26,46,0.38)", letterSpacing: "0.45px", textTransform: "uppercase" }}>Brouillons disponibles</p>
            {drafts.length === 0 ? (
              <p style={{ margin: 0, padding: 14, borderRadius: 12, background: "#f6f6f6", color: "rgba(18,26,46,0.45)", fontSize: 12, textAlign: "center" }}>Aucun brouillon sans date.</p>
            ) : (
              drafts.map((post) => {
                const active = selectedPost?.id === post.id;
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => onSelectPost(post.id)}
                    style={{
                      border: active ? "1px solid rgba(18,26,46,0.22)" : "1px solid rgba(0,0,0,0.07)",
                      background: active ? "#fbfbfb" : "#fff",
                      borderRadius: 13,
                      padding: 9,
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                    }}
                  >
                    {post.analytics?.mediaPreviewUrl ? (
                      <span style={{ width: 44, height: 44, borderRadius: 9, background: `url(${post.analytics.mediaPreviewUrl}) center / cover`, flexShrink: 0 }} />
                    ) : null}
                    <span style={{ flex: 1, minWidth: 0, color: "#121a2e", fontSize: 12, fontWeight: 750, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {post.content || "Brouillon sans titre"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <div style={{ padding: 14, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <ClientBlueButton compact type="button" onClick={onSave} disabled={!selectedPost || !dateKey} wrapperStyle={{ width: "100%", display: "flex" }} style={{ width: "100%", justifyContent: "center" }}>
          {isRescheduling ? "Mettre a jour la date" : "Planifier ce post"}
        </ClientBlueButton>
      </div>
    </>
  );
}

function PostSideCard({ post, tone, onValidate, onOpen }: { post: LinkedInPost; tone?: { bg: string; border: string; color: string; dot: string }; onValidate?: () => void; onOpen?: () => void }) {
  const date = post.status === "scheduled"
    ? post.scheduledAt
    : post.analytics?.publishedDate
      ? new Date(`${post.analytics.publishedDate}T${post.analytics.publishedTime || "12:00"}:00`).toISOString()
      : post.publishedAt;
  const style = tone ?? STATUS_STYLES[post.status] ?? STATUS_STYLES.draft;
  const isAutoRecycle = Boolean(post.analytics?.autoRecycleSourcePostId);
  const statusLabel = isAutoRecycle ? "Relance auto" : post.status === "scheduled" ? "Planifie" : post.status === "published" ? "Valide LinkedIn" : "Brouillon";
  const mediaUrl = post.analytics?.mediaPreviewUrl;

  return (
    <div onClick={onOpen} style={{ borderRadius: 10, border: `1px solid ${isAutoRecycle ? "#d8b4fe" : style.border}`, background: isAutoRecycle ? "#faf5ff" : style.bg, padding: 12, cursor: onOpen ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {mediaUrl ? <div style={{ width: 34, height: 34, borderRadius: 7, background: `url(${mediaUrl}) center / cover`, flexShrink: 0 }} /> : null}
        <span style={{ fontSize: 12, fontWeight: 600, color: isAutoRecycle ? "#6d28d9" : style.color }}>{statusLabel}</span>
        {date && <span style={{ fontSize: 12, color: isAutoRecycle ? "#6d28d9" : style.color, opacity: 0.7, marginLeft: "auto" }}>{formatTime(date)}</span>}
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.5, color: isAutoRecycle ? "#6d28d9" : style.color, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {post.content}
      </p>
      {post.styleName && <p style={{ fontSize: 12, opacity: 0.6, margin: "6px 0 0", color: isAutoRecycle ? "#6d28d9" : style.color }}>Style: {post.styleName}</p>}
      {post.type === "carousel" && <span style={{ fontSize: 12, opacity: 0.6, color: isAutoRecycle ? "#6d28d9" : style.color }}>Carrousel · {post.slides?.length || 0} slides</span>}
      {isAutoRecycle && <p style={{ fontSize: 12, opacity: 0.78, margin: "6px 0 0", color: "#6d28d9" }}>Relance automatique top 25%</p>}
      {post.status === "scheduled" && !isAutoRecycle && onValidate ? (
        <button type="button" onClick={(event) => { event.stopPropagation(); onValidate(); }} style={{ marginTop: 10, width: "100%", minHeight: 40, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 10, background: "#fff", color: "#121a2e", padding: "0 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          Valider sur LinkedIn
        </button>
      ) : null}
    </div>
  );
}
