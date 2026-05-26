"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import type { AuditRequest, AuditRequestStatus } from "@/types/audit";

const STATUS_LABELS: Record<AuditRequestStatus, string> = {
  pending: "A traiter",
  accepted: "Accepte",
  refused: "Refuse",
  audit_ready: "Audit pret",
  sent: "Envoye",
};

const STATUS_STYLES: Record<AuditRequestStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-100",
  accepted: "bg-blue-50 text-blue-700 border-blue-100",
  refused: "bg-gray-100 text-gray-600 border-gray-200",
  audit_ready: "bg-emerald-50 text-emerald-700 border-emerald-100",
  sent: "bg-indigo-50 text-indigo-700 border-indigo-100",
};

const FILTERS: Array<{ key: "all" | AuditRequestStatus; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "A traiter" },
  { key: "accepted", label: "Acceptes" },
  { key: "audit_ready", label: "Prets" },
  { key: "sent", label: "Envoyes" },
  { key: "refused", label: "Refuses" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emptyStateText(status: "all" | AuditRequestStatus) {
  if (status === "pending") return "Aucune demande a traiter.";
  if (status === "accepted") return "Aucune demande acceptee pour le moment.";
  if (status === "audit_ready") return "Aucun audit pret a envoyer.";
  if (status === "sent") return "Aucun audit envoye.";
  if (status === "refused") return "Aucune demande refusee.";
  return "Aucune demande d'audit recue.";
}

export default function AuditPage() {
  const [audits, setAudits] = useState<AuditRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"all" | AuditRequestStatus>("pending");
  const [query, setQuery] = useState("");
  const [auditUrl, setAuditUrl] = useState("");
  const [auditSummary, setAuditSummary] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void loadAudits();
  }, []);

  const selected = audits.find((audit) => audit.id === selectedId) ?? audits[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
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
      const next = data.audits ?? [];
      setAudits(next);
      setSelectedId((current) => current ?? next[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function patchAudit(id: string, body: Record<string, unknown>) {
    setSaving(true);
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
      setSaving(false);
    }
  }

  async function decide(status: "accepted" | "refused") {
    if (!selected) return;
    const updated = await patchAudit(selected.id, { status, generateMessage: status === "accepted" });
    if (updated) {
      setMessage(updated.whatsapp_message ?? "");
      setNotice(status === "accepted" ? "Demande acceptee, code cree." : "Demande refusee, code cree.");
    }
  }

  async function saveAuditReady() {
    if (!selected) return;
    const updated = await patchAudit(selected.id, {
      status: "audit_ready",
      auditUrl,
      auditSummary,
      generateMessage: true,
    });
    if (updated) {
      setMessage(updated.whatsapp_message ?? "");
      setNotice("Audit marque comme pret.");
    }
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
    const normalizedQuery = query.trim().toLowerCase();
    return audits.filter((audit) => {
      if (filter !== "all" && audit.status !== filter) return false;
      if (!normalizedQuery) return true;
      return [
        audit.full_name,
        audit.email,
        audit.phone,
        audit.website_url,
        audit.business_domain,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [audits, filter, query]);

  const pendingCount = audits.filter((audit) => audit.status === "pending").length;
  const readyCount = audits.filter((audit) => audit.status === "audit_ready").length;

  return (
    <div className="audit-page min-h-screen bg-[#f6f7fb] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold leading-tight text-gray-950">Audit</h1>
            <p className="mt-1 text-sm text-gray-500">
              {audits.length} demandes · {pendingCount} a traiter · {readyCount} prets a envoyer
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAudits()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        </header>

        <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Nom, email, telephone, site..."
                  className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none transition-colors focus:border-blue-300 focus:bg-white"
                />
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      filter === item.key
                        ? "border-gray-950 bg-gray-950 text-white"
                        : "border-gray-200 bg-white text-gray-500"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[640px] overflow-y-auto p-3">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-sm text-gray-400">
                  <Loader2 className="mr-2 animate-spin" size={16} />
                  Chargement...
                </div>
              ) : filteredAudits.length === 0 ? (
                <div className="flex h-40 items-center justify-center px-8 text-center text-sm text-gray-400">
                  {emptyStateText(filter)}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredAudits.map((audit) => (
                    <button
                      key={audit.id}
                      type="button"
                      onClick={() => setSelectedId(audit.id)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        selected?.id === audit.id
                          ? "border-blue-200 bg-blue-50"
                          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-gray-950">{audit.full_name}</p>
                          <p className="mt-0.5 truncate text-xs text-gray-500">{audit.website_url}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[audit.status]}`}>
                          {STATUS_LABELS[audit.status]}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                        <span className="truncate">{audit.business_domain || audit.email}</span>
                        <span>{formatDate(audit.created_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <main className="min-h-[560px] rounded-2xl border border-gray-200 bg-white shadow-sm">
            {!selected ? (
              <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-center text-sm text-gray-400">
                Selectionne une demande d'audit.
              </div>
            ) : (
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[selected.status]}`}>
                          {STATUS_LABELS[selected.status]}
                        </span>
                        {selected.access_key && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            <KeyRound size={12} />
                            {selected.access_key}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-gray-950">{selected.full_name}</h2>
                      <p className="mt-1 text-sm text-gray-500">{selected.email} · {selected.phone || "Telephone non renseigne"}</p>
                    </div>
                    <a
                      href={selected.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 no-underline hover:bg-gray-50"
                    >
                      Voir le site
                      <ExternalLink size={15} />
                    </a>
                  </div>

                  <div className="grid gap-4 py-5 md:grid-cols-3">
                    <InfoBlock label="Domaine" value={selected.business_domain || "Non renseigne"} />
                    <InfoBlock label="Business" value={selected.business_description || "Non renseigne"} />
                    <InfoBlock label="Question" value={selected.main_question || "Non renseignee"} />
                  </div>

                  <div className="grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void decide("accepted")}
                      disabled={saving}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
                    >
                      <Check size={17} />
                      Accepter l'audit
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide("refused")}
                      disabled={saving}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                    >
                      <X size={17} />
                      Refuser
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="text-sm font-bold text-gray-950">Audit final</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Colle ici l'URL de l'audit quand il est cree. Le template WhatsApp sera regenere avec le code d'acces.
                    </p>
                    <div className="mt-4 grid gap-3">
                      <input
                        value={auditUrl}
                        onChange={(event) => setAuditUrl(event.target.value)}
                        placeholder="https://..."
                        className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
                      />
                      <textarea
                        value={auditSummary}
                        onChange={(event) => setAuditSummary(event.target.value)}
                        rows={4}
                        placeholder="Notes internes ou resume rapide de l'audit..."
                        className="resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-blue-300"
                      />
                      <button
                        type="button"
                        onClick={() => void saveAuditReady()}
                        disabled={saving || !auditUrl.trim()}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Clipboard size={16} />}
                        Valider l'audit cree
                      </button>
                    </div>
                  </div>
                </div>

                <aside className="border-t border-gray-100 bg-gray-50 p-4 lg:border-l lg:border-t-0 sm:p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-green-100 text-green-700">
                      <MessageCircle size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-950">Message WhatsApp</h3>
                      <p className="text-xs text-gray-500">Template modifiable avant envoi</p>
                    </div>
                  </div>

                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={13}
                    placeholder="Accepte la demande ou valide l'audit pour generer le message."
                    className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm leading-6 outline-none focus:border-green-300"
                  />

                  <div className="mt-3 grid gap-2">
                    <button
                      type="button"
                      onClick={() => void sendWhatsapp()}
                      disabled={sending || !message.trim() || !selected.phone.trim()}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                      Envoyer via WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyMessage()}
                      disabled={!message.trim()}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
                    >
                      <Clipboard size={16} />
                      Copier le message
                    </button>
                  </div>

                  {notice && (
                    <p className="mt-3 rounded-xl border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-600">
                      {notice}
                    </p>
                  )}
                </aside>
              </div>
            )}
          </main>
        </section>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-gray-800">{value}</p>
    </div>
  );
}

