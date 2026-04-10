"use client";

import { useState, useEffect } from "react";
import { Plus, ExternalLink, Pencil, Trash2, Copy, Check, Users, Zap, PauseCircle, FileText } from "lucide-react";
import Link from "next/link";

interface LeadMagnet {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  resource_url: string;
  timer_minutes: number | null;
  status: "draft" | "active" | "paused";
  created_at: string;
  lead_magnet_leads?: [{ count: number }];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const STATUS_STYLES = {
  active: "bg-green-100 text-green-700",
  draft: "bg-gray-100 text-gray-600",
  paused: "bg-amber-100 text-amber-700",
};
const STATUS_LABELS = { active: "Actif", draft: "Brouillon", paused: "Pausé" };

export default function LeadMagnetListPage() {
  const [magnets, setMagnets] = useState<LeadMagnet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createUrl, setCreateUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const siteUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL || "";

  useEffect(() => {
    fetchMagnets();
  }, []);

  async function fetchMagnets() {
    setLoading(true);
    try {
      const res = await fetch("/api/lead-magnet");
      const data = await res.json();
      setMagnets(data.magnets ?? []);
    } catch {}
    setLoading(false);
  }

  async function handleCreate() {
    if (!createTitle.trim() || !createSlug.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/lead-magnet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle,
          slug: createSlug,
          resourceUrl: createUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "Erreur création");
        return;
      }
      window.location.href = `/admin/lead-magnet/${data.magnet.id}`;
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/lead-magnet/${id}`, { method: "DELETE" });
    setMagnets((prev) => prev.filter((m) => m.id !== id));
    setDeleteId(null);
  }

  function copyPublicUrl(slug: string) {
    navigator.clipboard.writeText(`${siteUrl}/lm/${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  const totalLeads = magnets.reduce(
    (s, m) => s + (m.lead_magnet_leads?.[0]?.count ?? 0),
    0
  );
  const activeCount = magnets.filter((m) => m.status === "active").length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Lead Magnets</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {magnets.length} lead magnet{magnets.length > 1 ? "s" : ""} · {totalLeads} leads collectés · {activeCount} actifs
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} />
            Nouveau Lead Magnet
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
            Chargement...
          </div>
        ) : magnets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Zap size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">Aucun lead magnet</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              Créez votre premier lead magnet et commencez à collecter des leads
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              <Plus size={16} />
              Créer un lead magnet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {magnets.map((magnet) => {
              const leadsCount = magnet.lead_magnet_leads?.[0]?.count ?? 0;
              return (
                <div
                  key={magnet.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
                >
                  {/* Image preview */}
                  {magnet.image_url ? (
                    <div className="h-36 overflow-hidden bg-gray-100">
                      <img
                        src={magnet.image_url}
                        alt={magnet.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                      <FileText size={32} className="text-gray-300" />
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">
                          {magnet.title}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          /lm/{magnet.slug}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_STYLES[magnet.status]}`}
                      >
                        {STATUS_LABELS[magnet.status]}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 py-2 border-t border-b border-gray-50 my-2">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Users size={12} />
                        <span className="font-medium text-gray-900">{leadsCount}</span> leads
                      </div>
                      {magnet.timer_minutes && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <span>⏱ {magnet.timer_minutes} min</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 mt-2">
                      <Link
                        href={`/admin/lead-magnet/${magnet.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Pencil size={12} />
                        Éditer
                      </Link>
                      <button
                        onClick={() => copyPublicUrl(magnet.slug)}
                        className="flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Copier l'URL publique"
                      >
                        {copiedSlug === magnet.slug ? (
                          <Check size={12} className="text-green-500" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                      {magnet.status === "active" && (
                        <a
                          href={`/lm/${magnet.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center text-xs py-1.5 px-3 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                          title="Voir la page publique"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button
                        onClick={() => setDeleteId(magnet.id)}
                        className="flex items-center justify-center text-xs py-1.5 px-3 border border-gray-200 text-gray-300 rounded-lg hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add card */}
            <button
              onClick={() => setShowCreate(true)}
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors min-h-[240px]"
            >
              <Plus size={24} />
              <span className="text-sm font-medium">Nouveau lead magnet</span>
            </button>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 text-lg">Nouveau lead magnet</h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateTitle("");
                  setCreateSlug("");
                  setCreateUrl("");
                  setCreateError("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Titre du lead magnet *
                </label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => {
                    setCreateTitle(e.target.value);
                    setCreateSlug(slugify(e.target.value));
                  }}
                  placeholder="Ex: 100 Hooks LinkedIn pour 10k abonnés"
                  autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Slug (URL publique) *
                </label>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-gray-900/20 focus-within:border-gray-900">
                  <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 shrink-0">
                    /lm/
                  </span>
                  <input
                    type="text"
                    value={createSlug}
                    onChange={(e) => setCreateSlug(slugify(e.target.value))}
                    placeholder="mon-lead-magnet"
                    className="flex-1 px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  URL de la ressource
                </label>
                <input
                  type="url"
                  value={createUrl}
                  onChange={(e) => setCreateUrl(e.target.value)}
                  placeholder="https://exemple.com/ressource ou lien vidéo..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
                />
              </div>
              {createError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createTitle.trim() || !createSlug.trim()}
                className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {creating ? "Création..." : "Créer et configurer →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Supprimer ce lead magnet ?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tous les leads collectés seront également supprimés. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
