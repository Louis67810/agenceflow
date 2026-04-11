"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, CheckSquare, Calendar, Target, Repeat,
  BarChart2, Timer, Settings, Flame
} from "lucide-react";
import { cn } from "@/lib/utils";

const agendaNav = [
  { href: "/admin/agenda", label: "Dashboard", icon: <LayoutDashboard size={15} />, exact: true },
  { href: "/admin/agenda/calendar", label: "Calendrier", icon: <Calendar size={15} /> },
  { href: "/admin/agenda/tasks", label: "Tâches", icon: <CheckSquare size={15} /> },
  { href: "/admin/agenda/objectives", label: "Objectifs", icon: <Target size={15} /> },
  { href: "/admin/agenda/habits", label: "Habitudes", icon: <Repeat size={15} /> },
  { href: "/admin/agenda/recap", label: "Récap du jour", icon: <Flame size={15} /> },
  { href: "/admin/agenda/stats", label: "Statistiques", icon: <BarChart2 size={15} /> },
  { href: "/admin/agenda/pomodoro", label: "Pomodoro", icon: <Timer size={15} /> },
  { href: "/admin/agenda/settings", label: "Paramètres", icon: <Settings size={15} /> },
];

export default function AgendaLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full">
      {/* Sub-sidebar */}
      <aside className="w-48 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col py-4">
        <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Agenda
        </p>
        <nav className="space-y-0.5 px-2">
          {agendaNav.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
