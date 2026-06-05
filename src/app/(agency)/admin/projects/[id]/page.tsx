"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import ClientBlueButton from "@/components/shared/ClientBlueButton";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Settings,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";

interface Stage {
  id: string;
  label: string;
  duration_days: number;
  completed: boolean;
  completed_at: string | null;
  image_url?: string;
}

interface Designer {
  id: string;
  name: string;
  speciality: string | null;
}

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  status: string;
  stages: Stage[];
  current_stage_index: number;
  form_data: Record<string, unknown>;
  start_date: string | null;
  designer_id: string | null;
  created_at: string;
  banner_url: string | null;
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

interface ReviewItem {
  id: string;
  stage_label: string;
  message: string | null;
  link_url: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  review: "bg-violet-50 text-violet-700 border-violet-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const FILE_LABELS: Record<string, string> = {
  figma: "Figma",
  google_doc: "Google Doc",
  image: "Image",
  pdf: "PDF",
  other: "Autre",
};

type AdminTab = "brief" | "messages" | "fichiers" | "review" | "settings";

function stageDate(stages: Stage[], upToIdx: number, startDate: string): Date {
  const date = new Date(startDate);
  for (let i = 0; i <= upToIdx; i++) date.setDate(date.getDate() + (stages[i]?.duration_days ?? 0));
  return date;
}

export default function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [designers, setDesigners] = useState<Designer[]>([]);
  const [tab, setTab] = useState<AdminTab>("brief");
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [addingFile, setAddingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [newFileType, setNewFileType] = useState("other");
  const [showSendReview, setShowSendReview] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const [reviewStageIdx, setReviewStageIdx] = useState<number | null>(null);
  const [reviewMsg, setReviewMsg] = useState("");
  const [reviewLink, setReviewLink] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [bannerUrl, setBannerUrl] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadData();
    void loadDesigners();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!project || !timelineRef.current) return;
    const currentEl = timelineRef.current.querySelector(`[data-stage="${project.current_stage_index}"]`) as HTMLElement | null;
    if (currentEl) currentEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setBannerUrl(project.banner_url ?? "");
  }, [project]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [projectRes, messagesRes, filesRes, reviewsRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/messages?project_id=${id}`),
        fetch(`/api/files?project_id=${id}`),
        fetch(`/api/reviews?project_id=${id}`),
      ]);
      const projectData = await projectRes.json();
      if (!projectRes.ok) {
        setError(projectData.error ?? "Projet introuvable");
        setLoading(false);
        return;
      }
      const messagesData = await messagesRes.json();
      const filesData = await filesRes.json();
      const reviewsData = await reviewsRes.json();
      setProject(projectData.project);
      setMessages(messagesData.messages ?? []);
      setFiles(filesData.files ?? []);
      setReviews(reviewsData.reviews ?? []);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  async function loadDesigners() {
    try {
      const res = await fetch("/api/designers");
      const data = await res.json();
      setDesigners(data.designers ?? []);
    } catch {
      setDesigners([]);
    }
  }

  async function updateProject(updates: Record<string, unknown>) {
    if (!project) return;
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (res.ok && data.project) setProject(data.project);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !newMsg.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id, sender_role: "admin", sender_name: "Agence", content: newMsg.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setNewMsg("");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleAddFile(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !newFileName.trim() || !newFileUrl.trim()) return;
    setAddingFile(true);
    try {
      const res = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id, name: newFileName.trim(), url: newFileUrl.trim(), type: newFileType }),
      });
      const data = await res.json();
      if (res.ok && data.file) {
        setFiles((prev) => [data.file, ...prev]);
        setNewFileName("");
        setNewFileUrl("");
        setNewFileType("other");
        setShowAddFile(false);
      }
    } finally {
      setAddingFile(false);
    }
  }

  async function handleDeleteFile(fileId: string) {
    await fetch("/api/files", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: fileId }) });
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
  }

  async function handleAssignDesigner(designerId: string | null) {
    setAssigning(true);
    try {
      await updateProject({ designer_id: designerId });
    } finally {
      setAssigning(false);
    }
  }

  async function handleSendReview(e: React.FormEvent) {
    e.preventDefault();
    if (!project || reviewStageIdx === null) return;
    const stage = project.stages?.[reviewStageIdx];
    if (!stage) return;
    setSendingReview(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id, stage_index: reviewStageIdx, stage_label: stage.label, message: reviewMsg || null, link_url: reviewLink || null }),
      });
      const data = await res.json();
      if (res.ok && data.review) {
        setReviews((prev) => [data.review, ...prev]);
        setShowSendReview(false);
        setReviewStageIdx(null);
        setReviewMsg("");
        setReviewLink("");
      }
    } finally {
      setSendingReview(false);
    }
  }

  async function handleSaveBanner() {
    setSavingBanner(true);
    try {
      await updateProject({ banner_url: bannerUrl || null });
    } finally {
      setSavingBanner(false);
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={28} /></div>;
  if (error || !project) {
    return <div className="p-8"><Link href="/admin/projects" className="mb-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft size={16} />Retour</Link><div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /><p className="text-sm">{error ?? "Projet introuvable"}</p></div></div>;
  }

  const stages = project.stages ?? [];
  const currentIdx = project.current_stage_index ?? 0;
  const currentStage = stages[currentIdx];
  const startDate = project.start_date ?? project.created_at.split("T")[0];
  const doneCount = stages.filter((stage) => stage.completed).length;
  const progress = stages.length > 0 ? Math.round((doneCount / stages.length) * 100) : 0;
  const allDone = currentIdx >= stages.length && stages.length > 0;
  const assignedDesigner = designers.find((designer) => designer.id === project.designer_id) ?? null;
  const pendingReviews = reviews.filter((review) => review.status === "pending").length;
  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "brief", label: "Brief", icon: <FileText size={14} /> },
    { key: "messages", label: "Messages", icon: <MessageSquare size={14} />, count: messages.length || undefined },
    { key: "fichiers", label: "Fichiers", icon: <Paperclip size={14} />, count: files.length || undefined },
    { key: "review", label: "Review", icon: <ClipboardCheck size={14} />, count: pendingReviews || undefined },
    { key: "settings", label: "Paramètres", icon: <Settings size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#fbfbfb] text-[#121A2E]">
      {project.banner_url && (
        <div className="h-36 overflow-hidden border-b border-black/10 bg-white sm:h-48 lg:h-56">
          <img src={project.banner_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:px-10 lg:py-10">
        <header className="mb-6 flex flex-col gap-4 rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_18px_50px_rgba(18,26,46,0.06)] sm:mb-8 sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
              <Link href="/admin/projects" className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-[#f6f6f6] hover:text-[#121A2E]">
                <ArrowLeft size={15} />
                Retour
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="min-w-0 text-[1.45rem] font-bold leading-tight tracking-[-0.03em] text-[#121A2E] sm:text-[1.75rem]">
                    {project.name}
                  </h1>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[project.status] ?? "border-gray-200 bg-gray-50 text-gray-600"}`}>
                    {STATUS_LABELS[project.status] ?? project.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-400">
                  <span>
                    Créé le {new Date(project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  {project.client_name && (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <User size={12} />
                      <span className="truncate">
                        {project.client_name}{project.client_email ? ` • ${project.client_email}` : ""}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
              <div className="rounded-2xl border border-black/10 bg-[#fbfbfb] px-3 py-2 text-center sm:min-w-[92px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Progression</p>
                <p className="mt-1 text-lg font-bold text-[#0147FF]">{progress}%</p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-[#fbfbfb] px-3 py-2 text-center sm:min-w-[92px]">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Reviews</p>
                <p className="mt-1 text-lg font-bold text-[#121A2E]">{pendingReviews}</p>
              </div>
            </div>
          </div>

          {stages.length > 0 && (
            <div className="rounded-2xl bg-[#f7f8fb] p-3 sm:p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#121A2E]">Calendrier du projet</h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">Timeline inspirée de l’espace client, avec défilement horizontal des étapes.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">{doneCount}/{stages.length} étapes</span>
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-[#0147FF] transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-[#0147FF]">{progress}%</span>
                </div>
              </div>

              <div ref={timelineRef} className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
                <div className="relative flex min-w-max py-1">
                  <div className="absolute left-6 right-6 top-6 z-0 h-0.5 bg-white" />
                  {stages.map((stage, idx) => {
                    const isDone = stage.completed;
                    const isCurrent = idx === currentIdx;
                    const deadline = stageDate(stages, idx, startDate);
                    return (
                      <div key={stage.id ?? idx} data-stage={idx} className="relative z-10 flex min-w-[8.5rem] flex-col items-center px-3">
                        <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full border-2 bg-white transition-all ${isDone ? "border-emerald-400 bg-emerald-50" : isCurrent ? "border-[#0147FF] bg-blue-50 shadow-[0_12px_22px_rgba(1,71,255,0.14)]" : "border-gray-200"}`}>
                          {stage.image_url ? (
                            <img src={stage.image_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                          ) : isDone ? (
                            <CheckCircle2 size={17} className="text-emerald-500" />
                          ) : isCurrent ? (
                            <div className="h-3 w-3 animate-pulse rounded-full bg-[#0147FF]" />
                          ) : (
                            <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                          )}
                        </div>
                        <p className={`mb-0.5 max-w-[7.5rem] text-center text-xs font-bold leading-tight ${isDone ? "text-emerald-700" : isCurrent ? "text-[#0147FF]" : "text-slate-400"}`}>
                          {stage.label}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400">{stage.duration_days}j</p>
                        <div className={`mt-1.5 rounded-lg px-2 py-0.5 text-center text-[10px] font-semibold ${isDone ? "bg-emerald-50 text-emerald-600" : isCurrent ? "bg-blue-50 text-[#0147FF]" : "text-slate-300"}`}>
                          {isDone && stage.completed_at
                            ? `✓ ${new Date(stage.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                            : isCurrent
                              ? `→ ${deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                              : deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,2.08fr)]">
          <aside className="space-y-4">
            <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_16px_45px_rgba(18,26,46,0.04)] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Pilotage projet</p>
                  <h2 className="mt-1 text-base font-bold text-[#121A2E]">Étape actuelle</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0147FF]">
                  <CalendarDays size={17} />
                </div>
              </div>

              {allDone ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                  <CheckCircle2 size={16} className="mb-2" />
                  Projet terminé
                </div>
              ) : !currentStage ? (
                <p className="rounded-2xl border border-gray-100 bg-[#fbfbfb] p-4 text-sm text-slate-400">Aucune étape active pour l’instant.</p>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-3 rounded-2xl bg-blue-50 p-3">
                    {currentStage.image_url ? (
                      <img src={currentStage.image_url} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white">
                        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#0147FF]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0147FF]">{currentStage.label}</p>
                      <p className="mt-0.5 text-xs font-semibold text-blue-500">{currentStage.duration_days} jours</p>
                    </div>
                  </div>

                  <div className="mb-4 space-y-2 rounded-2xl border border-black/10 bg-[#fbfbfb] p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <CalendarDays size={12} />
                      Fin estimée : {stageDate(stages, currentIdx, startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-500">
                      <UserPlus size={12} className="mt-0.5 shrink-0" />
                      <span>
                        Prestataire : <strong className="font-semibold text-[#121A2E]">{assignedDesigner ? assignedDesigner.name : "Aucun prestataire assigné"}</strong>
                        {assignedDesigner?.speciality ? <span className="block text-slate-400">{assignedDesigner.speciality}</span> : null}
                      </span>
                    </div>
                  </div>

                  <ClientBlueButton
                    type="button"
                    onClick={() => {
                      setTab("review");
                      setShowSendReview(true);
                      setReviewStageIdx(currentIdx < stages.length ? currentIdx : null);
                    }}
                    icon={<ClipboardCheck size={15} />}
                    wrapperStyle={{ width: "100%" }}
                    style={{ minHeight: 46, padding: "0 18px", fontSize: 14 }}
                  >
                    Envoyer en review
                  </ClientBlueButton>
                </>
              )}
            </section>

            {stages.length > 0 && (
              <section className="rounded-[24px] border border-black/10 bg-white p-4 shadow-[0_16px_45px_rgba(18,26,46,0.04)]">
                <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Toutes les étapes</h2>
                <div className="space-y-2">
                  {stages.map((stage, idx) => {
                    const isDone = stage.completed;
                    const isCurrent = idx === currentIdx;
                    return (
                      <div key={stage.id ?? idx} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                        <div className="shrink-0">
                          {isDone ? <CheckCircle2 size={14} className="text-emerald-500" /> : isCurrent ? <div className="h-3 w-3 animate-pulse rounded-full bg-[#0147FF]" /> : <div className="h-3 w-3 rounded-full border-2 border-gray-200" />}
                        </div>
                        <p className={`min-w-0 truncate text-xs ${isDone ? "text-emerald-700 line-through" : isCurrent ? "font-bold text-[#0147FF]" : "text-slate-400"}`}>
                          {stage.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </aside>

          <section className="flex min-h-[560px] flex-col overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-[0_16px_45px_rgba(18,26,46,0.05)] lg:max-h-[760px]">
            <div className="shrink-0 overflow-x-auto border-b border-black/[0.06] px-2 pt-2 [-webkit-overflow-scrolling:touch]">
              <div className="flex min-w-max gap-1">
                {tabs.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className={`flex items-center gap-2 rounded-t-2xl border-b-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-4 ${tab === item.key ? "border-[#0147FF] bg-blue-50/70 text-[#0147FF]" : "border-transparent text-slate-500 hover:bg-[#f7f8fb] hover:text-[#121A2E]"}`}
                  >
                    {item.icon}
                    {item.label}
                    {item.count !== undefined && (
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${tab === item.key ? "bg-white text-[#0147FF]" : "bg-gray-100 text-slate-500"}`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {tab === "brief" && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                {!project.form_data || Object.keys(project.form_data).length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-center text-slate-400">
                    <FileText size={34} className="mb-3 opacity-30" />
                    <p className="text-sm font-semibold">Aucun brief disponible</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {Object.entries(project.form_data).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-black/[0.06] bg-[#fbfbfb] p-4">
                        <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-slate-400">{key.replace(/_/g, " ")}</p>
                        <p className="break-words text-sm font-medium leading-relaxed text-[#121A2E]">{Array.isArray(value) ? value.join(", ") : String(value ?? "")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "messages" && (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                  {messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center py-12 text-center text-slate-400">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7f8fb]">
                        <MessageSquare size={20} className="opacity-40" />
                      </div>
                      <p className="text-sm font-semibold">Aucun message pour l’instant</p>
                      <p className="mt-1 text-xs">Démarrez la conversation avec le client.</p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isAdmin = msg.sender_role === "admin";
                      return (
                        <div key={msg.id} className={`flex gap-3 ${isAdmin ? "flex-row-reverse" : ""}`}>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isAdmin ? "bg-blue-100 text-[#0147FF]" : "bg-gray-100 text-gray-600"}`}>
                            {msg.sender_name.charAt(0).toUpperCase()}
                          </div>
                          <div className={`flex max-w-[82%] flex-col sm:max-w-sm lg:max-w-md ${isAdmin ? "items-end" : "items-start"}`}>
                            <span className="mb-1 text-xs font-medium text-slate-400">{msg.sender_name}</span>
                            <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isAdmin ? "rounded-tr-sm bg-[#0147FF] text-white" : "rounded-tl-sm bg-[#f3f4f6] text-[#121A2E]"}`}>
                              {msg.content}
                            </div>
                            <span className="mt-1 text-xs text-slate-400">
                              {new Date(msg.created_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="flex shrink-0 gap-2 border-t border-black/[0.06] p-3 sm:p-4">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="Écrire un message..."
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-[#f7f8fb] px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-200 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                  <button type="submit" disabled={sending || !newMsg.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0147FF] text-white transition-colors hover:bg-[#003bd6] disabled:opacity-50">
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </form>
              </>
            )}

            {tab === "review" && (
              <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                {!showSendReview ? (
                  <ClientBlueButton
                    type="button"
                    onClick={() => {
                      setShowSendReview(true);
                      if (reviewStageIdx === null && currentIdx < stages.length) setReviewStageIdx(currentIdx);
                    }}
                    icon={<ClipboardCheck size={14} />}
                    wrapperStyle={{ width: "100%" }}
                    style={{ minHeight: 44, padding: "0 18px", fontSize: 14 }}
                  >
                    Envoyer une tâche à review
                  </ClientBlueButton>
                ) : (
                  <form onSubmit={handleSendReview} className="space-y-3 rounded-2xl border border-black/10 bg-[#fbfbfb] p-4">
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Étape concernée</label>
                      <select value={reviewStageIdx ?? ""} onChange={(e) => setReviewStageIdx(Number(e.target.value))} required className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100">
                        <option value="">Choisir une étape...</option>
                        {stages.map((stage, index) => <option key={stage.id ?? index} value={index}>{stage.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Message</label>
                      <textarea value={reviewMsg} onChange={(e) => setReviewMsg(e.target.value)} rows={3} placeholder="Instructions pour le client..." className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Lien à partager</label>
                      <input type="url" value={reviewLink} onChange={(e) => setReviewLink(e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                      <button type="button" onClick={() => setShowSendReview(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-white">
                        Annuler
                      </button>
                      <ClientBlueButton type="submit" disabled={sendingReview || reviewStageIdx === null} icon={sendingReview ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} wrapperStyle={{ width: "100%" }} style={{ minHeight: 44, padding: "0 18px", fontSize: 14 }}>
                        Envoyer
                      </ClientBlueButton>
                    </div>
                  </form>
                )}

                {reviews.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-gray-200 py-8 text-center text-sm font-medium text-slate-400">Aucune review envoyée pour ce projet.</p>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="space-y-2 rounded-2xl border border-black/[0.06] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-[#121A2E]">{review.stage_label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${review.status === "validated" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                          {review.status === "validated" ? "Validé" : "En attente"}
                        </span>
                      </div>
                      {review.message && <p className="text-sm leading-relaxed text-slate-500">{review.message}</p>}
                      {review.link_url && <a href={review.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-xs font-semibold text-[#0147FF] hover:text-[#003bd6]"><ExternalLink size={11} /><span className="truncate">{review.link_url}</span></a>}
                      <p className="text-xs text-slate-400">{new Date(review.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "fichiers" && (
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
                {showAddFile ? (
                  <form onSubmit={handleAddFile} className="space-y-3 rounded-2xl border border-black/10 bg-[#fbfbfb] p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Nom du fichier</label>
                        <input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="Ex : Maquette Figma" required className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">Type</label>
                        <select value={newFileType} onChange={(e) => setNewFileType(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100">
                          {Object.entries(FILE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">URL</label>
                      <input value={newFileUrl} onChange={(e) => setNewFileUrl(e.target.value)} placeholder="https://..." type="url" required className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                      <button type="button" onClick={() => setShowAddFile(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-white">Annuler</button>
                      <ClientBlueButton type="submit" disabled={addingFile} icon={addingFile ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} wrapperStyle={{ width: "100%" }} style={{ minHeight: 44, padding: "0 18px", fontSize: 14 }}>
                        Ajouter
                      </ClientBlueButton>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => setShowAddFile(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-3 text-sm font-bold text-[#0147FF] transition-colors hover:bg-blue-50">
                    <Plus size={14} />
                    Ajouter un fichier
                  </button>
                )}

                {files.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-12 text-center text-slate-400">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f7f8fb]"><FolderOpen size={20} className="opacity-40" /></div>
                    <p className="text-sm font-semibold">Aucun fichier partagé</p>
                    <p className="mt-1 text-xs">Ajoute ici les livrables, liens ou documents du projet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="group flex items-center gap-3 rounded-2xl border border-black/[0.06] p-3 transition-all hover:border-blue-200 hover:bg-blue-50/60 sm:gap-3.5 sm:p-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-[#f7f8fb] text-xs font-bold text-slate-500 group-hover:border-blue-200">
                          {FILE_LABELS[file.type] ?? "Fichier"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#121A2E] group-hover:text-[#0147FF]">{file.name}</p>
                          <p className="text-xs text-slate-400">{new Date(file.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                        </div>
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full p-2 text-slate-300 transition-colors hover:bg-white hover:text-[#0147FF]"><ExternalLink size={14} /></a>
                        <button onClick={() => handleDeleteFile(file.id)} className="shrink-0 rounded-full p-2 text-slate-200 transition-colors hover:bg-red-50 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "settings" && (
              <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
                <div className="rounded-2xl border border-black/[0.06] p-4">
                  <div className="mb-3 flex items-center gap-2"><UserPlus size={15} className="text-[#0147FF]" /><h3 className="text-sm font-bold text-[#121A2E]">Prestataire assigné</h3></div>
                  <div className="space-y-2">
                    <button onClick={() => void handleAssignDesigner(null)} disabled={assigning} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${!project.designer_id ? "border-blue-200 bg-blue-50 text-[#0147FF]" : "border-gray-200 text-slate-500 hover:bg-[#f7f8fb]"}`}><span>Aucun prestataire</span>{!project.designer_id && <CheckCircle2 size={14} />}</button>
                    {designers.map((designer) => {
                      const selected = project.designer_id === designer.id;
                      return (
                        <button key={designer.id} onClick={() => void handleAssignDesigner(designer.id)} disabled={assigning} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left ${selected ? "border-blue-200 bg-blue-50" : "border-gray-200 hover:bg-[#f7f8fb]"}`}>
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-bold ${selected ? "text-[#0147FF]" : "text-[#121A2E]"}`}>{designer.name}</p>
                            {designer.speciality && <p className="text-xs text-slate-400">{designer.speciality}</p>}
                          </div>
                          {selected && <CheckCircle2 size={14} className="text-[#0147FF]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-black/[0.06] p-4">
                  <div className="mb-3 flex items-center gap-2"><ImageIcon size={15} className="text-[#0147FF]" /><h3 className="text-sm font-bold text-[#121A2E]">Bannière du projet</h3></div>
                  {project.banner_url && <div className="mb-3 h-32 overflow-hidden rounded-2xl border border-gray-200"><img src={project.banner_url} alt="" className="h-full w-full object-cover" /></div>}
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-400">URL de l’image</label>
                  <input type="url" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100" />
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <ClientBlueButton type="button" onClick={() => void handleSaveBanner()} disabled={savingBanner} icon={savingBanner ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} wrapperStyle={{ width: "100%" }} style={{ minHeight: 44, padding: "0 18px", fontSize: 14 }}>
                      Enregistrer
                    </ClientBlueButton>
                    {project.banner_url && <button onClick={() => { setBannerUrl(""); void updateProject({ banner_url: null }); }} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50">Supprimer</button>}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
