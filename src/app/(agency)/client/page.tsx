"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Send, FolderOpen, ExternalLink } from "lucide-react";
import { AgencySidebar } from "@/components/agency/AgencySidebar";

// ── Types ───────────────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

// Couleurs des étapes (fidèles au Figma)
function stageColors(stage: Stage, idx: number, currentIdx: number) {
  if (stage.completed) return {
    bg: "#d1fae5", border: "1px solid rgba(102,59,18,0.17)",
    text: "#168b64", sub: "rgba(22,139,100,0.7)",
  };
  if (idx === currentIdx) return {
    bg: "#fee6d0", border: "1px solid rgba(102,59,18,0.17)",
    text: "#663b12", sub: "rgba(102,59,18,0.7)",
  };
  return {
    bg: "#d5eeff", border: "1px solid rgba(102,59,18,0.17)",
    text: "#073e63", sub: "rgba(7,62,99,0.7)",
  };
}

function stageDeadline(stages: Stage[], upToIdx: number, startDate: string): string {
  const d = new Date(startDate);
  for (let i = 0; i <= upToIdx; i++) d.setDate(d.getDate() + (stages[i]?.duration_days ?? 0));
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// ── Component ────────────────────────────────────────────────────────────────

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
  const [convTab, setConvTab]       = useState<"app" | "docs" | "figma" | "framer">("app");
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

  // ── Loading / empty states ───────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#fbfbfb" }}>
      <Loader2 style={{ color: "#121a2e", animation: "spin 1s linear infinite" }} size={28} />
    </div>
  );

  if (!project) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#fbfbfb", flexDirection: "column", gap: 12 }}>
      <FolderOpen size={40} style={{ color: "rgba(18,26,46,0.2)" }} />
      <p style={{ fontSize: 16, color: "rgba(18,26,46,0.5)" }}>Aucun projet en cours</p>
    </div>
  );

  const stages      = project.stages ?? [];
  const currentIdx  = project.current_stage_index ?? 0;
  const currentStage = stages[currentIdx];
  const startDate   = project.start_date ?? project.created_at.split("T")[0];
  const totalDays   = stages.reduce((s, st) => s + (st.duration_days || 1), 0);

  // Liens outils depuis form_data
  const googleDocsUrl = (project.form_data?.google_docs_url ?? project.form_data?.docs_url ?? "") as string;
  const figmaUrl      = (project.form_data?.figma_url ?? "") as string;
  const framerUrl     = (project.form_data?.framer_url ?? "") as string;

  const toolLinks = [
    { label: "Projet Google Docs", url: googleDocsUrl, icon: "https://www.figma.com/api/mcp/asset/5e6372b4-16fb-4b2a-ac9c-f7812ea0f33b" },
    { label: "Projet Figma",       url: figmaUrl,      icon: "https://www.figma.com/api/mcp/asset/b4e5daec-6971-417b-af37-6027f6a670ac" },
    { label: "Projet Framer",      url: framerUrl,     icon: "https://www.figma.com/api/mcp/asset/79058a24-e856-492e-8390-f8c869d50e7c" },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />

      {/* Main content */}
      <div style={{ marginLeft: 256, flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ── Hero section (rotating cards) ─────────────────────────────── */}
        <div style={{
          position: "relative",
          background: "#eeeeee",
          borderBottom: "1px solid rgba(0,0,0,0.14)",
          height: 200,
          overflow: "hidden",
          flexShrink: 0,
        }}>
          {Array.from({ length: 12 }).map((_, i) => {
            const row = i % 2;
            const col = Math.floor(i / 2);
            return (
              <div key={i} style={{
                position: "absolute",
                left: col * 200 - 60,
                top: row === 0 ? -60 : 80,
                width: 260,
                height: 180,
                border: "1px solid rgba(0,0,0,0.18)",
                borderRadius: 13,
                background: "#fff",
                transform: "rotate(15.12deg)",
                boxShadow: "0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
              }} />
            );
          })}
          {/* Gradient fade at bottom */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 76,
            background: "linear-gradient(to bottom, transparent, #fbfbfb)",
          }} />
        </div>

        {/* ── Header: title + validate button ──────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "24px 70px 16px",
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
                  padding: "18px 24px",
                  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                  color: "#fff",
                  border: "1px solid #2f4d9d",
                  borderRadius: 10,
                  fontSize: 16, fontWeight: 500, lineHeight: "1.029",
                  cursor: advancing ? "not-allowed" : "pointer",
                  opacity: advancing ? 0.7 : 1,
                  boxShadow: "inset 0px -3px 0px 0px #0e42c8, inset 0px 2px 6px 4px rgba(0,0,0,0.08), inset 0px 3px 0px 0px rgba(255,255,255,0.5)",
                  whiteSpace: "nowrap",
                }}>
                {advancing
                  ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Validation...</>
                  : `Valider l'étape : ${currentStage.label}`}
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "0 70px" }} />

        {/* ── Main content area ────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 20, padding: "24px 70px 32px", flex: 1 }}>

          {/* Left column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Stage Gantt */}
            {stages.length > 0 && (
              <div style={{
                position: "relative",
                background: "#eeeeee",
                borderRadius: 13,
                height: 198,
                overflow: "hidden",
                flexShrink: 0,
              }}>
                {/* Vertical now-line */}
                {(() => {
                  const nowRatio = stages.slice(0, currentIdx).reduce((s, st) => s + (st.duration_days || 1), 0) / totalDays;
                  return (
                    <div style={{
                      position: "absolute",
                      left: `calc(21px + ${nowRatio * 80}%)`,
                      top: 10, bottom: 10, width: 2,
                      background: "rgba(0,0,0,0.25)",
                      zIndex: 2,
                    }} />
                  );
                })()}
                {/* Stage pills — alternating rows */}
                {(() => {
                  let leftAccum = 21;
                  return stages.map((stage, idx) => {
                    const c = stageColors(stage, idx, currentIdx);
                    const widthRatio = (stage.duration_days || 1) / totalDays;
                    const W = Math.floor(widthRatio * 860);
                    const isTop = idx % 2 === 0;
                    const left = leftAccum + (isTop ? 0 : Math.floor(W * 0.15));
                    leftAccum += Math.floor(widthRatio * 500);
                    return (
                      <div key={stage.id ?? idx} style={{
                        position: "absolute",
                        top: isTop ? 31 : 109,
                        left,
                        width: Math.max(W, 120),
                        height: 74,
                        background: c.bg,
                        border: c.border,
                        borderRadius: 10,
                        padding: "15px 13px",
                        boxShadow: "0px 8px 5px rgba(0,0,0,0.01), 0px 4px 4px rgba(0,0,0,0.02), 0px 1px 2px rgba(0,0,0,0.03)",
                        display: "flex", flexDirection: "column", gap: 8,
                      }}>
                        <span style={{
                          fontSize: 14, fontWeight: 600,
                          letterSpacing: "-0.45px", lineHeight: "16px",
                          color: c.text,
                        }}>
                          {stage.label}
                        </span>
                        <span style={{
                          fontSize: 13, fontWeight: 500,
                          letterSpacing: "-0.45px", lineHeight: "13px",
                          color: c.sub,
                        }}>
                          {idx === currentIdx && !stage.completed
                            ? `${stage.duration_days} j : fin ${stageDeadline(stages, idx, startDate)}`
                            : `${stage.duration_days} jours`}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {/* Tool links card (Liens/Brief/Fichiers) */}
            <div style={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.18)",
              borderRadius: 13,
              overflow: "hidden",
              boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
            }}>
              {/* Tab bar */}
              <div style={{
                background: "#fbfbfb",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                padding: "12px 13px",
                display: "flex", gap: 4,
              }}>
                {(["liens", "brief", "fichiers"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{
                      padding: "11px 13px",
                      background: tab === t ? "#fff" : "transparent",
                      border: tab === t ? "1px solid rgba(158,158,158,0.17)" : "1px solid transparent",
                      borderRadius: 10,
                      fontSize: 12, fontWeight: 600,
                      letterSpacing: "-0.45px", lineHeight: "16px",
                      color: tab === t ? "#121a2e" : "rgba(18,26,46,0.45)",
                      cursor: "pointer",
                      boxShadow: tab === t ? "0px 8px 5px rgba(0,0,0,0.01), 0px 4px 4px rgba(0,0,0,0.02), 0px 1px 2px rgba(0,0,0,0.03)" : "none",
                    }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div style={{ padding: "18px" }}>
                {tab === "liens" && (
                  <>
                    {toolLinks.map((link, i) => (
                      <div key={link.label}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: "#fff",
                          borderRadius: 10,
                          padding: 14,
                          opacity: (!link.url && i === 2) ? 0.39 : 1,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{
                              width: 38, height: 39,
                              background: "#f7f7f7",
                              borderRadius: 4,
                              overflow: "hidden",
                              flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <img src={link.icon} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />
                            </div>
                            <span style={{
                              fontSize: 14, fontWeight: 600,
                              letterSpacing: "-0.45px", lineHeight: "16px",
                              color: "#121a2e",
                            }}>
                              {link.label}
                            </span>
                          </div>
                          {link.url ? (
                            <a href={link.url} target="_blank" rel="noopener noreferrer"
                              style={{
                                display: "flex", alignItems: "center",
                                padding: "12px 14px",
                                background: "#fff",
                                border: "1px solid rgba(0,0,0,0.06)",
                                borderRadius: 10,
                                fontSize: 12, fontWeight: 500, lineHeight: "1.029",
                                color: "#121a2e", textDecoration: "none",
                              }}>
                              Ouvrir
                            </a>
                          ) : (
                            <span style={{
                              padding: "12px 14px",
                              border: "1px solid rgba(0,0,0,0.06)",
                              borderRadius: 10,
                              fontSize: 12, color: "rgba(18,26,46,0.3)",
                            }}>
                              Ouvrir
                            </span>
                          )}
                        </div>
                        {i < toolLinks.length - 1 && (
                          <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "0 4px" }} />
                        )}
                      </div>
                    ))}
                  </>
                )}

                {tab === "brief" && (
                  <div style={{ padding: "16px 0", color: "rgba(18,26,46,0.5)", fontSize: 14 }}>
                    {project.form_data && Object.keys(project.form_data).length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {Object.entries(project.form_data)
                          .filter(([k]) => !k.startsWith("_") && !["google_docs_url","figma_url","framer_url","docs_url"].includes(k))
                          .map(([k, v]) => (
                            <div key={k}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</span>
                              <p style={{ margin: "4px 0 0", fontSize: 14, color: "#121a2e" }}>{String(v)}</p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p>Aucun brief disponible pour l&apos;instant.</p>
                    )}
                  </div>
                )}

                {tab === "fichiers" && (
                  <div style={{ padding: "8px 0" }}>
                    {files.length === 0 ? (
                      <p style={{ color: "rgba(18,26,46,0.5)", fontSize: 14, padding: "8px 0" }}>Aucun fichier partagé pour l&apos;instant.</p>
                    ) : (
                      files.map((f) => (
                        <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "12px 14px", borderRadius: 10, textDecoration: "none",
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

          {/* Right column: Conversation panel */}
          <div style={{
            width: 380,
            flexShrink: 0,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.18)",
            borderRadius: 13,
            overflow: "hidden",
            display: "flex", flexDirection: "column",
            boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
          }}>
            {/* Header */}
            <div style={{
              padding: "18px 24px 14px",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}>
              <span style={{
                ...jakartaSans,
                fontSize: 20, fontWeight: 600,
                letterSpacing: "-0.45px", lineHeight: "16px",
                color: "#121a2e",
              }}>
                Conversation
              </span>
            </div>

            {/* Conv tabs */}
            <div style={{
              background: "#fbfbfb",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              padding: "11px 18px",
              display: "flex", gap: 6,
            }}>
              {(["app", "docs", "figma", "framer"] as const).map((t) => (
                <button key={t} onClick={() => setConvTab(t)}
                  style={{
                    padding: "11px 13px",
                    background: convTab === t ? "#fff" : "transparent",
                    border: convTab === t ? "1px solid rgba(158,158,158,0.17)" : "1px solid transparent",
                    borderRadius: 10,
                    fontSize: 12, fontWeight: 600,
                    letterSpacing: "-0.45px",
                    color: convTab === t ? "#121a2e" : "rgba(18,26,46,0.45)",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    boxShadow: convTab === t ? "0px 8px 5px rgba(0,0,0,0.01), 0px 4px 4px rgba(0,0,0,0.02), 0px 1px 2px rgba(0,0,0,0.03)" : "none",
                  }}>
                  {t === "app" ? "App" : t === "docs" ? "Google Docs" : t.charAt(0).toUpperCase() + t.slice(1)}
                  {t !== "app" && (
                    <ExternalLink size={12} style={{ opacity: 0.5 }} />
                  )}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", background: "#fbfbfb", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {convTab === "app" ? (
                messages.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0" }}>
                    <div style={{ width: 56, height: 56, marginBottom: 12, opacity: 0.3 }}>
                      <svg viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="56" height="56" rx="12" fill="#f0f0f0"/>
                        <path d="M16 20h24v14a2 2 0 01-2 2H18a2 2 0 01-2-2V20z" stroke="#121a2e" strokeWidth="1.5" fill="none"/>
                        <circle cx="22" cy="27" r="2" fill="#121a2e"/>
                        <circle cx="28" cy="27" r="2" fill="#121a2e"/>
                        <circle cx="34" cy="27" r="2" fill="#121a2e"/>
                      </svg>
                    </div>
                    <p style={{ fontSize: 14, color: "rgba(18,26,46,0.3)", letterSpacing: "-0.45px" }}>
                      Aucun message pour l&apos;instant
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isClient = msg.sender_role === "client";
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: isClient ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "80%",
                          padding: "10px 14px",
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
                )
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: 14, color: "rgba(18,26,46,0.3)", textAlign: "center" }}>
                    Ouvrez {convTab === "docs" ? "Google Docs" : convTab.charAt(0).toUpperCase() + convTab.slice(1)}<br />pour accéder aux commentaires
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: "8px 12px 12px",
              borderTop: "1px solid rgba(0,0,0,0.06)",
              background: "#fff",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                flex: 1,
                background: "#fff",
                border: "1px solid rgba(158,158,158,0.17)",
                borderRadius: 10,
                padding: "11px 13px",
                boxShadow: "0px 8px 5px rgba(0,0,0,0.01), 0px 4px 4px rgba(0,0,0,0.02), 0px 1px 2px rgba(0,0,0,0.03)",
              }}>
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Entrez un message ici"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                  style={{
                    width: "100%", border: "none", outline: "none",
                    fontSize: 12, fontWeight: 600, letterSpacing: "-0.45px",
                    color: "rgba(18,26,46,0.6)", background: "transparent",
                  }}
                />
              </div>
              <button
                onClick={handleSend}
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
                }}>
                {sending ? <Loader2 size={14} style={{ color: "#fff", animation: "spin 1s linear infinite" }} /> : <Send size={14} style={{ color: "#fff" }} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
