"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft, Send, CheckCircle2, Clock, Loader2, MessageSquare, AlertCircle,
} from "lucide-react";

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
  status: string;
  stages: Stage[];
  current_stage_index: number;
  start_date: string | null;
  created_at: string;
}

interface Message {
  id: string;
  sender_role: "admin" | "client";
  sender_name: string;
  content: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

export default function ClientProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [project, setProject]   = useState<Project | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg]     = useState("");
  const [sending, setSending]   = useState(false);
  const [clientName, setClientName] = useState("Moi");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Non connecté"); setLoading(false); return; }

      const r = await fetch(`/api/projects/${id}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Projet introuvable"); setLoading(false); return; }
      setProject(d.project);

      const mr = await fetch(`/api/messages?project_id=${id}`);
      const md = await mr.json();
      setMessages(md.messages ?? []);

      setClientName((d.project as Project).name?.split("—")[1]?.trim() || session.user.email?.split("@")[0] || "Moi");
      setLoading(false);
    }
    init();
  }, [id]);

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
        sender_role: "client",
        sender_name: clientName,
        content: newMsg.trim(),
      }),
    });
    const d = await r.json();
    if (r.ok && d.message) {
      setMessages((prev) => [...prev, d.message]);
      setNewMsg("");
    }
    setSending(false);
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

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/client" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors">
        <ArrowLeft size={16} />Retour
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
        <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
          {STATUS_LABELS[project.status] ?? project.status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Stages */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Avancement</h2>
          {stages.length === 0 ? (
            <p className="text-xs text-gray-400">Votre agence va démarrer votre projet prochainement.</p>
          ) : (
            <div className="space-y-3">
              {stages.map((stage, idx) => {
                const isCurrent = idx === currentIdx;
                const isDone = stage.completed;
                return (
                  <div key={stage.id ?? idx} className={`flex items-start gap-3 ${idx < stages.length - 1 ? "pb-3 border-b border-gray-50" : ""}`}>
                    <div className="shrink-0 mt-0.5">
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-green-500" />
                      ) : isCurrent ? (
                        <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isDone ? "text-green-700" : isCurrent ? "text-indigo-700" : "text-gray-400"}`}>
                        {stage.label}
                      </p>
                      <p className="text-xs text-gray-400">{stage.duration_days} jour{stage.duration_days !== 1 ? "s" : ""}</p>
                      {isDone && stage.completed_at && (
                        <p className="text-xs text-green-500">Validé le {new Date(stage.completed_at).toLocaleDateString("fr-FR")}</p>
                      )}
                      {isCurrent && <p className="text-xs text-indigo-400">En cours</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {currentIdx >= stages.length && stages.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-green-600 text-sm font-medium">
              <CheckCircle2 size={15} />Projet terminé !
            </div>
          )}
        </div>

        {/* Chat */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: "520px" }}>
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <MessageSquare size={16} className="text-indigo-500" />
            <h2 className="font-semibold text-gray-900 text-sm">Messages avec l&apos;équipe</h2>
          </div>

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

          <form onSubmit={handleSend} className="p-4 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Écrire un message..."
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
