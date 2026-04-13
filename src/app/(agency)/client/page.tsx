"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Send, FolderOpen, ExternalLink, MessageSquare } from "lucide-react";
import { AgencySidebar } from "@/components/agency/AgencySidebar";

// ── Types ────────────────────────────────────────────────────────────────────

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
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

function stageColors(stage: Stage, idx: number) {
  if (stage.completed) return {
    bg: "#d1fae5", border: "1px solid rgba(22,139,100,0.2)",
    text: "#168b64", sub: "rgba(22,139,100,0.7)",
  };
  const palette = [
    { bg: "#fee6d0", border: "1px solid rgba(102,59,18,0.17)", text: "#663b12", sub: "rgba(102,59,18,0.7)"  },
    { bg: "#d5eeff", border: "1px solid rgba(7,62,99,0.17)",   text: "#073e63", sub: "rgba(7,62,99,0.7)"    },
    { bg: "#E1D1FA", border: "1px solid rgba(98,54,170,0.17)", text: "#6236AA", sub: "rgba(98,54,170,0.7)"  },
  ];
  return palette[idx % 3];
}

function stageDeadline(stages: Stage[], upToIdx: number, startDate: string): string {
  const d = new Date(startDate);
  for (let i = 0; i <= upToIdx; i++) d.setDate(d.getDate() + (stages[i]?.duration_days ?? 0));
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientDashboard() {
  const [project, setProject]       = useState<Project | null>(null);
  const [loading, setLoading]       = useState(true);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [files, setFiles]           = useState<ProjectFile[]>([]);
  const [newMsg, setNewMsg]         = useState("");
  const [sending, setSending]       = useState(false);
  const [clientName, setClientName] = useState("Moi");
  const [advancing, setAdvancing]   = useState(false);
  const [tab, setTab]               = useState<"liens" | "brief" | "fichiers">("liens");
  const [convTab, setConvTab]       = useState<"app">("app");
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

  async function handleSend(e: React.FormEvent | { preventDefault?: () => void }) {
    if ("preventDefault" in e) e.preventDefault?.();
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#fbfbfb" }}>
      <Loader2 style={{ color: "#121a2e", animation: "spin 1s linear infinite" }} size={28} />
    </div>
  );

  if (!project) return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
        <FolderOpen size={40} style={{ color: "rgba(18,26,46,0.2)" }} />
        <p style={{ fontSize: 16, color: "rgba(18,26,46,0.5)" }}>Aucun projet en cours</p>
      </div>
    </div>
  );

  const stages      = project.stages ?? [];
  const currentIdx  = project.current_stage_index ?? 0;
  const currentStage = stages[currentIdx];
  const startDate   = project.start_date ?? project.created_at.split("T")[0];
  const totalDays   = stages.reduce((s, st) => s + (st.duration_days || 1), 0);

  const googleDocsUrl = (project.form_data?.google_docs_url ?? project.form_data?.docs_url ?? "") as string;
  const figmaUrl      = (project.form_data?.figma_url ?? "") as string;
  const framerUrl     = (project.form_data?.framer_url ?? "") as string;

  const toolLinks = [
    {
      label: "Projet Google Docs",
      url: googleDocsUrl,
      icon: (
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
          <path fill="#4285F4" d="M2 0h10l6 6v14a2 2 0 01-2 2H2a2 2 0 01-2-2V2a2 2 0 012-2z"/>
          <path fill="#1565C0" d="M12 0l6 6h-6V0z"/>
          <rect fill="white" x="3" y="9" width="12" height="1.8" rx=".9"/>
          <rect fill="white" x="3" y="12.5" width="12" height="1.8" rx=".9"/>
          <rect fill="white" x="3" y="16" width="7" height="1.8" rx=".9"/>
        </svg>
      ),
    },
    {
      label: "Projet Figma",
      url: figmaUrl,
      icon: (
        <svg width="15" height="23" viewBox="0 0 15 23" fill="none">
          <path d="M0 18.3594C0 16.3315 1.61774 14.6875 3.61328 14.6875H7.22656V18.3594C7.22656 20.3873 5.60882 22.0312 3.61328 22.0312C1.61774 22.0312 0 20.3873 0 18.3594Z" fill="#24CB71"/>
          <path d="M7.22656 0V7.34375H10.8398C12.8354 7.34375 14.4531 5.69978 14.4531 3.67187C14.4531 1.64397 12.8354 0 10.8398 0H7.22656Z" fill="#FF7237"/>
          <path d="M10.8096 14.6875C12.8051 14.6875 14.4229 13.0435 14.4229 11.0156C14.4229 8.9877 12.8051 7.34375 10.8096 7.34375C8.81401 7.34375 7.19629 8.9877 7.19629 11.0156C7.19629 13.0435 8.81401 14.6875 10.8096 14.6875Z" fill="#00B6FF"/>
          <path d="M0 3.67187C0 5.69978 1.61774 7.34375 3.61328 7.34375H7.22656V0H3.61328C1.61774 0 0 1.64397 0 3.67187Z" fill="#FF3737"/>
          <path d="M0 11.0156C0 13.0435 1.61774 14.6875 3.61328 14.6875H7.22656V7.34375H3.61328C1.61774 7.34375 0 8.98772 0 11.0156Z" fill="#874FFF"/>
        </svg>
      ),
    },
    {
      label: "Projet Framer",
      url: framerUrl,
      icon: (
        <svg width="14" height="21" viewBox="0 0 14 21" fill="none">
          <path d="M0 0H13.7614V6.88044H6.88071L0 0ZM0 6.88044H6.88071L13.7614 13.7612H0V6.88044ZM0 13.7612H6.88071V20.6419L0 13.7612Z" fill="black"/>
        </svg>
      ),
    },
  ];

  // Médias pour le ticker : fichiers images/vidéos uploadés par l'utilisateur
  const mediaFiles = files.filter((f) => f.type.startsWith("image") || f.type.startsWith("video"));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ── Hero : ticker vertical de médias ─────────────────────────── */}
        <HeroBanner mediaFiles={mediaFiles} />

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "24px 24px 16px",
        }}>
          <h1 style={{
            ...jakartaSans,
            fontSize: 32, fontWeight: 600,
            letterSpacing: "-0.45px", lineHeight: "28px",
            color: "#121a2e", margin: 0,
          }}>
            Mon espace
          </h1>

          {currentStage && (
            <div style={{ padding: 6, background: "#e1e5ee", borderRadius: 15 }}>
              <button onClick={handleValidate} disabled={advancing}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "14px 20px",
                  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                  color: "#fff",
                  border: "1px solid #2f4d9d",
                  borderRadius: 10,
                  fontSize: 14, fontWeight: 500,
                  cursor: advancing ? "not-allowed" : "pointer",
                  opacity: advancing ? 0.7 : 1,
                  boxShadow: "inset 0px -3px 0px 0px #0e42c8, inset 0px 2px 6px 4px rgba(0,0,0,0.08), inset 0px 3px 0px 0px rgba(255,255,255,0.5), 0px 4px 12px rgba(1,71,255,0.2)",
                  whiteSpace: "nowrap",
                }}>
                {advancing
                  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Validation...</>
                  : `Valider : ${currentStage.label}`}
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "0 24px" }} />

        {/* ── Main content ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 16, padding: "20px 24px 32px", flex: 1 }}>

          {/* Left column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

            {/* Gantt */}
            {stages.length > 0 && (
              <div style={{
                position: "relative",
                background: "#eeeeee",
                borderRadius: 13,
                height: 196,
                overflow: "hidden",
                flexShrink: 0,
              }}>
                <div style={{ position: "absolute", left: 16, right: 16, top: 0, bottom: 0 }}>
                  {/* Now-line */}
                  {(() => {
                    const nowPct = stages.slice(0, currentIdx).reduce((s, st) => s + (st.duration_days || 1), 0) / totalDays * 100;
                    return (
                      <div style={{
                        position: "absolute",
                        left: `${nowPct}%`,
                        top: 8, bottom: 8, width: 2,
                        background: "rgba(0,0,0,0.3)",
                        zIndex: 3, borderRadius: 1,
                      }} />
                    );
                  })()}

                  {stages.map((stage, idx) => {
                    const startPct = stages.slice(0, idx).reduce((s, st) => s + (st.duration_days || 1), 0) / totalDays * 100;
                    const widthPct = (stage.duration_days || 1) / totalDays * 100;
                    const isTop    = idx % 2 === 0;
                    const c        = stageColors(stage, idx);
                    return (
                      <div key={stage.id ?? idx} style={{
                        position: "absolute",
                        left: `${startPct}%`,
                        width: `calc(${widthPct}% - 8px)`,
                        top: isTop ? 22 : 104,
                        height: 70,
                        background: c.bg,
                        border: c.border,
                        borderRadius: 10,
                        padding: "12px 11px",
                        boxShadow: "0px 4px 8px rgba(0,0,0,0.06)",
                        overflow: "hidden",
                        boxSizing: "border-box",
                        zIndex: 2,
                      }}>
                        <span style={{
                          display: "block", fontSize: 13, fontWeight: 600,
                          letterSpacing: "-0.45px", color: c.text,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {stage.label}
                        </span>
                        <span style={{ display: "block", marginTop: 6, fontSize: 11, color: c.sub }}>
                          {idx === currentIdx && !stage.completed
                            ? `fin ${stageDeadline(stages, idx, startDate)}`
                            : `${stage.duration_days}j`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tool links card */}
            <div style={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.13)",
              borderRadius: 13,
              overflow: "hidden",
              boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
            }}>
              <div style={{
                background: "#fbfbfb",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                padding: "10px 12px",
                display: "flex", gap: 4,
              }}>
                {(["liens", "brief", "fichiers"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{
                      padding: "10px 13px",
                      background: tab === t ? "#fff" : "transparent",
                      border: tab === t ? "1px solid rgba(158,158,158,0.17)" : "1px solid transparent",
                      borderRadius: 9,
                      fontSize: 14, fontWeight: 600,
                      letterSpacing: "-0.45px",
                      color: tab === t ? "#121a2e" : "rgba(18,26,46,0.45)",
                      cursor: "pointer",
                      boxShadow: tab === t ? "0px 4px 4px rgba(0,0,0,0.02)" : "none",
                    }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              <div style={{ padding: "12px 16px" }}>
                {tab === "liens" && toolLinks.map((link, i) => (
                  <div key={link.label}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 4px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: "#f7f7f7",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                          opacity: link.url ? 1 : 0.4,
                        }}>
                          {link.icon}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.45px", color: link.url ? "#121a2e" : "rgba(18,26,46,0.35)" }}>
                          {link.label}
                        </span>
                      </div>
                      {link.url ? (
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            padding: "9px 13px",
                            background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
                            borderRadius: 9, fontSize: 13, fontWeight: 500,
                            color: "#121a2e", textDecoration: "none",
                            boxShadow: "0px 2px 4px rgba(0,0,0,0.04)",
                          }}>
                          Ouvrir
                        </a>
                      ) : (
                        <span style={{
                          padding: "9px 13px", border: "1px solid rgba(0,0,0,0.05)",
                          borderRadius: 9, fontSize: 12, color: "rgba(18,26,46,0.25)",
                          letterSpacing: "-0.3px",
                        }}>
                          En attente de création
                        </span>
                      )}
                    </div>
                    {i < toolLinks.length - 1 && <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />}
                  </div>
                ))}

                {tab === "brief" && (
                  <div style={{ padding: "4px 0" }}>
                    {project.form_data && Object.entries(project.form_data).filter(([k]) => !k.startsWith("_") && !["google_docs_url","figma_url","framer_url","docs_url"].includes(k)).length > 0 ? (
                      Object.entries(project.form_data)
                        .filter(([k]) => !k.startsWith("_") && !["google_docs_url","figma_url","framer_url","docs_url"].includes(k))
                        .map(([k, v], i, arr) => (
                          <div key={k}>
                            <div style={{ padding: "10px 4px" }}>
                              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.38)", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>
                                {k.replace(/_/g, " ")}
                              </span>
                              <p style={{ margin: 0, fontSize: 14, color: "#121a2e", lineHeight: "1.5" }}>{String(v)}</p>
                            </div>
                            {i < arr.length - 1 && <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />}
                          </div>
                        ))
                    ) : (
                      <p style={{ color: "rgba(18,26,46,0.5)", fontSize: 14, padding: "8px 0" }}>Aucun brief disponible.</p>
                    )}
                  </div>
                )}

                {tab === "fichiers" && (
                  <div style={{ padding: "4px 0" }}>
                    {files.length === 0 ? (
                      <p style={{ color: "rgba(18,26,46,0.5)", fontSize: 14, padding: "8px 0" }}>Aucun fichier partagé.</p>
                    ) : (
                      files.map((f) => (
                        <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 8px", borderRadius: 9, textDecoration: "none",
                            border: "1px solid rgba(0,0,0,0.06)", marginBottom: 6,
                          }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#121a2e" }}>{f.name}</span>
                          <ExternalLink size={14} style={{ color: "rgba(18,26,46,0.4)" }} />
                        </a>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column: Conversation */}
          <div style={{
            width: 340,
            flexShrink: 0,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.13)",
            borderRadius: 13,
            overflow: "hidden",
            display: "flex", flexDirection: "column",
            boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
          }}>
            <div style={{ padding: "15px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <span style={{ ...jakartaSans, fontSize: 17, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>
                Conversation
              </span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", background: "#fbfbfb", padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
                  <MessageSquare size={36} style={{ color: "rgba(18,26,46,0.15)", marginBottom: 10 }} />
                  <p style={{ fontSize: 13, color: "rgba(18,26,46,0.3)", letterSpacing: "-0.45px" }}>Aucun message</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isClient = msg.sender_role === "client";
                  return (
                    <div key={msg.id} style={{ display: "flex", justifyContent: isClient ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "82%",
                        padding: "10px 13px",
                        background: isClient ? "linear-gradient(121deg, rgb(78,126,250), rgb(1,71,255))" : "#fff",
                        border: isClient ? "none" : "1px solid rgba(0,0,0,0.08)",
                        borderRadius: 10,
                        fontSize: 13, lineHeight: "1.5",
                        color: isClient ? "#fff" : "#121a2e",
                        boxShadow: "0px 2px 5px rgba(0,0,0,0.03)",
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: "8px 10px 10px", background: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                flex: 1,
                background: "#fff",
                border: "1px solid rgba(158,158,158,0.17)",
                borderRadius: 9,
                padding: "10px 13px",
                boxShadow: "0px 4px 4px rgba(0,0,0,0.02)",
              }}>
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Entrez un message ici"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
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
                  width: 36, height: 36,
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
                  ? <Loader2 size={13} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
                  : <Send size={13} style={{ color: "#fff" }} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hero Banner (carrousel) ────────────────────────────────────────────────────
// Affiche les fichiers média un par un, change toutes les 5 secondes.
// Si aucun fichier → retourne null (bannière invisible).

interface TickerFile { url: string; type: string; name: string }

function HeroBanner({ mediaFiles }: { mediaFiles: TickerFile[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (mediaFiles.length <= 1) return;
    const timer = setInterval(() => {
      setIndex(prev => (prev + 1) % mediaFiles.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [mediaFiles.length]);

  if (mediaFiles.length === 0) return null;

  const current = mediaFiles[index];

  return (
    <div style={{
      position: "relative",
      height: 240,
      overflow: "hidden",
      flexShrink: 0,
      background: "#000",
      borderBottom: "1px solid rgba(0,0,0,0.10)",
    }}>
      {current.type.startsWith("image") ? (
        <img
          key={index}
          src={current.url}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <video
          key={index}
          src={current.url}
          autoPlay
          muted
          loop
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      )}

      {/* Points de navigation */}
      {mediaFiles.length > 1 && (
        <div style={{
          position: "absolute",
          bottom: 12,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 6,
          zIndex: 10,
        }}>
          {mediaFiles.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              style={{
                width: i === index ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === index ? "#fff" : "rgba(255,255,255,0.5)",
                border: "none",
                padding: 0,
                cursor: "pointer",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
