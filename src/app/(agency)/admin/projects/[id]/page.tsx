"use client";

<<<<<<< HEAD
import { useEffect, useRef, useState, use } from "react";
=======
import { useState, use } from "react";
>>>>>>> c88e0ce48fe80b5fb1ab34a6e4723e21fb1c8425
import Link from "next/link";
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

<<<<<<< HEAD
function stageDate(stages: Stage[], upToIdx: number, startDate: string): Date {
  const date = new Date(startDate);
  for (let i = 0; i <= upToIdx; i++) date.setDate(date.getDate() + (stages[i]?.duration_days ?? 0));
  return date;
}
=======
export default function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [activeTab, setActiveTab] = useState<ActiveTab>("messages");
  const [newMessage, setNewMessage] = useState("");
  const [tasks, setTasks] = useState(mockTasks);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);
>>>>>>> c88e0ce48fe80b5fb1ab34a6e4723e21fb1c8425

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

<<<<<<< HEAD
  useEffect(() => {
    if (!project || !timelineRef.current) return;
    const currentEl = timelineRef.current.querySelector(`[data-stage="${project.current_stage_index}"]`) as HTMLElement | null;
    if (currentEl) currentEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setBannerUrl(project.banner_url ?? "");
  }, [project]);
=======
  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: `t${Date.now()}`,
      project_id: resolvedParams.id,
      title: newTaskTitle,
      status: "todo",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks((prev) => [...prev, newTask]);
    setNewTaskTitle("");
    setShowNewTask(false);
  };
>>>>>>> c88e0ce48fe80b5fb1ab34a6e4723e21fb1c8425

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
    <div className="min-h-screen bg-[#fbfbfb]">
      {project.banner_url && <div className="h-48 overflow-hidden border-b border-gray-200 bg-white"><img src={project.banner_url} alt="" className="h-full w-full object-cover" /></div>}
      <div className="mx-auto max-w-6xl p-6 lg:p-10">
        <div className="mb-8 flex items-start gap-4">
          <Link href="/admin/projects" className="mt-1 flex shrink-0 items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-700"><ArrowLeft size={15} />Retour</Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-xl font-bold text-gray-900">{project.name}</h1><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[project.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>{STATUS_LABELS[project.status] ?? project.status}</span></div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400"><span>Créé le {new Date(project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>{project.client_name && <span className="flex items-center gap-1.5"><User size={12} />{project.client_name}{project.client_email ? ` • ${project.client_email}` : ""}</span>}</div>
          </div>
        </div>

        {stages.length > 0 && <div className="mb-5 overflow-hidden rounded-2xl border border-gray-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold text-gray-700">Calendrier du projet</h2><div className="flex items-center gap-2"><span className="text-xs text-gray-400">{doneCount}/{stages.length} étapes</span><div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} /></div><span className="text-xs font-semibold text-indigo-600">{progress}%</span></div></div><div ref={timelineRef} className="overflow-x-auto pb-1"><div className="relative flex min-w-max"><div className="absolute left-6 right-6 top-5 z-0 h-0.5 bg-gray-100" />{stages.map((stage, idx) => { const isDone = stage.completed; const isCurrent = idx === currentIdx; const deadline = stageDate(stages, idx, startDate); return <div key={stage.id ?? idx} data-stage={idx} className="relative z-10 flex min-w-32 flex-col items-center px-3"><div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full border-2 bg-white transition-all ${isDone ? "border-emerald-400 bg-emerald-50" : isCurrent ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100" : "border-gray-200"}`}>{stage.image_url ? <img src={stage.image_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : isDone ? <CheckCircle2 size={16} className="text-emerald-500" /> : isCurrent ? <div className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse" /> : <span className="text-xs font-bold text-gray-400">{idx + 1}</span>}</div><p className={`mb-0.5 text-center text-xs font-semibold leading-tight ${isDone ? "text-emerald-700" : isCurrent ? "text-indigo-700" : "text-gray-400"}`}>{stage.label}</p><p className="text-[10px] text-gray-400">{stage.duration_days}j</p><div className={`mt-1.5 rounded-lg px-2 py-0.5 text-center text-[10px] ${isDone ? "bg-emerald-50 text-emerald-600" : isCurrent ? "bg-indigo-50 font-medium text-indigo-600" : "text-gray-300"}`}>{isDone && stage.completed_at ? `? ${new Date(stage.completed_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : isCurrent ? `? ${deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</div></div>; })}</div></div></div>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Pilotage projet</h2>
              {allDone ? <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600"><CheckCircle2 size={16} />Projet terminé</div> : !currentStage ? <p className="text-xs text-gray-400">Aucune étape active pour l’instant.</p> : <><div className="mb-4 rounded-xl bg-indigo-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Étape en cours</p><p className="mt-1 text-sm font-semibold text-indigo-700">{currentStage.label}</p><div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-500"><CalendarDays size={12} />Fin estimée : {stageDate(stages, currentIdx, startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</div></div><div className="space-y-3"><div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Prestataire assigné</p><p className="mt-1 text-sm font-medium text-gray-800">{assignedDesigner ? assignedDesigner.name : "Aucun prestataire assigné"}</p>{assignedDesigner?.speciality && <p className="mt-1 text-xs text-gray-400">{assignedDesigner.speciality}</p>}</div><button onClick={() => { setTab("review"); setShowSendReview(true); setReviewStageIdx(currentIdx < stages.length ? currentIdx : null); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"><ClipboardCheck size={14} />Envoyer en review<ChevronRight size={14} /></button></div></>}
            </div>
            {stages.length > 0 && <div className="rounded-2xl border border-gray-200 bg-white p-4"><h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Toutes les étapes</h2><div className="space-y-2">{stages.map((stage, idx) => { const isDone = stage.completed; const isCurrent = idx === currentIdx; return <div key={stage.id ?? idx} className="flex items-center gap-2.5"><div className="shrink-0">{isDone ? <CheckCircle2 size={13} className="text-emerald-500" /> : isCurrent ? <div className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse" /> : <div className="h-3 w-3 rounded-full border-2 border-gray-200" />}</div><p className={`truncate text-xs ${isDone ? "text-emerald-700 line-through" : isCurrent ? "font-semibold text-indigo-700" : "text-gray-400"}`}>{stage.label}</p></div>; })}</div></div>}
          </div>

          <div className="col-span-2 flex max-h-[720px] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex shrink-0 border-b border-gray-100 px-1 pt-1">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-3 text-sm font-medium transition-colors ${tab === item.key ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{item.icon}{item.label}{item.count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${tab === item.key ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-500"}`}>{item.count}</span>}</button>)}</div>

            {tab === "brief" && <div className="flex-1 overflow-y-auto p-5">{!project.form_data || Object.keys(project.form_data).length === 0 ? <div className="flex h-full flex-col items-center justify-center py-12 text-gray-400"><FileText size={32} className="mb-3 opacity-30" /><p className="text-sm font-medium">Aucun brief disponible</p></div> : <div className="space-y-2.5">{Object.entries(project.form_data).map(([key, value]) => <div key={key} className="rounded-xl bg-gray-50 p-4"><p className="mb-1 text-xs font-medium capitalize text-gray-400">{key.replace(/_/g, " ")}</p><p className="text-sm text-gray-800">{Array.isArray(value) ? value.join(", ") : String(value ?? "")}</p></div>)}</div>}</div>}

            {tab === "messages" && <><div className="flex-1 space-y-4 overflow-y-auto p-5">{messages.length === 0 ? <div className="flex h-full flex-col items-center justify-center py-12 text-gray-400"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><MessageSquare size={20} className="opacity-40" /></div><p className="text-sm font-medium">Aucun message pour l’instant</p><p className="mt-1 text-xs text-gray-400">Démarrez la conversation avec le client.</p></div> : messages.map((msg) => { const isAdmin = msg.sender_role === "admin"; return <div key={msg.id} className={`flex gap-3 ${isAdmin ? "flex-row-reverse" : ""}`}><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isAdmin ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600"}`}>{msg.sender_name.charAt(0).toUpperCase()}</div><div className={`flex max-w-xs flex-col lg:max-w-sm ${isAdmin ? "items-end" : "items-start"}`}><span className="mb-1 text-xs text-gray-400">{msg.sender_name}</span><div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isAdmin ? "rounded-tr-sm bg-indigo-600 text-white" : "rounded-tl-sm bg-gray-100 text-gray-800"}`}>{msg.content}</div><span className="mt-1 text-xs text-gray-400">{new Date(msg.created_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span></div></div>; })}<div ref={messagesEndRef} /></div><form onSubmit={handleSendMessage} className="flex shrink-0 gap-2 border-t border-gray-100 p-4"><input type="text" value={newMsg} onChange={(e) => setNewMsg(e.target.value)} placeholder="Écrire un message..." className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" /><button type="submit" disabled={sending || !newMsg.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button></form></>}

            {tab === "review" && <div className="flex-1 space-y-4 overflow-y-auto p-5">{!showSendReview ? <button onClick={() => { setShowSendReview(true); if (reviewStageIdx === null && currentIdx < stages.length) setReviewStageIdx(currentIdx); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"><ClipboardCheck size={14} />Envoyer une tâche à review</button> : <form onSubmit={handleSendReview} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4"><div><label className="mb-1 block text-xs font-medium text-gray-600">Étape concernée</label><select value={reviewStageIdx ?? ""} onChange={(e) => setReviewStageIdx(Number(e.target.value))} required className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"><option value="">Choisir une étape...</option>{stages.map((stage, index) => <option key={stage.id ?? index} value={index}>{stage.label}</option>)}</select></div><div><label className="mb-1 block text-xs font-medium text-gray-600">Message</label><textarea value={reviewMsg} onChange={(e) => setReviewMsg(e.target.value)} rows={3} placeholder="Instructions pour le client..." className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" /></div><div><label className="mb-1 block text-xs font-medium text-gray-600">Lien à partager</label><input type="url" value={reviewLink} onChange={(e) => setReviewLink(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" /></div><div className="flex gap-2"><button type="submit" disabled={sendingReview || reviewStageIdx === null} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">{sendingReview ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}Envoyer</button><button type="button" onClick={() => setShowSendReview(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Annuler</button></div></form>}{reviews.length === 0 ? <p className="py-4 text-center text-sm text-gray-400">Aucune review envoyée pour ce projet.</p> : reviews.map((review) => <div key={review.id} className="space-y-2 rounded-xl border border-gray-200 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-gray-900">{review.stage_label}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${review.status === "validated" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>{review.status === "validated" ? "Validé" : "En attente"}</span></div>{review.message && <p className="text-xs text-gray-500">{review.message}</p>}{review.link_url && <a href={review.link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"><ExternalLink size={11} />{review.link_url}</a>}<p className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p></div>)}</div>}

            {tab === "fichiers" && <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">{showAddFile ? <form onSubmit={handleAddFile} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-2"><div><label className="mb-1 block text-xs font-medium text-gray-600">Nom du fichier</label><input value={newFileName} onChange={(e) => setNewFileName(e.target.value)} placeholder="Ex : Maquette Figma" required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" /></div><div><label className="mb-1 block text-xs font-medium text-gray-600">Type</label><select value={newFileType} onChange={(e) => setNewFileType(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">{Object.entries(FILE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div><div><label className="mb-1 block text-xs font-medium text-gray-600">URL</label><input value={newFileUrl} onChange={(e) => setNewFileUrl(e.target.value)} placeholder="https://..." type="url" required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" /></div><div className="flex gap-2"><button type="submit" disabled={addingFile} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">{addingFile ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Ajouter</button><button type="button" onClick={() => setShowAddFile(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Annuler</button></div></form> : <button onClick={() => setShowAddFile(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 px-4 py-2.5 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50"><Plus size={14} />Ajouter un fichier</button>}{files.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center py-12 text-gray-400"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50"><FolderOpen size={20} className="opacity-40" /></div><p className="text-sm font-medium">Aucun fichier partagé</p><p className="mt-1 text-xs text-gray-400">Ajoute ici les livrables, liens ou documents du projet.</p></div> : <div className="space-y-2">{files.map((file) => <div key={file.id} className="group flex items-center gap-3.5 rounded-xl border border-gray-100 p-3.5 transition-all hover:border-indigo-200 hover:bg-indigo-50"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 group-hover:border-indigo-200">{FILE_LABELS[file.type] ?? "Fichier"}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-800 group-hover:text-indigo-700">{file.name}</p><p className="text-xs text-gray-400">{new Date(file.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p></div><a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-gray-300 transition-colors hover:text-indigo-500"><ExternalLink size={14} /></a><button onClick={() => handleDeleteFile(file.id)} className="shrink-0 text-gray-200 transition-colors hover:text-red-400"><Trash2 size={14} /></button></div>)}</div>}</div>}

            {tab === "settings" && <div className="flex-1 space-y-5 overflow-y-auto p-5"><div className="rounded-xl border border-gray-200 p-4"><div className="mb-3 flex items-center gap-2"><UserPlus size={15} className="text-indigo-500" /><h3 className="text-sm font-semibold text-gray-900">Prestataire assigné</h3></div><div className="space-y-2"><button onClick={() => void handleAssignDesigner(null)} disabled={assigning} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${!project.designer_id ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}><span>Aucun prestataire</span>{!project.designer_id && <CheckCircle2 size={14} />}</button>{designers.map((designer) => { const selected = project.designer_id === designer.id; return <button key={designer.id} onClick={() => void handleAssignDesigner(designer.id)} disabled={assigning} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left ${selected ? "border-indigo-200 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}><div><p className={`text-sm font-medium ${selected ? "text-indigo-700" : "text-gray-900"}`}>{designer.name}</p>{designer.speciality && <p className="text-xs text-gray-400">{designer.speciality}</p>}</div>{selected && <CheckCircle2 size={14} className="text-indigo-600" />}</button>; })}</div></div><div className="rounded-xl border border-gray-200 p-4"><div className="mb-3 flex items-center gap-2"><ImageIcon size={15} className="text-indigo-500" /><h3 className="text-sm font-semibold text-gray-900">Bannière du projet</h3></div>{project.banner_url && <div className="mb-3 h-28 overflow-hidden rounded-xl border border-gray-200"><img src={project.banner_url} alt="" className="h-full w-full object-cover" /></div>}<label className="mb-1 block text-xs font-medium text-gray-600">URL de l’image</label><input type="url" value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" /><div className="mt-3 flex gap-2"><button onClick={() => void handleSaveBanner()} disabled={savingBanner} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">{savingBanner ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Enregistrer</button>{project.banner_url && <button onClick={() => { setBannerUrl(""); void updateProject({ banner_url: null }); }} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-500 hover:bg-red-50">Supprimer</button>}</div></div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

