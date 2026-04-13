"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Send, ExternalLink, FolderOpen } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  status: string;
  stages: Stage[];
  current_stage_index: number;
  form_data: Record<string, unknown>;
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

interface ProjectFile {
  id: string;
  name: string;
  url: string;
  type: string;
  created_at: string;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

// Couleurs des étapes (fidèles au Framer)
function stageStyle(stage: Stage, idx: number, currentIdx: number) {
  if (stage.completed) {
    return {
      border: "1.5px solid rgb(22,139,100)",
      background: "rgba(22,139,100,0.08)",
      labelColor: "rgb(22,139,100)",
      subColor: "rgba(22,139,100,0.7)",
    };
  }
  if (idx === currentIdx) {
    return {
      border: "1.5px solid rgb(101,58,18)",
      background: "rgba(101,58,18,0.08)",
      labelColor: "rgb(101,58,18)",
      subColor: "rgba(102,59,18,0.7)",
    };
  }
  return {
    border: "1.5px solid rgb(6,62,98)",
    background: "rgba(6,62,98,0.06)",
    labelColor: "rgb(6,62,98)",
    subColor: "rgba(7,62,99,0.7)",
  };
}

function stageDeadline(stages: Stage[], upToIdx: number, startDate: string): string {
  const d = new Date(startDate);
  for (let i = 0; i <= upToIdx; i++) d.setDate(d.getDate() + (stages[i]?.duration_days ?? 0));
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// ── Component ───────────────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const [project, setProject]     = useState<Project | null>(null);
  const [loading, setLoading]     = useState(true);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [files, setFiles]         = useState<ProjectFile[]>([]);
  const [newMsg, setNewMsg]       = useState("");
  const [sending, setSending]     = useState(false);
  const [clientName, setClientName] = useState("Moi");
  const [advancing, setAdvancing] = useState(false);
  const [tab, setTab]             = useState<"liens" | "brief" | "fichiers">("liens");
  const [convTab, setConvTab]     = useState<"app" | "docs" | "figma" | "framer">("app");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
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

      const [mr, fr] = await Promise.all([
        fetch(`/api/messages?project_id=${proj.id}`),
        fetch(`/api/files?project_id=${proj.id}`),
      ]);
      const md = await mr.json();
      const fd = await fr.json();
      setMessages(md.messages ?? []);
      setFiles(fd.files ?? []);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!newMsg.trim() || !project) return;
    setSending(true);
    const r = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: project.id, sender_role: "client", sender_name: clientName, content: newMsg.trim() }),
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <Loader2 style={{ color: "rgb(18,26,46)", animation: "spin 1s linear infinite" }} size={28} />
    </div>
  );

  if (!project) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", flexDirection: "column", gap: 12 }}>
      <FolderOpen size={40} style={{ color: "rgba(18,26,46,0.2)" }} />
      <p style={{ fontSize: 16, color: "rgba(18,26,46,0.5)" }}>Aucun projet en cours</p>
    </div>
  );

  const stages     = project.stages ?? [];
  const currentIdx = project.current_stage_index ?? 0;
  const currentStage = stages[currentIdx];
  const startDate  = project.start_date ?? project.created_at.split("T")[0];

  // Liens outils depuis form_data si présents
  const googleDocsUrl  = (project.form_data?.google_docs_url  ?? project.form_data?.docs_url  ?? "") as string;
  const figmaUrl       = (project.form_data?.figma_url       ?? "") as string;
  const framerUrl      = (project.form_data?.framer_url      ?? "") as string;

  const toolLinks = [
    { label: "Projet Google Docs", sub: "Google Docs", url: googleDocsUrl, emoji: "📄" },
    { label: "Projet Figma",       sub: "Figma",       url: figmaUrl,      emoji: "🎨" },
    { label: "Projet Framer",      sub: "Framer",      url: framerUrl,     emoji: "▲" },
  ];

  // Style bouton tab
  const tabBtn = (active: boolean) => ({
    display: "flex" as const, alignItems: "center" as const, gap: 4,
    padding: "6px 12px",
    border: "1px solid",
    borderColor: active ? "rgb(18,26,46)" : "rgba(18,26,46,0.15)",
    borderRadius: 8,
    background: active ? "rgb(18,26,46)" : "#fff",
    color: active ? "#fff" : "rgb(18,26,46)",
    fontSize: 12, fontWeight: 600, letterSpacing: "-0.45px", lineHeight: "16px",
    cursor: "pointer",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", position: "relative" }}>
      {/* Panneau décoratif gauche (cartes rotées) */}
      <div style={{
        position: "fixed", left: 64, top: 0, bottom: 0, width: 40,
        background: "linear-gradient(to bottom, rgba(18,26,46,0.04), rgba(18,26,46,0.08))",
        overflow: "hidden", zIndex: 0,
      }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: -20 + (i % 3) * 15,
            top: i * 70 - 20,
            width: 60, height: 40,
            border: "1px solid rgba(18,26,46,0.12)",
            borderRadius: 6,
            transform: "rotate(15deg)",
            background: "#fff",
          }} />
        ))}
      </div>

      {/* Contenu principal */}
      <div style={{ marginLeft: 16, padding: "0 0 32px", position: "relative", zIndex: 1 }}>
        <div style={{
          background: "#fff",
          border: "1px solid rgba(18,26,46,0.1)",
          borderRadius: 0,
          minHeight: "100vh",
          padding: "0 0 24px",
        }}>

          {/* En-tête : "Mon espace" + CTA valider */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "24px 32px 20px",
          }}>
            <h1 style={{
              ...jakartaSans,
              fontSize: 32, fontWeight: 600,
              letterSpacing: "-0.45px", lineHeight: "28px",
              color: "rgb(18,26,46)",
              margin: 0,
            }}>
              Mon espace
            </h1>

            {currentStage && (
              <button onClick={handleValidate} disabled={advancing}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 20px",
                  background: "rgb(18,26,46)",
                  color: "#fff",
                  border: "1px solid rgb(18,26,46)",
                  borderRadius: 10,
                  fontSize: 14, fontWeight: 500, lineHeight: "102.88%",
                  cursor: advancing ? "not-allowed" : "pointer",
                  opacity: advancing ? 0.7 : 1,
                }}>
                {advancing
                  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Validation...</>
                  : `Valider l'étape : ${currentStage.label}`}
              </button>
            )}
          </div>

          {/* Séparateur */}
          <div style={{ height: 1, background: "rgba(18,26,46,0.08)", margin: "0 0 0 0" }} />

          {/* Tabs Liens / Brief / Fichiers */}
          <div style={{ display: "flex", gap: 8, padding: "16px 32px" }}>
            {(["liens", "brief", "fichiers"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Ticker d'étapes */}
          {stages.length > 0 && (
            <div style={{
              margin: "0 32px 20px",
              borderRadius: 12,
              overflow: "hidden",
              background: "linear-gradient(135deg, rgba(18,26,46,0.04) 0%, rgba(18,26,46,0.08) 100%)",
              border: "1px solid rgba(18,26,46,0.08)",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 0,
            }}>
              {stages.map((stage, idx) => {
                const s = stageStyle(stage, idx, currentIdx);
                return (
                  <div key={stage.id ?? idx} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{
                      border: s.border,
                      background: s.background,
                      borderRadius: 10,
                      padding: "8px 16px",
                      display: "flex", flexDirection: "column", gap: 4,
                      minWidth: 140,
                    }}>
                      <span style={{
                        fontSize: 14, fontWeight: 600,
                        letterSpacing: "-0.45px", lineHeight: "16px",
                        color: s.labelColor,
                      }}>
                        {stage.label}
                      </span>
                      <span style={{
                        fontSize: 14, fontWeight: 500,
                        letterSpacing: "-0.45px", lineHeight: "13px",
                        color: s.subColor,
                      }}>
                        {idx === currentIdx && !stage.completed
                          ? `${stage.duration_days} j : fin ${stageDeadline(stages, idx, startDate)}`
                          : `${stage.duration_days} jours`}
                      </span>
                    </div>
                    {/* Connecteur SVG entre les pills */}
                    {idx < stages.length - 1 && (
                      <div style={{ width: 24, height: 2, background: "rgba(18,26,46,0.15)", flexShrink: 0 }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Grille : liens outils + conversation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: "0 32px" }}>

            {/* Panel gauche : liens outils OU brief OU fichiers */}
            <div style={{
              border: "1px solid rgba(18,26,46,0.1)",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
            }}>
              {tab === "liens" && (
                <>
                  {toolLinks.map((link, i) => (
                    <div key={link.label}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 18px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 28, height: 28,
                            background: "rgba(18,26,46,0.04)",
                            borderRadius: 6,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14,
                          }}>
                            {link.emoji}
                          </div>
                          <span style={{
                            fontSize: 14, fontWeight: 600,
                            letterSpacing: "-0.45px", lineHeight: "16px",
                            color: "rgb(18,26,46)",
                          }}>
                            {link.label}
                          </span>
                        </div>
                        {link.url ? (
                          <a href={link.url} target="_blank" rel="noopener noreferrer"
                            style={{
                              display: "flex", alignItems: "center", gap: 4,
                              padding: "5px 12px",
                              border: "1px solid rgba(18,26,46,0.2)",
                              borderRadius: 8,
                              fontSize: 12, fontWeight: 500, lineHeight: "102.88%",
                              color: "rgb(18,26,46)",
                              textDecoration: "none",
                            }}>
                            Ouvrir
                          </a>
                        ) : (
                          <span style={{
                            padding: "5px 12px",
                            border: "1px solid rgba(18,26,46,0.1)",
                            borderRadius: 8,
                            fontSize: 12, color: "rgba(18,26,46,0.3)",
                          }}>
                            Non configuré
                          </span>
                        )}
                      </div>
                      {i < toolLinks.length - 1 && (
                        <div style={{ height: 1, background: "rgba(18,26,46,0.06)", margin: "0 18px" }} />
                      )}
                    </div>
                  ))}
                </>
              )}

              {tab === "brief" && (
                <div style={{ padding: "16px 18px" }}>
                  {!project.form_data || Object.keys(project.form_data).length === 0 ? (
                    <p style={{ fontSize: 14, color: "rgba(18,26,46,0.3)", textAlign: "center", padding: "24px 0" }}>
                      Aucun brief disponible
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {Object.entries(project.form_data).map(([k, v]) => (
                        <div key={k} style={{ padding: "10px 14px", background: "rgba(18,26,46,0.02)", borderRadius: 8, border: "1px solid rgba(18,26,46,0.06)" }}>
                          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(18,26,46,0.4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {k.replace(/_/g, " ")}
                          </p>
                          <p style={{ fontSize: 14, color: "rgb(18,26,46)" }}>
                            {Array.isArray(v) ? v.join(", ") : String(v ?? "")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "fichiers" && (
                <div style={{ padding: "16px 18px" }}>
                  {files.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0" }}>
                      <FolderOpen size={28} style={{ color: "rgba(18,26,46,0.15)", margin: "0 auto 8px" }} />
                      <p style={{ fontSize: 14, color: "rgba(18,26,46,0.3)" }}>Aucun fichier partagé</p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {files.map((file) => (
                        <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px",
                            border: "1px solid rgba(18,26,46,0.08)", borderRadius: 8,
                            textDecoration: "none",
                          }}>
                          <span style={{ fontSize: 14, color: "rgb(18,26,46)", fontWeight: 500 }}>{file.name}</span>
                          <ExternalLink size={14} style={{ color: "rgba(18,26,46,0.3)" }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Panel droit : conversation */}
            <div style={{
              border: "1px solid rgba(18,26,46,0.1)",
              borderRadius: 12,
              overflow: "hidden",
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              height: 460,
            }}>
              {/* Titre + tabs de contexte */}
              <div style={{ padding: "14px 18px 0", borderBottom: "1px solid rgba(18,26,46,0.06)" }}>
                <h2 style={{
                  fontSize: 20, fontWeight: 600,
                  letterSpacing: "-0.45px", lineHeight: "16px",
                  color: "rgb(18,26,46)", marginBottom: 12,
                }}>
                  Conversation
                </h2>
                {/* Tabs App / Google Docs / Figma / Framer */}
                <div style={{ display: "flex", gap: 6, paddingBottom: 14 }}>
                  {([
                    { key: "app",    label: "App" },
                    { key: "docs",   label: "Google Docs", url: googleDocsUrl },
                    { key: "figma",  label: "Figma",       url: figmaUrl },
                    { key: "framer", label: "Framer",      url: framerUrl },
                  ] as { key: typeof convTab; label: string; url?: string }[]).map((t) => {
                    const isActive = convTab === t.key;
                    if (t.key !== "app" && t.url) {
                      return (
                        <a key={t.key} href={t.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "5px 10px",
                            border: "1px solid rgba(18,26,46,0.15)",
                            borderRadius: 8,
                            fontSize: 12, fontWeight: 600,
                            letterSpacing: "-0.45px", lineHeight: "16px",
                            color: "rgb(18,26,46)",
                            textDecoration: "none",
                          }}>
                          {t.label}
                          <ExternalLink size={11} />
                        </a>
                      );
                    }
                    return (
                      <button key={t.key} onClick={() => setConvTab(t.key)}
                        style={{
                          padding: "5px 10px",
                          border: "1px solid",
                          borderColor: isActive ? "rgb(18,26,46)" : "rgba(18,26,46,0.15)",
                          borderRadius: 8,
                          background: isActive ? "rgb(18,26,46)" : "#fff",
                          color: isActive ? "#fff" : "rgb(18,26,46)",
                          fontSize: 12, fontWeight: 600,
                          letterSpacing: "-0.45px", lineHeight: "16px",
                          cursor: "pointer",
                        }}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Zone messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                {messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(18,26,46,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Send size={16} style={{ color: "rgba(18,26,46,0.2)" }} />
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.45px", lineHeight: "16px", color: "rgba(18,26,46,0.3)" }}>
                      Aucun message pour l&apos;instant
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isClient = msg.sender_role === "client";
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: isClient ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "75%",
                          padding: "8px 12px",
                          borderRadius: 10,
                          background: isClient ? "rgb(18,26,46)" : "rgba(18,26,46,0.05)",
                          color: isClient ? "#fff" : "rgb(18,26,46)",
                          fontSize: 13, lineHeight: "18px",
                        }}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input message */}
              <form onSubmit={handleSend} style={{
                borderTop: "1px solid rgba(18,26,46,0.08)",
                padding: "12px 18px",
                display: "flex", gap: 10, alignItems: "center",
              }}>
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Entrez un message ici"
                  style={{
                    flex: 1, padding: "8px 12px",
                    border: "1px solid rgba(18,26,46,0.15)",
                    borderRadius: 8,
                    fontSize: 12, fontWeight: 600,
                    letterSpacing: "-0.45px", lineHeight: "16px",
                    color: "rgba(18,26,46,0.6)",
                    outline: "none",
                    background: "#fff",
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                />
                <button type="submit" disabled={sending || !newMsg.trim()}
                  style={{
                    width: 34, height: 34,
                    background: "rgb(18,26,46)",
                    border: "none", borderRadius: 8,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: sending || !newMsg.trim() ? "not-allowed" : "pointer",
                    opacity: sending || !newMsg.trim() ? 0.5 : 1,
                  }}>
                  {sending
                    ? <Loader2 size={14} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
                    : <Send size={14} style={{ color: "#fff" }} />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
