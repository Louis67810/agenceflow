"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock, Plus } from "lucide-react";
import { LinkedInPost } from "@/types/linkedin";
import Link from "next/link";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function getFirstDayOfMonth(year: number, month: number): number {
  // 0=Sun, make Mon=0
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isoToDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 border-gray-200 text-gray-600",
  scheduled: "bg-blue-50 border-blue-200 text-blue-700",
  published: "bg-green-50 border-green-200 text-green-700",
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-gray-400",
  scheduled: "bg-blue-500",
  published: "bg-green-500",
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
      try {
        setPosts(JSON.parse(saved));
      } catch {
        setPosts([]);
      }
    }
  }, []);

  const prevMonth = () => {
    setCurrent((c) => {
      if (c.month === 0) return { year: c.year - 1, month: 11 };
      return { year: c.year, month: c.month - 1 };
    });
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrent((c) => {
      if (c.month === 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: c.month + 1 };
    });
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrent({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDate(null);
  };

  // Build map: dateKey -> posts[]
  const postsByDate: Record<string, LinkedInPost[]> = {};
  posts.forEach((p) => {
    const dateKey =
      p.status === "scheduled" && p.scheduledAt
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

  // Stats
  const monthKey = `${current.year}-${String(current.month + 1).padStart(2, "0")}`;
  const monthPosts = posts.filter((p) => {
    const date =
      p.status === "scheduled" ? p.scheduledAt : p.status === "published" ? p.publishedAt : null;
    return date && date.startsWith(monthKey);
  });
  const scheduledThisMonth = monthPosts.filter((p) => p.status === "scheduled").length;
  const publishedThisMonth = monthPosts.filter((p) => p.status === "published").length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-lg font-semibold text-gray-900 w-44 text-center">
                {MONTHS[current.month]} {current.year}
              </h2>
              <button
                onClick={nextMonth}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Aujourd'hui
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-600">{scheduledThisMonth} planifiés</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-gray-600">{publishedThisMonth} publiés</span>
            </div>
            <Link
              href="/admin/linkedin/posts"
              className="flex items-center gap-1.5 bg-[#0A66C2] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#0057a3] transition-colors"
            >
              <Plus size={14} />
              Nouveau post
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Calendar */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium text-gray-400 py-2 uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            className="grid grid-cols-7 gap-1 flex-1"
            style={{
              gridTemplateRows: `repeat(${totalCells / 7}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: totalCells }).map((_, i) => {
              const dayNum = i - firstDay + 1;
              const isValid = dayNum >= 1 && dayNum <= daysInMonth;
              if (!isValid)
                return <div key={i} className="rounded-xl" />;

              const dateKey = `${current.year}-${String(current.month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const dayPosts = postsByDate[dateKey] || [];
              const isToday = dateKey === todayKey;
              const isSelected = dateKey === selectedDate;

              return (
                <button
                  key={i}
                  onClick={() =>
                    setSelectedDate(isSelected ? null : dateKey)
                  }
                  className={`rounded-xl p-2 flex flex-col gap-1 text-left transition-all border ${
                    isSelected
                      ? "border-[#0A66C2] bg-blue-50 shadow-sm"
                      : isToday
                      ? "border-[#0A66C2]/30 bg-blue-50/30"
                      : "border-transparent hover:border-gray-200 hover:bg-white"
                  }`}
                >
                  <span
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-[#0A66C2] text-white"
                        : isSelected
                        ? "text-[#0A66C2]"
                        : "text-gray-700"
                    }`}
                  >
                    {dayNum}
                  </span>

                  {dayPosts.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      className={`text-xs px-1.5 py-0.5 rounded-md border truncate ${STATUS_COLORS[p.status]}`}
                    >
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${STATUS_DOT[p.status]}`}
                      />
                      {p.content.slice(0, 20)}...
                    </div>
                  ))}
                  {dayPosts.length > 3 && (
                    <span className="text-xs text-gray-400 pl-1">
                      +{dayPosts.length - 3}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-hidden shrink-0">
          {selectedDate ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                    "fr-FR",
                    { weekday: "long", day: "numeric", month: "long" }
                  )}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedPosts.length} post{selectedPosts.length > 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {selectedPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Calendar size={20} className="text-gray-300 mb-2" />
                    <p className="text-xs text-gray-400">
                      Aucun post ce jour
                    </p>
                    <Link
                      href="/admin/linkedin/posts"
                      className="mt-2 text-xs text-[#0A66C2] hover:underline"
                    >
                      Créer un post
                    </Link>
                  </div>
                ) : (
                  selectedPosts.map((p) => (
                    <PostSideCard key={p.id} post={p} />
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Calendar size={24} className="text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">
                Sélectionnez un jour
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Cliquez sur une date pour voir les posts planifiés
              </p>
            </div>
          )}

          {/* Upcoming */}
          <div className="border-t border-gray-100 p-3">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              Prochains posts
            </p>
            {posts
              .filter(
                (p) =>
                  p.status === "scheduled" &&
                  p.scheduledAt &&
                  new Date(p.scheduledAt) > today
              )
              .sort((a, b) =>
                new Date(a.scheduledAt!).getTime() -
                new Date(b.scheduledAt!).getTime()
              )
              .slice(0, 4)
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0"
                  onMouseEnter={() => setHoveredPost(p.id)}
                  onMouseLeave={() => setHoveredPost(null)}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">
                      {p.content.slice(0, 40)}...
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock size={10} className="text-gray-400" />
                      <span className="text-xs text-gray-400">
                        {new Date(p.scheduledAt!).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        à {formatTime(p.scheduledAt!)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            {posts.filter(
              (p) =>
                p.status === "scheduled" &&
                p.scheduledAt &&
                new Date(p.scheduledAt) > today
            ).length === 0 && (
              <p className="text-xs text-gray-400 py-2">
                Aucun post planifié
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PostSideCard({ post }: { post: LinkedInPost }) {
  const date =
    post.status === "scheduled" ? post.scheduledAt : post.publishedAt;

  return (
    <div
      className={`rounded-lg border p-3 ${STATUS_COLORS[post.status]}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[post.status]}`} />
        <span className="text-xs font-medium capitalize">
          {post.status === "scheduled"
            ? "Planifié"
            : post.status === "published"
            ? "Publié"
            : "Brouillon"}
        </span>
        {date && (
          <span className="text-xs opacity-70 ml-auto">{formatTime(date)}</span>
        )}
      </div>
      <p className="text-xs leading-relaxed line-clamp-3">{post.content}</p>
      {post.styleName && (
        <p className="text-xs opacity-60 mt-1.5">Style: {post.styleName}</p>
      )}
      {post.type === "carousel" && (
        <span className="text-xs opacity-60">
          Carrousel · {post.slides?.length || 0} slides
        </span>
      )}
    </div>
  );
}
