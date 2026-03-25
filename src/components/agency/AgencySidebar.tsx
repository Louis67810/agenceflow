"use client";

import type { ReactNode } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgencyRole } from "@/types/agency";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/admin/projects", label: "Projets", icon: <FolderKanban size={18} /> },
  { href: "/admin/clients", label: "Clients", icon: <Users size={18} /> },
  { href: "/admin/designers", label: "Prestataires", icon: <Palette size={18} /> },
  { href: "/admin/calendar", label: "Calendrier", icon: <Calendar size={18} /> },
  { href: "/admin/forms", label: "Formulaires", icon: <FileText size={18} /> },
];

const clientNav: NavItem[] = [
  { href: "/client", label: "Mon espace", icon: <LayoutDashboard size={18} /> },
  { href: "/client/projects", label: "Mes projets", icon: <FolderKanban size={18} /> },
  { href: "/client/messages", label: "Messages", icon: <MessageSquare size={18} /> },
];

const designerNav: NavItem[] = [
  { href: "/designer", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { href: "/designer/projects", label: "Mes projets", icon: <FolderKanban size={18} /> },
  { href: "/designer/tasks", label: "Tâches", icon: <FileText size={18} /> },
  { href: "/designer/messages", label: "Messages", icon: <MessageSquare size={18} /> },
];

interface AgencySidebarProps {
  role: AgencyRole;
  userName?: string;
}

export function AgencySidebar({ role, userName = "Utilisateur" }: AgencySidebarProps) {
  const pathname = usePathname();

  const navItems = role === "admin" ? adminNav : role === "client" ? clientNav : designerNav;

  const roleLabel =
    role === "admin" ? "Administration" : role === "client" ? "Espace Client" : "Espace Designer";

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white flex flex-col z-30">
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
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
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
        <Link
          href={`/${role}/settings`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <Settings size={18} />
          Paramètres
        </Link>
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors">
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
