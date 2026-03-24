"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Users,
  CheckSquare,
  Bell,
  ArrowRight,
  Plus,
  Clock,
  AlertCircle,
  MessageSquare,
  FileText,
  Figma,
  Monitor,
} from "lucide-react";

const stats = [
  {
    label: "Projets actifs",
    value: "12",
    icon: FolderKanban,
    color: "bg-indigo-50 text-indigo-600",
    href: "/admin/projects",
  },
  {
    label: "Clients actifs",
    value: "8",
    icon: Users,
    color: "bg-blue-50 text-blue-600",
    href: "/admin/clients",
  },
  {
    label: "Tâches en cours",
    value: "14",
    icon: CheckSquare,
    color: "bg-amber-50 text-amber-600",
    href: "/admin/projects",
  },
  {
    label: "Notifications",
    value: "3",
    icon: Bell,
    color: "bg-rose-50 text-rose-600",
    href: "#",
  },
];

const activePeriodTasks = [
  {
    id: "t1",
    title: "Design page services",
    project: "Site web Startup XYZ",
    projectId: "1",
    stage: "Design",
    status: "in_progress",
    daysLeft: 3,
  },
  {
    id: "t2",
    title: "Prototype animations Framer",
    project: "Site web Startup XYZ",
    projectId: "1",
    stage: "Design",
    status: "todo",
    daysLeft: 6,
  },
  {
    id: "t3",
    title: "Validation maquettes V2",
    project: "Identité visuelle Brand Co",
    projectId: "2",
    stage: "Révisions",
    status: "todo",
    daysLeft: 2,
  },
  {
    id: "t4",
    title: "Exporter les assets",
    project: "Site web Startup XYZ",
    projectId: "1",
    stage: "Design",
    status: "todo",
    daysLeft: 6,
  },
];

const mockNotifications = [
  {
    id: "n1",
    title: "Message WhatsApp",
    message: 'Martin Dupont : "Bonjour, j\'ai regardé les maquettes..."',
    project: "Site web Startup XYZ",
    projectId: "1",
    source: "whatsapp",
    time: "Il y a 15 min",
    read: false,
  },
  {
    id: "n2",
    title: "Commentaire Figma",
    message: "Sophie L. a commenté sur Frame #12",
    project: "Identité visuelle Brand Co",
    projectId: "2",
    source: "figma",
    time: "Il y a 2h",
    read: false,
  },
  {
    id: "n3",
    title: "Retour Google Docs",
    message: "Pierre M. a modifié le brief client",
    project: "App mobile TechStart",
    projectId: "3",
    source: "google_doc",
    time: "Il y a 5h",
    read: true,
  },
];

function SourceIcon({ source }: { source: string }) {
  if (source === "whatsapp")
    return <MessageSquare size={14} className="text-green-600" />;
  if (source === "figma")
    return <Figma size={14} className="text-purple-600" />;
  if (source === "google_doc")
    return <FileText size={14} className="text-blue-600" />;
  return <Monitor size={14} className="text-gray-500" />;
}

function SourceBg({ source }: { source: string }) {
  if (source === "whatsapp") return "bg-green-100";
  if (source === "figma") return "bg-purple-100";
  if (source === "google_doc") return "bg-blue-100";
  return "bg-gray-100";
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"tasks" | "notifications">(
    "tasks"
  );
  const unreadCount = mockNotifications.filter((n) => !n.read).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Bienvenue ! Voici un aperçu de votre activité.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} />
          Nouveau projet
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}>
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all group">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <Icon size={20} />
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-gray-300 group-hover:text-gray-500 transition-colors"
                  />
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Tâches & Notifications */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab("tasks")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "tasks"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <CheckSquare size={14} />
              Tâches de la période
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "notifications"
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Bell size={14} />
              Notifications
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <div className="p-4">
              <p className="text-xs text-gray-400 mb-3">
                Tâches dans la phase active de chaque projet
              </p>
              <div className="space-y-1">
                {activePeriodTasks.map((task) => (
                  <Link key={task.id} href={`/admin/projects/${task.projectId}`}>
                    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group transition-colors">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          task.status === "in_progress"
                            ? "bg-indigo-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {task.project} · Phase {task.stage}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-amber-600 shrink-0">
                        <Clock size={11} />
                        {task.daysLeft}j
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-gray-300 group-hover:text-indigo-400 transition-colors"
                      />
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                href="/admin/projects"
                className="flex items-center gap-1 mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Voir tous les projets
                <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="p-4">
              <div className="space-y-2">
                {mockNotifications.map((notif) => (
                  <Link
                    key={notif.id}
                    href={`/admin/projects/${notif.projectId}`}
                  >
                    <div
                      className={`flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 group transition-colors ${
                        !notif.read ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg shrink-0 ${SourceBg({ source: notif.source })}`}
                      >
                        <SourceIcon source={notif.source} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {notif.title}
                          </p>
                          {!notif.read && (
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {notif.project} · {notif.time}
                        </p>
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-gray-300 group-hover:text-indigo-400 shrink-0 mt-1 transition-colors"
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Projets urgents */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-orange-500" />
              <h2 className="font-semibold text-gray-900 text-sm">
                Projets urgents
              </h2>
            </div>
            <Link
              href="/admin/projects"
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Voir tout
            </Link>
          </div>
          <div className="space-y-1">
            {[
              {
                id: "1",
                name: "Site web Startup XYZ",
                client: "Martin D.",
                daysLeft: 4,
              },
              {
                id: "2",
                name: "Identité visuelle Brand Co",
                client: "Sophie L.",
                daysLeft: 6,
              },
              {
                id: "3",
                name: "App mobile TechStart",
                client: "Pierre M.",
                daysLeft: 9,
              },
            ].map((project) => (
              <Link key={project.id} href={`/admin/projects/${project.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 group transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-xs group-hover:text-indigo-600 transition-colors truncate">
                      {project.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {project.client}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-orange-600 font-medium shrink-0 ml-2">
                    <Clock size={11} />
                    {project.daysLeft}j
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
