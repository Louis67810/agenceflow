"use client";

import { useState, useEffect } from "react";
import {
  Plus, Search, Mail, FolderKanban, X, Check, ArrowLeft,
  Loader2, Trash2, Pen, Code2, AlertCircle,
} from "lucide-react";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

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

const roleStyle = (role: string) =>
  role === "designer"
    ? { background: "#E1D1FA", color: "#6236AA" }
    : { background: "#d5eeff", color: "#073e63" };
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

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]             = useState({ name: "", email: "", speciality: "", role: "designer" as "designer" | "developer", bio: "", hourly_rate: "" });
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => { loadAll(); }, []);

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
      body: JSON.stringify({ ...form, hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null }),
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

  const cardStyle = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.13)",
    borderRadius: 13,
    boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px",
    border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10,
    fontSize: 13, background: "#f6f6f6", color: "#121a2e",
    outline: "none", boxSizing: "border-box" as const,
    fontFamily: '"Plus Jakarta Sans", sans-serif',
  };

  return (
    <div style={{ padding: 32, background: "#fbfbfb", minHeight: "100vh", ...jakartaSans }}>
      {/* Profile slide-over */}
      {selectedProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.3)" }} onClick={() => setSelectedProfile(null)} />
          <div style={{ width: 420, background: "#fff", height: "100%", overflowY: "auto", boxShadow: "0 0 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 24px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <button onClick={() => setSelectedProfile(null)} style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(18,26,46,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArrowLeft size={15} style={{ color: "rgba(18,26,46,0.5)" }} />
              </button>
              <h2 style={{ fontWeight: 700, color: "#121a2e", margin: 0, fontSize: 15, letterSpacing: "-0.3px" }}>Profil prestataire</h2>
            </div>
            <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, flexShrink: 0, ...roleStyle(selectedProfile.role) }}>
                  {selectedProfile.name.charAt(0)}
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: "#121a2e", margin: "0 0 4px", letterSpacing: "-0.3px" }}>{selectedProfile.name}</h3>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, ...roleStyle(selectedProfile.role) }}>
                    {roleIcon(selectedProfile.role)}{roleLabel(selectedProfile.role)}
                  </span>
                  {selectedProfile.speciality && <p style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", margin: "6px 0 0" }}>{selectedProfile.speciality}</p>}
                  {selectedProfile.email && <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 12, color: "rgba(18,26,46,0.4)" }}><Mail size={11} />{selectedProfile.email}</div>}
                  {selectedProfile.hourly_rate && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: "2px 0 0" }}>{selectedProfile.hourly_rate} €/h</p>}
                </div>
              </div>

              {selectedProfile.bio && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(18,26,46,0.38)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>Bio</p>
                  <p style={{ fontSize: 13, color: "#121a2e", lineHeight: "1.6", margin: 0 }}>{selectedProfile.bio}</p>
                </div>
              )}

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(18,26,46,0.38)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                  Projets assignés ({designerProjects(selectedProfile).length})
                </p>
                {designerProjects(selectedProfile).length === 0 ? (
                  <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)" }}>Aucun projet assigné</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {designerProjects(selectedProfile).map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, border: "1px solid rgba(0,0,0,0.07)", background: "#f9f9fb" }}>
                        <FolderKanban size={14} style={{ color: "rgba(18,26,46,0.35)" }} />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#121a2e", margin: 0 }}>{p.name}</p>
                          {p.client_name && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: "1px 0 0" }}>{p.client_name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => { setAssignModal(selectedProfile); setSelectedProfile(null); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                  color: "#fff", border: "1px solid #2f4d9d",
                  boxShadow: "inset 0px -2px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.2)",
                }}
              >
                <FolderKanban size={14} />Assigner à un projet
              </button>
              <button
                onClick={() => { handleDelete(selectedProfile.id); setSelectedProfile(null); }}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px", borderRadius: 10, fontSize: 13, cursor: "pointer", background: "#fff", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}
              >
                <Trash2 size={13} />Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign modal */}
      {assignModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} onClick={() => setAssignModal(null)} />
          <div style={{ position: "relative", background: "#fff", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.15)", width: "100%", maxWidth: 440, margin: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <div>
                <h3 style={{ fontWeight: 700, color: "#121a2e", margin: 0, fontSize: 15, letterSpacing: "-0.3px" }}>Assigner à un projet</h3>
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", margin: "2px 0 0" }}>{assignModal.name}</p>
              </div>
              <button onClick={() => setAssignModal(null)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(18,26,46,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} style={{ color: "rgba(18,26,46,0.5)" }} />
              </button>
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {projects.length === 0 ? (
                <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)", textAlign: "center", padding: 16 }}>Aucun projet disponible</p>
              ) : projects.map((project) => {
                const isAssigned = project.designer_id === assignModal.id;
                return (
                  <button
                    key={project.id}
                    onClick={() => handleAssign(assignModal, project.id)}
                    disabled={assigning}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 10,
                      border: isAssigned ? "1px solid rgba(1,71,255,0.2)" : "1px solid rgba(0,0,0,0.08)",
                      background: isAssigned ? "#e8edff" : "#fff", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <FolderKanban size={14} style={{ color: isAssigned ? "#0147ff" : "rgba(18,26,46,0.35)" }} />
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#121a2e", margin: 0 }}>{project.name}</p>
                        {project.client_name && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", margin: "1px 0 0" }}>{project.client_name}</p>}
                      </div>
                    </div>
                    {isAssigned && <Check size={14} style={{ color: "#0147ff", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
            <div style={{ padding: 16, borderTop: "1px solid rgba(0,0,0,0.07)" }}>
              <button onClick={() => setAssignModal(null)} style={{
                width: "100%", padding: "12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                color: "#fff", border: "1px solid #2f4d9d",
              }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.45px" }}>Prestataires</h1>
          <p style={{ color: "rgba(18,26,46,0.5)", margin: "4px 0 0", fontSize: 14 }}>{designers.length} prestataire{designers.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 10,
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
            color: "#fff", border: "1px solid #2f4d9d",
            boxShadow: "inset 0px -2px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.2)",
            letterSpacing: "-0.3px",
          }}
        >
          <Plus size={15} />Ajouter un prestataire
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ ...cardStyle, padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontWeight: 700, color: "#121a2e", margin: "0 0 16px", fontSize: 15, letterSpacing: "-0.3px" }}>Nouveau prestataire</h3>
          {createError && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 12, background: "#fef2f2", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, marginBottom: 16 }}>
              <AlertCircle size={13} style={{ color: "#ef4444", marginTop: 1 }} />
              <p style={{ fontSize: 13, color: "#b91c1c", margin: 0 }}>{createError}</p>
            </div>
          )}
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              {[
                { label: "Nom *", key: "name", placeholder: "Prénom Nom", type: "text", required: true },
                { label: "Email", key: "email", placeholder: "email@exemple.com", type: "email", required: false },
                { label: "Spécialité", key: "speciality", placeholder: "Ex : UI/UX Design, Next.js...", type: "text", required: false },
                { label: "Taux horaire (€)", key: "hourly_rate", placeholder: "Ex : 65", type: "number", required: false },
                { label: "Bio", key: "bio", placeholder: "Courte description...", type: "text", required: false },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", marginBottom: 6, letterSpacing: "-0.2px" }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={(e) => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    required={f.required}
                    style={inputStyle}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", marginBottom: 6, letterSpacing: "-0.2px" }}>Rôle</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm(p => ({ ...p, role: e.target.value as "designer" | "developer" }))}
                  style={inputStyle}
                >
                  <option value="designer">Designer</option>
                  <option value="developer">Développeur</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="submit" disabled={creating} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10,
                fontSize: 13, fontWeight: 600, cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1,
                background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                color: "#fff", border: "1px solid #2f4d9d",
              }}>
                {creating ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Création...</> : <><Check size={13} />Ajouter</>}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} style={{ padding: "10px 18px", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, fontSize: 13, color: "rgba(18,26,46,0.6)", background: "#fff", cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(18,26,46,0.35)" }} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 38 }}
          />
        </div>
        {(["all", "designer", "developer"] as const).map((r) => (
          <button key={r} onClick={() => setFilterRole(r)} style={{
            padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: filterRole === r ? "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)" : "#fff",
            color: filterRole === r ? "#fff" : "rgba(18,26,46,0.6)",
            border: filterRole === r ? "1px solid #2f4d9d" : "1px solid rgba(0,0,0,0.1)",
          }}>
            {r === "all" ? "Tous" : r === "designer" ? "Designers" : "Développeurs"}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Loader2 size={28} style={{ color: "rgba(18,26,46,0.2)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...cardStyle, padding: 60, textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(18,26,46,0.5)", margin: "0 0 4px" }}>Aucun prestataire</p>
          <p style={{ fontSize: 13, color: "rgba(18,26,46,0.35)", margin: 0 }}>Ajoutez votre premier prestataire.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {filtered.map((d) => {
            const activeProjects = designerProjects(d);
            const rs = roleStyle(d.role);
            return (
              <div
                key={d.id}
                onClick={() => setSelectedProfile(d)}
                style={{ ...cardStyle, padding: 20, cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, ...rs }}>
                    {d.name.charAt(0)}
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, ...rs }}>
                    {roleIcon(d.role)}{roleLabel(d.role)}
                  </span>
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#121a2e", margin: "0 0 2px", letterSpacing: "-0.3px" }}>{d.name}</h3>
                {d.speciality && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", margin: "0 0 2px" }}>{d.speciality}</p>}
                {d.email && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(18,26,46,0.4)" }}><Mail size={11} />{d.email}</div>}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(18,26,46,0.5)" }}>
                    <FolderKanban size={12} />
                    {activeProjects.length} projet{activeProjects.length !== 1 ? "s" : ""}
                  </div>
                  {d.hourly_rate && <span style={{ fontSize: 12, color: "rgba(18,26,46,0.4)" }}>{d.hourly_rate} €/h</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
