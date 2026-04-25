"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  DatabaseZap,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import {
  CAROUSEL_IMAGE_MODELS,
  DEFAULT_CAROUSEL_TEMPLATE,
  DEFAULT_SETTINGS,
  DEFAULT_BIG_PROMPT,
  DEFAULT_CAROUSEL_SKILL_PROMPT,
  DEFAULT_SMALL_PROMPT,
  MODELS_BIG,
  MODELS_SMALL,
  OPENROUTER_MODELS,
  fetchRemoteLinkedInSettings,
  flushPendingRemoteLinkedInSettings,
  hasMeaningfulLinkedInSettings,
  loadLinkedInSettings,
  persistRemoteLinkedInSettings,
  queueRemoteLinkedInSettingsSync,
  type LinkedInSettings,
} from "@/lib/linkedin/settings";
import {
  DEFAULT_LINKEDIN_WORKSPACE,
  clearLinkedInWorkspaceLocal,
  fetchRemoteLinkedInWorkspace,
  flushPendingRemoteLinkedInWorkspace,
  hasMeaningfulLinkedInWorkspaceData,
  loadLinkedInWorkspaceCache,
  saveRemoteLinkedInWorkspace,
} from "@/lib/linkedin/workspace";
import {
  clearLinkedInPostsLocal,
  loadLinkedInPosts,
} from "@/lib/linkedin/posts";
import {
  clearPendingRemoteLinkedInPosts,
  fetchRemoteLinkedInPosts,
  flushPendingRemoteLinkedInPosts,
  persistRemoteLinkedInPosts,
} from "@/lib/linkedin/remote";

function InlineToggle({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      style={{
        position: "relative",
        width: 42,
        height: 22,
        borderRadius: 999,
        background: checked ? "#0A66C2" : "#e5e7eb",
        border: "none",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.16)",
          transition: "left 0.2s ease",
        }}
      />
    </button>
  );
}

export default function LinkedInParametresPage() {
  const [settings, setSettings] = useState<LinkedInSettings>(DEFAULT_SETTINGS);
  const [showKey, setShowKey] = useState(false);
  const [showBigPrompt, setShowBigPrompt] = useState(false);
  const [showSmallPrompt, setShowSmallPrompt] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [syncInfo, setSyncInfo] = useState("");
  const [syncingSupabase, setSyncingSupabase] = useState(false);
  const [testingPersistence, setTestingPersistence] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSnapshotRef = useRef(JSON.stringify(DEFAULT_SETTINGS));

  useEffect(() => {
    void (async () => {
      setSyncingSupabase(true);
      setSaveError("");

      const localSettings = loadLinkedInSettings();
      const localWorkspace = loadLinkedInWorkspaceCache();
      const localPosts = loadLinkedInPosts();
      setSettings(localSettings);
      lastSavedSnapshotRef.current = JSON.stringify(localSettings);

      await Promise.allSettled([
        flushPendingRemoteLinkedInSettings(),
        flushPendingRemoteLinkedInWorkspace(),
        flushPendingRemoteLinkedInPosts(),
      ]);

      try {
        const [remoteSettingsResult, remoteWorkspaceResult, remotePostsResult] = await Promise.allSettled([
          fetchRemoteLinkedInSettings(),
          fetchRemoteLinkedInWorkspace(),
          fetchRemoteLinkedInPosts(),
        ]);

        const nextSettings =
          remoteSettingsResult.status === "fulfilled"
            ? remoteSettingsResult.value
            : hasMeaningfulLinkedInSettings(localSettings)
              ? await persistRemoteLinkedInSettings(localSettings)
              : localSettings;

        const nextWorkspace =
          remoteWorkspaceResult.status === "fulfilled" && remoteWorkspaceResult.value.hasStoredData
            ? remoteWorkspaceResult.value.workspace
            : localWorkspace;

        const nextPosts =
          remotePostsResult.status === "fulfilled" && remotePostsResult.value.length > 0
            ? remotePostsResult.value
            : localPosts;

        setSettings(nextSettings);
        lastSavedSnapshotRef.current = JSON.stringify(nextSettings);
        setSyncInfo(`Supabase actif · ${nextWorkspace.prospects.length} prospects · ${nextPosts.length} posts`);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Initialisation LinkedIn impossible.");
      } finally {
        setSyncingSupabase(false);
      }
    })();

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const queued = queueRemoteLinkedInSettingsSync(settings);
    const snapshot = JSON.stringify(queued);
    if (snapshot === lastSavedSnapshotRef.current) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const savedSettings = await persistRemoteLinkedInSettings(queued);
          lastSavedSnapshotRef.current = JSON.stringify(savedSettings);
        } catch (error) {
          setSaveError(error instanceof Error ? error.message : "Sauvegarde impossible.");
        }
      })();
    }, 250);
  }, [settings]);

  const handleSave = async () => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveError("");
    try {
      const savedSettings = await persistRemoteLinkedInSettings(settings);
      lastSavedSnapshotRef.current = JSON.stringify(savedSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Sauvegarde impossible.");
    }
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
      setSyncInfo(`Supabase actif · ${workspace.prospects.length} prospects · ${posts.length} posts`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Synchronisation impossible.");
    } finally {
      setSyncingSupabase(false);
    }
  };

  const handleTestPersistence = async () => {
    setTestingPersistence(true);
    setSaveError("");
    try {
      await handleForceSupabaseSync();
      clearLinkedInWorkspaceLocal();
      clearLinkedInPostsLocal();
      clearPendingRemoteLinkedInPosts();
      const remoteSettings = await fetchRemoteLinkedInSettings();
      setSettings(remoteSettings);
      lastSavedSnapshotRef.current = JSON.stringify(remoteSettings);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Test impossible.");
    } finally {
      setTestingPersistence(false);
    }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#fbfbfb", padding: 28 }}>
      <div style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 28, lineHeight: "32px", fontWeight: 700, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Parametres LinkedIn</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: "22px", color: "rgba(18,26,46,0.54)", fontFamily: '"Inter", sans-serif' }}>
            Toute la configuration IA et la synchronisation LinkedIn sont maintenant centralisees ici.
          </p>
        </div>

        <div style={{ borderRadius: 20, border: "1px solid rgba(10,102,194,0.12)", background: "linear-gradient(180deg, rgba(233,244,255,0.9) 0%, rgba(255,255,255,0.96) 100%)", padding: 18, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <DatabaseZap size={18} style={{ color: "#0A66C2", marginTop: 2 }} />
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Persistance centralisee Supabase</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: "20px", color: "rgba(18,26,46,0.6)", fontFamily: '"Inter", sans-serif' }}>
              {syncInfo || "Les reglages, les prospects, les idees, les styles et les posts sont synchronises ensemble."}
            </p>
          </div>
        </div>

        <section style={{ borderRadius: 24, background: "#fff", border: "1px solid rgba(18,26,46,0.08)", boxShadow: "0 18px 40px rgba(18,26,46,0.06)", padding: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>OpenRouter</h2>
          <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6b7a", marginBottom: 8 }}>Cle API OpenRouter</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showKey ? "text" : "password"}
                  value={settings.openrouterApiKey}
                  onChange={(e) => setSettings({ ...settings, openrouterApiKey: e.target.value })}
                  placeholder="sk-or-v1-..."
                  style={{ width: "100%", minHeight: 46, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: "0 44px 0 14px", fontSize: 14, outline: "none", fontFamily: "monospace" }}
                />
                <button type="button" onClick={() => setShowKey((value) => !value)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", cursor: "pointer", color: "#6f7887" }}>
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6b7a", marginBottom: 8 }}>Modele general</label>
              <div style={{ position: "relative" }}>
                <select value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })} style={{ width: "100%", minHeight: 46, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: "0 40px 0 14px", fontSize: 14, appearance: "none", outline: "none", background: "#fff" }}>
                  {OPENROUTER_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
                <ChevronDown size={16} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#6f7887", pointerEvents: "none" }} />
              </div>
            </div>
          </div>
        </section>

        <section style={{ borderRadius: 24, background: "#fff", border: "1px solid rgba(18,26,46,0.08)", boxShadow: "0 18px 40px rgba(18,26,46,0.06)", padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Carrousel IA</h2>
              <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: "20px", color: "rgba(18,26,46,0.56)", fontFamily: '"Inter", sans-serif' }}>
                Reglages dedies a la generation des slides, des images et du format long LinkedIn.
              </p>
            </div>
            <button type="button" onClick={() => setSettings((current) => ({ ...current, carouselContentModel: DEFAULT_SETTINGS.carouselContentModel, carouselImageModel: DEFAULT_SETTINGS.carouselImageModel, carouselSkillPrompt: DEFAULT_CAROUSEL_SKILL_PROMPT, carouselTemplate: DEFAULT_CAROUSEL_TEMPLATE }))} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 12, color: "#6f7887", fontWeight: 600 }}>
              Reinitialiser
            </button>
          </div>
          <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6b7a", marginBottom: 8 }}>Modele contenu carrousel</label>
              <div style={{ position: "relative" }}>
                <select value={settings.carouselContentModel} onChange={(e) => setSettings({ ...settings, carouselContentModel: e.target.value })} style={{ width: "100%", minHeight: 46, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: "0 40px 0 14px", fontSize: 14, appearance: "none", outline: "none", background: "#fff" }}>
                  {OPENROUTER_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
                <ChevronDown size={16} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#6f7887", pointerEvents: "none" }} />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6b7a", marginBottom: 8 }}>Modele image carrousel</label>
              <div style={{ position: "relative" }}>
                <select value={settings.carouselImageModel} onChange={(e) => setSettings({ ...settings, carouselImageModel: e.target.value })} style={{ width: "100%", minHeight: 46, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: "0 40px 0 14px", fontSize: 14, appearance: "none", outline: "none", background: "#fff" }}>
                  {CAROUSEL_IMAGE_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
                <ChevronDown size={16} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#6f7887", pointerEvents: "none" }} />
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6b7a", marginBottom: 8 }}>Prompt global carrousel (skill md)</label>
              <textarea value={settings.carouselSkillPrompt} onChange={(e) => setSettings({ ...settings, carouselSkillPrompt: e.target.value })} rows={12} style={{ width: "100%", borderRadius: 16, border: "1px solid rgba(18,26,46,0.12)", padding: 14, fontSize: 13, lineHeight: "20px", outline: "none", fontFamily: "monospace", resize: "vertical" }} />
            </div>
          </div>
        </section>

        <section style={{ borderRadius: 24, background: "#fff", border: "1px solid rgba(18,26,46,0.08)", boxShadow: "0 18px 40px rgba(18,26,46,0.06)", padding: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Prospection IA</h2>
          <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6b7a", marginBottom: 8 }}>Big AI</label>
              <select value={settings.prospectionBigModel} onChange={(e) => setSettings({ ...settings, prospectionBigModel: e.target.value })} style={{ width: "100%", minHeight: 46, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: "0 14px", fontSize: 14, outline: "none", background: "#fff" }}>
                {MODELS_BIG.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
            </div>
            <div>
              <button type="button" onClick={() => setShowBigPrompt((value) => !value)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "transparent", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#5f6b7a" }}>
                {showBigPrompt ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Prompt Big AI
              </button>
              {showBigPrompt ? <textarea value={settings.prospectionBigPrompt} onChange={(e) => setSettings({ ...settings, prospectionBigPrompt: e.target.value })} rows={6} style={{ width: "100%", marginTop: 10, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: 14, fontSize: 13, lineHeight: "20px", outline: "none", fontFamily: "monospace", resize: "vertical" }} /> : null}
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5f6b7a", marginBottom: 8 }}>Small AI</label>
              <select value={settings.prospectionSmallModel} onChange={(e) => setSettings({ ...settings, prospectionSmallModel: e.target.value })} style={{ width: "100%", minHeight: 46, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: "0 14px", fontSize: 14, outline: "none", background: "#fff" }}>
                {MODELS_SMALL.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
            </div>
            <div>
              <button type="button" onClick={() => setShowSmallPrompt((value) => !value)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: 0, background: "transparent", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#5f6b7a" }}>
                {showSmallPrompt ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Prompt Small AI
              </button>
              {showSmallPrompt ? <textarea value={settings.prospectionSmallPrompt} onChange={(e) => setSettings({ ...settings, prospectionSmallPrompt: e.target.value })} rows={5} style={{ width: "100%", marginTop: 10, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: 14, fontSize: 13, lineHeight: "20px", outline: "none", fontFamily: "monospace", resize: "vertical" }} /> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#121a2e" }}>Auto-analyse</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(18,26,46,0.52)" }}>Regenerer les squelettes tous les N prospects envoyes.</p>
              </div>
              <InlineToggle checked={settings.prospectionAutoAnalysis} onClick={() => setSettings((current) => ({ ...current, prospectionAutoAnalysis: !current.prospectionAutoAnalysis }))} />
            </div>
            {settings.prospectionAutoAnalysis ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "#5f6b7a" }}>Analyser tous les</span>
                <input type="number" min={5} max={100} step={5} value={settings.prospectionAutoAnalysisEvery} onChange={(e) => setSettings((current) => ({ ...current, prospectionAutoAnalysisEvery: Math.max(5, parseInt(e.target.value, 10) || 10) }))} style={{ width: 72, minHeight: 40, borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", padding: "0 10px", fontSize: 14, outline: "none" }} />
                <span style={{ fontSize: 13, color: "#5f6b7a" }}>prospects</span>
              </div>
            ) : null}
          </div>
        </section>

        <section style={{ borderRadius: 24, background: "#fff", border: "1px solid rgba(18,26,46,0.08)", boxShadow: "0 18px 40px rgba(18,26,46,0.06)", padding: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Airtable</h2>
          <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
            <input value={settings.airtableKey} onChange={(e) => setSettings({ ...settings, airtableKey: e.target.value })} placeholder="PAT Airtable" style={{ width: "100%", minHeight: 46, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: "0 14px", fontSize: 14, outline: "none" }} />
            <input value={settings.airtableBaseId} onChange={(e) => setSettings({ ...settings, airtableBaseId: e.target.value })} placeholder="Base ID" style={{ width: "100%", minHeight: 46, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: "0 14px", fontSize: 14, outline: "none" }} />
            <input value={settings.airtableTableName} onChange={(e) => setSettings({ ...settings, airtableTableName: e.target.value })} placeholder="Nom de la table" style={{ width: "100%", minHeight: 46, borderRadius: 14, border: "1px solid rgba(18,26,46,0.12)", padding: "0 14px", fontSize: 14, outline: "none" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#121a2e" }}>Synchronisation automatique</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(18,26,46,0.52)" }}>A chaque changement de statut.</p>
              </div>
              <InlineToggle checked={settings.airtableAutoSync} onClick={() => setSettings((current) => ({ ...current, airtableAutoSync: !current.airtableAutoSync }))} />
            </div>
          </div>
        </section>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, paddingBottom: 28 }}>
          <div>
            {saveError ? <span style={{ fontSize: 12, color: "#dc2626" }}>{saveError}</span> : <span style={{ fontSize: 12, color: "rgba(18,26,46,0.45)" }}>Sauvegarde auto et sync Supabase actives.</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={() => void handleForceSupabaseSync()} disabled={syncingSupabase || testingPersistence} style={{ minHeight: 42, padding: "0 14px", borderRadius: 12, border: "1px solid rgba(18,26,46,0.12)", background: "#fff", color: "#121a2e", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {syncingSupabase ? "Sync..." : "Forcer la sync"}
            </button>
            <button type="button" onClick={() => void handleTestPersistence()} disabled={syncingSupabase || testingPersistence} style={{ minHeight: 42, padding: "0 14px", borderRadius: 12, border: "1px solid rgba(10,102,194,0.2)", background: "#eef6ff", color: "#0A66C2", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {testingPersistence ? "Test..." : "Tester apres push"}
            </button>
            <button type="button" onClick={() => void handleSave()} style={{ minHeight: 42, padding: "0 16px", borderRadius: 12, border: "none", background: saved ? "#22c55e" : "#0A66C2", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              {saved ? <><Check size={14} /> Enregistre</> : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
