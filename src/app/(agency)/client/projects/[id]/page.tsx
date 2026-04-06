"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft, Send, CheckCircle2, Loader2, MessageSquare, AlertCircle,
  Paperclip, ExternalLink, FolderOpen, FileText, ChevronRight, CalendarDays,
} from "lucide-react";

interface Stage {
  id: string;
  label: string;
  duration_days: number;
  completed: boolean;
  completed_at: string | null;
  image_url?: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  stages: Stage[];
  current_stage_index: number;
  start_date: string | null;
  created_at: string;
  form_data: Record<string, unknown>;
}

interface Message {
  id: string;
  sender_role: "admin" | "client";
  sender_name: string;
  content: string;
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

type Tab = "brief" | "messages" | "fichiers";

function stageDate(stages: Stage[], upToIdx: number, startDate: string): Date {
  const d = new Date(startDate);
  for (let i = 0; i <= upToIdx; i++) d.setDate(d.getDate() + (stages[i]?.duration_days ?? 0));
  return d;
}

export default function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [project, setProject]   = useState<Project | null>(null);
  const [loading, setLoading]   = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles]       = useState<ProjectFile[]>([]);
  const [newMsg, setNewMsg]     = useState("");
  const [sending, setSending]   = useState(false);
  const [clientName, setClientName] = useState("Moi");
  const [tab, setTab]           = useState<Tab>("brief");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Non connecté"); setLoading(false); return; }

      const [pr, mr, fr] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/messages?project_id=${id}`),
        fetch(`/api/files?project_id=${id}`),
      ]);

      const pd = await pr.json();
      if (!pr.ok) { setError(pd.error ?? "Projet introuvable"); setLoading(false); return; }
      setProject(pd.project);

      const md = await mr.json();
      setMessages(md.messages ?? []);

      const fd = await fr.json();
      setFiles(fd.files ?? []);

      setClientName((pd.project as Project).name?.split("—")[1]?.trim() || session.user.email?.split("@")[0] || "Moi");
      setLoading(false);
    }
    init();
  }, [id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Scroll timeline to current stage
  useEffect(() => {
    if (!project || !timelineRef.current) return;
    const currentEl = timelineRef.current.querySelector(`[data-stage="${project.current_stage_index}"]`) as HTMLElement | null;
    if (currentEl) currentEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [project]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !project) return;
    setSending(true);
    const r = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        sender_role: "client",
        sender_name: clientName,
        content: newMsg.trim(),
      }),
    });
    const d = await r.json();
    if (r.ok && d.message) { setMessages((prev) => [...prev, d.message]); setNewMsg(""); }
    setSending(false);
  }

  async function handleValidate() {
    if (!project) return;
    setAdvancing(true);
    const r = await fetch(`/api/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance_stage" }),
    });
    const d = await r.json();
    if (r.ok) setProject(d.project);
    setAdvancing(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  );

  if (error || !project) return (
    <div className="p-8">
      <Link href="/client" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-4">
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
  const currentStage = stages[currentIdx];
  const allDone = currentIdx >= stages.length && stages.length > 0;
  const startDate = project.start_date ?? project.created_at.split("T")[0];

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/client" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors">
        <ArrowLeft size={16} />Retour
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
      </div>

      {/* ── Horizontal Timeline ── */}
      {stages.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Calendrier du projet</h2>
          <div ref={timelineRef} className="overflow-x-auto pb-2">
            <div className="flex min-w-max relative">
              {/* Connecting line */}
              <div className="absolute top-5 left-6 right-6 h-0.5 bg-gray-100 z-0" />

              {stages.map((stage, idx) => {
                const isDone = stage.completed;
                const isCurrent = idx === currentIdx;
                const deadline = stageDate(stages, idx, startDate);
                const startD = idx === 0
                  ? new Date(startDate)
                  : stageDate(stages, idx - 1, startDate);

                return (
                  <div
                    key={stage.id ?? idx}
                    data-stage={idx}
                    className="flex flex-col items-center min-w-36 px-3 relative z-10"
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-3 bg-white transition-all ${
                      isDone ? "border-green-400 bg-green-50"
                      : isCurrent ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100"
                      : "border-gray-200"
                    }`}>
                      {stage.image_url ? (
                        <img src={stage.image_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : isDone ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : isCurrent ? (
                        <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                      ) : (
                        <span className="text-xs text-gray-400 font-bold">{idx + 1}</span>
                      )}
                    </div>

                    {/* Label */}
                    <p className={`text-xs font-semibold text-center leading-tight mb-1 ${
                      isDone ? "text-green-700" : isCurrent ? "text-indigo-700" : "text-gray-400"
                    }`}>
                      {stage.label}
                    </p>
                    <p className="text-xs text-gray-400 text-center">{stage.duration_days}j</p>

                    {/* Date */}
                    <div className={`mt-2 px-2 py-1 rounded-lg text-xs text-center ${
                      isDone ? "bg-green-50 text-green-600"
                      : isCurrent ? "bg-indigo-50 text-indigo-600 font-medium"
                      : "text-gray-300"
                    }`}>
                      {isDone && stage.completed_at
                        ? `✓ ${new Date(stage.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                        : isCurrent
                        ? `→ ${deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                        : deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Left: current stage info + validation */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Étape actuelle</h2>
            {allDone ? (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle2 size={16} />Projet terminé !
              </div>
            ) : !currentStage ? (
              <p className="text-xs text-gray-400">Votre agence va démarrer prochainement.</p>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {currentStage.image_url ? (
                    <img src={currentStage.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm text-indigo-700">{currentStage.label}</p>
                    <p className="text-xs text-gray-400">{currentStage.duration_days} jours</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                  <CalendarDays size={12} />
                  Fin estimée : {stageDate(stages, currentIdx, startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                </div>

                {/* Progression bar */}
                {stages.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Avancement global</span>
                      <span>{Math.round((stages.filter(s => s.completed).length / stages.length) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${(stages.filter(s => s.completed).length / stages.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleValidate}
                  disabled={advancing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {advancing
                    ? <><Loader2 size={14} className="animate-spin" />Validation...</>
                    : <><CheckCircle2 size={14} />Valider cette étape<ChevronRight size={14} /></>
                  }
                </button>
              </>
            )}
          </div>

          {/* All stages mini list */}
          {stages.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="font-semibold text-gray-900 text-xs uppercase tracking-wide text-gray-400 mb-3">Toutes les étapes</h2>
              <div className="space-y-2">
                {stages.map((stage, idx) => {
                  const isDone = stage.completed;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div key={stage.id ?? idx} className="flex items-center gap-2">
                      <div className="shrink-0">
                        {isDone ? <CheckCircle2 size={13} className="text-green-500" />
                        : isCurrent ? <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                        : <div className="w-3 h-3 rounded-full border-2 border-gray-200" />}
                      </div>
                      <p className={`text-xs truncate ${isDone ? "text-green-700 line-through" : isCurrent ? "text-indigo-700 font-medium" : "text-gray-400"}`}>
                        {stage.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: tabs */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: "520px" }}>
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 shrink-0">
            {[
              { key: "brief" as Tab, label: "Brief", icon: <FileText size={14} /> },
              { key: "messages" as Tab, label: "Messages", icon: <MessageSquare size={14} /> },
              { key: "fichiers" as Tab, label: `Fichiers${files.length > 0 ? ` (${files.length})` : ""}`, icon: <Paperclip size={14} /> },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  tab === t.key ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Brief */}
          {tab === "brief" && (
            <div className="flex-1 overflow-y-auto p-5">
              {!project.form_data || Object.keys(project.form_data).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FileText size={32} className="mb-3 opacity-40" />
                  <p className="text-sm">Aucun brief disponible</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(project.form_data).map(([k, v]) => (
                    <div key={k} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-medium text-gray-400 mb-1 capitalize">{k.replace(/_/g, " ")}</p>
                      <p className="text-sm text-gray-800">{Array.isArray(v) ? v.join(", ") : String(v ?? "")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {tab === "messages" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                    <MessageSquare size={28} className="mb-2 opacity-30" />
                    <p>Aucun message pour l&apos;instant</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isClient = msg.sender_role === "client";
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isClient ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isClient ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600"}`}>
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`flex flex-col max-w-xs ${isClient ? "items-end" : "items-start"}`}>
                          <span className="text-xs text-gray-400 mb-1">{msg.sender_name}</span>
                          <div className={`px-3 py-2 rounded-xl text-sm ${isClient ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"}`}>
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
              <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2 shrink-0">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Écrire un message..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button type="submit" disabled={sending || !newMsg.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </form>
            </>
          )}

          {/* Files */}
          {tab === "fichiers" && (
            <div className="flex-1 overflow-y-auto p-5">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FolderOpen size={32} className="mb-3 opacity-40" />
                  <p className="text-sm">Aucun fichier partagé pour l&apos;instant</p>
                  <p className="text-xs mt-1">Votre agence partagera les fichiers ici.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors group">
                      <span className="text-xl">{FILE_ICONS[file.type] ?? "📎"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-indigo-700">{file.name}</p>
                        <p className="text-xs text-gray-400">{new Date(file.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <ExternalLink size={14} className="text-gray-300 group-hover:text-indigo-400 shrink-0" />
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
