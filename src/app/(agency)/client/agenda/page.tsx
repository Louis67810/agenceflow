"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, FolderOpen, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { AgencySidebar } from "@/components/agency/AgencySidebar";

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
  stages: Stage[];
  current_stage_index: number;
  start_date: string | null;
  created_at: string;
}

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

// 3 couleurs cycliques + vert quand validée — identique à client/page.tsx
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

function stageStartDate(stages: Stage[], idx: number, startDate: string): string {
  const d = new Date(startDate);
  for (let i = 0; i < idx; i++) d.setDate(d.getDate() + (stages[i]?.duration_days ?? 0));
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

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

  if (loading) return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} style={{ color: "#121a2e", animation: "spin 1s linear infinite" }} />
      </div>
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
  const completedStages = stages.filter((s) => s.completed);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "68px 24px 0",
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
                  padding: "16px 22px",
                  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                  color: "#fff",
                  border: "1px solid #2f4d9d",
                  borderRadius: 10,
                  fontSize: 14, fontWeight: 500,
                  cursor: advancing ? "not-allowed" : "pointer",
                  opacity: advancing ? 0.7 : 1,
                  boxShadow: [
                    "inset 0px -3px 0px 0px #0e42c8",
                    "inset 0px 2px 6px 4px rgba(0,0,0,0.08)",
                    "inset 0px 3px 0px 0px rgba(255,255,255,0.5)",
                    "0px 4px 12px rgba(1,71,255,0.2)",
                  ].join(", "),
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
        <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "24px 24px 0" }} />

        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Gantt card */}
          {stages.length > 0 && (
            <div style={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.18)",
              borderRadius: 13,
              overflow: "hidden",
              boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
            }}>
              <div style={{
                padding: "14px 20px",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ ...jakartaSans, fontSize: 14, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>
                  Calendrier du projet
                </span>
                {currentStage && (
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    padding: "5px 10px",
                    background: stageColors(currentStage, currentIdx).bg,
                    borderRadius: 6,
                    color: stageColors(currentStage, currentIdx).text,
                    letterSpacing: "-0.3px",
                    border: stageColors(currentStage, currentIdx).border,
                  }}>
                    En cours : {currentStage.label}
                  </span>
                )}
              </div>

              {/* Gantt chart — fond grille diagonale */}
              <div style={{
                position: "relative",
                height: 198,
                overflow: "hidden",
                background: "#f7f7f9",
                backgroundImage: [
                  "repeating-linear-gradient(135deg, rgba(140,150,200,0.07) 0px, rgba(140,150,200,0.07) 1px, transparent 1px, transparent 34px)",
                  "repeating-linear-gradient(45deg, rgba(140,150,200,0.07) 0px, rgba(140,150,200,0.07) 1px, transparent 1px, transparent 34px)",
                ].join(", "),
              }}>
                <div style={{ position: "absolute", left: 16, right: 16, top: 0, bottom: 0, zIndex: 1 }}>
                  {/* Barre de progression (flèche + ligne verticale) */}
                  {(() => {
                    const nowPct = stages.slice(0, currentIdx).reduce((s, st) => s + (st.duration_days || 1), 0) / totalDays * 100;
                    return (
                      <div style={{
                        position: "absolute",
                        left: `calc(${nowPct}% - 10px)`,
                        top: 0,
                        width: 20,
                        height: 198,
                        zIndex: 3,
                        pointerEvents: "none",
                      }}>
                        <svg width="20" height="198" viewBox="0 0 20 198" fill="none">
                          <defs>
                            <filter id="gp_filter" x="0" y="0" width="20" height="27.5" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                              <feOffset/><feGaussianBlur stdDeviation="0.5"/>
                              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.13 0"/>
                              <feBlend mode="normal" in2="BackgroundImageFix" result="e1"/>
                              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                              <feOffset dy="1"/><feGaussianBlur stdDeviation="0.5"/>
                              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.12 0"/>
                              <feBlend mode="normal" in2="e1" result="e2"/>
                              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                              <feOffset dy="3"/><feGaussianBlur stdDeviation="1"/>
                              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.07 0"/>
                              <feBlend mode="normal" in2="e2" result="e3"/>
                              <feBlend mode="normal" in="SourceGraphic" in2="e3" result="shape"/>
                            </filter>
                          </defs>
                          <line x1="10" y1="17" x2="10" y2="198" stroke="#82858C" strokeWidth="2"/>
                          <g filter="url(#gp_filter)">
                            <path d="M4 6C4 4.34315 5.34315 3 7 3H13C14.6569 3 16 4.34315 16 6V10.9C16 11.2961 15.9216 11.6882 15.7692 12.0538L14.2692 15.6538C13.8034 16.7718 12.7111 17.5 11.5 17.5H8.5C7.2889 17.5 6.19658 16.7718 5.73077 15.6538L4.23077 12.0538C4.07843 11.6882 4 11.2961 4 10.9V6Z" fill="#121A2E"/>
                            <path d="M13 2C15.2091 2 17 3.79086 17 6V10.9004C16.9999 11.4284 16.8954 11.9511 16.6924 12.4385L15.1924 16.0381C14.5713 17.5287 13.1148 18.5 11.5 18.5H8.5C6.8852 18.5 5.4287 17.5287 4.80762 16.0381L3.30762 12.4385C3.10455 11.9511 3.00005 11.4284 3 10.9004V6C3 3.79086 4.79086 2 7 2H13Z" stroke="white" strokeWidth="2"/>
                          </g>
                        </svg>
                      </div>
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
                        top: isTop ? 24 : 104,
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
                          {stage.duration_days}j
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Stages list */}
          <div style={{
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.18)",
            borderRadius: 13,
            overflow: "hidden",
            boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
          }}>
            <div style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(0,0,0,0.05)",
              background: "#fbfbfb",
            }}>
              <span style={{ ...jakartaSans, fontSize: 14, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>
                Toutes les étapes
              </span>
            </div>

            {stages.length === 0 ? (
              <div style={{ padding: "20px" }}>
                <p style={{ fontSize: 14, color: "rgba(18,26,46,0.4)" }}>Aucune étape définie.</p>
              </div>
            ) : (
              stages.map((stage, idx) => {
                const isCompleted = stage.completed;
                const isCurrent   = idx === currentIdx && !isCompleted;
                const c = stageColors(stage, idx);
                return (
                  <div key={stage.id ?? idx}>
                    <div style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: c.bg,
                        }}>
                          {isCompleted
                            ? <CheckCircle2 size={17} style={{ color: c.text }} />
                            : isCurrent
                              ? <Clock size={17} style={{ color: c.text }} />
                              : <AlertCircle size={17} style={{ color: c.text }} />}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>
                            {stage.label}
                          </span>
                          <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", letterSpacing: "-0.3px" }}>
                            {isCompleted && stage.completed_at
                              ? `Validée le ${new Date(stage.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
                              : isCurrent
                                ? `En cours · ${stage.duration_days}j · fin ${stageDeadline(stages, idx, startDate)}`
                                : `À venir · début ${stageStartDate(stages, idx, startDate)}`}
                          </span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        padding: "6px 10px",
                        borderRadius: 8,
                        letterSpacing: "-0.3px",
                        background: c.bg,
                        color: c.text,
                        border: c.border,
                        whiteSpace: "nowrap" as const,
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
            boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
            marginBottom: 8,
          }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.05)", background: "#fbfbfb" }}>
              <span style={{ ...jakartaSans, fontSize: 14, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>
                Historique des validations
              </span>
            </div>

            {completedStages.length === 0 ? (
              <div style={{ padding: "20px" }}>
                <p style={{ fontSize: 14, color: "rgba(18,26,46,0.4)" }}>Aucune étape validée pour l&apos;instant.</p>
              </div>
            ) : (
              completedStages.map((stage, i) => (
                <div key={stage.id ?? i}>
                  <div style={{ padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "#d1fae5",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <CheckCircle2 size={16} style={{ color: "#168b64" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>
                          {stage.label}
                        </span>
                        {stage.completed_at && (
                          <span style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", letterSpacing: "-0.3px" }}>
                            Validée le {new Date(stage.completed_at).toLocaleDateString("fr-FR", {
                              day: "numeric", month: "long", year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 500,
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: "#d1fae5",
                      color: "#168b64",
                      border: "1px solid rgba(22,139,100,0.2)",
                    }}>
                      Validée
                    </span>
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
