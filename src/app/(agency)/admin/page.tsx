"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import {
  FolderKanban, Users, CheckSquare, Bell, ArrowRight, Plus,
  Clock, AlertCircle, CalendarDays, Zap, Flame, Bot,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

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
  id: string; name: string; status: string; deadline?: string | null; current_stage?: string | null;
  client_name?: string | null; client_email?: string | null;
  clients?: { name: string } | null;
}
interface AccessKey {
  id: string; role: "client" | "designer" | string; used_at: string | null;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"tasks" | "notifications">("tasks");
  const [todayTasks, setTodayTasks] = useState<AgendaTask[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({ projects: 0, clients: 0, connectedClients: 0, tasks: 0 });
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      const [projectsRes, keysRes, tasksRes, notifsRes, agendaRes] = await Promise.all([
        fetch("/api/projects").then(r => r.json()).catch(() => ({ projects: [] })),
        fetch("/api/keys").then(r => r.json()).catch(() => ({ keys: [] })),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
        userId ? supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10) : Promise.resolve({ data: [], count: 0 }),
        agendaFetch(`/api/agenda/tasks?date=${today}`).then(r => r.json()).catch(() => ({ tasks: [] })),
      ]);

      const allProjects = ((projectsRes.projects ?? []) as Project[]);
      const activeProjects = allProjects.filter((project) => project.status !== "completed");
      const clientKeys = ((keysRes.keys ?? []) as AccessKey[]).filter((key) => key.role === "client");

      setProjects(
        activeProjects
          .slice()
          .sort((a, b) => {
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          })
          .slice(0, 5)
      );
      setStats({
        projects: activeProjects.length,
        clients: clientKeys.length,
        connectedClients: clientKeys.filter((key) => Boolean(key.used_at)).length,
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
  const getClientName = (project: Project) => project.client_name ?? project.clients?.name ?? "Client non renseigné";

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#fbfbfb", ...jakartaSans }}>
        <p style={{ color: "rgba(18,26,46,0.4)", fontSize: 14 }}>Chargement...</p>
      </div>
    );
  }

  const cardStyle = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.13)",
    borderRadius: 13,
    boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
  };

  return (
    <div className="admin-dashboard-root" style={{ padding: 32, background: "#fbfbfb", minHeight: "100vh", ...jakartaSans }}>
      {/* Header */}
      <div className="admin-dashboard-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.45px" }}>Dashboard</h1>
          <p style={{ color: "rgba(18,26,46,0.5)", marginTop: 4, fontSize: 14, margin: "4px 0 0" }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Link href="/admin/projects/new" className="admin-dashboard-new-project" style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
          color: "#fff", padding: "11px 16px", borderRadius: 10,
          fontSize: 13, fontWeight: 600, textDecoration: "none",
          border: "1px solid #2f4d9d",
          boxShadow: "inset 0px -2px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.2)",
          letterSpacing: "-0.3px",
        }}>
          <Plus size={15} />Nouveau projet
        </Link>
      </div>

      {/* Stats */}
      <div className="admin-dashboard-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Projets actifs", value: stats.projects, helper: "hors terminés", icon: FolderKanban, bg: "#e8edff", color: "#0147ff", href: "/admin/projects", onClick: undefined },
          { label: "Clients", value: stats.clients, helper: `${stats.connectedClients} connecté${stats.connectedClients !== 1 ? "s" : ""}`, icon: Users, bg: "#d5eeff", color: "#073e63", href: "/admin/clients", onClick: undefined },
          { label: "Tâches en cours", value: stats.tasks, helper: "projets", icon: CheckSquare, bg: "#fee6d0", color: "#663b12", href: "/admin/projects", onClick: undefined },
          { label: "Notifications", value: unread, helper: "non lues", icon: Bell, bg: "#E1D1FA", color: "#6236AA", href: "#", onClick: () => setActiveTab("notifications") },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href} onClick={stat.onClick} style={{ textDecoration: "none" }}>
            <div className="admin-dashboard-card" style={{ ...cardStyle, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: stat.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <stat.icon size={18} style={{ color: stat.color }} />
                </div>
                <ArrowRight size={15} style={{ color: "rgba(18,26,46,0.2)" }} />
              </div>
              <p style={{ fontSize: 26, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.5px" }}>{stat.value}</p>
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", margin: "2px 0 0" }}>{stat.label}</p>
              {stat.helper && <p style={{ fontSize: 11, color: "rgba(18,26,46,0.38)", margin: "4px 0 0" }}>{stat.helper}</p>}
            </div>
          </Link>
        ))}
      </div>

      <div className="admin-dashboard-content-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        {/* Main panel */}
        <div className="admin-dashboard-main-panel" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Agenda du jour */}
          <div className="admin-dashboard-card" style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarDays size={15} style={{ color: "#0147ff" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#121a2e", letterSpacing: "-0.3px" }}>Habits — Aujourd'hui</span>
                <span style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", background: "rgba(18,26,46,0.06)", borderRadius: 20, padding: "1px 8px" }}>{todayTasks.length}</span>
              </div>
              <Link href="/admin/agenda" style={{ fontSize: 13, color: "#0147ff", textDecoration: "none", fontWeight: 500 }}>Ouvrir →</Link>
            </div>
            <div style={{ padding: 16 }}>
              {todayTasks.length === 0 ? (
                <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)", textAlign: "center", padding: "16px 0" }}>Aucune tâche planifiée aujourd'hui</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {todayTasks.slice(0, 5).map(task => {
                    const dotColor = task.status === "done" ? "#168b64" : task.status === "in_progress" ? "#0147ff" : task.status === "cancelled" ? "#ef4444" : "rgba(18,26,46,0.2)";
                    return (
                      <div key={task.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 9 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, flex: 1, color: task.status === "done" ? "rgba(18,26,46,0.35)" : "#121a2e", textDecoration: task.status === "done" ? "line-through" : "none" }}>
                          {task.title}
                        </span>
                        {task.start_time && (
                          <span style={{ fontSize: 11, color: "rgba(18,26,46,0.4)", display: "flex", alignItems: "center", gap: 3 }}>
                            <Clock size={10} />{task.start_time.slice(0, 5)}
                          </span>
                        )}
                        <div style={{ display: "flex", gap: 2 }}>
                          {Array.from({ length: task.importance }).map((_, i) => (
                            <Zap key={i} size={9} style={{ color: "#f59e0b", fill: "#f59e0b" } as React.CSSProperties} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {todayTasks.length > 5 && (
                    <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", textAlign: "center", paddingTop: 4 }}>+{todayTasks.length - 5} autres tâches</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tasks / Notifications card */}
          <div className="admin-dashboard-card" style={{ ...cardStyle, overflow: "hidden" }}>
            <div className="admin-dashboard-tabbar" style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              {(["tasks", "notifications"] as const).map((t) => (
                <button key={t} onClick={() => setActiveTab(t)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "14px 20px", fontSize: 13, fontWeight: 600,
                  borderBottom: activeTab === t ? "2px solid #0147ff" : "2px solid transparent",
                  color: activeTab === t ? "#0147ff" : "rgba(18,26,46,0.45)",
                  background: "none", border: "none",
                  cursor: "pointer", letterSpacing: "-0.3px",
                }}>
                  {t === "tasks" ? <CheckSquare size={14} /> : <Bell size={14} />}
                  {t === "tasks" ? "Tâches projets" : "Notifications"}
                  {t === "notifications" && unread > 0 && (
                    <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{unread}</span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === "tasks" && (
              <div style={{ padding: 16 }}>
                {projects.length === 0 ? (
                  <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)", textAlign: "center", padding: "24px 0" }}>Aucun projet actif</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {projects.map(p => {
                      const days = p.deadline ? Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86400000) : null;
                      return (
                        <Link key={p.id} href={`/admin/projects/${p.id}`} style={{ textDecoration: "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 9 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0147ff", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "#121a2e", margin: 0, letterSpacing: "-0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: "2px 0 0" }}>
                                {getClientName(p)} · {p.current_stage ?? "En cours"}
                              </p>
                            </div>
                            {days !== null && (
                              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, flexShrink: 0, color: days <= 3 ? "#ef4444" : days <= 7 ? "#d97706" : "rgba(18,26,46,0.4)" }}>
                                <Clock size={11} />{days}j
                              </span>
                            )}
                            <ArrowRight size={14} style={{ color: "rgba(18,26,46,0.2)", flexShrink: 0 }} />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
                <Link href="/admin/projects" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 13, color: "#0147ff", textDecoration: "none", fontWeight: 500 }}>
                  Voir tous les projets<ArrowRight size={14} />
                </Link>
              </div>
            )}

            {activeTab === "notifications" && (
              <div style={{ padding: 16 }}>
                {notifications.length === 0 ? (
                  <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)", textAlign: "center", padding: "24px 0" }}>Aucune notification</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {notifications.map(n => {
                      const notifBg = n.type === "success" ? "#d1fae5" : n.type === "warning" ? "#fee6d0" : n.type === "error" ? "#fee2e2" : "#d5eeff";
                      const notifColor = n.type === "success" ? "#168b64" : n.type === "warning" ? "#663b12" : n.type === "error" ? "#b91c1c" : "#073e63";
                      return (
                        <div key={n.id} onClick={() => markRead(n.id)} style={{
                          display: "flex", alignItems: "flex-start", gap: 12, padding: 12, borderRadius: 9, cursor: "pointer",
                          background: !n.read ? "#f0f3ff" : "transparent",
                        }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: notifBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Bell size={13} style={{ color: notifColor }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>{n.title}</p>
                              {!n.read && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0147ff", flexShrink: 0 }} />}
                            </div>
                            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.55)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</p>
                            <p style={{ fontSize: 11, color: "rgba(18,26,46,0.35)", margin: "4px 0 0" }}>{new Date(n.created_at).toLocaleDateString("fr-FR")}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="admin-dashboard-side-panel" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Projets urgents */}
          <div className="admin-dashboard-card" style={{ ...cardStyle, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={15} style={{ color: "#d97706" }} />
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>Projets urgents</h2>
              </div>
              <Link href="/admin/projects" style={{ fontSize: 12, color: "#0147ff", textDecoration: "none", fontWeight: 500 }}>Voir tout</Link>
            </div>
            {urgentProjects.length === 0 ? (
              <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", textAlign: "center", padding: "16px 0" }}>Aucun projet urgent</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {urgentProjects.map(p => {
                  const days = Math.ceil((new Date(p.deadline!).getTime() - Date.now()) / 86400000);
                  return (
                    <Link key={p.id} href={`/admin/projects/${p.id}`} style={{ textDecoration: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 9 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#121a2e", margin: 0, letterSpacing: "-0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                          <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: "1px 0 0" }}>{getClientName(p)}</p>
                        </div>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 8, color: days <= 3 ? "#ef4444" : "#d97706" }}>
                          <Clock size={10} />{days}j
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Accès rapide */}
          <div style={{ ...cardStyle, padding: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#121a2e", margin: "0 0 12px", letterSpacing: "-0.3px" }}>Accès rapide</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { href: "/admin/coach", label: "Coach IA", icon: <Bot size={16} style={{ color: "#6236AA" }} />, bg: "#E1D1FA" },
                { href: "/admin/leads", label: "Leads CRM", icon: <Users size={16} style={{ color: "#073e63" }} />, bg: "#d5eeff" },
                { href: "/admin/agenda", label: "Habits", icon: <Flame size={16} style={{ color: "#dc2626" }} />, bg: "#fee6d0" },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                  <div className="admin-dashboard-list-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 9 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#121a2e", letterSpacing: "-0.3px" }}>{item.label}</span>
                    <ArrowRight size={13} style={{ marginLeft: "auto", color: "rgba(18,26,46,0.2)" }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Habits CTA */}
          <Link href="/admin/agenda/stats" style={{ textDecoration: "none" }}>
            <div style={{
              background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
              borderRadius: 13, padding: 20, color: "#fff",
              border: "1px solid #2f4d9d",
              boxShadow: "inset 0px -2px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Flame size={16} />
                <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.3px" }}>Habits</span>
              </div>
              <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>Voir vos statistiques et points</p>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                Ouvrir les stats <ArrowRight size={12} />
              </div>
            </div>
          </Link>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 1023px) {
          .admin-dashboard-root {
            max-width: 100vw;
            overflow-x: hidden;
            padding: 24px 18px calc(104px + env(safe-area-inset-bottom)) !important;
          }

          .admin-dashboard-header {
            align-items: flex-start !important;
            flex-direction: column !important;
            gap: 16px !important;
            margin-bottom: 24px !important;
          }

          .admin-dashboard-new-project {
            justify-content: center !important;
            width: 100% !important;
          }

          .admin-dashboard-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
            margin-bottom: 24px !important;
          }

          .admin-dashboard-content-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 18px !important;
          }

          .admin-dashboard-main-panel,
          .admin-dashboard-side-panel {
            gap: 18px !important;
            min-width: 0;
          }

          .admin-dashboard-card {
            min-width: 0;
          }

          .admin-dashboard-tabbar {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .admin-dashboard-tabbar button {
            flex: 0 0 auto;
          }
        }

        @media (max-width: 640px) {
          .admin-dashboard-root {
            padding: 18px 14px calc(110px + env(safe-area-inset-bottom)) !important;
          }

          .admin-dashboard-root h1 {
            font-size: 24px !important;
            line-height: 1.16 !important;
          }

          .admin-dashboard-stats-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .admin-dashboard-card {
            border-radius: 16px !important;
          }

          .admin-dashboard-list-row {
            align-items: flex-start !important;
          }
        }
      `}</style>
    </div>
  );
}
