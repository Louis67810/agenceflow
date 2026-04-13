"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Briefcase,
  PenLine,
  CheckSquare,
  ChevronDown,
  Zap,
  UserCheck,
  CalendarDays,
  Lightbulb,
  ClipboardList,
  Bot,
  HelpCircle,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgencyRole } from "@/types/agency";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const agendaSubNav: NavItem[] = [
  { href: "/admin/agenda", label: "Dashboard", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/agenda/calendar", label: "Calendrier", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/agenda/tasks", label: "Tâches", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/agenda/objectives", label: "Objectifs", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/agenda/habits", label: "Habitudes", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/agenda/recap", label: "Récap du jour", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/agenda/stats", label: "Statistiques", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/agenda/pomodoro", label: "Pomodoro", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/agenda/settings", label: "Paramètres", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
];

const linkedInSubNav: NavItem[] = [
  { href: "/admin/linkedin/posts", label: "Posts", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/linkedin/planification", label: "Planification", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/linkedin/style", label: "Style", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/linkedin/idees", label: "Idées", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
  { href: "/admin/linkedin/prospection", label: "Prospection", icon: <span className="w-1.5 h-1.5 rounded-full bg-current" /> },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/admin/projects", label: "Projets", icon: <FolderKanban size={18} /> },
  { href: "/admin/clients", label: "Clients", icon: <Users size={18} /> },
  { href: "/admin/designers", label: "Prestataires", icon: <Palette size={18} /> },
  { href: "/admin/copywriting", label: "Copywriting", icon: <PenLine size={18} /> },
  { href: "/admin/calendar", label: "Calendrier", icon: <Calendar size={18} /> },
  { href: "/admin/leads", label: "Leads", icon: <UserCheck size={18} /> },
  { href: "/admin/lead-magnet", label: "Lead Magnet", icon: <Zap size={18} /> },
  { href: "/admin/agenda", label: "Habits", icon: <CalendarDays size={18} /> },
  { href: "/admin/notes", label: "Notes & Idées", icon: <Lightbulb size={18} /> },
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
  const isOnLinkedIn = pathname.startsWith("/admin/linkedin");
  const isOnAgenda = pathname.startsWith("/admin/agenda");
  const [linkedInOpen, setLinkedInOpen] = useState(isOnLinkedIn);
  const [agendaOpen, setAgendaOpen] = useState(isOnAgenda);

  const navItems = role === "admin" ? adminNav : role === "client" ? clientNav : designerNav;

  const roleLabel =
    role === "admin" ? "Administration" : role === "client" ? "Espace Client" : "Espace Designer";

  // ── Client sidebar — design fidèle au Framer ────────────────────────────────
  if (role === "client") {
    const clientLinks = [
      { href: "/client", label: "Mon projet", icon: <LayoutDashboard size={18} />, exact: true },
      { href: "/client/messages", label: "Conversation", icon: <MessageSquare size={18} />, exact: false },
      { href: "/client/ressources", label: "Ressources", icon: <FolderOpen size={18} />, exact: false },
      { href: "/client/agenda", label: "Agenda", icon: <CalendarDays size={18} />, exact: false },
    ];

    return (
      <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col z-30"
        style={{ background: "#121a2e", borderRight: "1px solid rgba(255,255,255,0.08)" }}>

        {/* Header — logo + séparateur + "Espace Client" */}
        <div className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {/* Logo SVG simplifié */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
              <Briefcase size={13} className="text-gray-900" />
            </div>
          </div>
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
          <Link href="/client/aide"
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 9,
              fontSize: 14, lineHeight: "20px",
              color: "rgb(156,163,175)",
              textDecoration: "none",
            }}>
            <span style={{ display: "flex" }}><HelpCircle size={18} /></span>
            <span>Aide</span>
          </Link>

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
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 text-white flex flex-col z-30" style={{ background: "#121a2e" }}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Briefcase size={16} />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">AgenceFlow</p>
            <p className="text-xs text-gray-400">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          // Insert LinkedIn group after copywriting
          if (item.href === "/admin/calendar" && role === "admin") {
            return (
              <div key="linkedin-group">
                {/* LinkedIn collapsible group */}
                <button
                  onClick={() => setLinkedInOpen((o) => !o)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isOnLinkedIn
                      ? "bg-[#0A66C2] text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div className="w-[18px] h-[18px] bg-white rounded flex items-center justify-center shrink-0">
                    <span className="text-[#0A66C2] text-[10px] font-black leading-none">in</span>
                  </div>
                  <span className="flex-1 text-left">LinkedIn</span>
                  <ChevronDown
                    size={15}
                    className={`transition-transform ${linkedInOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {linkedInOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-700 pl-3">
                    {linkedInSubNav.map((sub) => {
                      const subActive = pathname.startsWith(sub.href);
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                            subActive
                              ? "text-white bg-white/7"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {sub.icon}
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Render the calendar item */}
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mt-1",
                    pathname.startsWith(item.href)
                      ? "bg-white/7 text-white rounded-lg"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </div>
            );
          }

          // Insert Agenda collapsible group
          if (item.href === "/admin/agenda" && role === "admin") {
            return (
              <div key="agenda-group">
                <button
                  onClick={() => setAgendaOpen((o) => !o)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isOnAgenda
                      ? "bg-white/7 text-white rounded-lg"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <CalendarDays size={18} />
                  <span className="flex-1 text-left">Habits</span>
                  <ChevronDown
                    size={15}
                    className={`transition-transform ${agendaOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {agendaOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-700 pl-3">
                    {agendaSubNav.map((sub) => {
                      const subActive = sub.href === "/admin/agenda"
                        ? pathname === sub.href
                        : pathname.startsWith(sub.href);
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                            subActive
                              ? "text-white bg-white/7"
                              : "text-gray-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          {sub.icon}
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
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
        })}
      </nav>

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
  );
}
