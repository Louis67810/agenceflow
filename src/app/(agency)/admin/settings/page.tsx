"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  MessageSquare,
  Figma,
  FileText,
  Sparkles,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Settings,
  Zap,
} from "lucide-react";

type IntegrationStatus = "connected" | "disconnected" | "error";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  iconBg: string;
  status: IntegrationStatus;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    helpUrl: string;
    helpText: string;
    type?: "text" | "password";
  }[];
  badge?: string;
  recommended?: boolean;
}

export default function SettingsPage() {
  const [savedKeys, setSavedKeys] = useState<Record<string, string>>({});
  const [editingKeys, setEditingKeys] = useState<Record<string, string>>({});
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});

  const integrations: Integration[] = [
    {
      id: "greenapi",
      name: "WhatsApp — Green API",
      description:
        "Envoyez et recevez des messages WhatsApp depuis le dashboard. Green API est la solution la plus simple : pas de vérification business, tier gratuit à 1 500 messages/mois.",
      icon: <MessageSquare size={20} />,
      iconBg: "bg-green-100 text-green-600",
      status: savedKeys["greenapi_instance"] && savedKeys["greenapi_token"] ? "connected" : "disconnected",
      badge: "Gratuit jusqu'à 1 500 msg/mois",
      recommended: true,
      fields: [
        {
          key: "greenapi_instance",
          label: "ID d'instance",
          placeholder: "Ex: 1101234567",
          helpUrl: "https://console.green-api.com",
          helpText: "Créez un compte sur green-api.com → Créer une instance → copiez l'ID",
          type: "text",
        },
        {
          key: "greenapi_token",
          label: "Token API",
          placeholder: "Ex: abc123xyz...",
          helpUrl: "https://console.green-api.com",
          helpText: "Dans votre instance Green API → API Token",
          type: "password",
        },
      ],
    },
    {
      id: "figma",
      name: "Figma",
      description:
        "Connectez Figma pour voir les commentaires de vos clients directement dans la messagerie. Utilise un token personnel gratuit.",
      icon: <Figma size={20} />,
      iconBg: "bg-purple-100 text-purple-600",
      status: savedKeys["figma_token"] ? "connected" : "disconnected",
      fields: [
        {
          key: "figma_token",
          label: "Token d'accès personnel",
          placeholder: "figd_...",
          helpUrl: "https://www.figma.com/settings",
          helpText:
            "figma.com → Paramètres → Security → Personal access tokens → Générer un token",
          type: "password",
        },
      ],
    },
    {
      id: "google",
      name: "Google Docs / Drive",
      description:
        "Synchronisez les retours Google Docs de vos clients. Nécessite une clé API Google Cloud.",
      icon: <FileText size={20} />,
      iconBg: "bg-blue-100 text-blue-600",
      status: savedKeys["google_api_key"] ? "connected" : "disconnected",
      fields: [
        {
          key: "google_api_key",
          label: "Clé API Google Cloud",
          placeholder: "AIza...",
          helpUrl: "https://console.cloud.google.com/apis/credentials",
          helpText:
            "console.cloud.google.com → APIs & Services → Credentials → Créer une clé API → Activer l'API Google Docs",
          type: "password",
        },
      ],
    },
    {
      id: "claude",
      name: "Claude AI (Anthropic)",
      description:
        "Active le bouton \"Peaufiner avec IA\" dans la messagerie pour reformuler vos messages automatiquement.",
      icon: <Sparkles size={20} />,
      iconBg: "bg-orange-100 text-orange-600",
      status: savedKeys["claude_api_key"] ? "connected" : "disconnected",
      fields: [
        {
          key: "claude_api_key",
          label: "Clé API Anthropic",
          placeholder: "sk-ant-...",
          helpUrl: "https://console.anthropic.com/settings/keys",
          helpText:
            "console.anthropic.com → API Keys → Créer une clé",
          type: "password",
        },
      ],
    },
  ];

  const handleChange = (key: string, value: string) => {
    setEditingKeys((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (integrationId: string, fields: Integration["fields"]) => {
    const updates: Record<string, string> = {};
    fields.forEach((f) => {
      if (editingKeys[f.key] !== undefined) {
        updates[f.key] = editingKeys[f.key];
      }
    });
    setSavedKeys((prev) => ({ ...prev, ...updates }));
    setSavedStatus((prev) => ({ ...prev, [integrationId]: true }));
    setTimeout(() => {
      setSavedStatus((prev) => ({ ...prev, [integrationId]: false }));
    }, 2500);
    // TODO: Persist to Supabase or environment variables via API route
  };

  const toggleVisible = (key: string) => {
    setVisibleKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getValue = (key: string) =>
    editingKeys[key] !== undefined ? editingKeys[key] : savedKeys[key] ?? "";

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Settings size={22} className="text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        </div>
        <p className="text-gray-500 mt-1">
          Connectez vos outils pour centraliser tous vos échanges clients dans AgenceFlow.
        </p>
      </div>

      {/* WhatsApp note */}
      <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-8">
        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-amber-800">Pourquoi Green API plutôt que WhatsApp Business officiel ?</p>
          <p className="text-amber-700 mt-0.5">
            L&apos;API officielle Meta nécessite une vérification business longue et coûte cher.
            Green API fonctionne avec votre numéro WhatsApp existant via un QR code — comme WhatsApp Web — sans aucune approbation. Parfait pour une agence.
          </p>
        </div>
      </div>

      {/* Integrations */}
      <div className="space-y-5">
        {integrations.map((integration) => {
          const isConnected = integration.status === "connected";
          const isSaved = savedStatus[integration.id];

          return (
            <div
              key={integration.id}
              className="bg-white rounded-xl border border-gray-200 p-6"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${integration.iconBg}`}>
                    {integration.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900">
                        {integration.name}
                      </h2>
                      {integration.recommended && (
                        <span className="flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                          <Zap size={10} />
                          Recommandé
                        </span>
                      )}
                      {integration.badge && (
                        <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                          {integration.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {integration.description}
                    </p>
                  </div>
                </div>
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                    isConnected
                      ? "bg-green-50 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isConnected ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                  )}
                  {isConnected ? "Connecté" : "Non connecté"}
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-4">
                {integration.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {field.label}
                    </label>
                    <div className="relative">
                      <input
                        type={
                          field.type === "password" && !visibleKeys[field.key]
                            ? "password"
                            : "text"
                        }
                        value={getValue(field.key)}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
                      />
                      {field.type === "password" && (
                        <button
                          type="button"
                          onClick={() => toggleVisible(field.key)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {visibleKeys[field.key] ? (
                            <EyeOff size={15} />
                          ) : (
                            <Eye size={15} />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="flex items-start gap-1 mt-1.5">
                      <AlertCircle size={12} className="text-gray-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-gray-400">
                        {field.helpText}{" "}
                        <a
                          href={field.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:text-indigo-700 inline-flex items-center gap-0.5"
                        >
                          Obtenir la clé
                          <ExternalLink size={10} />
                        </a>
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save button */}
              <div className="mt-5 flex justify-end">
                <button
                  onClick={() => handleSave(integration.id, integration.fields)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isSaved
                      ? "bg-green-500 text-white"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {isSaved ? (
                    <>
                      <Check size={14} />
                      Enregistré
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Security note */}
      <div className="mt-6 flex gap-2 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <AlertCircle size={14} className="text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">
          Les clés API sont stockées localement pour l&apos;instant. En production, elles seront chiffrées dans Supabase et jamais exposées côté client.
        </p>
      </div>
    </div>
  );
}
