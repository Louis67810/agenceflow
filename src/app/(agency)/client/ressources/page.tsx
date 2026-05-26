"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, ExternalLink, FolderOpen, Upload, X } from "lucide-react";

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  form_data: Record<string, unknown>;
}

interface ProjectFile {
  id: string;
  name: string;
  url: string;
  type: string;
  created_at: string;
}

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

// Icônes de marque — data URIs SVG propres
const GDOCS_ICON  = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 18 22' fill='none'%3E%3Cpath fill='%234285F4' d='M2 0h10l6 6v14a2 2 0 01-2 2H2a2 2 0 01-2-2V2a2 2 0 012-2z'/%3E%3Cpath fill='%231565C0' d='M12 0l6 6h-6V0z'/%3E%3Crect fill='white' x='3' y='9' width='12' height='1.8' rx='.9'/%3E%3Crect fill='white' x='3' y='12.5' width='12' height='1.8' rx='.9'/%3E%3Crect fill='white' x='3' y='16' width='7' height='1.8' rx='.9'/%3E%3C/svg%3E";
const FIGMA_ICON  = "data:image/svg+xml,%3Csvg width='15' height='23' viewBox='0 0 15 23' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 18.3594C0 16.3315 1.61774 14.6875 3.61328 14.6875H7.22656V18.3594C7.22656 20.3873 5.60882 22.0312 3.61328 22.0312C1.61774 22.0312 0 20.3873 0 18.3594Z' fill='%2324CB71'/%3E%3Cpath d='M7.22656 0V7.34375H10.8398C12.8354 7.34375 14.4531 5.69978 14.4531 3.67187C14.4531 1.64397 12.8354 0 10.8398 0H7.22656Z' fill='%23FF7237'/%3E%3Cpath d='M10.8096 14.6875C12.8051 14.6875 14.4229 13.0435 14.4229 11.0156C14.4229 8.9877 12.8051 7.34375 10.8096 7.34375C8.81401 7.34375 7.19629 8.9877 7.19629 11.0156C7.19629 13.0435 8.81401 14.6875 10.8096 14.6875Z' fill='%2300B6FF'/%3E%3Cpath d='M0 3.67187C0 5.69978 1.61774 7.34375 3.61328 7.34375H7.22656V0H3.61328C1.61774 0 0 1.64397 0 3.67187Z' fill='%23FF3737'/%3E%3Cpath d='M0 11.0156C0 13.0435 1.61774 14.6875 3.61328 14.6875H7.22656V7.34375H3.61328C1.61774 7.34375 0 8.98772 0 11.0156Z' fill='%23874FFF'/%3E%3C/svg%3E";
const FRAMER_ICON = "data:image/svg+xml,%3Csvg width='14' height='21' viewBox='0 0 14 21' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0H13.7614V6.88044H6.88071L0 0ZM0 6.88044H6.88071L13.7614 13.7612H0V6.88044ZM0 13.7612H6.88071V20.6419L0 13.7612Z' fill='black'/%3E%3C/svg%3E";

export default function ClientRessourcesPage() {
  const [project, setProject]       = useState<Project | null>(null);
  const [files, setFiles]           = useState<ProjectFile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [clientName, setClientName] = useState("Moi");
  const [tab, setTab]               = useState<"brief" | "fichiers">("brief");
  const [uploading, setUploading]   = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const fr = await fetch(`/api/files?project_id=${proj.id}`);
      const fd = await fr.json();
      setFiles(fd.files ?? []);
      setLoading(false);
    }
    init();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!project || !e.target.files?.length) return;
    setUploading(true);
    const uploaded: ProjectFile[] = [];

    for (const file of Array.from(e.target.files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("project_id", project.id);

      const r = await fetch("/api/files/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok && d.file) uploaded.push(d.file);
    }

    setFiles((prev) => [...uploaded, ...prev]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(fileId: string) {
    await fetch("/api/files", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: fileId }),
    });
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  if (loading) return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} style={{ color: "#121a2e", animation: "spin 1s linear infinite" }} />
      </div>
    </div>
  );

  const googleDocsUrl = (project?.form_data?.google_docs_url ?? project?.form_data?.docs_url ?? "") as string;
  const figmaUrl      = (project?.form_data?.figma_url ?? "") as string;
  const framerUrl     = (project?.form_data?.framer_url ?? "") as string;

  const toolCards = [
    { label: "Projet Google Docs", icon: GDOCS_ICON,  url: googleDocsUrl },
    { label: "Projet Figma",       icon: FIGMA_ICON,  url: figmaUrl      },
    { label: "Projet Framer",      icon: FRAMER_ICON, url: framerUrl     },
  ];

  const briefEntries = project?.form_data
    ? Object.entries(project.form_data).filter(
        ([k]) => !k.startsWith("_") && !["google_docs_url","figma_url","framer_url","docs_url"].includes(k)
      )
    : [];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "40px 24px 0" }}>
          <h1 style={{
            ...jakartaSans,
            fontSize: 32, fontWeight: 600,
            letterSpacing: "-0.45px", lineHeight: "28px",
            color: "#121a2e", margin: 0,
          }}>
            Mes ressources
          </h1>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "24px 24px 0" }} />

        {!project ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <FolderOpen size={40} style={{ color: "rgba(18,26,46,0.2)" }} />
            <p style={{ fontSize: 16, color: "rgba(18,26,46,0.5)" }}>Aucun projet en cours</p>
          </div>
        ) : (
          <div style={{ padding: "20px 24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* 3 tool cards */}
            <div style={{ display: "flex", gap: 16 }}>
              {toolCards.map((card) => (
                <div key={card.label} style={{
                  flex: 1,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.13)",
                  borderRadius: 13,
                  overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
                }}>
                  {/* Preview area */}
                  <div style={{
                    flex: 1,
                    background: "#f5f5f5",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                    minHeight: 150,
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: 8,
                  }}>
                    <img src={card.icon} alt="" style={{ width: 36, height: 36, objectFit: "contain", opacity: 0.2 }} />
                    {!card.url && (
                      <span style={{
                        fontSize: 12, fontWeight: 500,
                        color: "rgba(18,26,46,0.35)",
                        letterSpacing: "-0.3px",
                        padding: "4px 10px",
                        background: "rgba(0,0,0,0.04)",
                        borderRadius: 6,
                      }}>
                        En attente de création
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 40, height: 40,
                        background: "#f7f7f7",
                        borderRadius: 8,
                        overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <img src={card.icon} alt="" style={{ width: 24, height: 24, objectFit: "contain" }} />
                      </div>
                      <span style={{
                        ...jakartaSans,
                        fontSize: 14, fontWeight: 600,
                        letterSpacing: "-0.45px",
                        color: card.url ? "#121a2e" : "rgba(18,26,46,0.4)",
                      }}>
                        {card.label}
                      </span>
                    </div>
                    {card.url ? (
                      <a href={card.url} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "9px 13px",
                          background: "#fff",
                          border: "1px solid rgba(0,0,0,0.08)",
                          borderRadius: 9,
                          fontSize: 13, fontWeight: 500,
                          color: "#121a2e", textDecoration: "none",
                          boxShadow: "0px 2px 4px rgba(0,0,0,0.04)",
                        }}>
                        <ExternalLink size={11} /> Ouvrir
                      </a>
                    ) : (
                      <span style={{
                        padding: "9px 13px",
                        border: "1px solid rgba(0,0,0,0.06)",
                        borderRadius: 9,
                        fontSize: 13, color: "rgba(18,26,46,0.25)",
                      }}>
                        Ouvrir
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Brief / Fichiers */}
            <div style={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.13)",
              borderRadius: 13,
              overflow: "hidden",
              boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
              marginBottom: 8,
            }}>
              {/* Tab bar + upload button */}
              <div style={{
                background: "#fbfbfb",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                padding: "10px 12px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["brief", "fichiers"] as const).map((t) => (
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

                {/* Upload button */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip"
                    onChange={handleUpload}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "9px 14px",
                      background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                      border: "1px solid #2f4d9d",
                      borderRadius: 9,
                      fontSize: 13, fontWeight: 500,
                      color: "#fff", cursor: uploading ? "not-allowed" : "pointer",
                      opacity: uploading ? 0.7 : 1,
                      boxShadow: "inset 0px -2px 0px #0e42c8, 0px 3px 8px rgba(1,71,255,0.2)",
                    }}>
                    {uploading
                      ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                      : <Upload size={13} />}
                    {uploading ? "Envoi..." : "Ajouter un fichier"}
                  </button>
                </div>
              </div>

              <div>
                {tab === "brief" && (
                  briefEntries.length === 0 ? (
                    <div style={{ padding: "20px" }}>
                      <p style={{ fontSize: 14, color: "rgba(18,26,46,0.4)" }}>Aucun brief disponible pour l&apos;instant.</p>
                    </div>
                  ) : (
                    briefEntries.map(([k, v], i) => (
                      <div key={k}>
                        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            letterSpacing: "0.05em", textTransform: "uppercase" as const,
                            color: "rgba(18,26,46,0.38)",
                          }}>
                            {k.replace(/_/g, " ")}
                          </span>
                          <span style={{ fontSize: 15, color: "#121a2e", lineHeight: "1.55", letterSpacing: "-0.3px" }}>
                            {String(v)}
                          </span>
                        </div>
                        {i < briefEntries.length - 1 && (
                          <div style={{ height: 1, background: "rgba(0,0,0,0.04)", margin: "0 20px" }} />
                        )}
                      </div>
                    ))
                  )
                )}

                {tab === "fichiers" && (
                  files.length === 0 ? (
                    <div style={{ padding: "32px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <FolderOpen size={32} style={{ color: "rgba(18,26,46,0.15)" }} />
                      <p style={{ fontSize: 14, color: "rgba(18,26,46,0.4)", textAlign: "center" }}>
                        Aucun fichier pour l&apos;instant.<br />
                        <span style={{ fontSize: 13, color: "rgba(18,26,46,0.3)" }}>Cliquez sur « Ajouter un fichier » pour en déposer un.</span>
                      </p>
                    </div>
                  ) : (
                    files.map((f, i) => {
                      const isMedia = f.type.startsWith("image") || f.type.startsWith("video");
                      return (
                        <div key={f.id}>
                          <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              {isMedia ? (
                                <div style={{
                                  width: 44, height: 44, borderRadius: 8, overflow: "hidden",
                                  background: "#f5f5f5", flexShrink: 0,
                                }}>
                                  <img src={f.url} alt={f.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                              ) : (
                                <div style={{
                                  width: 44, height: 44, borderRadius: 8,
                                  background: "#f5f5f5", flexShrink: 0,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(18,26,46,0.35)", textTransform: "uppercase" as const }}>
                                    {f.type.split("/").pop()?.slice(0, 3) ?? "FIL"}
                                  </span>
                                </div>
                              )}
                              <div>
                                <span style={{ display: "block", fontSize: 14, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>{f.name}</span>
                                <span style={{ display: "block", fontSize: 12, color: "rgba(18,26,46,0.45)", marginTop: 2 }}>{f.type}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <a href={f.url} target="_blank" rel="noopener noreferrer"
                                style={{
                                  display: "flex", alignItems: "center", gap: 5,
                                  padding: "9px 13px",
                                  background: "#fff",
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  borderRadius: 9,
                                  fontSize: 13, fontWeight: 500,
                                  color: "#121a2e", textDecoration: "none",
                                  boxShadow: "0px 2px 4px rgba(0,0,0,0.04)",
                                }}>
                                <ExternalLink size={11} /> Ouvrir
                              </a>
                              <button
                                onClick={() => handleDelete(f.id)}
                                style={{
                                  width: 32, height: 32,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  background: "#fff",
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  color: "rgba(18,26,46,0.4)",
                                }}>
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                          {i < files.length - 1 && (
                            <div style={{ height: 1, background: "rgba(0,0,0,0.04)", margin: "0 20px" }} />
                          )}
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
