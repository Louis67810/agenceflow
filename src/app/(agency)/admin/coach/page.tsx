"use client";

import { useEffect, useRef, useState } from "react";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { Send, Bot, User, Loader2, Plus, Trash2, ChevronDown } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

const MODELS = [
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "anthropic/claude-opus-4", label: "Claude Opus 4" },
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "google/gemini-pro-1.5", label: "Gemini Pro 1.5" },
  { id: "mistralai/mistral-large-2411", label: "Mistral Large" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
];

const SUGGESTIONS = [
  "Analyse mes projets en cours et dis-moi quels risques tu vois.",
  "Comment optimiser ma prospection LinkedIn basée sur mes leads actuels ?",
  "Quelles habitudes devrais-je prendre pour scaler mon agence ?",
  "Aide-moi à rédiger une offre de service pour attirer plus de clients.",
  "Quelles sont les erreurs courantes des agences à mon stade ?",
];

export default function CoachPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [businessContext, setBusinessContext] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    agendaFetch("/api/coach").then(r => r.json()).then(d => setConversations(d.conversations ?? []));
    agendaFetch("/api/app-settings").then(r => r.json()).then(d => {
      setBusinessContext(d.settings?.business_context ?? "");
      const m = d.settings?.ai_models?.coach;
      if (m) setModel(m);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const newConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    const res = await agendaFetch("/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: newMessages,
        model,
        business_context: businessContext,
        conversation_id: conversationId,
      }),
    }).then(r => r.json());

    setLoading(false);
    if (res.reply) {
      setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
    }
    if (res.conversation_id) {
      setConversationId(res.conversation_id);
      setConversations(prev => {
        const exists = prev.find(c => c.id === res.conversation_id);
        if (!exists && res.conversation_id) {
          return [{ id: res.conversation_id, title: content.slice(0, 40) + "...", updated_at: new Date().toISOString() }, ...prev];
        }
        return prev;
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar conversations */}
      <div className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-indigo-600" />
              <span className="font-bold text-gray-900 text-sm">Coach IA</span>
            </div>
            <button onClick={newConversation} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700" title="Nouvelle conversation">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Model selector */}
        <div className="px-3 py-2 border-b border-gray-100">
          <label className="text-xs text-gray-500 mb-1 block">Modèle</label>
          <div className="relative">
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 pr-6 bg-white appearance-none focus:outline-none focus:border-indigo-400 text-gray-700"
            >
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center p-4">Aucune conversation</p>
          ) : (
            conversations.map(c => (
              <div key={c.id} className={`p-2.5 rounded-lg mb-1 cursor-pointer text-xs hover:bg-gray-50 transition-colors ${conversationId === c.id ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600"}`}>
                <p className="truncate">{c.title}</p>
                <p className="text-gray-400 mt-0.5">{new Date(c.updated_at).toLocaleDateString("fr-FR")}</p>
              </div>
            ))
          )}
        </div>

        {/* Settings */}
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={() => setShowSettings(s => !s)}
            className="w-full text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 justify-center"
          >
            Contexte business <ChevronDown size={11} className={showSettings ? "rotate-180" : ""} />
          </button>
          {showSettings && (
            <div className="mt-2">
              <textarea
                value={businessContext}
                onChange={e => setBusinessContext(e.target.value)}
                onBlur={() => agendaFetch("/api/app-settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ business_context: businessContext }),
                })}
                placeholder="Décrivez votre agence, vos services, vos objectifs..."
                rows={5}
                className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:outline-none focus:border-indigo-400 text-gray-700"
              />
              <p className="text-xs text-gray-400 mt-1">Sauvegarde automatique</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto text-center mt-12">
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot size={32} className="text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Coach Business IA</h2>
              <p className="text-gray-500 text-sm mb-8">Je connais vos projets, leads et données. Posez-moi n'importe quelle question sur votre agence.</p>
              <div className="grid grid-cols-1 gap-2 text-left">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)} className="p-3 bg-white rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} max-w-4xl ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-indigo-600" />
                </div>
              )}
              <div className={`rounded-2xl px-4 py-3 text-sm max-w-2xl whitespace-pre-wrap leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
              }`}>
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
                  <User size={16} className="text-white" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start max-w-4xl">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                <Bot size={16} className="text-indigo-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 size={16} className="animate-spin text-indigo-500" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Posez votre question... (Entrée pour envoyer, Shift+Entrée pour nouvelle ligne)"
              rows={2}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-indigo-400 leading-relaxed"
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
