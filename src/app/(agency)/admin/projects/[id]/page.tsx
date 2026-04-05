"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Send, CheckCircle2, Clock, Loader2, ChevronRight,
  User, MessageSquare, AlertCircle, UserPlus, X,
  Paperclip, FolderOpen, ExternalLink, Trash2, Plus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stage {
  id: string;
  label: string;
  duration_days: number;
  completed: boolean;
  completed_at: string | null;
}

interface Designer {
  id: string;
  name: string;
  speciality: string | null;
  role: string;
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
}

interface Message {
  id: string;
  project_id: string;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stageStartDate(stages: Stage[], idx: number, startDate: string): Date {
  const base = new Date(startDate);
  for (let i = 0; i < idx; i++) base.setDate(base.getDate() + (stages[i]?.duration_days ?? 0));
  return base;
}

function stageEndDate(stages: Stage[], idx: number, startDate: string): Date {
  const start = stageStartDate(stages, idx, startDate);
  start.setDate(start.getDate() + (stages[idx]?.duration_days ?? 0));
  return start;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  review: "bg-purple-50 text-purple-700 border-purple-200",
  completed: "bg-green-50 text-green-700 border-green-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [project, setProject]     = useState<Project | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [advancing, setAdvancing]   = useState(false);
  const [designers, setDesigners]   = useState<Designer[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning]   = useState(false);

  const [messages, setMessages]     = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg]         = useState("");
  const [sending, setSending]       = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Files
  const [files, setFiles]           = useState<ProjectFile[]>([]);
  const [rightTab, setRightTab]     = useState<"messages" | "fichiers">("messages");
  const [newFileName, setNewFileName] = useState("");
  const [newFileUrl, setNewFileUrl]   = useState("");
  const [newFileType, setNewFileType] = useState("other");
  const [addingFile, setAddingFile]   = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);

  useEffect(() => { loadProject(); loadDesigners(); }, [id]);
  useEffect(() => { if (project) { loadMessages(); loadFiles(); } }, [project?.id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadProject() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${id}`);
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Erreur"); setLoading(false); return; }
      setProject(d.project);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  async function loadDesigners() {
    try {
      const r = await fetch("/api/designers");
      const d = await r.json();
      setDesigners(d.designers ?? []);
    } catch { /* silent */ }
  }

  async function handleAssignDesigner(designerId: string | null) {
    if (!project) return;
    setAssigning(true);
    await fetch(`/api/projects/${project.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designer_id: designerId }),
    });
    setProject((p) => p ? { ...p, designer_id: designerId } : p);
    setShowAssign(false);
    setAssigning(false);
  }

  async function loadMessages() {
    if (!project) return;
    setMsgLoading(true);
    try {
      const r = await fetch(`/api/messages?project_id=${project.id}`);
      const d = await r.json();
      setMessages(d.messages ?? []);
    } catch { /* silent */ }
    setMsgLoading(false);
  }

  async function loadFiles() {
    if (!project) return;
    try {
      const r = await fetch(`/api/files?project_id=${project.id}`);
      const d = await r.json();
      setFiles(d.files ?? []);
    } catch { /* silent */ }
  }

  async function handleAddFile(e: React.FormEvent) {
    e.preventDefault();
    if (!newFileName.trim() || !newFileUrl.trim() || !project) return;
    setAddingFile(true);
    try {
      const r = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id, name: newFileName.trim(), url: newFileUrl.trim(), type: newFileType }),
      });
      const d = await r.json();
      if (r.ok && d.file) {
        setFiles((prev) => [d.file, ...prev]);
        setNewFileName(""); setNewFileUrl(""); setNewFileType("other");
        setShowAddFile(false);
      }
    } catch { /* silent */ }
    setAddingFile(false);
  }

  async function handleDeleteFile(fileId: string) {
    try {
      await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fileId }),
      });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch { /* silent */ }
  }

  async function handleAdvanceStage() {
    if (!project) return;
    setAdvancing(true);
    try {
      const r = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance_stage" }),
      });
      const d = await r.json();
      if (r.ok) setProject(d.project);
      else alert(d.error ?? "Erreur lors de la validation");
    } catch (e) {
      alert(String(e));
    }
    setAdvancing(false);
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !project) return;
    setSending(true);
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          sender_role: "admin",
          sender_name: "Agence",
          content: newMsg.trim(),
        }),
      });
      const d = await r.json();
      if (r.ok && d.message) {
        setMessages((prev) => [...prev, d.message]);
        setNewMsg("");
      }
    } catch { /* silent */ }
    setSending(false);
  }

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-indigo-500" size={28} />
    </div>
  );

  if (error || !project) return (
    <div className="p-8">
      <Link href="/admin/projects" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6">
        <ArrowLeft size={16} />Retour aux projets
      </Link>
      <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <p className="text-sm">{error ?? "Projet introuvable"}</p>
      </div>
    </div>
  );

  const stages = project.stages ?? [];
  const currentIdx = project.current_stage_index ?? 0;
  const currentStage = stages[currentIdx];
  const allDone = currentIdx >= stages.length;
  const startDate = project.start_date ?? project.created_at.split("T")[0];

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <Link href="/admin/projects" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors">
        <ArrowLeft size={16} />Retour aux projets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[project.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {project.client_name && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <User size={14} />
                <span>{project.client_name}</span>
                {project.client_email && <span className="text-gray-400">— {project.client_email}</span>}
              </div>
            )}
            {/* Designer assignment */}
            <div className="relative">
              {project.designer_id ? (
                <button
                  onClick={() => setShowAssign((v) => !v)}
                  className="flex items-center gap-2 text-sm text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1 rounded-full hover:bg-indigo-100 transition-colors"
                >
                  <UserPlus size={13} />
                  {designers.find((d) => d.id === project.designer_id)?.name ?? "Prestataire assigné"}
                  <X size={11} className="text-indigo-400" />
                </button>
              ) : (
                <button
                  onClick={() => setShowAssign((v) => !v)}
                  className="flex items-center gap-2 text-sm text-gray-500 border border-dashed border-gray-300 px-3 py-1 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  <UserPlus size={13} />Assigner un prestataire
                </button>
              )}
              {showAssign && (
                <div className="absolute top-8 left-0 z-20 bg-white rounded-xl border border-gray-200 shadow-lg p-2 min-w-52">
                  {project.designer_id && (
                    <button
                      onClick={() => handleAssignDesigner(null)}
                      className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      Retirer le prestataire
                    </button>
                  )}
                  {designers.length === 0 ? (
                    <p className="text-xs text-gray-400 px-3 py-2">Aucun prestataire</p>
                  ) : designers.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleAssignDesigner(d.id)}
                      disabled={assigning}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${project.designer_id === d.id ? "bg-indigo-50 text-indigo-700" : "hover:bg-gray-50 text-gray-700"}`}
                    >
                      <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {d.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{d.name}</p>
                        {d.speciality && <p className="text-xs text-gray-400">{d.speciality}</p>}
                      </div>
                      {project.designer_id === d.id && <ChevronRight size={12} className="ml-auto text-indigo-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Créé le {new Date(project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: stages + form data */}
        <div className="space-y-5">

          {/* Stages */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 text-sm">Étapes du projet</h2>
              {stages.length > 0 && (
                <span className="text-xs text-gray-400">{Math.min(currentIdx, stages.length)}/{stages.length}</span>
              )}
            </div>

            {stages.length === 0 ? (
              <p className="text-xs text-gray-400">Aucune étape définie (prestation sans étapes).</p>
            ) : (
              <div className="space-y-3">
                {stages.map((stage, idx) => {
                  const isCurrent = idx === currentIdx;
                  const isDone = stage.completed;
                  const isFuture = idx > currentIdx;
                  const end = stageEndDate(stages, idx, startDate);

                  return (
                    <div key={stage.id ?? idx} className={`flex items-start gap-3 pb-3 ${idx < stages.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div className="shrink-0 mt-0.5">
                        {isDone ? (
                          <CheckCircle2 size={16} className="text-green-500" />
                        ) : isCurrent ? (
                          <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-gray-200" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isDone ? "text-green-700" : isCurrent ? "text-indigo-700" : "text-gray-400"}`}>
                          {stage.label}
                        </p>
                        <p className="text-xs text-gray-400">{stage.duration_days} jour{stage.duration_days !== 1 ? "s" : ""}</p>
                        {isDone && stage.completed_at && (
                          <p className="text-xs text-green-500">
                            Validé le {new Date(stage.completed_at).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                        {isCurrent && (
                          <p className="text-xs text-indigo-400">
                            Fin prévue : {end.toLocaleDateString("fr-FR")}
                          </p>
                        )}
                        {isFuture && (
                          <p className="text-xs text-gray-300">
                            À partir du {stageStartDate(stages, idx, startDate).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Advance button */}
            {stages.length > 0 && !allDone && (
              <button
                onClick={handleAdvanceStage}
                disabled={advancing}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {advancing ? (
                  <><Loader2 size={14} className="animate-spin" />Validation...</>
                ) : (
                  <><CheckCircle2 size={14} />Valider — {currentStage?.label}<ChevronRight size={14} /></>
                )}
              </button>
            )}
            {allDone && stages.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-green-600 text-sm font-medium">
                <CheckCircle2 size={15} />Projet terminé !
              </div>
            )}
          </div>

          {/* Form data */}
          {Object.keys(project.form_data ?? {}).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-4">Réponses du formulaire</h2>
              <div className="space-y-2.5">
                {Object.entries(project.form_data).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-xs text-gray-400 capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-sm text-gray-800 font-medium">
                      {Array.isArray(val) ? val.join(", ") : String(val || "—")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: tabs Messages / Fichiers */}
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: "600px" }}>
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button
              onClick={() => setRightTab("messages")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${rightTab === "messages" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <MessageSquare size={14} />Messages
            </button>
            <button
              onClick={() => setRightTab("fichiers")}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${rightTab === "fichiers" ? "border-indigo-500 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <Paperclip size={14} />
              Fichiers{files.length > 0 ? ` (${files.length})` : ""}
            </button>
          </div>

          {/* ── Messages ── */}
          {rightTab === "messages" && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {msgLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
                    <MessageSquare size={28} className="mb-2 opacity-30" />
                    <p>Aucun message pour l&apos;instant</p>
                    <p className="text-xs mt-1">Envoyez le premier message au client</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdmin = msg.sender_role === "admin";
                    return (
                      <div key={msg.id} className={`flex gap-3 ${isAdmin ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isAdmin ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-600"}`}>
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                        <div className={`flex flex-col max-w-xs ${isAdmin ? "items-end" : "items-start"}`}>
                          <span className="text-xs text-gray-400 mb-1">{msg.sender_name}</span>
                          <div className={`px-3 py-2 rounded-xl text-sm ${isAdmin ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                            {msg.content}
                          </div>
                          <span className="text-xs text-gray-400 mt-1">
                            {new Date(msg.created_at).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 flex gap-2 shrink-0">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Écrire un message au client..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  type="submit"
                  disabled={sending || !newMsg.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </form>
            </>
          )}

          {/* ── Fichiers ── */}
          {rightTab === "fichiers" && (
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {/* Add file form */}
              {showAddFile ? (
                <form onSubmit={handleAddFile} className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nom du fichier</label>
                      <input
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        placeholder="Ex : Maquette Figma"
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select
                        value={newFileType}
                        onChange={(e) => setNewFileType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        <option value="figma">🎨 Figma</option>
                        <option value="google_doc">📄 Google Doc</option>
                        <option value="image">🖼️ Image</option>
                        <option value="pdf">📕 PDF</option>
                        <option value="other">📎 Autre</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
                    <input
                      value={newFileUrl}
                      onChange={(e) => setNewFileUrl(e.target.value)}
                      placeholder="https://..."
                      type="url"
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={addingFile} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                      {addingFile ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      Ajouter
                    </button>
                    <button type="button" onClick={() => setShowAddFile(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddFile(true)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-indigo-300 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50 transition-colors w-full justify-center"
                >
                  <Plus size={14} />Ajouter un fichier
                </button>
              )}

              {/* Files list */}
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-gray-400">
                  <FolderOpen size={32} className="mb-3 opacity-40" />
                  <p className="text-sm">Aucun fichier partagé</p>
                  <p className="text-xs mt-1">Les fichiers ajoutés seront visibles par le client et le prestataire.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 group hover:border-indigo-200 hover:bg-indigo-50 transition-colors">
                      <span className="text-xl shrink-0">
                        {file.type === "figma" ? "🎨" : file.type === "google_doc" ? "📄" : file.type === "image" ? "🖼️" : file.type === "pdf" ? "📕" : "📎"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{new Date(file.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-indigo-500 transition-colors">
                        <ExternalLink size={14} />
                      </a>
                      <button onClick={() => handleDeleteFile(file.id)} className="text-gray-200 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
