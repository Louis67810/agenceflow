"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft, CheckCircle2, Loader2, AlertCircle,
  FileText, Paperclip, ExternalLink, FolderOpen, ListChecks, Clock,
  MessageSquare, Send,
} from "lucide-react";

interface Stage {
  id: string;
  label: string;
  duration_days: number;
  completed: boolean;
  completed_at: string | null;
  image_url?: string;
  assigned_to_designer?: boolean;
}

interface Project {
  id: string;
  name: string;
  status: string;
  stages: Stage[];
  current_stage_index: number;
  start_date: string | null;
  form_data: Record<string, unknown>;
  client_name: string | null;
  created_at: string;
}

interface ProjectFile {
  id: string;
  name: string;
  url: string;
  type: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

const FILE_ICONS: Record<string, string> = {
  figma: "🎨",
  google_doc: "📄",
  image: "🖼️",
  pdf: "📕",
  other: "📎",
};

interface Message {
  id: string;
  sender_role: "admin" | "client" | "designer";
  sender_name: string;
  content: string;
  created_at: string;
}

type Tab = "brief" | "taches" | "messages" | "fichiers";

export default function DesignerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [designerName, setDesignerName] = useState("Prestataire");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("brief");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !project) return;
    setSending(true);
    const r = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        sender_role: "designer",
        sender_name: designerName,
        content: newMsg.trim(),
      }),
    });
    const d = await r.json();
    if (r.ok && d.message) { setMessages((p) => [...p, d.message]); setNewMsg(""); }
    setSending(false);
  }

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Non connecté"); setLoading(false); return; }

      if (session.user.email) setDesignerName(session.user.email.split("@")[0]);

      const [pr, fr, mr] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/files?project_id=${id}`),
        fetch(`/api/messages?project_id=${id}`),
      ]);

      const pd = await pr.json();
      if (!pr.ok) { setError(pd.error ?? "Projet introuvable"); setLoading(false); return; }
      setProject(pd.project);

      const fd = await fr.json();
      setFiles(fd.files ?? []);

      const md = await mr.json();
      setMessages(md.messages ?? []);

      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  );

  if (error || !project) return (
    <div className="p-8">
      <Link href="/designer/projects" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-4">
        <ArrowLeft size={16} />Retour
      </Link>
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <AlertCircle size={16} className="mt-0.5" />
        <p className="text-sm">{error ?? "Projet introuvable"}</p>
      </div>
    </div>
  );

  const stages = project.stages ?? [];
  const currentIdx = project.current_stage_index ?? 0;

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/designer/projects" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors">
        <ArrowLeft size={16} />Retour
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-medium">
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Stages */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Avancement</h2>
          {stages.length === 0 ? (
            <p className="text-xs text-gray-400">Aucune étape définie.</p>
          ) : (
            <div className="space-y-3">
              {stages.map((stage, idx) => {
                const isCurrent = idx === currentIdx;
                const isDone = stage.completed;
                return (
                  <div key={stage.id ?? idx} className={`flex items-start gap-3 ${idx < stages.length - 1 ? "pb-3 border-b border-gray-50" : ""}`}>
                    <div className="shrink-0 mt-0.5">
                      {stage.image_url ? (
                        <img src={stage.image_url} alt={stage.label} className="w-5 h-5 rounded object-cover" />
                      ) : isDone ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full bg-purple-500 animate-pulse" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex items-center justify-center">
                          <span className="text-[8px] text-gray-400 font-bold">{idx + 1}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isDone ? "text-green-700" : isCurrent ? "text-purple-700" : "text-gray-400"}`}>
                        {stage.label}
                      </p>
                      <p className="text-xs text-gray-400">{stage.duration_days} jour{stage.duration_days !== 1 ? "s" : ""}</p>
                      {isDone && stage.completed_at && (
                        <p className="text-xs text-green-500">Validé le {new Date(stage.completed_at).toLocaleDateString("fr-FR")}</p>
                      )}
                      {isCurrent && <p className="text-xs text-purple-400">En cours</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {[
              { key: "brief" as Tab, label: "Brief", icon: <FileText size={14} /> },
              { key: "taches" as Tab, label: "Tâches", icon: <ListChecks size={14} /> },
              { key: "messages" as Tab, label: "Messages", icon: <MessageSquare size={14} /> },
              { key: "fichiers" as Tab, label: `Fichiers${files.length > 0 ? ` (${files.length})` : ""}`, icon: <Paperclip size={14} /> },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === t.key
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Brief */}
          {tab === "brief" && (
            <div className="p-6">
              {project.client_name && (
                <p className="text-sm text-gray-500 mb-4">Client : <span className="font-medium text-gray-700">{project.client_name}</span></p>
              )}
              {project.form_data && Object.keys(project.form_data).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(project.form_data).map(([k, v]) => (
                    <div key={k} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-500 mb-1 capitalize">{k.replace(/_/g, " ")}</p>
                      <p className="text-sm text-gray-800">
                        {Array.isArray(v) ? v.join(", ") : String(v ?? "")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Aucune information de brief disponible.</p>
              )}
            </div>
          )}

          {/* Tasks */}
          {tab === "taches" && (
            <div className="p-6">
              {(() => {
                const assignedStages = stages
                  .map((s, idx) => ({ ...s, idx }))
                  .filter((s) => s.assigned_to_designer);

                if (assignedStages.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                      <ListChecks size={32} className="mb-3 opacity-40" />
                      <p className="text-sm">Aucune tâche assignée</p>
                      <p className="text-xs mt-1">L&apos;agence vous assignera des étapes prochainement.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {assignedStages.map((stage) => {
                      const isCurrent = stage.idx === currentIdx;
                      const isDone = stage.completed;
                      const isUpcoming = stage.idx > currentIdx;

                      return (
                        <div
                          key={stage.id ?? stage.idx}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                            isDone
                              ? "bg-green-50 border-green-200"
                              : isCurrent
                              ? "bg-purple-50 border-purple-200"
                              : "bg-gray-50 border-gray-100"
                          }`}
                        >
                          <div className="shrink-0">
                            {stage.image_url ? (
                              <img src={stage.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                            ) : isDone ? (
                              <CheckCircle2 size={20} className="text-green-500" />
                            ) : isCurrent ? (
                              <div className="w-5 h-5 rounded-full bg-purple-500 animate-pulse" />
                            ) : (
                              <Clock size={20} className="text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className={`font-medium text-sm ${isDone ? "text-green-700" : isCurrent ? "text-purple-700" : "text-gray-500"}`}>
                              {stage.label}
                            </p>
                            <p className="text-xs text-gray-400">{stage.duration_days} jour{stage.duration_days !== 1 ? "s" : ""}</p>
                            {isDone && stage.completed_at && (
                              <p className="text-xs text-green-500">Validé le {new Date(stage.completed_at).toLocaleDateString("fr-FR")}</p>
                            )}
                          </div>
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            isDone ? "bg-green-100 text-green-700"
                            : isCurrent ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-400"
                          }`}>
                            {isDone ? "Terminé" : isCurrent ? "En cours" : "À venir"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Messages */}
          {tab === "messages" && (
            <div className="flex flex-col" style={{ height: "340px" }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                    <MessageSquare size={28} className="mb-2 opacity-30" />
                    <p>Aucun message pour l&apos;instant</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_role === "designer";
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isMe ? "bg-purple-100 text-purple-600" : "bg-gray-100 text-gray-600"}`}>
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`flex flex-col max-w-xs ${isMe ? "items-end" : "items-start"}`}>
                          <span className="text-xs text-gray-400 mb-1">{msg.sender_name}</span>
                          <div className={`px-3 py-2 rounded-xl text-sm ${isMe ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                            {msg.content}
                          </div>
                          <span className="text-xs text-gray-400 mt-1">
                            {new Date(msg.created_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSend} className="p-3 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Message à l'agence..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <button type="submit" disabled={sending || !newMsg.trim()}
                  className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </form>
            </div>
          )}

          {/* Files */}
          {tab === "fichiers" && (
            <div className="p-6">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <FolderOpen size={32} className="mb-3 opacity-40" />
                  <p className="text-sm">Aucun fichier partagé pour l&apos;instant</p>
                  <p className="text-xs mt-1">L&apos;agence partagera les fichiers ici.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-colors group"
                    >
                      <span className="text-xl">{FILE_ICONS[file.type] ?? "📎"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-purple-700">{file.name}</p>
                        <p className="text-xs text-gray-400">{new Date(file.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <ExternalLink size={14} className="text-gray-300 group-hover:text-purple-400 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
