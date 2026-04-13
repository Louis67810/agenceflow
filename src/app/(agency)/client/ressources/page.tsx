"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, ExternalLink, FolderOpen } from "lucide-react";
import { AgencySidebar } from "@/components/agency/AgencySidebar";

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

const FIGMA_LOGO  = "https://www.figma.com/api/mcp/asset/b4e5daec-6971-417b-af37-6027f6a670ac";
const GDOCS_LOGO  = "https://www.figma.com/api/mcp/asset/5e6372b4-16fb-4b2a-ac9c-f7812ea0f33b";
const FRAMER_LOGO = "https://www.figma.com/api/mcp/asset/79058a24-e856-492e-8390-f8c869d50e7c";

export default function ClientRessourcesPage() {
  const [project, setProject]   = useState<Project | null>(null);
  const [files, setFiles]       = useState<ProjectFile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [clientName, setClientName] = useState("Moi");
  const [tab, setTab]           = useState<"brief" | "fichiers">("brief");

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

  if (loading) return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />
      <div style={{ marginLeft: 256, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} style={{ color: "#121a2e", animation: "spin 1s linear infinite" }} />
      </div>
    </div>
  );

  const googleDocsUrl = (project?.form_data?.google_docs_url ?? project?.form_data?.docs_url ?? "") as string;
  const figmaUrl      = (project?.form_data?.figma_url ?? "") as string;
  const framerUrl     = (project?.form_data?.framer_url ?? "") as string;

  const toolCards = [
    { label: "Projet Google Docs", icon: GDOCS_LOGO,  url: googleDocsUrl },
    { label: "Projet Figma",       icon: FIGMA_LOGO,  url: figmaUrl      },
    { label: "Projet Framer",      icon: FRAMER_LOGO, url: framerUrl     },
  ];

  const briefEntries = project?.form_data
    ? Object.entries(project.form_data).filter(
        ([k]) => !k.startsWith("_") && !["google_docs_url","figma_url","framer_url","docs_url"].includes(k)
      )
    : [];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />

      <div style={{ marginLeft: 256, flex: 1, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ padding: "68px 32px 0" }}>
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
        <div style={{ height: 1, background: "rgba(0,0,0,0.07)", margin: "24px 32px 0" }} />

        {!project ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <FolderOpen size={40} style={{ color: "rgba(18,26,46,0.2)" }} />
            <p style={{ fontSize: 16, color: "rgba(18,26,46,0.5)" }}>Aucun projet en cours</p>
          </div>
        ) : (
          <div style={{ padding: "20px 32px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* 3 tool cards */}
            <div style={{ display: "flex", gap: 16 }}>
              {toolCards.map((card) => (
                <div key={card.label} style={{
                  flex: 1,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.18)",
                  borderRadius: 13,
                  overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
                  opacity: !card.url ? 0.45 : 1,
                }}>
                  {/* Preview */}
                  <div style={{
                    flex: 1,
                    background: "#f5f5f5",
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                    minHeight: 160,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <img src={card.icon} alt="" style={{ width: 52, height: 52, objectFit: "contain", opacity: 0.25 }} />
                  </div>

                  {/* Footer */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 44, height: 44,
                        background: "#f7f7f7",
                        borderRadius: 8,
                        overflow: "hidden",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <img src={card.icon} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
                      </div>
                      <span style={{
                        ...jakartaSans,
                        fontSize: 15, fontWeight: 600,
                        letterSpacing: "-0.45px",
                        color: "#121a2e",
                      }}>
                        {card.label}
                      </span>
                    </div>
                    {card.url ? (
                      <a href={card.url} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "10px 14px",
                          background: "#fff",
                          border: "1px solid rgba(0,0,0,0.08)",
                          borderRadius: 10,
                          fontSize: 13, fontWeight: 500,
                          color: "#121a2e", textDecoration: "none",
                          boxShadow: "0px 2px 4px rgba(0,0,0,0.04)",
                        }}>
                        <ExternalLink size={12} /> Ouvrir
                      </a>
                    ) : (
                      <span style={{
                        padding: "10px 14px",
                        border: "1px solid rgba(0,0,0,0.06)",
                        borderRadius: 10,
                        fontSize: 13, color: "rgba(18,26,46,0.3)",
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
              border: "1px solid rgba(0,0,0,0.18)",
              borderRadius: 13,
              overflow: "hidden",
              boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
              marginBottom: 8,
            }}>
              <div style={{
                background: "#fbfbfb",
                borderBottom: "1px solid rgba(0,0,0,0.05)",
                padding: "12px 13px",
                display: "flex", gap: 4,
              }}>
                {(["brief", "fichiers"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{
                      padding: "11px 13px",
                      background: tab === t ? "#fff" : "transparent",
                      border: tab === t ? "1px solid rgba(158,158,158,0.17)" : "1px solid transparent",
                      borderRadius: 10,
                      fontSize: 14, fontWeight: 600,
                      letterSpacing: "-0.45px",
                      color: tab === t ? "#121a2e" : "rgba(18,26,46,0.45)",
                      cursor: "pointer",
                      boxShadow: tab === t ? "0px 4px 4px rgba(0,0,0,0.02), 0px 1px 2px rgba(0,0,0,0.03)" : "none",
                    }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
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
                            fontSize: 13, fontWeight: 600,
                            letterSpacing: "0.03em", textTransform: "uppercase" as const,
                            color: "rgba(18,26,46,0.4)",
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
                    <div style={{ padding: "20px" }}>
                      <p style={{ fontSize: 14, color: "rgba(18,26,46,0.4)" }}>Aucun fichier partagé pour l&apos;instant.</p>
                    </div>
                  ) : (
                    files.map((f, i) => (
                      <div key={f.id}>
                        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.45px", color: "#121a2e" }}>{f.name}</span>
                            <span style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", letterSpacing: "-0.45px" }}>{f.type}</span>
                          </div>
                          <a href={f.url} target="_blank" rel="noopener noreferrer"
                            style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "10px 14px",
                              background: "#fff",
                              border: "1px solid rgba(0,0,0,0.08)",
                              borderRadius: 10,
                              fontSize: 13, fontWeight: 500,
                              color: "#121a2e", textDecoration: "none",
                              boxShadow: "0px 2px 4px rgba(0,0,0,0.04)",
                            }}>
                            <ExternalLink size={12} /> Ouvrir
                          </a>
                        </div>
                        {i < files.length - 1 && (
                          <div style={{ height: 1, background: "rgba(0,0,0,0.04)", margin: "0 20px" }} />
                        )}
                      </div>
                    ))
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
