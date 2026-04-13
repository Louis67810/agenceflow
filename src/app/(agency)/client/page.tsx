"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Send, FolderOpen, ExternalLink, MessageSquare, Bell, CheckCircle2, ClipboardCheck, Mail, Phone, Hash, ChevronRight, HelpCircle } from "lucide-react";
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
  banner_url: string | null;
  notif_email_enabled: boolean;
  notif_whatsapp_phone: string | null;
  notif_whatsapp_group: string | null;
  notif_whatsapp_enabled: boolean;
  notif_slack_webhook: string | null;
  notif_slack_enabled: boolean;
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

interface StageReview {
  id: string;
  project_id: string;
  stage_index: number;
  stage_label: string;
  message: string | null;
  link_url: string | null;
  thumbnail_url: string | null;
  status: "pending" | "validated";
  created_at: string;
  validated_at: string | null;
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
  const [files, setFiles]           = useState<ProjectFile[]>([]);
  const [clientName, setClientName] = useState("Moi");
  const [userId, setUserId]         = useState<string | null>(null);
  const [advancing, setAdvancing]   = useState(false);
  const [tab, setTab]               = useState<"liens" | "review" | "brief" | "fichiers">("liens");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPressed, setConfirmPressed] = useState(false);
  // Reviews (tâches à review)
  const [reviews, setReviews]       = useState<StageReview[]>([]);
  const [validatingReview, setValidatingReview] = useState<string | null>(null);
  // Notifications
  const [notifTab, setNotifTab]     = useState<"whatsapp" | "email" | "slack">("whatsapp");
  const [waPhone, setWaPhone]       = useState("");
  const [savingNotif, setSavingNotif] = useState(false);
  // Tutorial
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  /* ── Conversation (gardé en commentaire au cas où) ──────────────────────────
  const [messages, setMessages]     = useState<Message[]>([]);
  const [newMsg, setNewMsg]         = useState("");
  const [sending, setSending]       = useState(false);
  const [convTab, setConvTab]       = useState<"app">("app");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  ──────────────────────────────────────────────────────────────────────────── */

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
      setUserId(session.user.id);
      setClientName(proj.client_name ?? session.user.email?.split("@")[0] ?? "Moi");
      if (proj.notif_whatsapp_phone) setWaPhone(proj.notif_whatsapp_phone);

      const [fr, rr] = await Promise.all([
        fetch(`/api/files?project_id=${proj.id}`),
        fetch(`/api/reviews?project_id=${proj.id}`),
      ]);
      const fd = await fr.json();
      const rd = await rr.json();
      setFiles(fd.files ?? []);
      setReviews(rd.reviews ?? []);

      // Afficher le tutoriel à la première visite
      if (!localStorage.getItem("cf_tutorial_done")) {
        setShowTutorial(true);
      }

      setLoading(false);
    }
    load();
  }, []);

  /* ── Conversation helpers (gardés, non utilisés pour l'instant) ─────────────
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
      body: JSON.stringify({
        project_id: project.id,
        sender_id: userId ?? "00000000-0000-0000-0000-000000000000",
        sender_role: "client",
        sender_name: clientName,
        content: newMsg.trim(),
      }),
    });
    const d = await r.json();
    if (r.ok && d.message) { setMessages((prev) => [...prev, d.message]); setNewMsg(""); }
    setSending(false);
  }
  ──────────────────────────────────────────────────────────────────────────── */

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
    setShowConfirm(false);
    setConfirmPressed(false);
  }

  async function handleValidateReview(reviewId: string) {
    setValidatingReview(reviewId);
    const r = await fetch(`/api/reviews/${reviewId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "validated" }),
    });
    const d = await r.json();
    if (r.ok) {
      setReviews(prev => prev.map(rv => rv.id === reviewId ? d.review : rv));
    }
    setValidatingReview(null);
  }

  async function saveNotification(updates: Record<string, unknown>) {
    if (!project) return;
    setSavingNotif(true);
    const r = await fetch(`/api/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const d = await r.json();
    if (r.ok) setProject(d.project);
    setSavingNotif(false);
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
    <>
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* ── Bannière projet (image fixe définie par l'admin) ───────────── */}
        {project.banner_url && (
          <div style={{ position: "relative", height: 220, overflow: "hidden", flexShrink: 0 }}>
            <img
              src={project.banner_url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        )}

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
              <button onClick={() => setShowConfirm(true)} disabled={advancing}
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
                background: "#f7f7f9",
                backgroundImage: "repeating-linear-gradient(35deg, rgba(140,150,200,0.13) 0px, rgba(140,150,200,0.13) 1px, transparent 1px, transparent 34px)",
                borderRadius: 13,
                height: 196,
                overflow: "hidden",
                flexShrink: 0,
              }}>
                <div style={{ position: "absolute", left: 16, right: 16, top: 0, bottom: 0 }}>
                  {/* Barre de progression */}
                  {(() => {
                    const today = new Date();
                    const start = new Date(startDate);
                    const elapsedDays = Math.max(0, (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    const nowPct = Math.min(100, (elapsedDays / totalDays) * 100);
                    return (
                      <div style={{
                        position: "absolute",
                        left: `calc(${nowPct}% - 10px)`,
                        top: 0,
                        width: 20,
                        height: 196,
                        zIndex: 3,
                        pointerEvents: "none",
                      }}>
                        <svg width="20" height="196" viewBox="0 0 20 196" fill="none">
                          <defs>
                            <filter id="gp_filter2" x="0" y="0" width="20" height="27.5" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
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
                          <line x1="10" y1="17" x2="10" y2="196" stroke="#82858C" strokeWidth="2"/>
                          <g filter="url(#gp_filter2)">
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
                        <span style={{ display: "block", marginTop: 4, fontSize: 10, color: c.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {stage.duration_days}j · {stageDeadline(stages, idx, startDate)}
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
                {([
                  { key: "liens", label: "Liens" },
                  { key: "review", label: reviews.filter(r => r.status === "pending").length > 0
                    ? `À review (${reviews.filter(r => r.status === "pending").length})`
                    : "À review" },
                  { key: "brief", label: "Brief" },
                  { key: "fichiers", label: "Fichiers" },
                ] as const).map(({ key: t, label }) => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{
                      padding: "10px 13px",
                      background: tab === t ? "#fff" : "transparent",
                      border: tab === t ? "1px solid rgba(158,158,158,0.17)" : "1px solid transparent",
                      borderRadius: 9,
                      fontSize: 13, fontWeight: 600,
                      letterSpacing: "-0.45px",
                      color: tab === t ? "#121a2e" : "rgba(18,26,46,0.45)",
                      cursor: "pointer",
                      boxShadow: tab === t ? "0px 4px 4px rgba(0,0,0,0.02)" : "none",
                      position: "relative" as const,
                    }}>
                    {label}
                    {t === "review" && reviews.filter(r => r.status === "pending").length > 0 && (
                      <span style={{
                        position: "absolute", top: 6, right: 6,
                        width: 7, height: 7, borderRadius: "50%",
                        background: "#ef4444",
                      }} />
                    )}
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

                {tab === "review" && (
                  <div style={{ padding: "4px 0" }}>
                    {reviews.length === 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0", gap: 8 }}>
                        <ClipboardCheck size={32} style={{ color: "rgba(18,26,46,0.15)" }} />
                        <p style={{ color: "rgba(18,26,46,0.4)", fontSize: 14, letterSpacing: "-0.3px" }}>Aucune tâche à review</p>
                      </div>
                    ) : (
                      reviews.map((rv, i) => (
                        <div key={rv.id}>
                          <div style={{ padding: "12px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Header review */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 26, height: 26, borderRadius: 7,
                                  background: rv.status === "validated" ? "#d1fae5" : "#e8edff",
                                  flexShrink: 0,
                                }}>
                                  {rv.status === "validated"
                                    ? <CheckCircle2 size={14} style={{ color: "#168b64" }} />
                                    : <ClipboardCheck size={14} style={{ color: "#0147ff" }} />}
                                </span>
                                <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>
                                  {rv.stage_label}
                                </span>
                              </div>
                              <span style={{
                                fontSize: 11, padding: "3px 8px", borderRadius: 6,
                                background: rv.status === "validated" ? "#d1fae5" : "#fef9c3",
                                color: rv.status === "validated" ? "#168b64" : "#854d0e",
                                fontWeight: 600,
                              }}>
                                {rv.status === "validated" ? "Validé" : "En attente"}
                              </span>
                            </div>
                            {rv.message && (
                              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.6)", lineHeight: "1.5", margin: 0 }}>
                                {rv.message}
                              </p>
                            )}
                            {rv.link_url && (
                              <a href={rv.link_url} target="_blank" rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 6,
                                  padding: "8px 12px", background: "#f0f3ff",
                                  border: "1px solid rgba(1,71,255,0.12)", borderRadius: 8,
                                  fontSize: 13, fontWeight: 500, color: "#0147ff", textDecoration: "none",
                                }}>
                                <ExternalLink size={13} />Ouvrir le lien
                              </a>
                            )}
                            {rv.status === "pending" && (
                              <button
                                onClick={() => handleValidateReview(rv.id)}
                                disabled={validatingReview === rv.id}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                  padding: "11px 16px",
                                  background: validatingReview === rv.id ? "rgba(1,71,255,0.7)" : "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                                  color: "#fff", border: "1px solid #2f4d9d",
                                  borderRadius: 9, fontSize: 13, fontWeight: 600,
                                  cursor: validatingReview === rv.id ? "not-allowed" : "pointer",
                                  letterSpacing: "-0.45px",
                                  boxShadow: "inset 0px -2px 0px 0px #0e42c8, 0px 4px 10px rgba(1,71,255,0.2)",
                                }}>
                                {validatingReview === rv.id
                                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Validation...</>
                                  : <><CheckCircle2 size={13} />Valider cette étape</>}
                              </button>
                            )}
                          </div>
                          {i < reviews.length - 1 && <div style={{ height: 1, background: "rgba(0,0,0,0.05)" }} />}
                        </div>
                      ))
                    )}
                  </div>
                )}

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

          {/* Right column: Notifications */}
          <div style={{
            width: 340, flexShrink: 0,
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.13)",
            borderRadius: 13, overflow: "hidden",
            display: "flex", flexDirection: "column",
            boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
          }}>
            {/* Header */}
            <div style={{ padding: "15px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={16} style={{ color: "#121a2e" }} />
              <span style={{ ...jakartaSans, fontSize: 17, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>
                Notifications
              </span>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "0 12px" }}>
              {([
                { key: "whatsapp", label: "WhatsApp" },
                { key: "email", label: "Email" },
                { key: "slack", label: "Slack" },
              ] as const).map(({ key, label }) => (
                <button key={key} onClick={() => setNotifTab(key)}
                  style={{
                    padding: "10px 12px", fontSize: 13, fontWeight: 600,
                    letterSpacing: "-0.3px",
                    color: notifTab === key ? "#0147ff" : "rgba(18,26,46,0.4)",
                    background: "none", border: "none",
                    borderBottom: `2px solid ${notifTab === key ? "#0147ff" : "transparent"}`,
                    cursor: "pointer",
                    marginBottom: -1,
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

              {/* ── WhatsApp ── */}
              {notifTab === "whatsapp" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f7f7f9", borderRadius: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ ...jakartaSans, fontSize: 13, fontWeight: 600, color: "#121a2e", margin: 0 }}>WhatsApp</p>
                      <p style={{ ...jakartaSans, fontSize: 11, color: "rgba(18,26,46,0.45)", margin: "2px 0 0" }}>
                        {project.notif_whatsapp_group ? "Groupe actif" : "Non configuré"}
                      </p>
                    </div>
                    <button
                      onClick={() => saveNotification({ notif_whatsapp_enabled: !project.notif_whatsapp_enabled })}
                      disabled={!project.notif_whatsapp_group || savingNotif}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: "none", cursor: project.notif_whatsapp_group ? "pointer" : "not-allowed",
                        background: project.notif_whatsapp_enabled && project.notif_whatsapp_group ? "#0147ff" : "#e5e7eb",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                        opacity: !project.notif_whatsapp_group ? 0.5 : 1,
                      }}>
                      <span style={{
                        position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        transition: "left 0.2s",
                        left: project.notif_whatsapp_enabled && project.notif_whatsapp_group ? 23 : 3,
                      }} />
                    </button>
                  </div>

                  {project.notif_whatsapp_group ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <p style={{ ...jakartaSans, fontSize: 12, color: "rgba(18,26,46,0.5)", margin: 0 }}>Votre groupe WhatsApp est prêt :</p>
                      <a href={project.notif_whatsapp_group} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                          background: "#f0faf4", border: "1px solid rgba(37,211,102,0.2)",
                          borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 500, color: "#16a34a",
                        }}>
                        <ChevronRight size={14} />Rejoindre le groupe
                      </a>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <label style={{ ...jakartaSans, fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)" }}>
                        Numéro WhatsApp
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#f7f7f9", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9 }}>
                          <Phone size={14} style={{ color: "rgba(18,26,46,0.35)", flexShrink: 0 }} />
                          <input
                            type="tel"
                            value={waPhone}
                            onChange={(e) => setWaPhone(e.target.value)}
                            placeholder="+33 6 00 00 00 00"
                            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent", color: "#121a2e" }}
                          />
                        </div>
                        <button
                          onClick={() => saveNotification({ notif_whatsapp_phone: waPhone })}
                          disabled={!waPhone.trim() || savingNotif}
                          style={{
                            padding: "0 14px", background: "#121a2e", color: "#fff",
                            border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600,
                            cursor: !waPhone.trim() ? "not-allowed" : "pointer",
                            opacity: !waPhone.trim() ? 0.5 : 1,
                          }}>
                          {savingNotif ? "..." : "Envoyer"}
                        </button>
                      </div>
                      <p style={{ ...jakartaSans, fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0 }}>
                        Un groupe WhatsApp sera créé et vous y serez invité.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Email ── */}
              {notifTab === "email" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f7f7f9", borderRadius: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#4285f4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Mail size={16} style={{ color: "#fff" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ ...jakartaSans, fontSize: 13, fontWeight: 600, color: "#121a2e", margin: 0 }}>Email</p>
                      <p style={{ ...jakartaSans, fontSize: 11, color: "rgba(18,26,46,0.45)", margin: "2px 0 0" }}>Toujours configuré</p>
                    </div>
                    <button
                      onClick={() => saveNotification({ notif_email_enabled: !project.notif_email_enabled })}
                      disabled={savingNotif}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                        background: project.notif_email_enabled ? "#0147ff" : "#e5e7eb",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                      }}>
                      <span style={{
                        position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                        left: project.notif_email_enabled ? 23 : 3,
                      }} />
                    </button>
                  </div>
                  <p style={{ ...jakartaSans, fontSize: 13, color: "rgba(18,26,46,0.6)", lineHeight: "1.5" }}>
                    Les notifications seront envoyées à l&apos;adresse email associée à votre compte.
                  </p>
                </div>
              )}

              {/* ── Slack ── */}
              {notifTab === "slack" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#f7f7f9", borderRadius: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "#4A154B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Hash size={16} style={{ color: "#fff" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ ...jakartaSans, fontSize: 13, fontWeight: 600, color: "#121a2e", margin: 0 }}>Slack</p>
                      <p style={{ ...jakartaSans, fontSize: 11, color: "rgba(18,26,46,0.45)", margin: "2px 0 0" }}>
                        {project.notif_slack_webhook ? "Webhook configuré" : "Non configuré"}
                      </p>
                    </div>
                    <button
                      onClick={() => saveNotification({ notif_slack_enabled: !project.notif_slack_enabled })}
                      disabled={!project.notif_slack_webhook || savingNotif}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: "none", cursor: project.notif_slack_webhook ? "pointer" : "not-allowed",
                        background: project.notif_slack_enabled && project.notif_slack_webhook ? "#0147ff" : "#e5e7eb",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                        opacity: !project.notif_slack_webhook ? 0.5 : 1,
                      }}>
                      <span style={{
                        position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s",
                        left: project.notif_slack_enabled && project.notif_slack_webhook ? 23 : 3,
                      }} />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label style={{ ...jakartaSans, fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.5)" }}>Webhook URL</label>
                    <input
                      type="url"
                      defaultValue={project.notif_slack_webhook ?? ""}
                      placeholder="https://hooks.slack.com/services/..."
                      onBlur={(e) => { if (e.target.value !== (project.notif_slack_webhook ?? "")) saveNotification({ notif_slack_webhook: e.target.value || null }); }}
                      style={{
                        padding: "10px 12px", border: "1px solid rgba(0,0,0,0.09)",
                        borderRadius: 9, fontSize: 13, color: "#121a2e",
                        background: "#f7f7f9", outline: "none",
                      }}
                    />
                    <p style={{ ...jakartaSans, fontSize: 11, color: "rgba(18,26,46,0.4)", margin: 0 }}>
                      Obtenez votre webhook dans les paramètres de votre espace Slack.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── Conversation (gardée, masquée) ────────────────────────────────
          <div style={{ width: 340, flexShrink: 0, background: "#fff", border: "1px solid rgba(0,0,0,0.13)", borderRadius: 13, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "15px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: "#121a2e" }}>Conversation</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", background: "#fbfbfb", padding: "12px" }}>
              <div ref={messagesEndRef} />
            </div>
          </div>
          ────────────────────────────────────────────────────────────────────── */}
        </div>
      </div>
    </div>

    {/* ── Modal confirmation validation ──────────────────────────────────── */}
    {showConfirm && currentStage && (
      <div
        onClick={() => { if (!advancing) setShowConfirm(false); }}
        style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(18,26,46,0.3)",
          backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "32px 28px 28px",
            maxWidth: 400, width: "100%",
            boxShadow: "0px 32px 64px rgba(18,26,46,0.16), 0px 8px 24px rgba(18,26,46,0.06)",
            border: "1px solid rgba(0,0,0,0.07)",
          }}
        >
          {/* Icône avertissement */}
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: "#fff7ed",
            border: "1px solid rgba(234,88,12,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 20,
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L20.5 19H1.5L11 2Z" stroke="#ea580c" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(234,88,12,0.08)"/>
              <rect x="10.25" y="9" width="1.5" height="5.5" rx=".75" fill="#ea580c"/>
              <circle cx="11" cy="16.5" r=".85" fill="#ea580c"/>
            </svg>
          </div>

          <h3 style={{ ...jakartaSans, fontSize: 20, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.45px", margin: "0 0 12px" }}>
            Attention
          </h3>
          <p style={{ ...jakartaSans, fontSize: 14, color: "rgba(18,26,46,0.65)", lineHeight: "1.65", margin: "0 0 28px" }}>
            Une fois cette étape validée, vous ne pourrez plus y revenir. Nous passerons ensuite à la suivante, alors assurez-vous d&apos;être certain avant de valider.
          </p>

          {/* Bouton confirmer */}
          <button
            onClick={async () => {
              setConfirmPressed(true);
              await handleValidate();
              setConfirmPressed(false);
            }}
            disabled={advancing}
            style={{
              width: "100%", padding: "15px 20px", marginBottom: 10,
              background: confirmPressed || advancing
                ? "linear-gradient(121deg, rgb(40,80,200) 9.99%, rgb(0,45,180) 82.49%)"
                : "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
              color: "#fff",
              border: "1px solid #2f4d9d",
              borderRadius: 12,
              fontSize: 14, fontWeight: 600,
              letterSpacing: "-0.45px",
              cursor: advancing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: confirmPressed || advancing
                ? "inset 0px 3px 6px rgba(0,0,0,0.2)"
                : "inset 0px -3px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.25)",
              transition: "all 0.1s ease",
              transform: confirmPressed ? "scale(0.99)" : "scale(1)",
            }}
          >
            {advancing
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Validation...</>
              : `Valider : ${currentStage.label}`}
          </button>

          <button
            onClick={() => setShowConfirm(false)}
            disabled={advancing}
            style={{
              width: "100%", padding: "13px 20px",
              background: "transparent",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              fontSize: 14, fontWeight: 500,
              color: "rgba(18,26,46,0.5)",
              cursor: advancing ? "not-allowed" : "pointer",
              letterSpacing: "-0.45px",
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    )}

    {/* ── Tutoriel overlay ───────────────────────────────────────────────────── */}
    {showTutorial && (() => {
      const steps = [
        { title: "Bienvenue dans votre espace !", body: "Retrouvez ici l'avancement de votre projet, les étapes, et toutes les ressources partagées par votre agence.", icon: "👋" },
        { title: "Suivez vos étapes", body: "Le Gantt vous montre la progression de votre projet. Quand une étape est prête, vous pouvez la valider depuis le bouton en haut à droite.", icon: "📊" },
        { title: "Tâches à review", body: "L'onglet \"À review\" vous notifie quand votre agence vous soumet quelque chose à valider (maquette, texte, etc.).", icon: "✅" },
        { title: "Notifications", body: "Configurez vos alertes WhatsApp, Email ou Slack pour être notifié automatiquement à chaque avancement.", icon: "🔔" },
      ];
      const step = steps[tutorialStep];
      return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(18,26,46,0.5)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px 24px", maxWidth: 380, width: "100%", boxShadow: "0px 32px 64px rgba(18,26,46,0.2)" }}>
            <div style={{ fontSize: 36, marginBottom: 16, textAlign: "center" }}>{step.icon}</div>
            <h3 style={{ ...jakartaSans, fontSize: 20, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.45px", margin: "0 0 10px", textAlign: "center" }}>
              {step.title}
            </h3>
            <p style={{ ...jakartaSans, fontSize: 14, color: "rgba(18,26,46,0.6)", lineHeight: "1.65", margin: "0 0 28px", textAlign: "center" }}>
              {step.body}
            </p>
            {/* Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
              {steps.map((_, i) => (
                <span key={i} style={{ width: i === tutorialStep ? 20 : 6, height: 6, borderRadius: 3, background: i === tutorialStep ? "#0147ff" : "#e5e7eb", transition: "all 0.3s" }} />
              ))}
            </div>
            <button
              onClick={() => {
                if (tutorialStep < steps.length - 1) {
                  setTutorialStep(tutorialStep + 1);
                } else {
                  setShowTutorial(false);
                  localStorage.setItem("cf_tutorial_done", "1");
                }
              }}
              style={{
                width: "100%", padding: "14px", borderRadius: 12,
                background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                color: "#fff", border: "1px solid #2f4d9d",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                letterSpacing: "-0.45px",
                boxShadow: "inset 0px -3px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.25)",
              }}>
              {tutorialStep < steps.length - 1 ? "Suivant →" : "Commencer !"}
            </button>
          </div>
        </div>
      );
    })()}
    </>
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
      background: "#e8e8e8",
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
