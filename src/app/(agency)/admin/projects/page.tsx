"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Loader2, FolderOpen, ChevronRight } from "lucide-react";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  status: string;
  created_at: string;
  form_data: Record<string, unknown>;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_progress: "En cours",
  review: "En révision",
  completed: "Terminé",
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:     { bg: "#fee6d0", color: "#663b12" },
  in_progress: { bg: "#d5eeff", color: "#073e63" },
  review:      { bg: "#E1D1FA", color: "#6236AA" },
  completed:   { bg: "#d1fae5", color: "#168b64" },
};

export default function AdminProjectsPage() {
  const [projects, setProjects]         = useState<Project[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const r = await fetch("/api/projects");
      const d = await r.json();
      setProjects(d.projects ?? []);
    } catch { setProjects([]); }
    setLoading(false);
  }

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    return (p.name.toLowerCase().includes(q) || (p.client_name ?? "").toLowerCase().includes(q))
      && (statusFilter === "all" || p.status === statusFilter);
  });

  const filterStatuses = [
    { label: "Tous", value: "all" },
    { label: "En attente", value: "pending" },
    { label: "En cours", value: "in_progress" },
    { label: "En révision", value: "review" },
    { label: "Terminés", value: "completed" },
  ];

  return (
    <div style={{ padding: "28px 24px", background: "#fbfbfb", minHeight: "100vh", ...jakartaSans }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.45px", margin: 0 }}>Projets</h1>
          <p style={{ fontSize: 14, color: "rgba(18,26,46,0.45)", margin: "4px 0 0" }}>{projects.length} projet{projects.length !== 1 ? "s" : ""} au total</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(18,26,46,0.35)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Rechercher un projet ou client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 10, paddingBottom: 10, fontSize: 13, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, outline: "none", background: "#f7f7f9", color: "#121a2e", boxSizing: "border-box" as const }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
          {filterStatuses.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              style={{
                padding: "9px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                cursor: "pointer", letterSpacing: "-0.3px",
                background: statusFilter === f.value
                  ? "linear-gradient(121deg,rgb(78,126,250) 10%,rgb(1,71,255) 82%)"
                  : "#f7f7f9",
                color: statusFilter === f.value ? "#fff" : "rgba(18,26,46,0.55)",
                border: statusFilter === f.value ? "1px solid #2f4d9d" : "1px solid rgba(0,0,0,0.08)",
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <Loader2 size={28} style={{ color: "rgba(18,26,46,0.25)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.08)" }}>
          <FolderOpen size={40} style={{ color: "rgba(18,26,46,0.12)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(18,26,46,0.5)", margin: "0 0 4px" }}>
            {projects.length === 0 ? "Aucun projet pour l'instant" : "Aucun résultat"}
          </p>
          <p style={{ fontSize: 13, color: "rgba(18,26,46,0.35)" }}>
            {projects.length === 0 ? "Les projets sont créés automatiquement quand un client remplit son formulaire." : "Modifiez vos filtres."}
          </p>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.13)", borderRadius: 13, overflow: "hidden", boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#fbfbfb" }}>
                {["Projet", "Client", "Statut", "Créé le"].map(h => (
                  <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "rgba(18,26,46,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((project, i) => {
                const st = STATUS_STYLES[project.status] ?? { bg: "#f7f7f9", color: "rgba(18,26,46,0.5)" };
                return (
                  <tr key={project.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "14px 20px" }}>
                      <Link href={`/admin/projects/${project.id}`}
                        style={{ fontSize: 14, fontWeight: 600, color: "#121a2e", textDecoration: "none", letterSpacing: "-0.3px", display: "flex", alignItems: "center", gap: 4 }}>
                        {project.name}
                        <ChevronRight size={14} style={{ color: "rgba(18,26,46,0.25)" }} />
                      </Link>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <p style={{ fontSize: 13, color: "#121a2e", margin: 0 }}>{project.client_name ?? "—"}</p>
                      {project.client_email && <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: "2px 0 0" }}>{project.client_email}</p>}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: st.bg, color: st.color, letterSpacing: "-0.3px" }}>
                        {STATUS_LABELS[project.status] ?? project.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "rgba(18,26,46,0.4)" }}>
                      {new Date(project.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
