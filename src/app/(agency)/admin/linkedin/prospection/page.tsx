"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  X,
  ExternalLink,
  TrendingUp,
  MessageSquare,
  ThumbsUp,
  Eye,
} from "lucide-react";
import {
  LinkedInProspect,
  ACTION_LABELS,
  PROSPECT_STATUS_LABELS,
  PROSPECT_STATUS_COLORS,
} from "@/types/linkedin";
import { loadLinkedInSettings } from "../layout";

const ACTION_OPTIONS: { value: LinkedInProspect["actionType"]; label: string; icon: React.ReactNode }[] = [
  { value: "liked", label: "A liké votre post", icon: <ThumbsUp size={14} /> },
  { value: "commented", label: "A commenté votre post", icon: <MessageSquare size={14} /> },
  { value: "visited_profile", label: "A visité votre profil", icon: <Eye size={14} /> },
];

const STATUS_FLOW: LinkedInProspect["status"][] = [
  "draft", "sent", "accepted", "replied", "conversation", "deal_closed",
];

const STATUS_VARIANTS: LinkedInProspect["status"][] = [
  "draft", "sent", "accepted", "rejected", "replied", "conversation", "deal_closed", "deal_lost",
];

function getConversionRate(prospects: LinkedInProspect[]): string {
  const sent = prospects.filter((p) => p.status !== "draft").length;
  if (sent === 0) return "—";
  const positive = prospects.filter((p) =>
    ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)
  ).length;
  return `${Math.round((positive / sent) * 100)}%`;
}

export default function LinkedInProspectionPage() {
  const [prospects, setProspects] = useState<LinkedInProspect[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [language, setLanguage] = useState<"fr" | "en">("fr");

  // Form state
  const [form, setForm] = useState({
    name: "",
    profileUrl: "",
    actionType: "liked" as LinkedInProspect["actionType"],
    context: "",
  });
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [explanation, setExplanation] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("linkedin_prospects");
    const savedLang = localStorage.getItem("linkedin_prospection_language");
    if (saved) {
      try {
        setProspects(JSON.parse(saved));
      } catch {
        setProspects([]);
      }
    }
    if (savedLang) setLanguage(savedLang as "fr" | "en");
  }, []);

  const saveProspects = (updated: LinkedInProspect[]) => {
    setProspects(updated);
    localStorage.setItem("linkedin_prospects", JSON.stringify(updated));
  };

  const getLearningData = () => {
    return prospects
      .filter((p) => p.status !== "draft" && p.generatedMessage)
      .map((p) => ({
        message: p.customMessage || p.generatedMessage,
        status: p.status,
        actionType: p.actionType,
      }));
  };

  const handleGenerate = async () => {
    if (!form.name.trim()) return;
    setGenerating(true);
    try {
      const learningData = getLearningData();
      const s = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/generate-prospection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          actionType: form.actionType,
          context: form.context,
          learningData,
          language,
          openrouterApiKey: s.openrouterApiKey || undefined,
          model: s.model,
        }),
      });
      if (!res.ok) throw new Error("Erreur génération");
      const data = await res.json();
      setGeneratedMessage(data.message || "");
      setExplanation(data.explanation || "");
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!generatedMessage.trim() || !form.name.trim()) return;
    const newProspect: LinkedInProspect = {
      id: `prospect_${Date.now()}`,
      name: form.name,
      profileUrl: form.profileUrl || undefined,
      actionType: form.actionType,
      context: form.context || undefined,
      generatedMessage,
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    saveProspects([newProspect, ...prospects]);
    setForm({ name: "", profileUrl: "", actionType: "liked", context: "" });
    setGeneratedMessage("");
    setExplanation("");
    setShowForm(false);
  };

  const updateStatus = (id: string, status: LinkedInProspect["status"]) => {
    const updated = prospects.map((p) => {
      if (p.id !== id) return p;
      return {
        ...p,
        status,
        sentAt: status === "sent" && !p.sentAt ? new Date().toISOString() : p.sentAt,
      };
    });
    saveProspects(updated);
    setStatusDropdown(null);
  };

  const updateMessage = (id: string, msg: string) => {
    saveProspects(
      prospects.map((p) =>
        p.id === id ? { ...p, customMessage: msg } : p
      )
    );
  };

  const deleteProspect = (id: string) => {
    saveProspects(prospects.filter((p) => p.id !== id));
  };

  const copyMessage = (id: string, msg: string) => {
    navigator.clipboard.writeText(msg);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered =
    filterStatus === "all"
      ? prospects
      : prospects.filter((p) => p.status === filterStatus);

  const convRate = getConversionRate(prospects);
  const sentCount = prospects.filter((p) => p.status !== "draft").length;
  const dealCount = prospects.filter((p) => p.status === "deal_closed").length;
  const positiveCount = prospects.filter((p) =>
    ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)
  ).length;

  return (
    <div className="flex h-full overflow-hidden bg-gray-50">
      {/* Left panel - Form */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col overflow-hidden shrink-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Nouveau message</h2>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value as "fr" | "en");
                localStorage.setItem("linkedin_prospection_language", e.target.value);
              }}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-600 focus:outline-none"
            >
              <option value="fr">FR</option>
              <option value="en">EN</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Prénom du prospect *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex: Marie"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2]"
            />
          </div>

          {/* Action type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Action effectuée
            </label>
            <div className="flex flex-col gap-2">
              {ACTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setForm({ ...form, actionType: opt.value })}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                    form.actionType === opt.value
                      ? "border-[#0A66C2] bg-blue-50 text-[#0A66C2]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Profile URL */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              URL du profil LinkedIn (optionnel)
            </label>
            <input
              type="text"
              value={form.profileUrl}
              onChange={(e) => setForm({ ...form, profileUrl: e.target.value })}
              placeholder="https://linkedin.com/in/..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2]"
            />
          </div>

          {/* Context */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Contexte supplémentaire (optionnel)
            </label>
            <textarea
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
              placeholder="Ex: Elle est directrice marketing dans une startup SaaS B2B..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !form.name.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[#0A66C2] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#0057a3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {generating ? "Génération..." : "Générer le message"}
          </button>

          {/* Generated message */}
          {generatedMessage && (
            <div className="space-y-2">
              {explanation && (
                <p className="text-xs text-gray-400">{explanation}</p>
              )}
              <textarea
                value={generatedMessage}
                onChange={(e) => setGeneratedMessage(e.target.value)}
                rows={6}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => copyMessage("form", generatedMessage)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copied === "form" ? <Check size={13} /> : <Copy size={13} />}
                  {copied === "form" ? "Copié !" : "Copier"}
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <Plus size={13} />
                  Sauvegarder
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel - Prospects list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xl font-bold text-gray-900">{prospects.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-blue-600">{sentCount}</p>
              <p className="text-xs text-gray-500">Envoyés</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-green-600">{positiveCount}</p>
              <p className="text-xs text-gray-500">Positifs</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600">{dealCount}</p>
              <p className="text-xs text-gray-500">Deals</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-xl font-bold text-[#0A66C2]">{convRate}</p>
              <p className="text-xs text-gray-500">Conversion</p>
            </div>

            {prospects.filter((p) =>
              ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)
            ).length >= 3 && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                <TrendingUp size={13} />
                L'IA apprend de vos {sentCount} messages envoyés
              </div>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white border-b border-gray-100 px-6 py-2 shrink-0">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Tous ({prospects.length})
            </button>
            {STATUS_VARIANTS.map((s) => {
              const count = prospects.filter((p) => p.status === s).length;
              if (count === 0) return null;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filterStatus === s
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {PROSPECT_STATUS_LABELS[s]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <MessageSquare size={24} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium text-sm">
                {prospects.length === 0
                  ? "Aucun message de prospection"
                  : "Aucun message dans cette catégorie"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Générez un message avec le panneau de gauche
              </p>
            </div>
          ) : (
            filtered.map((prospect) => (
              <ProspectCard
                key={prospect.id}
                prospect={prospect}
                expanded={expandedId === prospect.id}
                onToggle={() =>
                  setExpandedId(expandedId === prospect.id ? null : prospect.id)
                }
                onStatusChange={(status) => updateStatus(prospect.id, status)}
                onMessageChange={(msg) => updateMessage(prospect.id, msg)}
                onDelete={() => deleteProspect(prospect.id)}
                onCopy={(msg) => copyMessage(prospect.id, msg)}
                copied={copied === prospect.id}
                showStatusDropdown={statusDropdown === prospect.id}
                onToggleDropdown={() =>
                  setStatusDropdown(
                    statusDropdown === prospect.id ? null : prospect.id
                  )
                }
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ProspectCard({
  prospect,
  expanded,
  onToggle,
  onStatusChange,
  onMessageChange,
  onDelete,
  onCopy,
  copied,
  showStatusDropdown,
  onToggleDropdown,
}: {
  prospect: LinkedInProspect;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (s: LinkedInProspect["status"]) => void;
  onMessageChange: (msg: string) => void;
  onDelete: () => void;
  onCopy: (msg: string) => void;
  copied: boolean;
  showStatusDropdown: boolean;
  onToggleDropdown: () => void;
}) {
  const displayMessage = prospect.customMessage || prospect.generatedMessage;
  const statusColor = PROSPECT_STATUS_COLORS[prospect.status] || "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-[#0A66C2]/10 flex items-center justify-center text-[#0A66C2] font-semibold text-sm shrink-0">
          {prospect.name[0]?.toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm">
              {prospect.name}
            </span>
            <span className="text-xs text-gray-400">
              {ACTION_LABELS[prospect.actionType]}
            </span>
            {prospect.profileUrl && (
              <a
                href={prospect.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-[#0A66C2] transition-colors"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate mt-0.5">
            {displayMessage.slice(0, 60)}...
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge + dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleDropdown();
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}
            >
              {PROSPECT_STATUS_LABELS[prospect.status]}
              <ChevronDown size={11} />
            </button>
            {showStatusDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1 w-44">
                {STATUS_VARIANTS.map((s) => (
                  <button
                    key={s}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStatusChange(s);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                      s === prospect.status ? "font-medium text-gray-900" : "text-gray-600"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        PROSPECT_STATUS_COLORS[s]
                          ?.split(" ")[0]
                          .replace("bg-", "bg-")
                      }`}
                    />
                    {PROSPECT_STATUS_LABELS[s]}
                    {s === prospect.status && (
                      <Check size={11} className="ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
          {prospect.context && (
            <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
              <span className="font-medium">Contexte :</span> {prospect.context}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              Message{prospect.customMessage ? " (modifié)" : ""}
            </label>
            <textarea
              value={displayMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onCopy(displayMessage)}
              className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copié !" : "Copier"}
            </button>

            {prospect.status === "draft" && (
              <button
                onClick={() => onStatusChange("sent")}
                className="flex items-center gap-1.5 text-xs bg-[#0A66C2] text-white px-3 py-1.5 rounded-lg hover:bg-[#0057a3] transition-colors"
              >
                <Check size={13} />
                Marquer comme envoyé
              </button>
            )}

            <button
              onClick={onDelete}
              className="ml-auto flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <X size={13} />
              Supprimer
            </button>
          </div>

          {prospect.sentAt && (
            <p className="text-xs text-gray-400">
              Envoyé le{" "}
              {new Date(prospect.sentAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
