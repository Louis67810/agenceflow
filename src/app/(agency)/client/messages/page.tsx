"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Send, Loader2, ExternalLink } from "lucide-react";
import { AgencySidebar } from "@/components/agency/AgencySidebar";

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
  client_name: string | null;
  form_data: Record<string, unknown>;
}

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

export default function ClientMessagesPage() {
  const [project, setProject]   = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(true);
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
      if (!session) { setLoading(false); return; }

      const r = await fetch("/api/projects/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const d = await r.json();
      const projects: Project[] = d.projects ?? [];
      if (!projects.length) { setLoading(false); return; }

      const proj = projects[0];
      setProject(proj);
      setClientName(proj.client_name ?? session.user.email?.split("@")[0] ?? "Moi");

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

  async function handleSend(e: { preventDefault?: () => void }) {
    e.preventDefault?.();
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

  const googleDocsUrl = project ? (project.form_data?.google_docs_url ?? project.form_data?.docs_url ?? "") as string : "";
  const figmaUrl      = project ? (project.form_data?.figma_url ?? "") as string : "";
  const framerUrl     = project ? (project.form_data?.framer_url ?? "") as string : "";

  const externalUrls: Record<"docs" | "figma" | "framer", string> = {
    docs: googleDocsUrl,
    figma: figmaUrl,
    framer: framerUrl,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />

      <div style={{ marginLeft: 256, flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "68px 24px 0" }}>
          <h1 style={{
            ...jakartaSans,
            fontSize: 32, fontWeight: 600,
            letterSpacing: "-0.45px", lineHeight: "28px",
            color: "#121a2e", margin: 0,
          }}>
            Mes conversations
          </h1>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "24px 24px 0" }} />

        {/* Conversation card */}
        <div style={{ padding: "20px 24px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{
            flex: 1,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.18)",
            borderRadius: 13,
            overflow: "hidden",
            display: "flex", flexDirection: "column",
            boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
            minHeight: 500,
          }}>
            {/* Tabs */}
            <div style={{
              background: "#fff",
              padding: "14px 15px",
              display: "flex", gap: 6,
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}>
              {/* App tab */}
              <button style={{
                padding: "10px 14px",
                background: "#fff",
                border: "1px solid rgba(158,158,158,0.17)",
                borderRadius: 10,
                fontSize: 14, fontWeight: 600,
                letterSpacing: "-0.45px",
                color: "#121a2e",
                cursor: "pointer",
                boxShadow: "0px 4px 4px rgba(0,0,0,0.02), 0px 1px 2px rgba(0,0,0,0.03)",
              }}>
                App
              </button>

              {(["docs", "figma", "framer"] as const).map((t) => {
                const url     = externalUrls[t];
                const disabled = !url;
                const label    = t === "docs" ? "Google Docs" : t.charAt(0).toUpperCase() + t.slice(1);
                return (
                  <button key={t}
                    disabled={disabled}
                    onClick={() => { if (url) window.open(url, "_blank", "noopener,noreferrer"); }}
                    style={{
                      padding: "10px 14px",
                      background: "transparent",
                      border: "1px solid transparent",
                      borderRadius: 10,
                      fontSize: 14, fontWeight: 600,
                      letterSpacing: "-0.45px",
                      color: disabled ? "rgba(18,26,46,0.2)" : "rgba(18,26,46,0.55)",
                      cursor: disabled ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                    {label}
                    <ExternalLink size={12} style={{ opacity: disabled ? 0.3 : 0.5 }} />
                  </button>
                );
              })}
            </div>

            {/* Messages area */}
            <div style={{
              flex: 1,
              background: "#fbfbfb",
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              borderTop: "1px solid rgba(0,0,0,0.06)",
            }}>
              {loading ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Loader2 size={24} style={{ color: "#121a2e", animation: "spin 1s linear infinite" }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
                  <div style={{ width: 56, height: 56, marginBottom: 16, opacity: 0.25 }}>
                    <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect width="56" height="56" rx="12" fill="#e0e0e0"/>
                      <path d="M14 18h28v16a2 2 0 01-2 2H16a2 2 0 01-2-2V18z" stroke="#121a2e" strokeWidth="1.5" fill="none"/>
                      <circle cx="22" cy="26" r="2" fill="#121a2e"/>
                      <circle cx="28" cy="26" r="2" fill="#121a2e"/>
                      <circle cx="34" cy="26" r="2" fill="#121a2e"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 16, color: "rgba(18,26,46,0.3)", letterSpacing: "-0.45px" }}>
                    Aucun message pour l&apos;instant
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isClient = msg.sender_role === "client";
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isClient ? "flex-end" : "flex-start", gap: 10 }}>
                      {!isClient && (
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: "#121a2e", flexShrink: 0,
                        }}>
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", maxWidth: "60%", alignItems: isClient ? "flex-end" : "flex-start" }}>
                        <span style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", marginBottom: 6, letterSpacing: "-0.45px" }}>
                          {msg.sender_name}
                        </span>
                        <div style={{
                          padding: "12px 16px",
                          background: isClient ? "linear-gradient(121deg, rgb(78,126,250), rgb(1,71,255))" : "#fff",
                          border: isClient ? "none" : "1px solid rgba(0,0,0,0.08)",
                          borderRadius: 10,
                          borderTopRightRadius: isClient ? 2 : 10,
                          borderTopLeftRadius: isClient ? 10 : 2,
                          fontSize: 14, lineHeight: "1.5",
                          color: isClient ? "#fff" : "#121a2e",
                          boxShadow: "0px 2px 5px rgba(0,0,0,0.03)",
                        }}>
                          {msg.content}
                        </div>
                        <span style={{ fontSize: 11, color: "rgba(18,26,46,0.3)", marginTop: 6, letterSpacing: "-0.45px" }}>
                          {new Date(msg.created_at).toLocaleString("fr-FR", {
                            hour: "2-digit", minute: "2-digit",
                            day: "numeric", month: "short",
                          })}
                        </span>
                      </div>
                      {isClient && (
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "rgba(78,126,250,0.1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: "#4e7efa", flexShrink: 0,
                        }}>
                          {clientName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input row */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 20px 14px",
              background: "#fff",
            }}>
              <div style={{
                flex: 1,
                background: "#fff",
                border: "1px solid rgba(158,158,158,0.17)",
                borderRadius: 10,
                padding: "11px 14px",
                boxShadow: "0px 4px 4px rgba(0,0,0,0.02), 0px 1px 2px rgba(0,0,0,0.03)",
              }}>
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Entrez un message ici"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  style={{
                    width: "100%", border: "none", outline: "none",
                    fontSize: 14, fontWeight: 500, letterSpacing: "-0.45px",
                    color: "#121a2e", background: "transparent",
                  }}
                />
              </div>
              <button
                onClick={() => handleSend({})}
                disabled={sending || !newMsg.trim()}
                style={{
                  width: 38, height: 38,
                  background: "linear-gradient(96.83deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                  border: "0.633px solid #2f4d9d",
                  borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: sending || !newMsg.trim() ? "not-allowed" : "pointer",
                  opacity: sending || !newMsg.trim() ? 0.5 : 1,
                  flexShrink: 0,
                  boxShadow: "0px 4px 10px rgba(1,71,255,0.25)",
                }}>
                {sending
                  ? <Loader2 size={14} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
                  : <Send size={14} style={{ color: "#fff" }} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
