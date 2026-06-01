"use client";

import { useState, useEffect } from "react";
import {
  Search, UserCheck, Clock, ChevronRight, X, Loader2, Key, ExternalLink, AlertCircle,
} from "lucide-react";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

interface FormField { id: string; label: string }
interface AccessKey {
  id: string; key: string; name: string; role: "client" | "designer";
  form_fields: FormField[]; used_at: string | null;
  form_data?: Record<string, string>; created_at: string;
}

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  client:   { bg: "#d5eeff", color: "#073e63" },
  designer: { bg: "#E1D1FA", color: "#6236AA" },
};

export default function ClientsPage() {
  const [keys, setKeys]         = useState<AccessKey[]>([]);
  const [loading, setLoading]   = useState(true);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all" | "connected" | "pending">("all");
  const [selected, setSelected] = useState<AccessKey | null>(null);

  useEffect(() => {
    fetch("/api/keys")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? `Erreur API /api/keys (${r.status})`);
        setKeys(d.keys ?? []);
      })
      .catch((error) => {
        setKeys([]);
        setKeysError(error instanceof Error ? error.message : "Erreur de chargement des clients.");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = keys.filter((k) => {
    const matchSearch = k.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "connected" ? !!k.used_at : !k.used_at);
    return matchSearch && matchFilter;
  });

  const connectedCount = keys.filter((k) => k.used_at).length;

  const filterOptions = [
    { id: "all" as const, label: "Tous" },
    { id: "connected" as const, label: "Connectés" },
    { id: "pending" as const, label: "En attente" },
  ];

  return (
    <div style={{ padding: "28px 24px", background: "#fbfbfb", minHeight: "100vh", ...jakartaSans }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.45px", margin: 0 }}>Clients</h1>
          <p style={{ fontSize: 14, color: "rgba(18,26,46,0.45)", margin: "4px 0 0" }}>
            {connectedCount} connecté{connectedCount !== 1 ? "s" : ""} · {keys.length - connectedCount} en attente
          </p>
        </div>
        <a
          href="/admin/settings"
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", background: "linear-gradient(121deg,rgb(78,126,250) 10%,rgb(1,71,255) 82%)", color: "#fff", border: "1px solid #2f4d9d", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.3px", boxShadow: "inset 0px -2px 0px #0e42c8, 0px 4px 10px rgba(1,71,255,0.15)" }}
        >
          <Key size={14} />
          Créer une invitation
        </a>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" as const }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(18,26,46,0.35)", pointerEvents: "none" }} />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 10, paddingBottom: 10, fontSize: 13, border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, outline: "none", background: "#f7f7f9", color: "#121a2e", boxSizing: "border-box" as const }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {filterOptions.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "9px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                cursor: "pointer", letterSpacing: "-0.3px",
                background: filter === f.id
                  ? "linear-gradient(121deg,rgb(78,126,250) 10%,rgb(1,71,255) 82%)"
                  : "#f7f7f9",
                color: filter === f.id ? "#fff" : "rgba(18,26,46,0.55)",
                border: filter === f.id ? "1px solid #2f4d9d" : "1px solid rgba(0,0,0,0.08)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <Loader2 size={28} style={{ color: "rgba(18,26,46,0.25)", animation: "spin 1s linear infinite" }} />
        </div>
      ) : keysError ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 16, background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 13, color: "#b91c1c", fontSize: 13 }}>
          <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <div>
            <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Erreur de chargement des clients</p>
            <p style={{ margin: 0 }}>{keysError}</p>
          </div>
        </div>
      ) : keys.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.08)" }}>
          <Key size={36} style={{ color: "rgba(18,26,46,0.12)", margin: "0 auto 12px", display: "block" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(18,26,46,0.5)", margin: "0 0 4px" }}>Aucun client pour l&apos;instant</p>
          <p style={{ fontSize: 13, color: "rgba(18,26,46,0.35)", margin: "0 0 20px" }}>Créez une clé d&apos;accès dans Paramètres pour inviter votre premier client.</p>
          <a href="/admin/settings" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "linear-gradient(121deg,rgb(78,126,250) 10%,rgb(1,71,255) 82%)", color: "#fff", border: "1px solid #2f4d9d", borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.3px" }}>
            <ExternalLink size={13} />Aller dans Paramètres
          </a>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", background: "#fff", borderRadius: 13, border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, color: "rgba(18,26,46,0.4)" }}>
          Aucun résultat pour cette recherche.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.13)", borderRadius: 13, overflow: "hidden", boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#fbfbfb" }}>
                {["Nom", "Type", "Statut", "Date", ""].map((h, i) => (
                  <th key={i} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "rgba(18,26,46,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((k, i) => {
                const roleStyle = ROLE_STYLES[k.role] ?? { bg: "#f7f7f9", color: "rgba(18,26,46,0.5)" };
                return (
                  <tr key={k.id}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: roleStyle.bg, color: roleStyle.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {k.name.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#121a2e", letterSpacing: "-0.3px" }}>{k.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: roleStyle.bg, color: roleStyle.color, letterSpacing: "-0.3px" }}>
                        {k.role === "client" ? "Client" : "Prestataire"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      {k.used_at ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 7, background: "#d1fae5", color: "#168b64", width: "fit-content" }}>
                          <UserCheck size={12} />
                          Connecté le {new Date(k.used_at).toLocaleDateString("fr-FR")}
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(18,26,46,0.4)" }}>
                          <Clock size={12} />En attente
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, color: "rgba(18,26,46,0.4)" }}>
                      Invité le {new Date(k.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      {k.used_at && k.form_data && (
                        <button
                          onClick={() => setSelected(k)}
                          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#0147ff", background: "none", border: "none", cursor: "pointer", marginLeft: "auto", letterSpacing: "-0.3px" }}
                        >
                          Voir fiche <ChevronRight size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over: form data */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex" }}>
          <div style={{ flex: 1, background: "rgba(0,0,0,0.3)" }} onClick={() => setSelected(null)} />
          <div style={{ width: "100%", maxWidth: 440, background: "#fff", boxShadow: "-4px 0 32px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", ...jakartaSans }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>{selected.name}</h2>
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)", margin: "3px 0 0" }}>
                  Connecté le {new Date(selected.used_at!).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "#f7f7f9", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(18,26,46,0.5)" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {selected.form_fields.map((field) => (
                <div key={field.id}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(18,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>{field.label}</p>
                  <p style={{ fontSize: 13, color: "#121a2e", background: "#f7f7f9", borderRadius: 9, padding: "10px 14px", margin: 0, whiteSpace: "pre-wrap", border: "1px solid rgba(0,0,0,0.06)" }}>
                    {selected.form_data?.[field.id] || <span style={{ color: "rgba(18,26,46,0.25)", fontStyle: "italic" }}>Non renseigné</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
