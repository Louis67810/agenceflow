"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Send, Loader2, MessageSquare, AlertCircle } from "lucide-react";

interface Message {
  id: string;
  sender_role: "admin" | "client";
  sender_name: string;
  content: string;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

export default function ClientMessagesPage() {
  const [project, setProject]   = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
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

      // Load client's project
      const r = await fetch("/api/projects/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const d = await r.json();
      const projects: Project[] = d.projects ?? [];
      if (projects.length === 0) { setLoading(false); return; }

      const proj = projects[0];
      setProject(proj);
      setClientName(proj.name?.split("—")[1]?.trim() || session.user.email?.split("@")[0] || "Moi");

      // Load messages
      const mr = await fetch(`/api/messages?project_id=${proj.id}`);
      const md = await mr.json();
      setMessages(md.messages ?? []);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 lg:px-10 py-5 border-b border-gray-200 bg-white shrink-0">
        <h1 className="text-lg font-bold text-gray-900">Conversation</h1>
        {project && (
          <p className="text-sm text-gray-400 mt-0.5">{project.name}</p>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-500" size={28} />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 max-w-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      ) : !project ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={22} className="text-gray-300" />
            </div>
            <p className="text-gray-700 font-semibold mb-1">Aucun projet en cours</p>
            <p className="text-gray-400 text-sm">Votre conversation apparaîtra ici une fois votre projet démarré.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 space-y-5 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                <div className="w-14 h-14 bg-white rounded-2xl border border-gray-200 flex items-center justify-center mb-4">
                  <MessageSquare size={22} className="opacity-40" />
                </div>
                <p className="text-sm font-medium text-gray-600">Aucun message pour l&apos;instant</p>
                <p className="text-xs text-gray-400 mt-1">Démarrez la conversation avec votre agence.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isClient = msg.sender_role === "client";
                return (
                  <div key={msg.id} className={`flex gap-3 ${isClient ? "flex-row-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isClient ? "bg-indigo-100 text-indigo-600" : "bg-white border border-gray-200 text-gray-600"}`}>
                      {msg.sender_name.charAt(0).toUpperCase()}
                    </div>
                    <div className={`flex flex-col max-w-xs lg:max-w-md ${isClient ? "items-end" : "items-start"}`}>
                      <span className="text-xs text-gray-400 mb-1.5">{msg.sender_name}</span>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isClient ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"}`}>
                        {msg.content}
                      </div>
                      <span className="text-xs text-gray-400 mt-1.5">
                        {new Date(msg.created_at).toLocaleString("fr-FR", {
                          hour: "2-digit", minute: "2-digit",
                          day: "numeric", month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-6 lg:px-10 py-4 border-t border-gray-200 bg-white shrink-0">
            <form onSubmit={handleSend} className="flex gap-3 items-end max-w-3xl">
              <input
                type="text"
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Écrire un message à votre agence..."
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />
              <button
                type="submit"
                disabled={sending || !newMsg.trim()}
                className="flex items-center justify-center w-11 h-11 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
