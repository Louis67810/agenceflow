"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  Loader2,
  ListFilter,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import type { AuditRequest, AuditRequestStatus } from "@/types/audit";

const jk: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };
const inputStyle: CSSProperties = {
  background: "#f6f6f6",
  border: "1px solid rgba(0,0,0,0.09)",
  borderRadius: 9,
  color: "#121a2e",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  fontSize: 13,
  outline: "none",
  padding: "8px 12px",
  width: "100%",
  boxSizing: "border-box",
};
const cardStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.09)",
  borderRadius: 13,
};
const primaryButton: CSSProperties = {
  alignItems: "center",
  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
  border: "1px solid #2f4d9d",
  borderRadius: 9,
  color: "#fff",
  cursor: "pointer",
  display: "flex",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  fontWeight: 600,
  gap: 6,
  justifyContent: "center",
};

const STATUS_LABELS: Record<AuditRequestStatus, string> = {
  pending: "A traiter",
  accepted: "Accepte",
  refused: "Refuse",
  audit_ready: "Envoye",
  sent: "Envoye",
};

const STATUS_STYLES: Record<AuditRequestStatus, { bg: string; color: string; dot: string }> = {
  pending: { bg: "#fee6d0", color: "#663b12", dot: "#f59e0b" },
  accepted: { bg: "#d5eeff", color: "#073e63", dot: "#0ea5e9" },
  refused: { bg: "#ffe4e4", color: "#c53030", dot: "#ef4444" },
  audit_ready: { bg: "#d1fae5", color: "#168b64", dot: "#22c55e" },
  sent: { bg: "#e8edff", color: "#0147ff", dot: "#0147ff" },
};

type AuditFilter = "all" | "pending" | "accepted" | "sent" | "refused";

const FILTERS: Array<{ key: AuditFilter; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "A traiter" },
  { key: "accepted", label: "Acceptes" },
  { key: "sent", label: "Envoyes" },
  { key: "refused", label: "Refuses" },
];

const STATUS_ORDER: Record<AuditRequestStatus, number> = {
  pending: 0,
  accepted: 1,
  audit_ready: 2,
  sent: 2,
  refused: 3,
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(value: string, long = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR", long
    ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function emptyStateText(status: AuditFilter) {
  if (status === "pending") return "Aucune demande a traiter.";
  if (status === "accepted") return "Aucune demande acceptee pour le moment.";
  if (status === "sent") return "Aucun audit envoye.";
  if (status === "refused") return "Aucune demande refusee.";
  return "Aucune demande d'audit recue.";
}

export default function AuditPage() {
  const [audits, setAudits] = useState<AuditRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<AuditFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [auditUrl, setAuditUrl] = useState("");
  const [auditSummary, setAuditSummary] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void loadAudits();
  }, []);

  const selected = audits.find((audit) => audit.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setAuditUrl(selected.audit_url ?? "");
    setAuditSummary(selected.audit_summary ?? "");
    setMessage(selected.whatsapp_message ?? "");
    setNotice("");
  }, [selected?.id]);

  async function loadAudits() {
    setLoading(true);
    try {
      const res = await fetch("/api/audits");
      const data = await res.json();
      setAudits(data.audits ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function patchAudit(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setNotice("");
    try {
      const res = await fetch(`/api/audits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur sauvegarde");
      setAudits((prev) => prev.map((audit) => audit.id === id ? data.audit : audit));
      return data.audit as AuditRequest;
    } catch (error) {
      setNotice(String(error));
      return null;
    } finally {
      setSavingId(null);
    }
  }

  async function decide(audit: AuditRequest, status: "accepted" | "refused") {
    const updated = await patchAudit(audit.id, { status, generateMessage: status === "accepted" });
    if (!updated) return;
    if (selectedId === audit.id) setMessage(updated.whatsapp_message ?? "");
    setNotice(status === "accepted" ? "Demande acceptee." : "Demande refusee.");
  }

  async function saveAuditReady() {
    if (!selected) return;
    const updated = await patchAudit(selected.id, {
      status: "audit_ready",
      auditUrl,
      auditSummary,
      generateMessage: true,
    });
    if (!updated) return;
    setMessage(updated.whatsapp_message ?? "");
    setNotice("Audit marque comme pret.");
  }

  async function sendWhatsapp() {
    if (!selected) return;
    setSending(true);
    setNotice("");
    try {
      const res = await fetch(`/api/audits/${selected.id}/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.setup || data.error || "Envoi WhatsApp impossible");
        return;
      }
      setAudits((prev) => prev.map((audit) => audit.id === selected.id ? data.audit : audit));
      setNotice("Message WhatsApp envoye.");
    } finally {
      setSending(false);
    }
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    setNotice("Message copie.");
  }

  const filteredAudits = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    return audits.filter((audit) => {
      if (filter === "sent" && !["sent", "audit_ready"].includes(audit.status)) return false;
      if (filter !== "all" && filter !== "sent" && audit.status !== filter) return false;
      if (!normalizedQuery) return true;
      return [
        audit.full_name,
        audit.email,
        audit.phone,
        audit.website_url,
        audit.business_description,
        STATUS_LABELS[audit.status],
      ].some((value) => normalizeSearch(value).includes(normalizedQuery));
    }).sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [audits, filter, query]);

  const pendingCount = audits.filter((audit) => audit.status === "pending").length;
  const acceptedCount = audits.filter((audit) => audit.status === "accepted").length;
  const readyCount = audits.filter((audit) => audit.status === "audit_ready").length;
  const sentCount = audits.filter((audit) => audit.status === "sent").length;

  const kpiCards = [
    { label: "Demandes", value: audits.length, icon: <MessageCircle size={16} />, bg: "#e8edff", color: "#0147ff" },
    { label: "A traiter", value: pendingCount, icon: <RefreshCw size={16} />, bg: "#fee6d0", color: "#663b12" },
    { label: "Acceptes", value: acceptedCount, icon: <Check size={16} />, bg: "#d5eeff", color: "#073e63" },
    { label: "Envoyes", value: sentCount + readyCount, icon: <Send size={16} />, bg: "#d1fae5", color: "#168b64" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#fbfbfb", ...jk }}>
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", flexShrink: 0, padding: "14px 24px" }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ color: "#121a2e", fontSize: 17, fontWeight: 700, letterSpacing: "-0.4px", margin: 0 }}>Audit</h1>
            <p style={{ color: "rgba(18,26,46,0.45)", fontSize: 12, marginBottom: 0, marginTop: 2 }}>
              Demandes recues et validation des audits site
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAudits()}
            style={{
              alignItems: "center",
              background: "#f6f6f6",
              border: "1px solid rgba(0,0,0,0.09)",
              borderRadius: 9,
              color: "rgba(18,26,46,0.55)",
              cursor: "pointer",
              display: "flex",
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: 12,
              gap: 5,
              padding: "7px 12px",
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Actualiser
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 20, overflowY: "auto", padding: 24 }}>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>
          {kpiCards.map((card) => (
            <div key={card.label} style={{ ...cardStyle, alignItems: "center", display: "flex", gap: 12, padding: 16 }}>
              <div style={{ alignItems: "center", background: card.bg, borderRadius: 10, color: card.color, display: "flex", justifyContent: "center", padding: 8 }}>
                {card.icon}
              </div>
              <div>
                <p style={{ color: "#121a2e", fontSize: 22, fontWeight: 700, margin: 0 }}>{card.value}</p>
                <p style={{ color: "rgba(18,26,46,0.45)", fontSize: 12, marginBottom: 0, marginTop: 1 }}>{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ alignItems: "center", display: "flex", gap: 12 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={13} style={{ color: "rgba(18,26,46,0.35)", left: 12, position: "absolute", top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher nom, email, telephone, site..."
              style={{ ...inputStyle, paddingLeft: 36, paddingRight: query ? 36 : 12 }}
              type="text"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                style={{ background: "none", border: "none", color: "rgba(18,26,46,0.4)", cursor: "pointer", display: "flex", position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setFilterOpen((open) => !open)}
              style={{
                alignItems: "center",
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 9,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                color: filter === "all" ? "rgba(18,26,46,0.55)" : "#0147ff",
                cursor: "pointer",
                display: "flex",
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                fontSize: 12,
                fontWeight: 600,
                gap: 6,
                height: 36,
                padding: "0 12px",
              }}
            >
              <ListFilter size={14} />
              {FILTERS.find((item) => item.key === filter)?.label ?? "Filtrer"}
            </button>
            {filterOpen && (
              <>
                <div style={{ inset: 0, position: "fixed", zIndex: 10 }} onClick={() => setFilterOpen(false)} />
                <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 11, boxShadow: "0px 8px 24px rgba(0,0,0,0.1)", minWidth: 168, padding: "4px 0", position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20 }}>
                  {FILTERS.map((item) => {
                    const active = filter === item.key;
                    const count = item.key === "all"
                      ? audits.length
                      : item.key === "sent"
                        ? audits.filter((audit) => ["sent", "audit_ready"].includes(audit.status)).length
                        : audits.filter((audit) => audit.status === item.key).length;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setFilter(item.key);
                          setFilterOpen(false);
                        }}
                        style={{ alignItems: "center", background: "none", border: "none", color: "#121a2e", cursor: "pointer", display: "flex", fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 12, fontWeight: active ? 700 : 400, gap: 8, padding: "8px 12px", textAlign: "left", width: "100%" }}
                      >
                        <span style={{ background: item.key === "all" ? "#8b8b8b" : STATUS_STYLES[item.key].dot, borderRadius: "50%", display: "inline-block", flexShrink: 0, height: 7, width: 7 }} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        <span style={{ color: "rgba(18,26,46,0.35)", fontSize: 11 }}>{count}</span>
                        {active && <Check size={11} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
          {(filter !== "all" || query) && (
            <button
              type="button"
              onClick={() => { setFilter("all"); setQuery(""); }}
              style={{ alignItems: "center", background: "none", border: "none", color: "rgba(18,26,46,0.5)", cursor: "pointer", display: "flex", fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 12, gap: 4 }}
            >
              <X size={13} />
              Reinitialiser
            </button>
          )}
          <p style={{ color: "rgba(18,26,46,0.4)", flexShrink: 0, fontSize: 12, margin: 0 }}>
            {filteredAudits.length} demande{filteredAudits.length > 1 ? "s" : ""}
          </p>
        </div>

        <div style={{ ...cardStyle, overflow: "hidden" }}>
          {loading ? (
            <div style={{ color: "rgba(18,26,46,0.4)", fontSize: 13, padding: "64px 0", textAlign: "center" }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite", marginRight: 6, verticalAlign: "text-bottom" }} />
              Chargement...
            </div>
          ) : filteredAudits.length === 0 ? (
            <div style={{ padding: "64px 0", textAlign: "center" }}>
              <MessageCircle size={32} style={{ color: "rgba(18,26,46,0.1)", margin: "0 auto 12px" }} />
              <p style={{ color: "rgba(18,26,46,0.5)", fontSize: 14, fontWeight: 500, margin: 0 }}>{emptyStateText(filter)}</p>
            </div>
          ) : (
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <thead>
                <tr style={{ background: "#f9f9f9", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  {["Contact", "Site", "CA", "Statut", "Date recue", ""].map((header) => (
                    <th key={header} style={{ color: "rgba(18,26,46,0.4)", fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", padding: "10px 16px", textAlign: header === "" ? "right" : "left", textTransform: "uppercase" }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAudits.map((audit) => (
                  <tr
                    key={audit.id}
                    onClick={() => setSelectedId(audit.id)}
                    style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", cursor: "pointer" }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <p style={{ color: "#121a2e", fontWeight: 600, margin: 0 }}>{audit.full_name}</p>
                      <p style={{ color: "rgba(18,26,46,0.45)", fontSize: 12, marginBottom: 0, marginTop: 2 }}>{audit.email}</p>
                      {audit.phone && <p style={{ color: "rgba(18,26,46,0.55)", fontSize: 12, marginBottom: 0, marginTop: 1 }}>{audit.phone}</p>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <a
                        href={audit.website_url}
                        onClick={(event) => event.stopPropagation()}
                        rel="noreferrer"
                        style={{ alignItems: "center", color: "#0147ff", display: "inline-flex", fontSize: 12, gap: 4, maxWidth: 260, overflow: "hidden", textDecoration: "none", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        target="_blank"
                      >
                        {audit.website_url}
                        <ExternalLink size={10} />
                      </a>
                    </td>
                    <td style={{ color: "rgba(18,26,46,0.62)", padding: "12px 16px" }}>
                      {audit.business_description || <span style={{ color: "rgba(18,26,46,0.28)", fontStyle: "italic" }}>Non renseigne</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusChip status={audit.status} />
                    </td>
                    <td style={{ color: "rgba(18,26,46,0.4)", fontSize: 12, padding: "12px 16px", whiteSpace: "nowrap" }}>
                      {formatDate(audit.created_at)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {audit.status === "pending" && (
                        <div style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "flex-end" }} onClick={(event) => event.stopPropagation()}>
                          <ActionCircle
                            disabled={savingId === audit.id}
                            icon={<Check size={14} />}
                            label="Accepter"
                            tone="green"
                            onClick={() => void decide(audit, "accepted")}
                          />
                          <ActionCircle
                            disabled={savingId === audit.id}
                            icon={<X size={14} />}
                            label="Refuser"
                            tone="red"
                            onClick={() => void decide(audit, "refused")}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <div
          onClick={() => setSelectedId(null)}
          style={{ alignItems: "flex-end", background: "rgba(0,0,0,0.5)", display: "flex", inset: 0, justifyContent: "center", padding: 16, position: "fixed", zIndex: 50 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ ...jk, background: "#fff", borderRadius: 16, boxShadow: "0px 20px 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", maxHeight: "92vh", maxWidth: 820, overflow: "hidden", width: "100%" }}
          >
            <div style={{ alignItems: "flex-start", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", padding: "20px 24px" }}>
              <div>
                <div style={{ alignItems: "center", display: "flex", gap: 8, marginBottom: 8 }}>
                  <StatusChip status={selected.status} />
                  <span style={{ color: "rgba(18,26,46,0.4)", fontSize: 12 }}>Recu le {formatDate(selected.created_at, true)}</span>
                </div>
                <h2 style={{ color: "#121a2e", fontSize: 18, fontWeight: 700, margin: 0 }}>{selected.full_name}</h2>
                <p style={{ color: "rgba(18,26,46,0.5)", fontSize: 13, marginBottom: 0, marginTop: 3 }}>{selected.email}</p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                style={{ background: "none", border: "none", color: "rgba(18,26,46,0.4)", cursor: "pointer", display: "flex" }}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gap: 24, gridTemplateColumns: "minmax(0,1fr) 320px", overflowY: "auto", padding: "18px 24px 22px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
                  <DetailItem label="Telephone" value={selected.phone || "Non renseigne"} />
                  <DetailItem label="Tranche de CA" value={selected.business_description || "Non renseigne"} />
                  <div style={{ gridColumn: "1 / -1" }}>
                    <DetailItem
                      label="Site"
                      value={selected.website_url}
                      href={selected.website_url}
                    />
                  </div>
                </div>

                {selected.status === "pending" && (
                  <div>
                    <p style={{ color: "rgba(18,26,46,0.5)", fontSize: 12, fontWeight: 500, margin: "0 0 8px" }}>Decision</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => void decide(selected, "accepted")}
                        disabled={savingId === selected.id}
                        style={{ ...primaryButton, background: "#d1fae5", border: "1px solid #9ee6c4", color: "#168b64", fontSize: 13, padding: "8px 14px", opacity: savingId === selected.id ? 0.6 : 1 }}
                      >
                        <Check size={13} />
                        Accepter
                      </button>
                      <button
                        type="button"
                        onClick={() => void decide(selected, "refused")}
                        disabled={savingId === selected.id}
                        style={{ alignItems: "center", background: "#ffe4e4", border: "1px solid #ffc7c7", borderRadius: 9, color: "#c53030", cursor: "pointer", display: "flex", fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 13, fontWeight: 600, gap: 6, padding: "8px 14px", opacity: savingId === selected.id ? 0.6 : 1 }}
                      >
                        <X size={13} />
                        Refuser
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 11, padding: 16 }}>
                  <p style={{ color: "#121a2e", fontSize: 13, fontWeight: 700, margin: 0 }}>Validation de l'audit</p>
                  <p style={{ color: "rgba(18,26,46,0.45)", fontSize: 12, lineHeight: 1.5, marginBottom: 14, marginTop: 4 }}>
                    Colle l'URL finale. Le code d'acces doit etre dans cette URL, pas dans le message WhatsApp.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <input
                      value={auditUrl}
                      onChange={(event) => setAuditUrl(event.target.value)}
                      placeholder="https://..."
                      style={{ ...inputStyle, background: "#fff" }}
                    />
                    <textarea
                      value={auditSummary}
                      onChange={(event) => setAuditSummary(event.target.value)}
                      placeholder="Notes internes ou resume rapide de l'audit..."
                      rows={4}
                      style={{ ...inputStyle, background: "#fff", lineHeight: 1.6, resize: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => void saveAuditReady()}
                      disabled={savingId === selected.id || !auditUrl.trim()}
                      style={{ ...primaryButton, fontSize: 13, opacity: savingId === selected.id || !auditUrl.trim() ? 0.5 : 1, padding: "9px 14px" }}
                    >
                      {savingId === selected.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Clipboard size={13} />}
                      Valider l'audit
                    </button>
                  </div>
                </div>

                {Object.keys(selected.raw_answers ?? {}).length > 0 && (
                  <div>
                    <p style={{ color: "rgba(18,26,46,0.5)", fontSize: 12, fontWeight: 500, margin: "0 0 8px" }}>Infos recues</p>
                    <div style={{ background: "#f6f6f6", borderRadius: 9, color: "rgba(18,26,46,0.6)", fontSize: 12, maxHeight: 132, overflowY: "auto", padding: 12 }}>
                      {Object.entries(selected.raw_answers).map(([key, value]) => (
                        <div key={key} style={{ display: "flex", gap: 8, marginBottom: 3 }}>
                          <span style={{ color: "rgba(18,26,46,0.35)", flexShrink: 0 }}>{key}:</span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <aside style={{ borderLeft: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: 12, paddingLeft: 24 }}>
                <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
                  <div style={{ alignItems: "center", background: "#d1fae5", borderRadius: 10, color: "#168b64", display: "flex", justifyContent: "center", padding: 8 }}>
                    <MessageCircle size={16} />
                  </div>
                  <div>
                    <p style={{ color: "#121a2e", fontSize: 13, fontWeight: 700, margin: 0 }}>WhatsApp</p>
                    <p style={{ color: "rgba(18,26,46,0.45)", fontSize: 12, margin: 0 }}>Message modifiable</p>
                  </div>
                </div>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Accepte la demande ou valide l'audit pour generer le message."
                  rows={11}
                  style={{ ...inputStyle, lineHeight: 1.6, resize: "none" }}
                />
                <button
                  type="button"
                  onClick={() => void sendWhatsapp()}
                  disabled={sending || !message.trim() || !selected.phone.trim()}
                  style={{ ...primaryButton, background: "#168b64", border: "1px solid #0f7654", fontSize: 13, opacity: sending || !message.trim() || !selected.phone.trim() ? 0.5 : 1, padding: "9px 14px" }}
                >
                  {sending ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
                  Envoyer
                </button>
                <button
                  type="button"
                  onClick={() => void copyMessage()}
                  disabled={!message.trim()}
                  style={{ alignItems: "center", background: "#f6f6f6", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 9, color: "rgba(18,26,46,0.6)", cursor: "pointer", display: "flex", fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 13, fontWeight: 600, gap: 6, justifyContent: "center", opacity: !message.trim() ? 0.5 : 1, padding: "9px 14px" }}
                >
                  <Clipboard size={13} />
                  Copier
                </button>
                {notice && (
                  <p style={{ background: "#f6f6f6", borderRadius: 9, color: "rgba(18,26,46,0.6)", fontSize: 12, lineHeight: 1.5, margin: 0, padding: 10 }}>
                    {notice}
                  </p>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StatusChip({ status }: { status: AuditRequestStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span style={{ alignItems: "center", background: style.bg, borderRadius: 20, color: style.color, display: "inline-flex", fontSize: 11, fontWeight: 600, gap: 5, padding: "3px 8px" }}>
      <span style={{ background: style.dot, borderRadius: "50%", display: "inline-block", height: 6, width: 6 }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function ActionCircle({
  disabled,
  icon,
  label,
  onClick,
  tone,
}: {
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone: "green" | "red";
}) {
  const isGreen = tone === "green";
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
      style={{
        alignItems: "center",
        background: isGreen ? "rgba(22,139,100,0.12)" : "rgba(197,48,48,0.12)",
        border: isGreen ? "1px solid rgba(22,139,100,0.16)" : "1px solid rgba(197,48,48,0.16)",
        borderRadius: "50%",
        color: isGreen ? "#168b64" : "#c53030",
        cursor: "pointer",
        display: "flex",
        height: 30,
        justifyContent: "center",
        opacity: disabled ? 0.5 : 1,
        width: 30,
      }}
    >
      {icon}
    </button>
  );
}

function DetailItem({ href, label, value }: { href?: string; label: string; value: string }) {
  return (
    <div>
      <p style={{ color: "rgba(18,26,46,0.4)", fontSize: 11, margin: "0 0 3px" }}>{label}</p>
      {href ? (
        <a href={href} rel="noreferrer" style={{ alignItems: "center", color: "#0147ff", display: "inline-flex", fontSize: 13, gap: 4, textDecoration: "none" }} target="_blank">
          {value}
          <ExternalLink size={10} />
        </a>
      ) : (
        <p style={{ color: "#121a2e", fontSize: 13, margin: 0 }}>{value}</p>
      )}
    </div>
  );
}
