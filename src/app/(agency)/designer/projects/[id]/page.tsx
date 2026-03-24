"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Check, Send, FileText } from "lucide-react";
import { StatusBadge } from "@/components/agency/StatusBadge";
import { StageTimeline } from "@/components/shared/StageTimeline";
import type { Task, Message } from "@/types/agency";

const mockProject = {
  id: "1",
  name: "Site web Startup XYZ",
  description: "Refonte complète du site vitrine avec animations Framer",
  status: "in_progress" as const,
  current_stage: "design" as const,
  stages: [
    { stage: "copywriting" as const, label: "Copywriting", duration_days: 5, completed: true },
    { stage: "wireframe" as const, label: "Wireframe", duration_days: 7, completed: true },
    { stage: "design" as const, label: "Design", duration_days: 14, completed: false },
    { stage: "development" as const, label: "Développement", duration_days: 10, completed: false },
  ],
  deadline: "2026-03-28",
  figma_url: "https://figma.com/...",
  brief: `## Brief projet — Site web Startup XYZ

**Client :** Martin Dupont — Startup XYZ (Tech/SaaS)

**Objectif :** Refonte complète du site vitrine pour présenter les services SaaS de la startup de manière moderne et convaincante.

**Style souhaité :** Dark & Premium, avec des animations subtiles

**Pages :**
1. Accueil — Hero section + Features + CTA
2. Services — Détail des offres
3. Tarifs — Pricing cards
4. Contact — Formulaire + infos

**Contraintes :**
- Réalisé sur Framer
- Mobile-first obligatoire
- Chargement rapide (<2s)
- Intégration CMS pour le blog`,
};

const mockTasks: Task[] = [
  { id: "t1", project_id: "1", title: "Maquettes page accueil (desktop)", status: "done", due_date: "2026-03-15", created_at: "", updated_at: "" },
  { id: "t2", project_id: "1", title: "Maquettes page accueil (mobile)", status: "in_progress", due_date: "2026-03-25", created_at: "", updated_at: "" },
  { id: "t3", project_id: "1", title: "Design page services", status: "todo", due_date: "2026-03-27", created_at: "", updated_at: "" },
  { id: "t4", project_id: "1", title: "Prototype Framer", status: "todo", due_date: "2026-03-28", created_at: "", updated_at: "" },
];

const mockMessages: Message[] = [
  { id: "m1", project_id: "1", sender_id: "a1", sender_name: "Admin", sender_role: "admin", content: "Salut Sarah ! Le brief est prêt, tu peux commencer par la page accueil. Focus sur le hero section d'abord.", source: "app", created_at: "2026-03-15T10:00:00" },
  { id: "m2", project_id: "1", sender_id: "d1", sender_name: "Sarah K.", sender_role: "designer", content: "Reçu ! Je commence aujourd'hui. J'ai une question sur le style — on part plutôt sur un fond noir pur ou dark blue ?", source: "app", created_at: "2026-03-15T10:30:00" },
  { id: "m3", project_id: "1", sender_id: "a1", sender_name: "Admin", sender_role: "admin", content: "Dark blue (#0A0E1A). Regarde les inspirations dans le brief, le client a aimé le style Vercel.", source: "app", created_at: "2026-03-15T11:00:00" },
];

type ActiveTab = "brief" | "tasks" | "messages";

export default function DesignerProjectDetailPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("brief");
  const [tasks, setTasks] = useState(mockTasks);
  const [message, setMessage] = useState("");

  const project = mockProject;

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status: t.status === "done" ? "todo" : "done" }
          : t
      )
    );
  };

  return (
    <div className="p-8">
      <Link href="/designer/projects" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors">
        <ArrowLeft size={16} />
        Retour
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-gray-500">{project.description}</p>
        </div>
        {project.figma_url && (
          <a
            href={project.figma_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <ExternalLink size={14} />
            Ouvrir Figma
          </a>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <StageTimeline stages={project.stages} currentStage={project.current_stage} />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { key: "brief", label: "Brief", icon: <FileText size={14} /> },
            { key: "tasks", label: "Mes tâches", icon: null },
            { key: "messages", label: "Messages admin", icon: null },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as ActiveTab)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Brief */}
        {activeTab === "brief" && (
          <div className="p-6 prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
              {project.brief}
            </div>
          </div>
        )}

        {/* Tasks */}
        {activeTab === "tasks" && (
          <div className="p-4">
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <button
                    onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      task.status === "done"
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300 hover:border-indigo-400"
                    }`}
                  >
                    {task.status === "done" && <Check size={12} />}
                  </button>
                  <span className={`flex-1 text-sm ${task.status === "done" ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {task.title}
                  </span>
                  <StatusBadge status={task.status} type="task" />
                  {task.due_date && (
                    <span className="text-xs text-gray-400">
                      {new Date(task.due_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {activeTab === "messages" && (
          <div className="flex flex-col" style={{ height: "360px" }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mockMessages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.sender_role === "designer" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${msg.sender_role === "admin" ? "bg-indigo-100 text-indigo-600" : "bg-purple-100 text-purple-600"}`}>
                    {msg.sender_name.charAt(0)}
                  </div>
                  <div className={`flex flex-col max-w-xs ${msg.sender_role === "designer" ? "items-end" : "items-start"}`}>
                    <div className={`px-3 py-2 rounded-lg text-sm ${msg.sender_role === "designer" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                      {msg.content}
                    </div>
                    <span className="text-xs text-gray-400 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Message à l'admin..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <button onClick={() => setMessage("")} className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
