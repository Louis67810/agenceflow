"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Send, FolderOpen, ExternalLink } from "lucide-react";
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
      <div style={{ marginLeft: 256, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
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
    { label: "Projet Google Docs", url: googleDocsUrl },
    { label: "Projet Figma",       url: figmaUrl      },
    { label: "Projet Framer",      url: framerUrl     },
  ];

  // Médias pour le ticker : fichiers images/vidéos uploadés par l'utilisateur
  const mediaFiles = files.filter((f) => f.type.startsWith("image") || f.type.startsWith("video"));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />

      <div style={{ marginLeft: 256, flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ── Hero : ticker vertical de médias ─────────────────────────── */}
        <HeroTicker mediaFiles={mediaFiles} />

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
                      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.45px", color: link.url ? "#121a2e" : "rgba(18,26,46,0.35)" }}>
                        {link.label}
                      </span>
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
                  <div style={{ opacity: 0.2, marginBottom: 10 }}>
                    <svg width="44" height="44" viewBox="0 0 56 56" fill="none"><rect width="56" height="56" rx="12" fill="#e0e0e0"/><path d="M14 18h28v16a2 2 0 01-2 2H16a2 2 0 01-2-2V18z" stroke="#121a2e" strokeWidth="1.5" fill="none"/><circle cx="22" cy="26" r="2" fill="#121a2e"/><circle cx="28" cy="26" r="2" fill="#121a2e"/><circle cx="34" cy="26" r="2" fill="#121a2e"/></svg>
                  </div>
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

// ── Hero Ticker ───────────────────────────────────────────────────────────────
// Colonnes de cartes inclinées qui défilent verticalement.
// Chaque carte individuelle est tournée (pas la colonne) → pas de dérive horizontale.

interface TickerFile { url: string; type: string; name: string }

function HeroTicker({ mediaFiles }: { mediaFiles: TickerFile[] }) {
  const NUM_COLS   = 10;
  const CARD_H     = 140;
  const CARD_GAP   = 14;
  const ITEMS_PER  = 4;              // cartes visibles par colonne avant duplication
  const TOTAL_H    = (CARD_H + CARD_GAP) * ITEMS_PER;

  return (
    <div style={{
      position: "relative",
      background: "#eeeeee",
      borderBottom: "1px solid rgba(0,0,0,0.14)",
      height: 200,
      overflow: "hidden",
      flexShrink: 0,
    }}>
      <style>{`
        @keyframes tickUp {
          from { transform: translateY(0); }
          to   { transform: translateY(-${TOTAL_H}px); }
        }
      `}</style>

      {Array.from({ length: NUM_COLS }).map((_, col) => {
        const leftPct  = (col / NUM_COLS) * 100;
        const widthPct = 100 / NUM_COLS;
        const speed    = 5 + col * 0.8;
        const delay    = -(col * 0.6);
        const offsetY  = col % 2 === 0 ? -30 : -60;

        // Contenu : médias réels si dispo, sinon placeholder vide
        const cards = Array.from({ length: ITEMS_PER * 2 }).map((_, i) => {
          const f = mediaFiles.length > 0 ? mediaFiles[i % mediaFiles.length] : null;
          return { key: i, file: f };
        });

        return (
          <div key={col} style={{
            position: "absolute",
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            top: offsetY,
            animation: `tickUp ${speed}s ${delay}s linear infinite`,
            // PAS de rotation ici → translateY reste vertical pur
          }}>
            {cards.map(({ key, file }) => (
              <div key={key} style={{
                margin: `0 6px ${CARD_GAP}px 6px`,
                height: CARD_H,
                borderRadius: 12,
                overflow: "hidden",
                // Rotation sur la CARTE individuelle, pas sur la colonne
                transform: "rotate(12deg)",
                transformOrigin: "center center",
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.12)",
                boxShadow: "0px 4px 12px rgba(0,0,0,0.06)",
                flexShrink: 0,
              }}>
                {file ? (
                  file.type.startsWith("image") ? (
                    <img src={file.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <video src={file.url} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )
                ) : (
                  // Placeholder vide sans texte
                  <div style={{ width: "100%", height: "100%", background: "#f0f0f0" }} />
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* Gradient fade bas */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 80,
        background: "linear-gradient(to bottom, transparent, #fbfbfb)",
        zIndex: 10,
        pointerEvents: "none",
      }} />
    </div>
  );
}
