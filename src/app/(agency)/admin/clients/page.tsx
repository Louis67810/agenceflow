"use client";

import { useState, useEffect } from "react";
import {
  Search, UserCheck, Clock, ChevronRight, X, Loader2, Key, ExternalLink,
} from "lucide-react";

interface FormField { id: string; label: string }
interface AccessKey {
  id: string; key: string; name: string; role: "client" | "designer";
  form_fields: FormField[]; used_at: string | null;
  form_data?: Record<string, string>; created_at: string;
}

export default function ClientsPage() {
  const [keys, setKeys]         = useState<AccessKey[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all" | "connected" | "pending">("all");
  const [selected, setSelected] = useState<AccessKey | null>(null);

  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((d) => { setKeys(d.keys ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = keys.filter((k) => {
    const matchSearch = k.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "connected" ? !!k.used_at : !k.used_at);
    return matchSearch && matchFilter;
  });

  const connectedCount = keys.filter((k) => k.used_at).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">
            {connectedCount} connecté{connectedCount !== 1 ? "s" : ""} · {keys.length - connectedCount} en attente
          </p>
        </div>
        <a
          href="/admin/settings"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Key size={15} />
          Créer une invitation
        </a>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([["all", "Tous"], ["connected", "Connectés"], ["pending", "En attente"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-gray-400" size={28} />
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <Key size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium mb-1">Aucun client pour l&apos;instant</p>
          <p className="text-gray-400 text-sm mb-5">Créez une clé d&apos;accès dans Paramètres pour inviter votre premier client.</p>
          <a href="/admin/settings" className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            <ExternalLink size={14} />Aller dans Paramètres
          </a>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">Aucun résultat pour cette recherche.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((k) => (
                <tr key={k.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${k.role === "client" ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}`}>
                        {k.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{k.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${k.role === "client" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                      {k.role === "client" ? "Client" : "Prestataire"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {k.used_at ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                        <UserCheck size={13} />
                        Connecté le {new Date(k.used_at).toLocaleDateString("fr-FR")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Clock size={13} />En attente
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-400">
                    Invité le {new Date(k.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {k.used_at && k.form_data && (
                      <button
                        onClick={() => setSelected(k)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium ml-auto"
                      >
                        Voir fiche <ChevronRight size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over: form data */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          <div className="w-full max-w-md bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">{selected.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Connecté le {new Date(selected.used_at!).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {selected.form_fields.map((field) => (
                <div key={field.id}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{field.label}</p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2.5 whitespace-pre-wrap">
                    {selected.form_data?.[field.id] || <span className="text-gray-300 italic">Non renseigné</span>}
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
