"use client";

import { useState, use } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  FileText,
  CheckSquare,
  ExternalLink,
  Send,
  Plus,
  Check,
  Bell,
  Figma,
  Monitor,
  Sparkles,
  CheckCircle2,
  User,
  LayoutGrid,
  ClipboardList,
  Pen,
  Code2,
} from "lucide-react";
import { StatusBadge } from "@/components/agency/StatusBadge";
import { StageTimeline } from "@/components/shared/StageTimeline";
import { formatDate } from "@/lib/utils";
import type { Project, Task, Message } from "@/types/agency";

// Mock project data
const mockProject: Project = {
  id: "1",
  name: "Site web Startup XYZ",
  description: "Refonte complète du site vitrine avec animations Framer",
  status: "in_progress",
  client_id: "c1",
  client: {
    id: "c1",
    name: "Martin Dupont",
    email: "martin@xyz.com",
    company: "Startup XYZ",
    phone: "+33 6 12 34 56 78",
    created_at: "2026-01-10",
    payment_status: "paid",
  },
  designer_id: "d1",
  designer: {
    id: "d1",
    name: "Sarah Kimura",
    email: "sarah@agency.com",
    speciality: "UI/UX Design",
    created_at: "2025-06-01",
  },
  current_stage: "design",
  stages: [
    {
      stage: "copywriting",
      label: "Copywriting",
      duration_days: 5,
      completed: true,
      completed_at: "2026-01-25",
    },
    {
      stage: "wireframe",
      label: "Wireframe",
      duration_days: 7,
      completed: true,
      completed_at: "2026-02-05",
    },
    {
      stage: "design",
      label: "Design",
      duration_days: 14,
      completed: false,
    },
    {
      stage: "development",
      label: "Développement",
      duration_days: 10,
      completed: false,
    },
    {
      stage: "revision",
      label: "Révisions",
      duration_days: 5,
      completed: false,
    },
  ],
  budget: 4500,
  start_date: "2026-01-15",
  deadline: "2026-03-28",
  figma_url: "https://figma.com/...",
  google_doc_url: "https://docs.google.com/...",
  created_at: "2026-01-15",
  updated_at: "2026-03-20",
};

const mockTasks: Task[] = [
  {
    id: "t1",
    project_id: "1",
    title: "Créer les maquettes page accueil",
    status: "done",
    assigned_to: "d1",
    due_date: "2026-03-15",
    created_at: "2026-03-01",
    updated_at: "2026-03-15",
  },
  {
    id: "t2",
    project_id: "1",
    title: "Design page services",
    status: "in_progress",
    assigned_to: "d1",
    due_date: "2026-03-25",
    created_at: "2026-03-10",
    updated_at: "2026-03-20",
  },
  {
    id: "t3",
    project_id: "1",
    title: "Prototype animations Framer",
    status: "todo",
    assigned_to: "d1",
    due_date: "2026-03-28",
    created_at: "2026-03-15",
    updated_at: "2026-03-15",
  },
  {
    id: "t4",
    project_id: "1",
    title: "Exporter les assets",
    status: "todo",
    due_date: "2026-03-30",
    created_at: "2026-03-15",
    updated_at: "2026-03-15",
  },
];

const mockClientMessages: Message[] = [
  {
    id: "m1",
    project_id: "1",
    sender_id: "c1",
    sender_name: "Martin Dupont",
    sender_role: "client",
    content:
      "Bonjour ! J'ai regardé les premières maquettes, super travail ! J'aurais juste quelques retours sur les couleurs.",
    source: "whatsapp",
    created_at: "2026-03-20T09:30:00",
  },
  {
    id: "m2",
    project_id: "1",
    sender_id: "a1",
    sender_name: "Admin",
    sender_role: "admin",
    content:
      "Parfait Martin ! On prend note de vos retours. Sarah va intégrer ça dans la V2 qu'on vous enverra vendredi.",
    source: "app",
    created_at: "2026-03-20T10:15:00",
  },
  {
    id: "m3",
    project_id: "1",
    sender_id: "c1",
    sender_name: "Martin Dupont",
    sender_role: "client",
    content:
      "Impeccable, merci ! Est-ce qu'on peut avoir un appel jeudi pour en discuter ?",
    source: "whatsapp",
    created_at: "2026-03-20T10:45:00",
  },
];

const mockDesignerMessages: Message[] = [
  {
    id: "tm1",
    project_id: "1",
    sender_id: "a1",
    sender_name: "Admin",
    sender_role: "admin",
    content:
      "Sarah, le client veut des couleurs plus douces sur la page d'accueil. Peux-tu regarder ça pour la V2 ?",
    source: "app",
    created_at: "2026-03-20T11:00:00",
  },
  {
    id: "tm2",
    project_id: "1",
    sender_id: "d1",
    sender_name: "Sarah Kimura",
    sender_role: "designer",
    content:
      "Pas de problème ! Je vais tester avec une palette pastel. Je vous envoie des propositions demain matin.",
    source: "app",
    created_at: "2026-03-20T11:30:00",
  },
  {
    id: "tm3",
    project_id: "1",
    sender_id: "d1",
    sender_name: "Sarah Kimura",
    sender_role: "designer",
    content:
      "J'ai aussi un commentaire sur Figma de sa part concernant la navbar, regardez quand vous pouvez.",
    source: "figma",
    created_at: "2026-03-21T09:00:00",
  },
];

const mockDevMessages: Message[] = [
  {
    id: "dev1",
    project_id: "1",
    sender_id: "a1",
    sender_name: "Admin",
    sender_role: "admin",
    content:
      "Karim, les maquettes V2 sont prêtes. Tu peux commencer l'intégration Framer dès que possible.",
    source: "app",
    created_at: "2026-03-22T09:00:00",
  },
  {
    id: "dev2",
    project_id: "1",
    sender_id: "dev1",
    sender_name: "Karim Benali",
    sender_role: "designer",
    content:
      "Reçu ! Je commence l'intégration aujourd'hui. J'ai quelques questions sur les animations de la hero section.",
    source: "app",
    created_at: "2026-03-22T10:15:00",
  },
];

type ActiveTab = "messages" | "tasks" | "files";
type MessageChannel = "client" | "designer" | "developer";
type PlatformFilter = "all" | "whatsapp" | "figma" | "app";

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { icon: ReactNode; label: string; color: string }> = {
    whatsapp: {
      icon: <MessageSquare size={10} />,
      label: "WhatsApp",
      color: "text-green-600 bg-green-50",
    },
    figma: {
      icon: <Figma size={10} />,
      label: "Figma",
      color: "text-purple-600 bg-purple-50",
    },
    app: {
      icon: <Monitor size={10} />,
      label: "App",
      color: "text-gray-600 bg-gray-100",
    },
    framer: {
      icon: <Monitor size={10} />,
      label: "Framer",
      color: "text-gray-600 bg-gray-100",
    },
    email: {
      icon: <FileText size={10} />,
      label: "Email",
      color: "text-blue-600 bg-blue-50",
    },
  };
  const item = map[source] ?? map.app;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium ${item.color}`}
    >
      {item.icon}
      {item.label}
    </span>
  );
}

export default function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const [activeTab, setActiveTab] = useState<ActiveTab>("messages");
  const [messageChannel, setMessageChannel] =
    useState<MessageChannel>("client");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [newMessage, setNewMessage] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [tasks, setTasks] = useState(mockTasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);

  const project = mockProject;

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    setNewMessage("");
    // TODO: Send via Supabase
  };

  const handleRefineWithAI = async () => {
    if (!newMessage.trim()) return;
    setIsRefining(true);
    // TODO: Call /api/ai/refine with newMessage
    await new Promise((r) => setTimeout(r, 1200));
    setNewMessage(
      newMessage + " Je reste disponible pour tout échange complémentaire."
    );
    setIsRefining(false);
  };

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === "done" ? "todo" : "done" }
          : t
      )
    );
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: `t${Date.now()}`,
      project_id: resolvedParams.id,
      title: newTaskTitle,
      status: "todo",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
    setNewTaskTitle("");
    setShowNewTask(false);
  };

  const handleValidateStage = () => {
    // TODO: update project stage in Supabase
    alert("Étape validée !");
  };

  const currentMessages =
    messageChannel === "client"
      ? mockClientMessages
      : messageChannel === "designer"
        ? mockDesignerMessages
        : mockDevMessages;

  const filteredMessages =
    platformFilter === "all"
      ? currentMessages
      : currentMessages.filter((m) => m.source === platformFilter);

  const platforms: { key: PlatformFilter; label: string; icon: ReactNode }[] = [
    { key: "all", label: "Tout", icon: <LayoutGrid size={12} /> },
    { key: "whatsapp", label: "WhatsApp", icon: <MessageSquare size={12} /> },
    { key: "figma", label: "Figma", icon: <Figma size={12} /> },
    { key: "app", label: "App", icon: <Monitor size={12} /> },
  ];

  return (
    <div className="p-8">
      {/* Back */}
      <Link
        href="/admin/projects"
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Retour aux projets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-gray-500">{project.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {project.figma_url && (
            <a
              href={project.figma_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-indigo-300 transition-colors"
            >
              <Figma size={14} />
              Figma
            </a>
          )}
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Bell size={14} />
            Notifier le client
          </button>
        </div>
      </div>

      {/* Stage Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Avancement du projet</h2>
        <StageTimeline
          stages={project.stages}
          currentStage={project.current_stage}
          onValidateStage={handleValidateStage}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Main tabs */}
            <div className="flex border-b border-gray-200">
              {[
                {
                  key: "messages",
                  label: "Messages",
                  icon: <MessageSquare size={14} />,
                },
                {
                  key: "tasks",
                  label: "Tâches",
                  icon: <CheckSquare size={14} />,
                },
                {
                  key: "files",
                  label: "Fichiers",
                  icon: <FileText size={14} />,
                },
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

            {/* Messages Tab */}
            {activeTab === "messages" && (
              <div className="flex flex-col">
                {/* Channel sub-tabs */}
                <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-gray-100 flex-wrap">
                  <button
                    onClick={() => setMessageChannel("client")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      messageChannel === "client"
                        ? "bg-indigo-600 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    <User size={12} />
                    Client
                  </button>
                  <button
                    onClick={() => setMessageChannel("designer")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      messageChannel === "designer"
                        ? "bg-purple-600 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    <Pen size={12} />
                    Designer
                  </button>
                  <button
                    onClick={() => setMessageChannel("developer")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      messageChannel === "developer"
                        ? "bg-blue-600 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    <Code2 size={12} />
                    Développeur
                  </button>

                  {/* Platform filter (only for client messages) */}
                  {messageChannel === "client" && (
                    <div className="flex items-center gap-1 ml-3 pl-3 border-l border-gray-200">
                      {platforms.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => setPlatformFilter(p.key)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                            platformFilter === p.key
                              ? "bg-gray-900 text-white"
                              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {p.icon}
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Messages list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-72 max-h-80">
                  {filteredMessages.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                      Aucun message sur cette plateforme
                    </p>
                  ) : (
                    filteredMessages.map((msg) => {
                      const isMe = msg.sender_role === "admin";
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                            {msg.sender_name.charAt(0)}
                          </div>
                          <div
                            className={`max-w-xs flex flex-col ${isMe ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`flex items-center gap-2 mb-1 ${isMe ? "flex-row-reverse" : ""}`}
                            >
                              <span className="text-xs font-medium text-gray-600">
                                {msg.sender_name}
                              </span>
                              <SourceBadge source={msg.source} />
                            </div>
                            <div
                              className={`px-3 py-2 rounded-xl text-sm ${
                                isMe
                                  ? "bg-indigo-600 text-white rounded-tr-sm"
                                  : "bg-gray-100 text-gray-800 rounded-tl-sm"
                              }`}
                            >
                              {msg.content}
                            </div>
                            <span className="text-xs text-gray-400 mt-1">
                              {new Date(msg.created_at).toLocaleTimeString(
                                "fr-FR",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Message input */}
                <div className="p-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleSendMessage()
                      }
                      placeholder={
                        messageChannel === "client"
                          ? "Écrire au client..."
                          : messageChannel === "designer"
                            ? "Écrire au designer..."
                            : "Écrire au développeur..."
                      }
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button
                      onClick={handleRefineWithAI}
                      disabled={isRefining || !newMessage.trim()}
                      title="Peaufiner avec IA"
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Sparkles
                        size={14}
                        className={isRefining ? "animate-pulse" : ""}
                      />
                      {isRefining ? "..." : "IA"}
                    </button>
                    <button
                      onClick={handleSendMessage}
                      className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                  {messageChannel === "client" && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Visible par le client · Cliquez sur un lien de plateforme pour ouvrir la conversation originale
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tasks Tab */}
            {activeTab === "tasks" && (
              <div className="p-4">
                <div className="space-y-1 mb-4">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 group"
                    >
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all shrink-0 ${
                          task.status === "done"
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-gray-300 hover:border-indigo-400"
                        }`}
                      >
                        {task.status === "done" && <Check size={12} />}
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          task.status === "done"
                            ? "line-through text-gray-400"
                            : "text-gray-700"
                        }`}
                      >
                        {task.title}
                      </span>
                      <StatusBadge status={task.status} type="task" />
                      {task.due_date && (
                        <span className="text-xs text-gray-400">
                          {new Date(task.due_date).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {showNewTask ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                      placeholder="Titre de la tâche..."
                      autoFocus
                      className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button
                      onClick={handleAddTask}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                    >
                      Ajouter
                    </button>
                    <button
                      onClick={() => setShowNewTask(false)}
                      className="px-3 py-2 text-gray-500 hover:text-gray-700 text-sm"
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewTask(true)}
                    className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    <Plus size={14} />
                    Ajouter une tâche
                  </button>
                )}
              </div>
            )}

            {/* Files Tab */}
            {activeTab === "files" && (
              <div className="p-4 space-y-4">
                {/* External tools */}
                <div className="space-y-2">
                  {project.figma_url && (
                    <a
                      href={project.figma_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                    >
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <Figma size={18} className="text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Maquettes Figma
                        </p>
                        <p className="text-xs text-gray-500">
                          Design principal du projet
                        </p>
                      </div>
                      <ExternalLink
                        size={14}
                        className="text-gray-400 group-hover:text-indigo-500"
                      />
                    </a>
                  )}
                  {project.google_doc_url && (
                    <a
                      href={project.google_doc_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText size={18} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Brief client
                        </p>
                        <p className="text-xs text-gray-500">
                          Document de spécifications
                        </p>
                      </div>
                      <ExternalLink
                        size={14}
                        className="text-gray-400 group-hover:text-indigo-500"
                      />
                    </a>
                  )}
                </div>

                {/* Onboarding form responses */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList size={14} className="text-gray-500" />
                    <p className="text-sm font-semibold text-gray-900">
                      Formulaire d&apos;onboarding
                    </p>
                  </div>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="space-y-3">
                      {[
                        {
                          q: "Secteur d'activité",
                          a: "Tech / SaaS",
                        },
                        {
                          q: "Objectif principal du site",
                          a: "Générer des leads qualifiés et présenter l'offre",
                        },
                        {
                          q: "Références visuelles",
                          a: "Linear.app, Stripe, Notion — style épuré et moderne",
                        },
                        {
                          q: "Couleurs souhaitées",
                          a: "Bleu indigo avec accents verts, fond blanc",
                        },
                        {
                          q: "Budget",
                          a: "4 500 €",
                        },
                      ].map((item) => (
                        <div key={item.q}>
                          <p className="text-xs font-medium text-gray-500">
                            {item.q}
                          </p>
                          <p className="text-sm text-gray-800 mt-0.5">
                            {item.a}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Soumis le 15 jan. 2026
                    </p>
                  </div>
                </div>

                <button className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  <Plus size={14} />
                  Ajouter un fichier
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          {/* Client */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Client</h3>
            {project.client && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                    {project.client.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-900">
                      {project.client.name}
                    </p>
                    {project.client.company && (
                      <p className="text-xs text-gray-500">
                        {project.client.company}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-500">
                  <p>{project.client.email}</p>
                  {project.client.phone && <p>{project.client.phone}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Designer */}
          {project.designer && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm">
                Prestataire
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-100 rounded-full flex items-center justify-center text-sm font-bold text-purple-600">
                  {project.designer.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {project.designer.name}
                  </p>
                  {project.designer.speciality && (
                    <p className="text-xs text-gray-500">
                      {project.designer.speciality}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Project Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">
              Informations
            </h3>
            <div className="space-y-2 text-sm">
              {project.start_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Début</span>
                  <span className="font-medium text-gray-900">
                    {formatDate(project.start_date)}
                  </span>
                </div>
              )}
              {project.deadline && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Deadline</span>
                  <span className="font-medium text-gray-900">
                    {formatDate(project.deadline)}
                  </span>
                </div>
              )}
              {project.budget && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Budget</span>
                  <span className="font-medium text-gray-900">
                    {project.budget.toLocaleString("fr-FR")} €
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">
              Actions rapides
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleValidateStage}
                className="w-full flex items-center gap-2 text-sm py-2 px-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium"
              >
                <CheckCircle2 size={14} />
                Valider l&apos;étape actuelle
              </button>
              <button className="w-full flex items-center gap-2 text-sm py-2 px-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                <MessageSquare size={14} />
                Envoyer notif WhatsApp
              </button>
              <button className="w-full flex items-center gap-2 text-sm py-2 px-3 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors">
                <Figma size={14} />
                Ouvrir Figma
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
