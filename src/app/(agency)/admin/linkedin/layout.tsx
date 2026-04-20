"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings, X, Eye, EyeOff, Check, ChevronDown, ChevronRight, RefreshCw, DatabaseZap } from "lucide-react";
import { clearLinkedInPostsLocal, loadLinkedInPosts, saveLinkedInPosts } from "@/lib/linkedin/posts";
import {
  clearPendingRemoteLinkedInPosts,
  fetchRemoteLinkedInPosts,
  flushPendingRemoteLinkedInPosts,
  persistRemoteLinkedInPosts,
} from "@/lib/linkedin/remote";
import {
  DEFAULT_LINKEDIN_WORKSPACE,
  clearLinkedInWorkspaceLocal,
  fetchRemoteLinkedInWorkspace,
  flushPendingRemoteLinkedInWorkspace,
  hasMeaningfulLinkedInWorkspaceData,
  loadLinkedInWorkspaceCache,
  saveLinkedInWorkspaceCache,
  saveRemoteLinkedInWorkspace,
} from "@/lib/linkedin/workspace";
import {
  DEFAULT_CAROUSEL_TEMPLATE,
  DEFAULT_SETTINGS,
  DEFAULT_BIG_PROMPT,
  DEFAULT_SMALL_PROMPT,
  MODELS_BIG,
  MODELS_SMALL,
  OPENROUTER_MODELS,
  clearLinkedInSettingsLocal,
  fetchRemoteLinkedInSettings,
  flushPendingRemoteLinkedInSettings,
  hasMeaningfulLinkedInSettings,
  loadLinkedInSettings,
  persistRemoteLinkedInSettings,
  queueRemoteLinkedInSettingsSync,
  type LinkedInSettings,
} from "@/lib/linkedin/settings";

export type { LinkedInSettings } from "@/lib/linkedin/settings";
export { loadLinkedInSettings } from "@/lib/linkedin/settings";

function InlineToggle({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      style={{
        position: "relative",
        width: 40,
        height: 20,
        borderRadius: 999,
        background: checked ? "#0A66C2" : "#e5e7eb",
        border: "none",
        cursor: "pointer",
        transition: "background-color 0.2s ease",
        padding: 0,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transition: "left 0.2s ease",
        }}
      />
    </button>
  );
}

export default function LinkedInLayout({ children }: { children: React.ReactNode }) {
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<LinkedInSettings>(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showBigPrompt, setShowBigPrompt] = useState(false);
  const [showSmallPrompt, setShowSmallPrompt] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [syncInfo, setSyncInfo] = useState("");
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [testingPersistence, setTestingPersistence] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRemoteRef = useRef(false);
  const lastSavedSnapshotRef = useRef(JSON.stringify(DEFAULT_SETTINGS));

  const describeSyncState = useCallback(
    (nextSettings: LinkedInSettings, prospectsCount: number, postsCount: number) => {
      const airtableLabel =
        nextSettings.airtableBaseId.trim() && nextSettings.airtableTableName.trim()
          ? "Airtable connecte"
          : "Airtable non configure";
      return `Supabase actif · ${airtableLabel} · ${prospectsCount} prospects · ${postsCount} posts`;
    },
    []
  );

  const bootstrapLinkedInState = useCallback(
    async (options?: { clearLocal?: boolean }) => {
      const clearLocal = options?.clearLocal ?? false;
      setSyncingSupabase(true);
      setSaveError("");

      if (clearLocal) {
        clearLinkedInSettingsLocal();
        clearLinkedInWorkspaceLocal();
        clearLinkedInPostsLocal();
        clearPendingRemoteLinkedInPosts();
      }

      const localSettings = clearLocal ? DEFAULT_SETTINGS : loadLinkedInSettings();
      const localWorkspace = clearLocal ? DEFAULT_LINKEDIN_WORKSPACE : loadLinkedInWorkspaceCache();
      const localPosts = clearLocal ? [] : loadLinkedInPosts();

      setSettings(localSettings);
      lastSavedSnapshotRef.current = JSON.stringify(localSettings);

      await Promise.allSettled([
        flushPendingRemoteLinkedInSettings(),
        flushPendingRemoteLinkedInWorkspace(),
        flushPendingRemoteLinkedInPosts(),
      ]);

      let nextSettings = localSettings;
      let nextWorkspace = localWorkspace;
      let nextPosts = localPosts;

      try {
        const [remoteSettingsResult, remoteWorkspaceResult, remotePostsResult] = await Promise.allSettled([
          fetchRemoteLinkedInSettings(),
          fetchRemoteLinkedInWorkspace(),
          fetchRemoteLinkedInPosts(),
        ]);

        if (remoteSettingsResult.status === "fulfilled") {
          nextSettings = remoteSettingsResult.value;
        } else if (hasMeaningfulLinkedInSettings(localSettings)) {
          try {
            nextSettings = await persistRemoteLinkedInSettings(localSettings);
          } catch {}
        }

        if (remoteWorkspaceResult.status === "fulfilled") {
          const remoteWorkspace = remoteWorkspaceResult.value;
          if (remoteWorkspace.hasStoredData) {
            nextWorkspace = remoteWorkspace.workspace;
            saveLinkedInWorkspaceCache(remoteWorkspace.workspace);
          } else if (hasMeaningfulLinkedInWorkspaceData(localWorkspace)) {
            try {
              nextWorkspace = await saveRemoteLinkedInWorkspace(localWorkspace);
            } catch {}
          }
        } else if (hasMeaningfulLinkedInWorkspaceData(localWorkspace)) {
          try {
            nextWorkspace = await saveRemoteLinkedInWorkspace(localWorkspace);
          } catch {}
        }

        if (remotePostsResult.status === "fulfilled") {
          if (remotePostsResult.value.length > 0) {
            nextPosts = remotePostsResult.value;
            saveLinkedInPosts(remotePostsResult.value);
          } else if (localPosts.length > 0) {
            try {
              await persistRemoteLinkedInPosts(localPosts, true);
              nextPosts = localPosts;
            } catch {}
          }
        } else if (localPosts.length > 0) {
          try {
            await persistRemoteLinkedInPosts(localPosts, true);
            nextPosts = localPosts;
          } catch {}
        }

        setSettings(nextSettings);
        lastSavedSnapshotRef.current = JSON.stringify(nextSettings);
        setSyncInfo(
          describeSyncState(nextSettings, nextWorkspace.prospects.length, nextPosts.length)
        );
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Initialisation Supabase impossible.");
      } finally {
        hasLoadedRemoteRef.current = true;
        setBootstrapped(true);
        setSyncingSupabase(false);
      }
    },
    [describeSyncState]
  );

  useEffect(() => {
    void bootstrapLinkedInState();

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [bootstrapLinkedInState]);

  useEffect(() => {
    if (!bootstrapped || !hasLoadedRemoteRef.current) return;

    const queued = queueRemoteLinkedInSettingsSync(settings);
    const serialized = JSON.stringify(queued);

    if (serialized === lastSavedSnapshotRef.current) return;

    setSaveError("");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const savedSettings = await persistRemoteLinkedInSettings(queued);
          const savedSnapshot = JSON.stringify(savedSettings);
          lastSavedSnapshotRef.current = savedSnapshot;
          setSyncInfo((current) =>
            current || describeSyncState(savedSettings, loadLinkedInWorkspaceCache().prospects.length, loadLinkedInPosts().length)
          );
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : "Sauvegarde Supabase impossible.");
        }
      })();
    }, 250);
  }, [settings, bootstrapped, describeSyncState]);

  const handleSave = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveError("");
    try {
      const savedSettings = await persistRemoteLinkedInSettings(settings);
      const savedSnapshot = JSON.stringify(savedSettings);
      lastSavedSnapshotRef.current = savedSnapshot;
      setSyncInfo(
        describeSyncState(
          savedSettings,
          loadLinkedInWorkspaceCache().prospects.length,
          loadLinkedInPosts().length
        )
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Sauvegarde Supabase impossible.");
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleForceSupabaseSync = async () => {
    setSyncingSupabase(true);
    setSaveError("");
    try {
      const syncedSettings = await persistRemoteLinkedInSettings(settings);
      const workspace = loadLinkedInWorkspaceCache();
      const posts = loadLinkedInPosts();
      await saveRemoteLinkedInWorkspace(workspace);
      await persistRemoteLinkedInPosts(posts, true);
      lastSavedSnapshotRef.current = JSON.stringify(syncedSettings);
      setSyncInfo(describeSyncState(syncedSettings, workspace.prospects.length, posts.length));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Synchronisation Supabase impossible.");
    } finally {
      setSyncingSupabase(false);
    }
  };

  const handleTestPersistence = async () => {
    setTestingPersistence(true);
    setSaveError("");
    try {
      await handleForceSupabaseSync();
      await bootstrapLinkedInState({ clearLocal: true });
    } finally {
      setTestingPersistence(false);
    }
  };

  const handleClose = () => {
    setSettings(loadLinkedInSettings());
    setShowSettings(false);
    setSaved(false);
  };

  const resetCarouselTemplate = () =>
    setSettings((current) => ({ ...current, carouselTemplate: DEFAULT_CAROUSEL_TEMPLATE }));

  const hasApiKey = settings.openrouterApiKey.trim().length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#0A66C2] rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-black">in</span>
            </div>
            <h1 className="font-bold text-gray-900 text-sm">LinkedIn</h1>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Settings size={14} />
            {hasApiKey ? "Parametres IA" : "Configurer l'IA"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden" style={{ zoom: 1.04 }}>
        {bootstrapped ? children : (
          <div className="flex h-full items-center justify-center bg-[#fbfbfb] text-sm text-gray-400">
            Chargement de l&apos;espace LinkedIn...
          </div>
        )}
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900 text-lg">Parametres LinkedIn IA</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Connexion OpenRouter, modeles et configuration prospection
                </p>
              </div>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
                <div className="flex items-start gap-3">
                  <DatabaseZap size={16} className="mt-0.5 text-[#0A66C2]" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Persistance LinkedIn centralisee dans Supabase
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {syncInfo || "Les parametres, les prospects, les idees, les styles et les posts sont maintenant verifies ensemble."}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-900 rounded flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">OR</span>
                  </div>
                  Connexion OpenRouter
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Cle API OpenRouter</label>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        value={settings.openrouterApiKey}
                        onChange={(e) => setSettings({ ...settings, openrouterApiKey: e.target.value })}
                        placeholder="sk-or-v1-..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] font-mono"
                      />
                      <button type="button" onClick={() => setShowKey((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Cle stockee localement puis synchronisee dans Supabase. Obtenez-la sur{" "}
                      <span className="text-[#0A66C2] font-medium">openrouter.ai/keys</span>
                    </p>
                    {!hasApiKey && (
                      <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                        Sans cle personnelle, l&apos;IA utilisera la cle serveur si configuree.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Modele general (posts, idees, copywriting)</label>
                    <div className="relative">
                      <select
                        value={settings.model}
                        onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 pr-8"
                      >
                        {OPENROUTER_MODELS.map((model) => (
                          <option key={model.id} value={model.id}>{model.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Langue par defaut</label>
                    <div className="flex gap-2">
                      {[{ value: "fr", label: "Francais" }, { value: "en", label: "English" }].map((lang) => (
                        <button
                          key={lang.value}
                          onClick={() => setSettings({ ...settings, language: lang.value })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            settings.language === lang.value
                              ? "bg-[#0A66C2] border-[#0A66C2] text-white"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">DM</span>
                  </div>
                  Prospection IA
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Deux IA distinctes : la Big AI analyse et cree des squelettes, la Small AI genere les messages personnalises.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Big AI - Analyse & creation de squelettes
                    </label>
                    <div className="relative">
                      <select
                        value={settings.prospectionBigModel}
                        onChange={(e) => setSettings({ ...settings, prospectionBigModel: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 pr-8"
                      >
                        {MODELS_BIG.map((model) => (
                          <option key={model.id} value={model.id}>{model.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Utilisee pour creer et ameliorer les squelettes de messages a partir de vos donnees.
                    </p>
                  </div>

                  <div>
                    <button
                      onClick={() => setShowBigPrompt((value) => !value)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showBigPrompt ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      Prompt Big AI (avance)
                    </button>
                    {showBigPrompt && (
                      <div className="mt-2">
                        <textarea
                          value={settings.prospectionBigPrompt}
                          onChange={(e) => setSettings({ ...settings, prospectionBigPrompt: e.target.value })}
                          rows={6}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 resize-none text-gray-700 leading-relaxed"
                        />
                        <button
                          onClick={() => setSettings((current) => ({ ...current, prospectionBigPrompt: DEFAULT_BIG_PROMPT }))}
                          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
                        >
                          Reinitialiser
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Small AI - Generation des messages
                    </label>
                    <div className="relative">
                      <select
                        value={settings.prospectionSmallModel}
                        onChange={(e) => setSettings({ ...settings, prospectionSmallModel: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 pr-8"
                      >
                        {MODELS_SMALL.map((model) => (
                          <option key={model.id} value={model.id}>{model.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Utilisee pour chaque generation de message - doit etre rapide et economique.
                    </p>
                  </div>

                  <div>
                    <button
                      onClick={() => setShowSmallPrompt((value) => !value)}
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showSmallPrompt ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      Prompt Small AI (avance)
                    </button>
                    {showSmallPrompt && (
                      <div className="mt-2">
                        <textarea
                          value={settings.prospectionSmallPrompt}
                          onChange={(e) => setSettings({ ...settings, prospectionSmallPrompt: e.target.value })}
                          rows={5}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 resize-none text-gray-700 leading-relaxed"
                        />
                        <button
                          onClick={() => setSettings((current) => ({ ...current, prospectionSmallPrompt: DEFAULT_SMALL_PROMPT }))}
                          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
                        >
                          Reinitialiser
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs font-medium text-gray-700">Auto-analyse des squelettes</p>
                      <p className="text-xs text-gray-400 mt-0.5">Regenere automatiquement les squelettes tous les N prospects envoyes</p>
                    </div>
                    <InlineToggle
                      checked={settings.prospectionAutoAnalysis}
                      onClick={() => setSettings((current) => ({ ...current, prospectionAutoAnalysis: !current.prospectionAutoAnalysis }))}
                    />
                  </div>
                  {settings.prospectionAutoAnalysis && (
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-600">Analyser tous les</label>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        step={5}
                        value={settings.prospectionAutoAnalysisEvery}
                        onChange={(e) => setSettings((current) => ({ ...current, prospectionAutoAnalysisEvery: Math.max(5, parseInt(e.target.value, 10) || 10) }))}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                      />
                      <label className="text-xs text-gray-600">prospects envoyes</label>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                  <div className="w-5 h-5 bg-yellow-400 rounded flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">AT</span>
                  </div>
                  Synchronisation Airtable
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Synchronise vos prospects LinkedIn vers Airtable. <span className="text-green-600 font-medium">Plan gratuit suffisant.</span>
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Personal Access Token (PAT)</label>
                    <input
                      type="password"
                      value={settings.airtableKey}
                      onChange={(e) => setSettings({ ...settings, airtableKey: e.target.value })}
                      placeholder="patXXXXXXXX..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                    />
                    <p className="text-xs text-gray-400 mt-1">Creez-le sur <span className="text-[#0A66C2]">airtable.com/create/tokens</span> avec les scopes <code>data.records:read</code> et <code>data.records:write</code></p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Base ID</label>
                    <input
                      type="text"
                      value={settings.airtableBaseId}
                      onChange={(e) => setSettings({ ...settings, airtableBaseId: e.target.value })}
                      placeholder="appXXXXXXXX"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                    />
                    <p className="text-xs text-gray-400 mt-1">Visible dans l&apos;URL de votre base : airtable.com/<strong>appXXXX</strong>/...</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom de la table</label>
                    <input
                      type="text"
                      value={settings.airtableTableName}
                      onChange={(e) => setSettings({ ...settings, airtableTableName: e.target.value })}
                      placeholder="Prospects LinkedIn"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-xs font-medium text-gray-700">Synchronisation automatique</p>
                      <p className="text-xs text-gray-400 mt-0.5">Synchronise a chaque changement de statut</p>
                    </div>
                    <InlineToggle
                      checked={settings.airtableAutoSync}
                      onClick={() => setSettings((current) => ({ ...current, airtableAutoSync: !current.airtableAutoSync }))}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">Template de carrousel</h3>
                  <button onClick={resetCarouselTemplate} className="text-xs text-gray-400 hover:text-gray-600">
                    Reinitialiser
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Ces instructions definissent la structure de chaque slide genere.
                </p>
                <textarea
                  value={settings.carouselTemplate}
                  onChange={(e) => setSettings({ ...settings, carouselTemplate: e.target.value })}
                  rows={10}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30 focus:border-[#0A66C2] resize-none text-gray-700 leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-gray-100 shrink-0">
              <div className="flex flex-col gap-1">
                <button onClick={handleClose} className="text-left text-sm text-gray-500 hover:text-gray-700">
                  Annuler
                </button>
                {saveError ? (
                  <span className="text-xs text-red-500">{saveError}</span>
                ) : (
                  <span className="text-xs text-gray-400">
                    {syncInfo || "Sauvegarde automatique vers Supabase activee"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleForceSupabaseSync()}
                  disabled={syncingSupabase || testingPersistence}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {syncingSupabase ? <RefreshCw size={14} className="animate-spin" /> : <DatabaseZap size={14} />}
                  Forcer la sync
                </button>
                <button
                  onClick={() => void handleTestPersistence()}
                  disabled={syncingSupabase || testingPersistence}
                  className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-[#0A66C2] hover:bg-blue-100 disabled:opacity-60"
                >
                  {testingPersistence ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Tester comme apres un push
                </button>
                <button
                  onClick={() => void handleSave()}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    saved ? "bg-green-500 text-white" : "bg-[#0A66C2] text-white hover:bg-[#0057a3]"
                  }`}
                >
                  {saved ? <><Check size={15} /> Enregistre !</> : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
