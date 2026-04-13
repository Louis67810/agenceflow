"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, FolderOpen, CheckCircle2, Clock, AlertCircle } from "lucide-react";
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
  start_date: string | null;
  created_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

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

function stageStartDate(stages: Stage[], idx: number, startDate: string): string {
  const d = new Date(startDate);
  for (let i = 0; i < idx; i++) d.setDate(d.getDate() + (stages[i]?.duration_days ?? 0));
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ClientAgendaPage() {
  const [project, setProject]       = useState<Project | null>(null);
  const [loading, setLoading]       = useState(true);
  const [clientName, setClientName] = useState("Moi");
  const [advancing, setAdvancing]   = useState(false);

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
      setLoading(false);
    }
    init();
  }, []);

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

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />
      <div style={{ marginLeft: 256, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} style={{ color: "#121a2e", animation: "spin 1s linear infinite" }} />
      </div>
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

  const completedStages = stages.filter((s) => s.completed);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />

      {/* Main content */}
      <div style={{ marginLeft: 256, flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "68px 70px 0",
        }}>
          <h1 style={{
            ...jakartaSans,
            fontSize: 32, fontWeight: 600,
            letterSpacing: "-0.45px", lineHeight: "28px",
            color: "#121a2e", margin: 0,
          }}>
            Mon agenda
          </h1>

          {currentStage && !currentStage.completed && (
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
        <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "24px 70px 0" }} />

        {/* Content */}
        <div style={{ padding: "24px 70px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Gantt card */}
          {stages.length > 0 && (
            <div style={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.18)",
              borderRadius: 13,
              overflow: "hidden",
              boxShadow: "0px 54px 15px rgba(0,0,0,0), 0px 35px 14px rgba(0,0,0,0), 0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
            }}>
              {/* Card header */}
              <div style={{
                padding: "16px 20px",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{
                  ...jakartaSans,
                  fontSize: 14, fontWeight: 600,
                  letterSpacing: "-0.45px", color: "#121a2e",
                }}>
                  Calendrier du projet
                </span>
                {currentStage && (
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    padding: "6px 10px",
                    background: "#fee6d0",
                    borderRadius: 6,
                    color: "#663b12",
                    letterSpacing: "-0.45px",
                  }}>
                    Étape actuelle : {currentStage.label}
                  </span>
                )}
              </div>

              {/* Gantt chart */}
              <div style={{
                position: "relative",
                background: "#eeeeee",
                height: 198,
                overflow: "hidden",
              }}>
                {/* Now-line */}
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

                {/* Stage pills */}
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
                            ? `${stage.duration_days} j · fin ${stageDeadline(stages, idx, startDate)}`
                            : `${stage.duration_days} jours`}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Stages list card */}
          <div style={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.18)",
            borderRadius: 13,
            overflow: "hidden",
            boxShadow: "0px 54px 15px rgba(0,0,0,0), 0px 35px 14px rgba(0,0,0,0), 0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
          }}>
            {/* Card header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(0,0,0,0.05)",
              background: "#fbfbfb",
            }}>
              <span style={{
                ...jakartaSans,
                fontSize: 14, fontWeight: 600,
                letterSpacing: "-0.45px", color: "#121a2e",
              }}>
                Toutes les étapes
              </span>
            </div>

            {stages.length === 0 ? (
              <div style={{ padding: "24px 20px" }}>
                <p style={{ fontSize: 14, color: "rgba(18,26,46,0.4)" }}>Aucune étape définie pour ce projet.</p>
              </div>
            ) : (
              stages.map((stage, idx) => {
                const isCompleted = stage.completed;
                const isCurrent   = idx === currentIdx && !isCompleted;
                const isPending   = !isCompleted && !isCurrent;

                return (
                  <div key={stage.id ?? idx}>
                    <div style={{
                      padding: "16px 20px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      {/* Left: icon + info */}
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isCompleted ? "#d1fae5" : isCurrent ? "#fee6d0" : "#d5eeff",
                        }}>
                          {isCompleted
                            ? <CheckCircle2 size={18} style={{ color: "#168b64" }} />
                            : isCurrent
                              ? <Clock size={18} style={{ color: "#663b12" }} />
                              : <AlertCircle size={18} style={{ color: "#073e63" }} />}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 600,
                            letterSpacing: "-0.45px", color: "#121a2e",
                          }}>
                            {stage.label}
                          </span>
                          <span style={{
                            fontSize: 12, color: "rgba(18,26,46,0.5)",
                            letterSpacing: "-0.45px",
                          }}>
                            {isCompleted && stage.completed_at
                              ? `Validée le ${new Date(stage.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
                              : isCurrent
                                ? `En cours · ${stage.duration_days} jours · fin ${stageDeadline(stages, idx, startDate)}`
                                : `À venir · début ${stageStartDate(stages, idx, startDate)}`}
                          </span>
                        </div>
                      </div>

                      {/* Right: status badge */}
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        padding: "7px 11px",
                        borderRadius: 8,
                        letterSpacing: "-0.45px",
                        background: isCompleted ? "#d1fae5" : isCurrent ? "#fee6d0" : "#f3f4f6",
                        color: isCompleted ? "#168b64" : isCurrent ? "#663b12" : "rgba(18,26,46,0.45)",
                        border: `1px solid ${isCompleted ? "rgba(22,139,100,0.2)" : isCurrent ? "rgba(102,59,18,0.17)" : "rgba(0,0,0,0.06)"}`,
                      }}>
                        {isCompleted ? "Validée" : isCurrent ? "En cours" : "À venir"}
                      </span>
                    </div>
                    {idx < stages.length - 1 && (
                      <div style={{ height: 1, background: "rgba(0,0,0,0.04)", margin: "0 20px" }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Historique des validations */}
          <div style={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.18)",
            borderRadius: 13,
            overflow: "hidden",
            boxShadow: "0px 54px 15px rgba(0,0,0,0), 0px 35px 14px rgba(0,0,0,0), 0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
            marginBottom: 8,
          }}>
            {/* Card header */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid rgba(0,0,0,0.05)",
              background: "#fbfbfb",
            }}>
              <span style={{
                ...jakartaSans,
                fontSize: 14, fontWeight: 600,
                letterSpacing: "-0.45px", color: "#121a2e",
              }}>
                Historique des validations
              </span>
            </div>

            {completedStages.length === 0 ? (
              <div style={{ padding: "24px 20px" }}>
                <p style={{ fontSize: 14, color: "rgba(18,26,46,0.4)" }}>Aucune étape validée pour l&apos;instant.</p>
              </div>
            ) : (
              completedStages.map((stage, i) => (
                <div key={stage.id ?? i}>
                  <div style={{
                    padding: "16px 20px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 600,
                        letterSpacing: "-0.45px", color: "#121a2e",
                      }}>
                        {stage.label}
                      </span>
                      {stage.completed_at && (
                        <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", letterSpacing: "-0.45px" }}>
                          Validée le {new Date(stage.completed_at).toLocaleDateString("fr-FR", {
                            day: "numeric", month: "long", year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                    <button
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "10px 14px",
                        background: "#fff",
                        border: "1px solid rgba(0,0,0,0.1)",
                        borderRadius: 10,
                        fontSize: 12, fontWeight: 500,
                        letterSpacing: "-0.45px",
                        color: "rgba(18,26,46,0.6)",
                        cursor: "pointer",
                        boxShadow: "0px 2px 4px rgba(0,0,0,0.04)",
                      }}
                      onClick={() => {
                        // Envoyer message demande de changement
                        const msg = `Demande de modification sur l'étape "${stage.label}"`;
                        window.location.href = `/client/messages?prefill=${encodeURIComponent(msg)}`;
                      }}
                    >
                      Demande de changements
                    </button>
                  </div>
                  {i < completedStages.length - 1 && (
                    <div style={{ height: 1, background: "rgba(0,0,0,0.04)", margin: "0 20px" }} />
                  )}
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
