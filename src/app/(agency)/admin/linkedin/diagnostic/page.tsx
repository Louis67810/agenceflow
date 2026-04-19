"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { linkedinFetch } from "@/lib/linkedin/fetchWithAuth";

type DiagnosticPayload = {
  ok: boolean;
  auth?: {
    ok: boolean;
    error?: string;
    user_id?: string;
    email?: string | null;
  };
  message?: string;
  prospection_ready?: boolean;
  statistics_ready?: boolean;
  sections?: Record<
    string,
    {
      ok: boolean;
      error?: string;
      details?: Record<string, unknown>;
    }
  >;
  error?: string;
};

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

export default function LinkedInDiagnosticPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosticPayload | null>(null);
  const [raw, setRaw] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await linkedinFetch("/api/linkedin/diagnostic", {
        cache: "no-store",
      });
      const json = (await res.json()) as DiagnosticPayload;
      setData(json);
      setRaw(JSON.stringify(json, null, 2));
    } catch (error) {
      const payload = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies DiagnosticPayload;
      setData(payload);
      setRaw(JSON.stringify(payload, null, 2));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div style={{ minHeight: "100%", background: "#fbfbfb", padding: 24, ...jk }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#121a2e" }}>Diagnostic LinkedIn</h1>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(18,26,46,0.48)", lineHeight: 1.5 }}>
                Cette page appelle l&apos;API avec le meme mecanisme d&apos;auth que l&apos;interface admin, donc elle montre un vrai etat exploitable.
              </p>
            </div>
            <button
              onClick={() => void load()}
              disabled={loading}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.1)",
                background: "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                color: "#121a2e",
                fontSize: 13,
                fontWeight: 600,
                opacity: loading ? 0.65 : 1,
              }}
            >
              <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
              Relancer le diagnostic
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <StatusCard
            label="Auth"
            ok={Boolean(data?.auth?.ok)}
            detail={data?.auth?.ok ? data?.auth?.email ?? data?.auth?.user_id ?? "OK" : data?.auth?.error ?? "Non authentifie"}
          />
          <StatusCard
            label="Prospection"
            ok={Boolean(data?.prospection_ready)}
            detail={data?.prospection_ready ? "Workspace + settings lisibles" : "Prospection non prete"}
          />
          <StatusCard
            label="Statistiques"
            ok={Boolean(data?.statistics_ready)}
            detail={data?.statistics_ready ? "Posts lisibles" : "Statistiques non pretes"}
          />
          <StatusCard
            label="Global"
            ok={Boolean(data?.ok)}
            detail={data?.ok ? "Tout est OK" : data?.message ?? data?.error ?? "Au moins une section echoue"}
          />
        </div>

        {data?.sections ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {Object.entries(data.sections).map(([key, section]) => (
              <div
                key={key}
                style={{
                  background: "#fff",
                  border: `1px solid ${section.ok ? "rgba(22,139,100,0.2)" : "rgba(197,48,48,0.2)"}`,
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  {section.ok ? <CheckCircle2 size={15} color="#168b64" /> : <AlertCircle size={15} color="#c53030" />}
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#121a2e", textTransform: "capitalize" }}>{key}</p>
                </div>
                {section.error ? (
                  <p style={{ margin: 0, fontSize: 12, color: "#c53030", lineHeight: 1.5 }}>{section.error}</p>
                ) : (
                  <pre
                    style={{
                      margin: 0,
                      fontSize: 11,
                      lineHeight: 1.55,
                      color: "rgba(18,26,46,0.72)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {JSON.stringify(section.details ?? {}, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ background: "#0f172a", borderRadius: 16, padding: 18 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#fff" }}>JSON brut</p>
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.6,
              color: "rgba(226,232,240,0.95)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {raw || (loading ? "Chargement..." : "Aucune reponse.")}
          </pre>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatusCard({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${ok ? "rgba(22,139,100,0.2)" : "rgba(197,48,48,0.2)"}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {ok ? <CheckCircle2 size={15} color="#168b64" /> : <AlertCircle size={15} color="#c53030" />}
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#121a2e" }}>{label}</p>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "rgba(18,26,46,0.55)", lineHeight: 1.5 }}>{detail}</p>
    </div>
  );
}
