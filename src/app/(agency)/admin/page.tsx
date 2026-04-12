"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import {
  FolderKanban, Users, CheckSquare, Bell, ArrowRight, Plus,
  Clock, AlertCircle, CalendarDays, Zap, Flame,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AgendaTask {
  id: string; title: string; status: string; importance: number; start_time?: string;
}
interface Notification {
  id: string; title: string; message: string; type: string; read: boolean; created_at: string; project_id?: string;
}
interface Project {
  id: string; name: string; status: string; deadline?: string; current_stage?: string;
  clients?: { name: string };
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"tasks" | "notifications">("tasks");
  const [todayTasks, setTodayTasks] = useState<AgendaTask[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({ projects: 0, clients: 0, tasks: 0 });
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      const [projectsRes, clientsRes, tasksRes, notifsRes, agendaRes] = await Promise.all([
        supabase.from("projects").select("id, name, status, deadline, current_stage, clients(name)").eq("status", "active").order("deadline").limit(5),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
        userId ? supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [], count: 0 }),
        agendaFetch(`/api/agenda/tasks?date=${today}`).then(r => r.json()).catch(() => ({ tasks: [] })),
      ]);

      setProjects((projectsRes.data ?? []) as unknown as Project[]);
      setStats({
        projects: projectsRes.data?.length ?? 0,
        clients: clientsRes.count ?? 0,
        tasks: tasksRes.count ?? 0,
      });
      setNotifications((notifsRes.data ?? []) as Notification[]);
      setTodayTasks((agendaRes.tasks ?? []) as AgendaTask[]);
      setLoading(false);
    }
    load();
  }, [today]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unread = notifications.filter(n => !n.read).length;
  const urgentProjects = projects.filter(p => {
    if (!p.deadline) return false;
    const days = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86400000);
    return days <= 10;
  });

  const statusColor: Record<string, string> = {
    todo: "bg-gray-300", in_progress: "bg-indigo-500", done: "bg-green-500", cancelled: "bg-red-300",
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-64"><div className="text-gray-400">Chargement...</div></div>;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Link href="/admin/projects/new" className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} />Nouveau projet
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Projets actifs", value: stats.projects, icon: FolderKanban, color: "bg-indigo-50 text-indigo-600", href: "/admin/projects" },
          { label: "Clients", value: stats.clients, icon: Users, color: "bg-blue-50 text-blue-600", href: "/admin/clients" },
          { label: "Tâches en cours", value: stats.tasks, icon: CheckSquare, color: "bg-amber-50 text-amber-600", href: "/admin/projects" },
          { label: "Notifications", value: unread, icon: Bell, color: "bg-rose-50 text-rose-600", href: "#", onClick: () => setActiveTab("notifications") },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} onClick={stat.onClick}>
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.color}`}><stat.icon size={20} /></div>
                <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main panel */}
        <div className="col-span-2 space-y-6">
          {/* Agenda du jour */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <CalendarDays size={15} className="text-indigo-500" />
                <span className="text-sm font-medium text-gray-900">Habits — Aujourd'hui</span>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{todayTasks.length}</span>
              </div>
              <Link href="/admin/agenda" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Ouvrir →</Link>
            </div>
            <div className="p-4">
              {todayTasks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucune tâche planifiée aujourd'hui</p>
              ) : (
                <div className="space-y-1">
                  {todayTasks.slice(0, 5).map(task => (
                    <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${statusColor[task.status] ?? "bg-gray-300"}`} />
                      <span className={`text-sm flex-1 ${task.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>
                        {task.title}
                      </span>
                      {task.start_time && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />{task.start_time.slice(0, 5)}
                        </span>
                      )}
                      <div className="flex gap-0.5">
                        {Array.from({ length: task.importance }).map((_, i) => (
                          <Zap key={i} size={9} className="text-amber-400 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                  ))}
                  {todayTasks.length > 5 && (
                    <p className="text-xs text-gray-400 text-center pt-1">+{todayTasks.length - 5} autres tâches</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button onClick={() => setActiveTab("tasks")} className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "tasks" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                <CheckSquare size={14} />Tâches projets
              </button>
              <button onClick={() => setActiveTab("notifications")} className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "notifications" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                <Bell size={14} />Notifications
                {unread > 0 && <span className="bg-rose-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">{unread}</span>}
              </button>
            </div>

            {activeTab === "tasks" && (
              <div className="p-4">
                {projects.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Aucun projet actif</p>
                ) : (
                  <div className="space-y-1">
                    {projects.map(p => {
                      const days = p.deadline ? Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86400000) : null;
                      return (
                        <Link key={p.id} href={`/admin/projects/${p.id}`}>
                          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group transition-colors">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors truncate">{p.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {(p.clients as unknown as { name: string } | null)?.name ?? ""} · {p.current_stage ?? "En cours"}
                              </p>
                            </div>
                            {days !== null && (
                              <span className={`flex items-center gap-1 text-xs shrink-0 ${days <= 3 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-gray-400"}`}>
                                <Clock size={11} />{days}j
                              </span>
                            )}
                            <ArrowRight size={14} className="text-gray-300 group-hover:text-indigo-400" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
                <Link href="/admin/projects" className="flex items-center gap-1 mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  Voir tous les projets<ArrowRight size={14} />
                </Link>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="p-4">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Aucune notification</p>
                ) : (
                  <div className="space-y-2">
                    {notifications.map(n => (
                      <div key={n.id} onClick={() => markRead(n.id)} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? "bg-indigo-50/40" : ""}`}>
                        <div className={`p-1.5 rounded-lg shrink-0 ${n.type === "success" ? "bg-green-100" : n.type === "warning" ? "bg-amber-100" : n.type === "error" ? "bg-red-100" : "bg-blue-100"}`}>
                          <Bell size={13} className={n.type === "success" ? "text-green-600" : n.type === "warning" ? "text-amber-600" : n.type === "error" ? "text-red-600" : "text-blue-600"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{n.title}</p>
                            {!n.read && <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-6">
          {/* Projets urgents */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={15} className="text-orange-500" />
                <h2 className="font-semibold text-gray-900 text-sm">Projets urgents</h2>
              </div>
              <Link href="/admin/projects" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Voir tout</Link>
            </div>
            {urgentProjects.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Aucun projet urgent 🎉</p>
            ) : (
              <div className="space-y-1">
                {urgentProjects.map(p => {
                  const days = Math.ceil((new Date(p.deadline!).getTime() - Date.now()) / 86400000);
                  return (
                    <Link key={p.id} href={`/admin/projects/${p.id}`}>
                      <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 group transition-colors">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-xs group-hover:text-indigo-600 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{(p.clients as unknown as { name: string } | null)?.name ?? ""}</p>
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-medium shrink-0 ml-2 ${days <= 3 ? "text-red-600" : "text-orange-600"}`}>
                          <Clock size={10} />{days}j
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Raccourcis */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Accès rapide</h2>
            <div className="space-y-1">
              {[
                { href: "/admin/coach", label: "Coach IA", icon: "🤖", color: "text-purple-600" },
                { href: "/admin/notes", label: "Notes & Idées", icon: "💡", color: "text-yellow-600" },
                { href: "/admin/leads", label: "Leads CRM", icon: "📊", color: "text-blue-600" },
                { href: "/admin/agenda", label: "Habits", icon: "🔥", color: "text-red-500" },
              ].map(item => (
                <Link key={item.href} href={item.href}>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                    <span className="text-base">{item.icon}</span>
                    <span className={`text-sm font-medium ${item.color} group-hover:underline`}>{item.label}</span>
                    <ArrowRight size={13} className="ml-auto text-gray-300 group-hover:text-gray-500" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Habits streak */}
          <Link href="/admin/agenda/stats">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white hover:opacity-90 transition-opacity">
              <div className="flex items-center gap-2 mb-2">
                <Flame size={16} />
                <span className="text-sm font-medium">Habits</span>
              </div>
              <p className="text-xs opacity-80">Voir vos statistiques et points</p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium">
                Ouvrir les stats <ArrowRight size={12} />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
