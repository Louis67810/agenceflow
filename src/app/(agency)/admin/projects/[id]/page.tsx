"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Send, CheckCircle2, Clock, Loader2, ChevronRight,
  User, MessageSquare, AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stage {
  id: string;
  label: string;
  duration_days: number;
  completed: boolean;
  completed_at: string | null;
}

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  status: string;
  stages: Stage[];
  current_stage_index: number;
  form_data: Record<string, unknown>;
  start_date: string | null;
  created_at: string;
}

interface Message {
  id: string;
  project_id: string;
  sender_role: "admin" | "client";
  sender_name: string;
  content: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageStartDate(stages: Stage[], idx: number, startDate: string): Date {
  const base = new Date(startDate);
  for (let i = 0; i < idx; i++) base.setDate(base.getDate() + (stages[i]?.duration_days ?? 0));
  return base;
}

function stageEndDate(stages: Stage[], idx: number, startDate: string): Date {
  const start = stageStartDate(stages, idx, startDate);
  start.setDate(start.getDate() + (stages[idx]?.duration_days ?? 0));
  return start;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  review: "bg-purple-50 text-purple-700 border-purple-200",
  completed: "bg-green-50 text-green-700 border-green-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [project, setProject]     = useState<Project | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const [messages, setMessages]     = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg]         = useState("");
  const [sending, setSending]       = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadProject(); }, [id]);
  useEffect(() => { if (project) loadMessages(); }, [project?.id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadProject() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${id}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Erreur"); setLoading(false); return; }
      setProject(d.project);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  async function loadMessages() {
    if (!project) return;
    setMsgLoading(true);
    try {
      const r = await fetch(`/api/messages?project_id=${project.id}`);
      const d = await r.json();
      setMessages(d.messages ?? []);
    } catch { /* silent */ }
    setMsgLoading(false);
  }

  async function handleAdvanceStage() {
    if (!project) return;
    setAdvancing(true);
    try {
      const r = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance_stage" }),
      });
      const d = await r.json();
      if (r.ok) setProject(d.project);
      else alert(d.error ?? "Erreur lors de la validation");
    } catch (e) {
      alert(String(e));
    }
    setAdvancing(false);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !project) return;
    setSending(true);
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          sender_role: "admin",
          sender_name: "Agence",
          content: newMsg.trim(),
        }),
      });
      const d = await r.json();
      if (r.ok && d.message) {
        setMessages((prev) => [...prev, d.message]);
        setNewMsg("");
      }
    } catch { /* silent */ }
    setSending(false);
  }

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  );

  if (error || !project) return (
    <div className="p-8">
      <Link href="/admin/projects" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6">
        <ArrowLeft size={16} />Retour aux projets
      </Link>
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <p className="text-sm">{error ?? "Projet introuvable"}</p>
      </div>
    </div>
  );

  const stages = project.stages ?? [];
  const currentIdx = project.current_stage_index ?? 0;
  const currentStage = stages[currentIdx];
  const allDone = currentIdx >= stages.length;
  const startDate = project.start_date ?? project.created_at.split("T")[0];

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <Link href="/admin/projects" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors">
        <ArrowLeft size={16} />Retour aux projets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[project.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>
          {project.client_name && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <User size={14} />
              <span>{project.client_name}</span>
              {project.client_email && <span className="text-gray-400">— {project.client_email}</span>}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">
          Créé le {new Date(project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: stages + form data */}
        <div className="space-y-5">

          {/* Stages */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 text-sm">Étapes du projet</h2>
              {stages.length > 0 && (
                <span className="text-xs text-gray-400">{Math.min(currentIdx, stages.length)}/{stages.length}</span>
              )}
            </div>

            {stages.length === 0 ? (
              <p className="text-xs text-gray-400">Aucune étape définie (prestation sans étapes).</p>
            ) : (
              <div className="space-y-3">
                {stages.map((stage, idx) => {
                  const isCurrent = idx === currentIdx;
                  const isDone = stage.completed;
                  const isFuture = idx > currentIdx;
                  const end = stageEndDate(stages, idx, startDate);

                  return (
                    <div key={stage.id ?? idx} className={`flex items-start gap-3 pb-3 ${idx < stages.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className="shrink-0 mt-0.5">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-green-500" />
                        ) : isCurrent ? (
                          <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isDone ? "text-green-700" : isCurrent ? "text-indigo-700" : "text-gray-400"}`}>
                          {stage.label}
                        </p>
                        <p className="text-xs text-gray-400">{stage.duration_days} jour{stage.duration_days !== 1 ? "s" : ""}</p>
                        {isDone && stage.completed_at && (
                          <p className="text-xs text-green-500">
                            Validé le {new Date(stage.completed_at).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                        {isCurrent && (
                          <p className="text-xs text-indigo-400">
                            Fin prévue : {end.toLocaleDateString("fr-FR")}
                          </p>
                        )}
                        {isFuture && (
                          <p className="text-xs text-gray-300">
                            À partir du {stageStartDate(stages, idx, startDate).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Advance button */}
            {stages.length > 0 && !allDone && (
              <button
                onClick={handleAdvanceStage}
                disabled={advancing}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {advancing ? (
                  <><Loader2 size={14} className="animate-spin" />Validation...</>
                ) : (
                  <><CheckCircle2 size={14} />Valider — {currentStage?.label}<ChevronRight size={14} /></>
                )}
              </button>
            )}
            {allDone && stages.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle2 size={15} />Projet terminé !
              </div>
            )}
          </div>

          {/* Form data */}
          {Object.keys(project.form_data ?? {}).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-4">Réponses du formulaire</h2>
              <div className="space-y-2.5">
                {Object.entries(project.form_data).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs text-gray-400 capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-sm text-gray-800 font-medium">
                      {Array.isArray(val) ? val.join(", ") : String(val || "—")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: chat (2 columns) */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: "600px" }}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <MessageSquare size={16} className="text-indigo-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Messages avec le client</h2>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {msgLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                <MessageSquare size={28} className="mb-2 opacity-30" />
                <p>Aucun message pour l&apos;instant</p>
                <p className="text-xs mt-1">Envoyez le premier message au client</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isAdmin = msg.sender_role === "admin";
                return (
                  <div key={msg.id} className={`flex gap-3 ${isAdmin ? "flex-row-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isAdmin ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600"}`}>
                      {msg.sender_name.charAt(0).toUpperCase()}
                    </div>
                    <div className={`flex flex-col max-w-xs ${isAdmin ? "items-end" : "items-start"}`}>
                      <span className="text-xs text-gray-400 mb-1">{msg.sender_name}</span>
                      <div className={`px-3 py-2 rounded-xl text-sm ${isAdmin ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"}`}>
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

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Écrire un message au client..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              type="submit"
              disabled={sending || !newMsg.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
