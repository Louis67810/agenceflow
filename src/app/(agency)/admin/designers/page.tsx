"use client";

import { useState, useEffect } from "react";
import {
  Plus, Search, Mail, FolderKanban, X, Check, ArrowLeft,
  Loader2, Trash2, Pen, Code2, AlertCircle,
} from "lucide-react";

interface Designer {
  id: string;
  name: string;
  email: string | null;
  speciality: string | null;
  role: "designer" | "developer";
  bio: string | null;
  hourly_rate: number | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  designer_id: string | null;
}

const roleColor = (role: string) =>
  role === "designer" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700";
const roleLabel = (role: string) =>
  role === "designer" ? "Designer" : "Développeur";
const roleIcon = (role: string) =>
  role === "designer" ? <Pen size={10} /> : <Code2 size={10} />;

export default function AdminDesignersPage() {
  const [designers, setDesigners]         = useState<Designer[]>([]);
  const [projects, setProjects]           = useState<Project[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [filterRole, setFilterRole]       = useState<"all" | "designer" | "developer">("all");
  const [selectedProfile, setSelectedProfile] = useState<Designer | null>(null);
  const [assignModal, setAssignModal]     = useState<Designer | null>(null);
  const [assigning, setAssigning]         = useState(false);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState({ name: "", email: "", speciality: "", role: "designer" as "designer" | "developer", bio: "", hourly_rate: "" });
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [dr, pr] = await Promise.all([
      fetch("/api/designers").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]);
    setDesigners(dr.designers ?? []);
    setProjects(pr.projects ?? []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const r = await fetch("/api/designers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      }),
    });
    const d = await r.json();
    if (!r.ok) { setCreateError(d.error ?? "Erreur"); setCreating(false); return; }
    setShowCreate(false);
    setForm({ name: "", email: "", speciality: "", role: "designer", bio: "", hourly_rate: "" });
    loadAll();
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce prestataire ?")) return;
    await fetch(`/api/designers/${id}`, { method: "DELETE" });
    loadAll();
  }

  async function handleAssign(designer: Designer, projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    const alreadyAssigned = project.designer_id === designer.id;
    setAssigning(true);
    await fetch(`/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designer_id: alreadyAssigned ? null : designer.id }),
    });
    await loadAll();
    setAssigning(false);
  }

  const filtered = designers.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch = d.name.toLowerCase().includes(q) || (d.speciality ?? "").toLowerCase().includes(q);
    const matchRole = filterRole === "all" || d.role === filterRole;
    return matchSearch && matchRole;
  });

  const designerProjects = (d: Designer) => projects.filter((p) => p.designer_id === d.id);

  return (
    <div className="p-8">
      {/* Profile slide-over */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelectedProfile(null)} />
          <div className="w-[420px] bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
              <button onClick={() => setSelectedProfile(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <ArrowLeft size={16} className="text-gray-500" />
              </button>
              <h2 className="font-semibold text-gray-900">Profil prestataire</h2>
            </div>
            <div className="p-6 flex-1 space-y-6">
              {/* Identity */}
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 ${selectedProfile.role === "designer" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                  {selectedProfile.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedProfile.name}</h3>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleColor(selectedProfile.role)}`}>
                    {roleIcon(selectedProfile.role)}{roleLabel(selectedProfile.role)}
                  </span>
                  {selectedProfile.speciality && <p className="text-sm text-gray-500 mt-1">{selectedProfile.speciality}</p>}
                  {selectedProfile.email && <div className="flex items-center gap-1 mt-1 text-xs text-gray-400"><Mail size={11} />{selectedProfile.email}</div>}
                  {selectedProfile.hourly_rate && <p className="text-xs text-gray-400 mt-0.5">{selectedProfile.hourly_rate} €/h</p>}
                </div>
              </div>

              {selectedProfile.bio && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Bio</p>
                  <p className="text-sm text-gray-700">{selectedProfile.bio}</p>
                </div>
              )}

              {/* Assigned projects */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Projets assignés ({designerProjects(selectedProfile).length})
                </p>
                {designerProjects(selectedProfile).length === 0 ? (
                  <p className="text-sm text-gray-400">Aucun projet assigné</p>
                ) : (
                  <div className="space-y-2">
                    {designerProjects(selectedProfile).map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                        <FolderKanban size={14} className="text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{p.name}</p>
                          {p.client_name && <p className="text-xs text-gray-400">{p.client_name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 space-y-2">
              <button
                onClick={() => { setAssignModal(selectedProfile); setSelectedProfile(null); }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                <FolderKanban size={15} />Assigner à un projet
              </button>
              <button
                onClick={() => { handleDelete(selectedProfile.id); setSelectedProfile(null); }}
                className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-500 py-2 rounded-lg text-sm hover:bg-red-50"
              >
                <Trash2 size={14} />Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setAssignModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">Assigner à un projet</h3>
                <p className="text-xs text-gray-500 mt-0.5">{assignModal.name}</p>
              </div>
              <button onClick={() => setAssignModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucun projet disponible</p>
              ) : projects.map((project) => {
                const isAssigned = project.designer_id === assignModal.id;
                return (
                  <button
                    key={project.id}
                    onClick={() => handleAssign(assignModal, project.id)}
                    disabled={assigning}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${isAssigned ? "border-indigo-300 bg-indigo-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-3">
                      <FolderKanban size={15} className={isAssigned ? "text-indigo-500" : "text-gray-400"} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{project.name}</p>
                        {project.client_name && <p className="text-xs text-gray-500">{project.client_name}</p>}
                      </div>
                    </div>
                    {isAssigned && <Check size={15} className="text-indigo-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button onClick={() => setAssignModal(null)} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prestataires</h1>
          <p className="text-gray-500 mt-1">{designers.length} prestataire{designers.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus size={15} />Ajouter un prestataire
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Nouveau prestataire</h3>
          {createError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle size={14} className="text-red-500 mt-0.5" />
              <p className="text-sm text-red-700">{createError}</p>
            </div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Prénom Nom" required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="email@exemple.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Spécialité</label>
                <input value={form.speciality} onChange={(e) => setForm((p) => ({ ...p, speciality: e.target.value }))} placeholder="Ex : UI/UX Design, Next.js..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as "designer" | "developer" }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  <option value="designer">Designer</option>
                  <option value="developer">Développeur</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Taux horaire (€)</label>
                <input type="number" value={form.hourly_rate} onChange={(e) => setForm((p) => ({ ...p, hourly_rate: e.target.value }))} placeholder="Ex : 65" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <input value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} placeholder="Courte description..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={creating} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                {creating ? <><Loader2 size={14} className="animate-spin" />Création...</> : <><Check size={14} />Ajouter</>}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        {(["all", "designer", "developer"] as const).map((r) => (
          <button key={r} onClick={() => setFilterRole(r)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${filterRole === r ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
            {r === "all" ? "Tous" : r === "designer" ? "Designers" : "Développeurs"}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 font-medium">Aucun prestataire</p>
          <p className="text-gray-400 text-sm mt-1">Ajoutez votre premier prestataire.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((d) => {
            const activeProjects = designerProjects(d);
            return (
              <div
                key={d.id}
                onClick={() => setSelectedProfile(d)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${d.role === "designer" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"}`}>
                    {d.name.charAt(0)}
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleColor(d.role)}`}>
                    {roleIcon(d.role)}{roleLabel(d.role)}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{d.name}</h3>
                {d.speciality && <p className="text-sm text-gray-500 mt-0.5">{d.speciality}</p>}
                {d.email && <div className="flex items-center gap-1 mt-1 text-xs text-gray-400"><Mail size={11} />{d.email}</div>}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <FolderKanban size={12} />
                    {activeProjects.length} projet{activeProjects.length !== 1 ? "s" : ""}
                  </div>
                  {d.hourly_rate && <span className="text-xs text-gray-400">{d.hourly_rate} €/h</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
