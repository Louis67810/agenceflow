"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Palette,
  Calendar,
  FileText,
  MessageSquare,
  Settings,
  LogOut,
  PenLine,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Zap,
  UserCheck,
  CalendarDays,
  Lightbulb,
  ClipboardList,
  ClipboardCheck,
  Bot,
  HelpCircle,
  FolderOpen,
  Target,
  Repeat,
  Timer,
  BarChart2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgencyRole } from "@/types/agency";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const agendaSubNav: NavItem[] = [
  { href: "/admin/agenda", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/admin/agenda/calendar", label: "Calendrier", icon: <Calendar size={18} /> },
  { href: "/admin/agenda/tasks", label: "Tâches", icon: <CheckSquare size={18} /> },
  { href: "/admin/agenda/objectives", label: "Objectifs", icon: <Target size={18} /> },
  { href: "/admin/agenda/habits", label: "Habitudes", icon: <Repeat size={18} /> },
  { href: "/admin/agenda/recap", label: "Récap du jour", icon: <FileText size={18} /> },
  { href: "/admin/agenda/pomodoro", label: "Pomodoro", icon: <Timer size={18} /> },
  { href: "/admin/agenda/settings", label: "Paramètres", icon: <Settings size={18} /> },
];

const linkedInSubNav: NavItem[] = [
  { href: "/admin/linkedin/posts", label: "Post", icon: <PenLine size={18} /> },
  { href: "/admin/linkedin/carrousel", label: "Carrousel", icon: <FileText size={18} /> },
  { href: "/admin/linkedin/planification", label: "Planification", icon: <CalendarDays size={18} /> },
  { href: "/admin/linkedin/statistiques", label: "Statistiques", icon: <BarChart2 size={18} /> },
  { href: "/admin/linkedin/style", label: "Style", icon: <Palette size={18} /> },
  { href: "/admin/linkedin/idees", label: "Idées", icon: <Lightbulb size={18} /> },
  { href: "/admin/linkedin/prospection", label: "Prospection", icon: <UserCheck size={18} /> },
  { href: "/admin/lead-magnet", label: "Lead Magnet", icon: <Zap size={18} /> },
  { href: "/admin/linkedin/parametres", label: "Parametres", icon: <Settings size={18} /> },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/admin/projects", label: "Projets", icon: <FolderKanban size={18} /> },
  { href: "/admin/clients", label: "Clients", icon: <Users size={18} /> },
  { href: "/admin/designers", label: "Prestataires", icon: <Palette size={18} /> },
  { href: "/admin/copywriting", label: "Copywriting", icon: <PenLine size={18} /> },
  { href: "/admin/articles", label: "Articles", icon: <FileText size={18} /> },
  { href: "/admin/calendar", label: "Calendrier", icon: <Calendar size={18} /> },
  { href: "/admin/leads", label: "Leads", icon: <UserCheck size={18} /> },
  { href: "/admin/cold-calls", label: "Appel à froid", icon: <UserCheck size={18} /> },
  { href: "/admin/audit", label: "Audit", icon: <ClipboardCheck size={18} /> },
  { href: "/admin/agenda", label: "Habits", icon: <CalendarDays size={18} /> },
  { href: "/admin/tests", label: "Tests Prestataires", icon: <ClipboardList size={18} /> },
  { href: "/admin/coach", label: "Coach IA", icon: <Bot size={18} /> },
  { href: "/admin/forms", label: "Formulaires", icon: <FileText size={18} /> },
  { href: "/admin/settings", label: "Paramètres", icon: <Settings size={18} /> },
];

const clientNav: NavItem[] = [
  { href: "/client", label: "Mon Projet", icon: <LayoutDashboard size={18} /> },
  { href: "/client/messages", label: "Conversation", icon: <MessageSquare size={18} /> },
  { href: "/client/projects", label: "Ressources", icon: <FolderKanban size={18} /> },
];

const designerNav: NavItem[] = [
  { href: "/designer", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/designer/projects", label: "Mes projets", icon: <FolderKanban size={18} /> },
  { href: "/designer/tasks", label: "Mes tâches", icon: <CheckSquare size={18} /> },
  { href: "/designer/tests", label: "Tests", icon: <ClipboardList size={18} /> },
];

interface AgencySidebarProps {
  role: AgencyRole;
  userName?: string;
}

export function AgencySidebar({ role, userName = "Utilisateur" }: AgencySidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isOnLinkedIn = pathname.startsWith("/admin/linkedin") || pathname.startsWith("/admin/lead-magnet");
  const isOnAgenda = pathname.startsWith("/admin/agenda");
  const [linkedInOpen, setLinkedInOpen] = useState(isOnLinkedIn);
  const [agendaOpen, setAgendaOpen] = useState(isOnAgenda);

  useEffect(() => {
    if (isOnLinkedIn) { setLinkedInOpen(true); setAgendaOpen(false); }
    if (isOnAgenda) { setAgendaOpen(true); setLinkedInOpen(false); }
  }, [isOnLinkedIn, isOnAgenda]);

  const navItems = role === "admin" ? adminNav : role === "client" ? clientNav : designerNav;

  const roleLabel =
    role === "admin" ? "Administration" : role === "client" ? "Espace Client" : "Espace Designer";
  const mobileSubNav = role === "admin"
    ? isOnLinkedIn
      ? linkedInSubNav
      : isOnAgenda
        ? agendaSubNav
        : adminNav
    : null;

  // ── Client sidebar — design fidèle au Framer ────────────────────────────────
  if (role === "client") {
    const clientLinks = [
      { href: "/client", label: "Mon projet", icon: <LayoutDashboard size={18} />, exact: true },
      { href: "/client/taches", label: "Tâches", icon: <ClipboardCheck size={18} />, exact: false },
      { href: "/client/ressources", label: "Ressources", icon: <FolderOpen size={18} />, exact: false },
      { href: "/client/agenda", label: "Agenda", icon: <CalendarDays size={18} />, exact: false },
    ];

    return (
      <>
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col lg:flex"
        style={{ background: "#121a2e", borderRight: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Header — logo blanc + séparateur + "Espace Client" */}
        <div className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Logo Ruff — version fond sombre */}
          <svg width="44" height="28" viewBox="0 0 61 39" fill="none" style={{ flexShrink: 0 }}>
            <path d="M0 12.5693C0 10.4559 1.55086 8.66264 3.64216 8.35791L56.1305 0.709556C58.6981 0.335424 61 2.32622 61 4.92089V33.9341C61 36.4665 58.8019 38.4386 56.2843 38.165L3.79593 32.4597C1.63623 32.2249 0 30.4012 0 28.2288V12.5693Z" fill="#4D5362"/>
            <path d="M45.291 20.5469L45.329 32.6905L47.6887 33.0077L50.0536 33.3252V24.5752L50.0795 22.9212H52.7067H55.3598V20.3972V18.7136L52.7455 18.6887L50.1183 18.6512L50.0795 17.7408L50.0536 11.1598C50.0536 11.1598 51.954 10.8025 53.1759 10.5975C54.2205 10.4221 55.8552 10.1757 55.8552 10.1757L56.1363 10.1411V6.18944L50.5691 6.93708L45.291 7.646V20.5469Z" fill="#121A2E"/>
            <path d="M33.3276 19.84V31.0784L35.6894 31.3951L38.0902 31.7178V23.8683L38.1161 22.2143H40.7433H43.3964V19.6903V18.0066L40.7821 17.9817L38.1549 17.9443L38.1161 17.0339L38.0902 11.9892L41.2143 11.453L43.8732 10.969L44.1729 10.9129V7.79574L38.7207 8.52819L33.3037 9.25597L33.3276 19.84Z" fill="#121A2E"/>
            <path d="M19.4502 11.1183V13.1213V18.7551V25.375C19.4502 27.3295 20.6678 29.3628 21.9247 29.5482L27.8507 30.344C30.8293 30.7442 31.749 27.6117 31.749 25.5694V24.8906V18.6829V9.46617L29.6473 9.74815L27.2842 10.0654L27.3224 18.3211V25.2196C27.0851 26.3062 24.5136 26.2762 24.0423 25.2196C23.9923 25.099 23.9643 18.2586 23.9643 18.2586V10.5121L22.0801 10.7649L19.4502 11.1183Z" fill="#121A2E"/>
            <path d="M5.52344 20.2215V27.344L7.81383 27.6512L9.55326 27.8845V25.1198V22.9705H10.5092C11.0503 22.9353 11.2489 22.9705 11.6863 23.4079C12.0452 23.7638 11.9748 23.9233 12.4278 25.1198L13.1614 28.3696L15.6204 28.6997L18.5032 29.0869L17.2849 25.7977L16.0697 23.158L15.6199 22.2833L16.1697 21.7085C17.2193 20.6339 17.6691 19.0094 17.4067 17.2851C17.0818 15.0608 15.8164 12.3734 13.6296 11.8986L9.22525 12.4899L5.52344 12.9863V20.2215ZM12.3179 16.754C12.724 17.1601 12.6803 18.4097 12.3179 18.8595C12.1055 19.1219 11.74 19.2094 10.8653 19.2469H9.55326V18.1722V16.3323H10.8653C11.6025 16.3323 12.0836 16.5197 12.3179 16.754Z" fill="#121A2E"/>
          </svg>
          {/* Séparateur vertical */}
          <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
          {/* Label */}
          <span style={{ fontSize: 14, fontWeight: 500, lineHeight: "20px", color: "rgb(255,255,255)" }}>
            Espace Client
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {clientLinks.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            if (isActive) {
              return (
                <Link key={item.href} href={item.href}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 9,
                    fontSize: 14, fontWeight: 500, lineHeight: "20px",
                    color: "rgb(255,255,255)",
                    background: "rgba(255,255,255,0.07)",
                    textDecoration: "none",
                  }}>
                  <span style={{ color: "rgb(255,255,255)", display: "flex" }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            }

            return (
              <Link key={item.href} href={item.href}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 9,
                  fontSize: 14, lineHeight: "20px",
                  color: "rgb(156,163,175)",
                  textDecoration: "none",
                }}>
                <span style={{ color: "rgb(156,163,175)", display: "flex" }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("cf_tutorial_done");
                window.location.href = "/client";
              }
            }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 9,
              fontSize: 14, lineHeight: "20px",
              color: "rgb(156,163,175)",
              background: "none", border: "none",
              cursor: "pointer", width: "100%",
              textAlign: "left",
            }}>
            <span style={{ display: "flex" }}><HelpCircle size={18} /></span>
            <span>Aide</span>
          </button>

          <Link href="/client/parametres"
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 9,
              fontSize: 14, lineHeight: "20px",
              color: "rgb(156,163,175)",
              textDecoration: "none",
            }}>
            <span style={{ display: "flex" }}><Settings size={18} /></span>
            <span>Paramètres</span>
          </Link>

          <form action="/api/auth/signout" method="POST">
            <button type="submit"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                width: "100%", padding: "12px 14px", borderRadius: 9,
                fontSize: 14, lineHeight: "20px",
                color: "rgb(156,163,175)",
                background: "none", border: "none", cursor: "pointer",
              }}>
              <LogOut size={18} />
              <span>Déconnexion</span>
            </button>
          </form>
        </div>
      </aside>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#121a2e]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_34px_rgba(18,26,46,0.22)] backdrop-blur lg:hidden"
        aria-label="Navigation client mobile"
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-white/70">Espace client</span>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="text-xs font-semibold text-white/70">Sortir</button>
          </form>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {clientLinks.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-[78px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold no-underline",
                  active ? "bg-white text-[#121a2e]" : "bg-white/7 text-white/72"
                )}
              >
                <span className="flex h-[18px] w-[18px] items-center justify-center">{item.icon}</span>
                <span className="max-w-[92px] truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      </>
    );
  }

  return (
    <>
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col text-white lg:flex" style={{ background: "#121a2e" }}>
      {/* Header — même design que la sidebar client */}
      <div className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <svg width="44" height="28" viewBox="0 0 61 39" fill="none" style={{ flexShrink: 0 }}>
          <path d="M0 12.5693C0 10.4559 1.55086 8.66264 3.64216 8.35791L56.1305 0.709556C58.6981 0.335424 61 2.32622 61 4.92089V33.9341C61 36.4665 58.8019 38.4386 56.2843 38.165L3.79593 32.4597C1.63623 32.2249 0 30.4012 0 28.2288V12.5693Z" fill="#4D5362"/>
          <path d="M45.291 20.5469L45.329 32.6905L47.6887 33.0077L50.0536 33.3252V24.5752L50.0795 22.9212H52.7067H55.3598V20.3972V18.7136L52.7455 18.6887L50.1183 18.6512L50.0795 17.7408L50.0536 11.1598C50.0536 11.1598 51.954 10.8025 53.1759 10.5975C54.2205 10.4221 55.8552 10.1757 55.8552 10.1757L56.1363 10.1411V6.18944L50.5691 6.93708L45.291 7.646V20.5469Z" fill="#121A2E"/>
          <path d="M33.3276 19.84V31.0784L35.6894 31.3951L38.0902 31.7178V23.8683L38.1161 22.2143H40.7433H43.3964V19.6903V18.0066L40.7821 17.9817L38.1549 17.9443L38.1161 17.0339L38.0902 11.9892L41.2143 11.453L43.8732 10.969L44.1729 10.9129V7.79574L38.7207 8.52819L33.3037 9.25597L33.3276 19.84Z" fill="#121A2E"/>
          <path d="M19.4502 11.1183V13.1213V18.7551V25.375C19.4502 27.3295 20.6678 29.3628 21.9247 29.5482L27.8507 30.344C30.8293 30.7442 31.749 27.6117 31.749 25.5694V24.8906V18.6829V9.46617L29.6473 9.74815L27.2842 10.0654L27.3224 18.3211V25.2196C27.0851 26.3062 24.5136 26.2762 24.0423 25.2196C23.9923 25.099 23.9643 18.2586 23.9643 18.2586V10.5121L22.0801 10.7649L19.4502 11.1183Z" fill="#121A2E"/>
          <path d="M5.52344 20.2215V27.344L7.81383 27.6512L9.55326 27.8845V25.1198V22.9705H10.5092C11.0503 22.9353 11.2489 22.9705 11.6863 23.4079C12.0452 23.7638 11.9748 23.9233 12.4278 25.1198L13.1614 28.3696L15.6204 28.6997L18.5032 29.0869L17.2849 25.7977L16.0697 23.158L15.6199 22.2833L16.1697 21.7085C17.2193 20.6339 17.6691 19.0094 17.4067 17.2851C17.0818 15.0608 15.8164 12.3734 13.6296 11.8986L9.22525 12.4899L5.52344 12.9863V20.2215ZM12.3179 16.754C12.724 17.1601 12.6803 18.4097 12.3179 18.8595C12.1055 19.1219 11.74 19.2094 10.8653 19.2469H9.55326V18.1722V16.3323H10.8653C11.6025 16.3323 12.0836 16.5197 12.3179 16.754Z" fill="#121A2E"/>
        </svg>
        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 500, lineHeight: "20px", color: "rgb(255,255,255)" }}>
          {roleLabel}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {linkedInOpen ? (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setLinkedInOpen(false)}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5"
            >
              <ArrowLeft size={15} />
              <span>Retour</span>
            </button>
            {linkedInSubNav.map((sub, index) => {
              const subActive =
                sub.href === "/admin/linkedin/posts"
                  ? pathname === sub.href
                  : pathname.startsWith(sub.href);
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    subActive ? "bg-white/7 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                  style={{ animation: `linkedin-nav-enter 320ms ease ${index * 38}ms both` }}
                >
                  <span className="flex h-[18px] w-[18px] items-center justify-center shrink-0">{sub.icon}</span>
                  <span>{sub.label}</span>
                </Link>
              );
            })}
          </div>
        ) : agendaOpen ? (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setAgendaOpen(false)}
              className="mb-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/5"
            >
              <ArrowLeft size={15} />
              <span>Retour</span>
            </button>
            {agendaSubNav.map((sub, index) => {
              const subActive = sub.href === "/admin/agenda"
                ? pathname === sub.href
                : pathname.startsWith(sub.href);
              return (
                <Link
                  key={sub.href}
                  href={sub.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    subActive ? "bg-white/7 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                  style={{ animation: `linkedin-nav-enter 320ms ease ${index * 38}ms both` }}
                >
                  <span className="flex h-[18px] w-[18px] items-center justify-center shrink-0">{sub.icon}</span>
                  <span>{sub.label}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          navItems.map((item) => {
            if (item.href === "/admin/calendar" && role === "admin") {
              return (
                <div key="linkedin-group">
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedInOpen(true);
                      if (!isOnLinkedIn && pathname !== "/admin/lead-magnet") router.push("/admin/linkedin/posts");
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isOnLinkedIn ? "bg-white/7 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <div className="w-[18px] h-[18px] bg-white rounded flex items-center justify-center shrink-0">
                      <span className="text-[#0A66C2] text-[10px] font-black leading-none">in</span>
                    </div>
                    <span className="flex-1 text-left">LinkedIn</span>
                    <ChevronRight size={15} />
                  </button>

                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-1",
                      pathname.startsWith(item.href) ? "bg-white/7 text-white rounded-lg" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </div>
              );
            }

            if (item.href === "/admin/agenda" && role === "admin") {
              return (
                <div key="agenda-group">
                  <button
                    type="button"
                    onClick={() => {
                      setAgendaOpen(true);
                      if (!isOnAgenda) router.push("/admin/agenda");
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isOnAgenda ? "bg-white/7 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <CalendarDays size={18} />
                    <span className="flex-1 text-left">Habits</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              );
            }

            const isActive =
              item.href === `/${role}`
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-white/7 text-white rounded-lg"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })
        )}
      </nav>
      <style>{`@keyframes linkedin-nav-enter { from { opacity: 0; filter: blur(10px); transform: translateY(-10px); } to { opacity: 1; filter: blur(0); transform: translateY(0); } }`}</style>

      {/* User + Actions */}
      <div className="px-3 py-4 border-t border-gray-700 space-y-1">
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-white/5 hover:text-red-400 transition-colors">
            <LogOut size={18} />
            Déconnexion
          </button>
        </form>
        <div className="px-3 py-2 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-sm font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-gray-400 capitalize">{role}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
    {mobileSubNav && (
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#121a2e]/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_34px_rgba(18,26,46,0.22)] backdrop-blur lg:hidden"
        aria-label={isOnLinkedIn ? "Navigation LinkedIn mobile" : "Navigation Habits mobile"}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <Link href="/admin" className="text-xs font-semibold text-white/70 no-underline">
            Admin
          </Link>
          <span className="text-xs font-semibold text-white">
            {isOnLinkedIn ? "LinkedIn" : isOnAgenda ? "Habits" : "Admin"}
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          {mobileSubNav.map((sub) => {
            const active = sub.href === "/admin" || sub.href === "/admin/linkedin/posts" || sub.href === "/admin/agenda"
              ? pathname === sub.href
              : pathname.startsWith(sub.href);
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className={cn(
                  "flex min-w-[74px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-semibold no-underline",
                  active ? "bg-white text-[#121a2e]" : "bg-white/7 text-white/72"
                )}
              >
                <span className="flex h-[18px] w-[18px] items-center justify-center">{sub.icon}</span>
                <span className="max-w-[86px] truncate">{sub.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    )}
    </>
  );
}
