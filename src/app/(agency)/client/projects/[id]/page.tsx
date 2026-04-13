"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft, Send, CheckCircle2, Loader2, MessageSquare, AlertCircle,
  Paperclip, ExternalLink, FolderOpen, FileText, ChevronRight, CalendarDays,
  Clock,
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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  review: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
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

  const [project, setProject]     = useState<Project | null>(null);
  const [loading, setLoading]     = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [files, setFiles]         = useState<ProjectFile[]>([]);
  const [newMsg, setNewMsg]       = useState("");
  const [sending, setSending]     = useState(false);
  const [clientName, setClientName] = useState("Moi");
  const [tab, setTab]             = useState<Tab>("brief");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timelineRef    = useRef<HTMLDivElement>(null);

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
      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <p className="text-sm">{error ?? "Projet introuvable"}</p>
      </div>
    </div>
  );

  const stages     = project.stages ?? [];
  const currentIdx = project.current_stage_index ?? 0;
  const currentStage = stages[currentIdx];
  const allDone    = currentIdx >= stages.length && stages.length > 0;
  const startDate  = project.start_date ?? project.created_at.split("T")[0];
  const doneCount  = stages.filter((s) => s.completed).length;
  const progress   = stages.length > 0 ? Math.round((doneCount / stages.length) * 100) : 0;

  const TABS: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "brief", label: "Brief", icon: <FileText size={14} /> },
    { key: "messages", label: "Messages", icon: <MessageSquare size={14} />, count: messages.length > 0 ? messages.length : undefined },
    { key: "fichiers", label: "Fichiers", icon: <Paperclip size={14} />, count: files.length > 0 ? files.length : undefined },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      {/* Back + title */}
      <div className="flex items-start gap-4 mb-8">
        <Link href="/client" className="mt-1 flex items-center gap-1.5 text-gray-400 hover:text-gray-700 text-sm transition-colors shrink-0">
          <ArrowLeft size={15} />Retour
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[project.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Démarré le {new Date(project.start_date ?? project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Horizontal timeline */}
      {stages.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Calendrier du projet</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{doneCount}/{stages.length} étapes</span>
              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-semibold text-indigo-600">{progress}%</span>
            </div>
          </div>
          <div ref={timelineRef} className="overflow-x-auto pb-1">
            <div className="flex min-w-max relative">
              {/* Connecting line */}
              <div className="absolute top-5 left-6 right-6 h-0.5 bg-gray-100 z-0" />

              {stages.map((stage, idx) => {
                const isDone    = stage.completed;
                const isCurrent = idx === currentIdx;
                const deadline  = stageDate(stages, idx, startDate);

                return (
                  <div key={stage.id ?? idx} data-stage={idx}
                    className="flex flex-col items-center min-w-32 px-3 relative z-10">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center mb-3 bg-white transition-all ${
                      isDone    ? "border-emerald-400 bg-emerald-50"
                      : isCurrent ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100"
                      : "border-gray-200"
                    }`}>
                      {stage.image_url ? (
                        <img src={stage.image_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : isDone ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      ) : isCurrent ? (
                        <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                      ) : (
                        <span className="text-xs text-gray-400 font-bold">{idx + 1}</span>
                      )}
                    </div>

                    <p className={`text-xs font-semibold text-center leading-tight mb-0.5 ${
                      isDone ? "text-emerald-700" : isCurrent ? "text-indigo-700" : "text-gray-400"
                    }`}>
                      {stage.label}
                    </p>
                    <p className="text-[10px] text-gray-400">{stage.duration_days}j</p>

                    <div className={`mt-1.5 px-2 py-0.5 rounded-lg text-[10px] text-center ${
                      isDone    ? "bg-emerald-50 text-emerald-600"
                      : isCurrent ? "bg-indigo-50 text-indigo-600 font-medium"
                      : "text-gray-300"
                    }`}>
                      {isDone && stage.completed_at
                        ? `✓ ${new Date(stage.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                        : isCurrent
                        ? `→ ${deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                        : deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: current stage + mini list */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Étape actuelle</h2>

            {allDone ? (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                <CheckCircle2 size={16} />Projet terminé !
              </div>
            ) : !currentStage ? (
              <p className="text-xs text-gray-400">Votre agence va démarrer prochainement.</p>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 rounded-xl">
                  {currentStage.image_url ? (
                    <img src={currentStage.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white border border-indigo-200 flex items-center justify-center shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm text-indigo-700 leading-tight">{currentStage.label}</p>
                    <p className="text-xs text-indigo-500 mt-0.5">{currentStage.duration_days} jours</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                  <CalendarDays size={12} />
                  Fin estimée : {stageDate(stages, currentIdx, startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                </div>

                <button
                  onClick={handleValidate}
                  disabled={advancing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {advancing
                    ? <><Loader2 size={14} className="animate-spin" />Validation...</>
                    : <><CheckCircle2 size={14} />Valider cette étape<ChevronRight size={14} /></>}
                </button>
              </>
            )}
          </div>

          {/* All stages mini list */}
          {stages.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Toutes les étapes</h2>
              <div className="space-y-2">
                {stages.map((stage, idx) => {
                  const isDone    = stage.completed;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div key={stage.id ?? idx} className="flex items-center gap-2.5">
                      <div className="shrink-0">
                        {isDone
                          ? <CheckCircle2 size={13} className="text-emerald-500" />
                          : isCurrent
                          ? <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                          : <div className="w-3 h-3 rounded-full border-2 border-gray-200" />}
                      </div>
                      <p className={`text-xs truncate ${isDone ? "text-emerald-700 line-through" : isCurrent ? "text-indigo-700 font-semibold" : "text-gray-400"}`}>
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
        <div className="col-span-2 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ minHeight: "520px", maxHeight: "620px" }}>
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 shrink-0 px-1 pt-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors rounded-t-lg border-b-2 ${
                  tab === t.key
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.icon}
                {t.label}
                {t.count !== undefined && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tab === t.key ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Brief ── */}
          {tab === "brief" && (
            <div className="flex-1 overflow-y-auto p-5">
              {!project.form_data || Object.keys(project.form_data).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                  <FileText size={32} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">Aucun brief disponible</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(project.form_data).map(([k, v]) => (
                    <div key={k} className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-xs font-medium text-gray-400 mb-1 capitalize">{k.replace(/_/g, " ")}</p>
                      <p className="text-sm text-gray-800">{Array.isArray(v) ? v.join(", ") : String(v ?? "")}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Messages ── */}
          {tab === "messages" && (
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                      <MessageSquare size={20} className="opacity-40" />
                    </div>
                    <p className="text-sm font-medium">Aucun message pour l&apos;instant</p>
                    <p className="text-xs text-gray-400 mt-1">Démarrez la conversation ci-dessous.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isClient = msg.sender_role === "client";
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isClient ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isClient ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600"}`}>
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`flex flex-col max-w-xs lg:max-w-sm ${isClient ? "items-end" : "items-start"}`}>
                          <span className="text-xs text-gray-400 mb-1">{msg.sender_name}</span>
                          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isClient ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
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
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all"
                />
                <button type="submit" disabled={sending || !newMsg.trim()}
                  className="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0">
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </form>
            </>
          )}

          {/* ── Fichiers ── */}
          {tab === "fichiers" && (
            <div className="flex-1 overflow-y-auto p-5">
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-12">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-3">
                    <FolderOpen size={20} className="opacity-40" />
                  </div>
                  <p className="text-sm font-medium">Aucun fichier partagé</p>
                  <p className="text-xs text-gray-400 mt-1">Votre agence partagera les fichiers ici.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3.5 p-3.5 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all group">
                      <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center text-lg shrink-0 border border-gray-100 group-hover:border-indigo-200">
                        {FILE_ICONS[file.type] ?? "📎"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-indigo-700">{file.name}</p>
                        <p className="text-xs text-gray-400">{new Date(file.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                      </div>
                      <ExternalLink size={14} className="text-gray-300 group-hover:text-indigo-500 shrink-0 transition-colors" />
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
