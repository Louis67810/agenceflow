"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Brain,
  Bug,
  CheckCircle2,
  Clock3,
  Cloud,
  Code2,
  ExternalLink,
  FileBarChart,
  KeyRound,
  Lock,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Workflow,
} from "lucide-react";
import {
  DEFAULT_ARTICLE_SETTINGS,
  fetchRemoteArticleConfig,
  hasMeaningfulArticleSettings,
  loadLocalArticleConnection,
  loadLocalArticleSettings,
  normalizeArticleConnection,
  normalizeArticleSettings,
  saveLocalArticleConfig,
  saveRemoteArticleConfig,
  type ArticlePublishingConnection,
  type ArticlePublishingSettings,
} from "@/lib/articles/settings";

type ConnectionState = "idle" | "testing" | "connected" | "error";

type TrackingDiagnostic = {
  ok: boolean;
  appOrigin: string;
  scriptUrl: string;
  collectUrl: string;
  scriptTag: string;
  checkedAt: string;
  cors: {
    articleOrigin: string;
    allowedOrigins: string[];
    allowed: boolean;
    mode: "open" | "restricted";
  };
  env: {
    supabaseUrlConfigured: boolean;
    serviceRoleConfigured: boolean;
    allowedOriginsConfigured: boolean;
  };
  db: {
    serviceRoleConfigured: boolean;
    tableReadable: boolean;
    totalEvents: number;
    recentEvents24h: number;
    recentEvents7d: number;
    latestEvents: Array<{
      site_id: string | null;
      event_name: string | null;
      event_time: string | null;
      url: string | null;
      path: string | null;
    }>;
    error: string;
  };
  recommendations: string[];
};

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;
const cardShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";

const inputStyle = {
  width: "100%",
  minHeight: 46,
  borderRadius: 12,
  border: "1px solid rgba(18,26,46,0.12)",
  background: "#fff",
  padding: "0 14px",
  color: "#121a2e",
  fontSize: 14,
  outline: "none",
  fontFamily: '"Inter", sans-serif',
  boxSizing: "border-box",
} as const;

const textareaStyle = {
  ...inputStyle,
  minHeight: 116,
  padding: 14,
  lineHeight: "19px",
  resize: "vertical",
  fontFamily: "monospace",
} as const;

const pipelineSteps = [
  "Synchroniser l'article avec la collection CMS Framer depuis un plugin Framer",
  "Executer le script Python de conversion Framer vers HTML quand il sera fourni",
  "Uploader le fichier HTML genere sur Cloudflare",
  "Purger le cache et verifier le domaine public",
];

function StatusBadge({ state }: { state: ConnectionState }) {
  const connected = state === "connected";
  const error = state === "error";
  return (
    <span
      style={{
        minHeight: 28,
        borderRadius: 999,
        padding: "0 10px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 700,
        background: connected ? "#d1fae5" : error ? "#fee2e2" : "#f4f4f5",
        color: connected ? "#168b64" : error ? "#dc2626" : "rgba(18,26,46,0.48)",
        whiteSpace: "nowrap",
      }}
    >
      {connected ? <CheckCircle2 size={13} /> : error ? <AlertCircle size={13} /> : <Lock size={13} />}
      {connected ? "Pret cote app" : error ? "Non connecte" : "A tester"}
    </span>
  );
}

function SettingCard({
  title,
  description,
  icon,
  children,
  badge,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <section style={{ borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: "#e8edff", color: "#0147ff", display: "grid", placeItems: "center", flexShrink: 0 }}>
            {icon}
          </span>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, lineHeight: "24px", fontWeight: 750, color: "#121a2e" }}>{title}</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: "20px", color: "rgba(18,26,46,0.54)", fontFamily: "Inter, sans-serif" }}>{description}</p>
          </div>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "password" | "url";
  help?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.62)", fontFamily: "Inter, sans-serif" }}>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={{ ...inputStyle, fontFamily: type === "password" ? "monospace" : '"Inter", sans-serif' }} />
      {help ? <span style={{ fontSize: 11, lineHeight: "16px", color: "rgba(18,26,46,0.42)", fontFamily: "Inter, sans-serif" }}>{help}</span> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  help?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.62)", fontFamily: "Inter, sans-serif" }}>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={textareaStyle} />
      {help ? <span style={{ fontSize: 11, lineHeight: "16px", color: "rgba(18,26,46,0.42)", fontFamily: "Inter, sans-serif" }}>{help}</span> : null}
    </label>
  );
}

export default function ArticleSettingsPage() {
  const [settings, setSettings] = useState<ArticlePublishingSettings>(DEFAULT_ARTICLE_SETTINGS);
  const [connection, setConnection] = useState<ArticlePublishingConnection>({});
  const remoteSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [framerState, setFramerState] = useState<ConnectionState>("idle");
  const [cloudflareState, setCloudflareState] = useState<ConnectionState>("idle");
  const [googleAnalyticsState, setGoogleAnalyticsState] = useState<ConnectionState>("idle");
  const [trackingState, setTrackingState] = useState<ConnectionState>("idle");
  const [trackingDiagnostic, setTrackingDiagnostic] = useState<TrackingDiagnostic | null>(null);
  const [appOrigin, setAppOrigin] = useState("https://votre-domaine-agenceflow.com");
  const [message, setMessage] = useState("Renseigne les champs Framer, Cloudflare et Google Analytics, puis teste les connexions.");

  useEffect(() => {
    setAppOrigin(window.location.origin);
    const localSettings = loadLocalArticleSettings();
    const localConnection = loadLocalArticleConnection();
    if (localSettings) setSettings(localSettings);
    if (localConnection) {
      setConnection(localConnection);
      if (typeof localConnection.cloudflareConnected === "boolean") {
        setCloudflareState(localConnection.cloudflareConnected ? "connected" : "error");
      }
      if (typeof localConnection.googleAnalyticsConnected === "boolean") {
        setGoogleAnalyticsState(localConnection.googleAnalyticsConnected ? "connected" : "error");
      }
    }

    let cancelled = false;
    async function loadSettings() {
      try {
        const remote = await fetchRemoteArticleConfig();
        const shouldMigrateLocal = localSettings && hasMeaningfulArticleSettings(localSettings);
        const nextSettings = shouldMigrateLocal ? localSettings : remote.settings;
        const nextConnection = normalizeArticleConnection({
          ...remote.connection,
          ...(localConnection ?? {}),
        });
        if (shouldMigrateLocal || localConnection) {
          await saveRemoteArticleConfig(nextSettings, nextConnection);
        }
        if (cancelled) return;
        setSettings(nextSettings);
        setConnection(nextConnection);
        if (typeof nextConnection.cloudflareConnected === "boolean") {
          setCloudflareState(nextConnection.cloudflareConnected ? "connected" : "error");
        }
        if (typeof nextConnection.googleAnalyticsConnected === "boolean") {
          setGoogleAnalyticsState(nextConnection.googleAnalyticsConnected ? "connected" : "error");
        }
        saveLocalArticleConfig(nextSettings, nextConnection);
        setMessage("Parametres articles synchronises avec Supabase.");
      } catch (error) {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Impossible de synchroniser les parametres articles avec Supabase.");
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
      if (remoteSaveTimerRef.current) {
        clearTimeout(remoteSaveTimerRef.current);
      }
    };
  }, []);

  function persistConfig(nextSettings: ArticlePublishingSettings, nextConnection = connection) {
    saveLocalArticleConfig(nextSettings, nextConnection);
    if (remoteSaveTimerRef.current) {
      clearTimeout(remoteSaveTimerRef.current);
    }
    remoteSaveTimerRef.current = setTimeout(() => {
      void saveRemoteArticleConfig(nextSettings, nextConnection).catch((error) => {
        setMessage(error instanceof Error ? error.message : "Impossible de sauvegarder dans Supabase.");
      });
    }, 500);
  }

  function persistConnection(nextConnection: ArticlePublishingConnection) {
    setConnection(nextConnection);
    saveLocalArticleConfig(settings, nextConnection);
    if (remoteSaveTimerRef.current) {
      clearTimeout(remoteSaveTimerRef.current);
      remoteSaveTimerRef.current = null;
    }
    void saveRemoteArticleConfig(settings, nextConnection).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Impossible de sauvegarder l'etat des connexions dans Supabase.");
    });
  }

  function updateSetting<K extends keyof ArticlePublishingSettings>(key: K, value: ArticlePublishingSettings[K]) {
    setSettings((current) => {
      const next = normalizeArticleSettings({ ...current, [key]: value });
      persistConfig(next);
      return next;
    });
    if (key.toString().startsWith("googleAnalytics")) {
      setGoogleAnalyticsState("idle");
    } else if (key === "analyticsSiteId") {
      setTrackingState("idle");
    } else if (key.toString().startsWith("cloudflare") || key === "articleDomain") {
      setCloudflareState("idle");
      setTrackingState("idle");
    } else {
      setFramerState("idle");
    }
    setMessage("Parametres modifies. Relance le test pour confirmer l'etat des connexions.");
  }

  const trackingScriptTag = `<script async src="${appOrigin}/agenceflow-track.js?v=2" data-site-id="${settings.analyticsSiteId || "ruff-agency"}" data-endpoint="${appOrigin}/api/analytics/collect" data-debug="true"></script>`;

  async function runTrackingDiagnostic() {
    setTrackingState("testing");
    setTrackingDiagnostic(null);
    setMessage("Diagnostic tracking AgenceFlow en cours...");

    try {
      const res = await fetch("/api/analytics/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleDomain: settings.articleDomain,
          siteId: settings.analyticsSiteId,
        }),
      });
      const data = await res.json() as TrackingDiagnostic;
      setTrackingDiagnostic(data);
      setTrackingState(res.ok && data.ok ? "connected" : "error");
      setMessage(
        res.ok && data.ok
          ? `Tracking pret. ${data.db.recentEvents7d} evenement(s) recu(s) sur 7 jours.`
          : data.recommendations[0] || data.db.error || "Tracking non connecte."
      );
    } catch {
      setTrackingState("error");
      setMessage("Impossible de lancer le diagnostic tracking depuis l'application.");
    }
  }

  async function testConnections() {
    setFramerState("testing");
    setCloudflareState("testing");
    setGoogleAnalyticsState("testing");
    setMessage("Test des connexions Framer, Cloudflare et Google Analytics en cours...");

    let framerMessage = "";
    let cloudflareMessage = "";
    let googleAnalyticsMessage = "";
    let nextConnection = normalizeArticleConnection(connection);

    try {
      const res = await fetch("/api/articles/framer/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: settings.projectId,
          collectionName: settings.collectionName,
          apiToken: settings.apiToken,
          siteUrl: settings.siteUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.connected) {
        setFramerState("error");
        framerMessage = data.message || "Framer non valide.";
      } else {
        setFramerState("connected");
        framerMessage = data.message || "Framer pret cote app.";
      }
    } catch {
      setFramerState("error");
      framerMessage = "Impossible de tester Framer depuis l'application.";
    }

    try {
      const res = await fetch("/api/articles/cloudflare/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: settings.cloudflareAccountId,
          zoneId: settings.cloudflareZoneId,
          apiToken: settings.cloudflareToken,
          uploadUrl: settings.cloudflareUploadUrl,
          articleDomain: settings.articleDomain,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.connected) {
        setCloudflareState("error");
        cloudflareMessage = data.message || "Cloudflare non valide.";
        nextConnection = normalizeArticleConnection({
          ...nextConnection,
          cloudflareConnected: false,
          cloudflareMessage,
          testedAt: new Date().toISOString(),
        });
      } else {
        setCloudflareState("connected");
        cloudflareMessage = data.message || "Cloudflare connecte.";
        nextConnection = normalizeArticleConnection({
          ...nextConnection,
          cloudflareConnected: true,
          cloudflareMessage,
          testedAt: new Date().toISOString(),
        });
      }
    } catch {
      setCloudflareState("error");
      cloudflareMessage = "Impossible de tester Cloudflare depuis l'application.";
      nextConnection = normalizeArticleConnection({
        ...nextConnection,
        cloudflareConnected: false,
        cloudflareMessage,
        testedAt: new Date().toISOString(),
      });
    }

    try {
      const res = await fetch("/api/articles/google-analytics/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: settings.googleAnalyticsPropertyId,
          measurementId: settings.googleAnalyticsMeasurementId,
          apiSecret: settings.googleAnalyticsApiSecret,
          serviceAccountJson: settings.googleAnalyticsServiceAccountJson,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.connected) {
        setGoogleAnalyticsState("error");
        googleAnalyticsMessage = data.message || "Google Analytics non valide.";
      } else {
        setGoogleAnalyticsState("connected");
        googleAnalyticsMessage = data.message || "Google Analytics connecte.";
      }
      nextConnection = normalizeArticleConnection({
        ...nextConnection,
        googleAnalyticsConnected: Boolean(res.ok && data.connected),
        googleAnalyticsMessage,
        testedAt: new Date().toISOString(),
      });
    } catch {
      setGoogleAnalyticsState("error");
      googleAnalyticsMessage = "Impossible de tester Google Analytics depuis l'application.";
      nextConnection = normalizeArticleConnection({
        ...nextConnection,
        googleAnalyticsConnected: false,
        googleAnalyticsMessage,
        testedAt: new Date().toISOString(),
      });
    }

    persistConnection(nextConnection);
    setMessage(`Framer : ${framerMessage} Cloudflare : ${cloudflareMessage} Google Analytics : ${googleAnalyticsMessage}`);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#fbfbfb", padding: "52px 64px", color: "#121a2e", ...jk }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, paddingBottom: 24, borderBottom: "1px solid rgba(18,26,46,0.12)" }}>
        <div>
          <Link href="/admin/articles" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(18,26,46,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            <ArrowLeft size={15} /> Retour aux articles
          </Link>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: "41px", fontWeight: 750, letterSpacing: "-0.04em" }}>Parametres articles</h1>
        </div>
        <button onClick={testConnections} disabled={framerState === "testing" || cloudflareState === "testing" || googleAnalyticsState === "testing"} type="button" style={{ minHeight: 46, borderRadius: 10, border: "1px solid rgba(1,71,255,0.18)", background: "#e8edff", color: "#0147ff", padding: "0 18px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 750, fontFamily: "Inter, sans-serif", opacity: framerState === "testing" || cloudflareState === "testing" || googleAnalyticsState === "testing" ? 0.65 : 1, cursor: framerState === "testing" || cloudflareState === "testing" || googleAnalyticsState === "testing" ? "wait" : "pointer" }}>
          <RefreshCw size={15} /> {framerState === "testing" || cloudflareState === "testing" || googleAnalyticsState === "testing" ? "Test en cours" : "Tester les connexions"}
        </button>
      </header>

      <section style={{ marginTop: 34, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 22, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SettingCard
            title="Connexion Framer"
            description="Framer ne fournit pas un simple lien de creation de page a coller ici. La creation/synchronisation d'articles passe par un plugin Framer connecte a la collection CMS ; ce test verifie que l'app est prete a lui parler."
            icon={<KeyRound size={21} />}
            badge={<StatusBadge state={framerState} />}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Project ID" value={settings.projectId} onChange={(value) => updateSetting("projectId", value)} placeholder="framer_project_..." />
              <Field label="Collection articles" value={settings.collectionName} onChange={(value) => updateSetting("collectionName", value)} placeholder="Articles / Blog / SEO" help="Nom ou identifiant de la collection CMS Framer qui recevra les articles." />
              <Field label="Token API Framer" value={settings.apiToken} onChange={(value) => updateSetting("apiToken", value)} placeholder="framer_..." type="password" />
              <Field label="URL du site Framer" value={settings.siteUrl} onChange={(value) => updateSetting("siteUrl", value)} placeholder="https://agence.framer.website" type="url" help="Le test verifie aussi que cette URL publique repond." />
            </div>
          </SettingCard>

          <SettingCard
            title="Script Python a brancher plus tard"
            description="Emplacement reserve pour le script qui transformera le site ou la page Framer en fichier HTML. Rien n'est execute pour le moment."
            icon={<Code2 size={22} />}
            badge={<StatusBadge state="idle" />}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Commande prevue" value="" onChange={() => {}} placeholder="python scripts/framer_to_html.py --url ... --out article.html" help="On pourra raccorder cette commande quand tu m'enverras le script Python." />
              <Field label="Chemin de sortie HTML" value="" onChange={() => {}} placeholder="exports/articles/{slug}.html" />
            </div>
          </SettingCard>

          <SettingCard
            title="Cloudflare upload HTML"
            description="Le test verifie le token Cloudflare, l'Account ID, la Zone ID et la coherence du domaine articles avant de brancher l'upload HTML."
            icon={<Cloud size={22} />}
            badge={<StatusBadge state={cloudflareState} />}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Lien API upload Cloudflare" value={settings.cloudflareUploadUrl} onChange={(value) => updateSetting("cloudflareUploadUrl", value)} placeholder="https://api.cloudflare.com/client/v4/..." type="url" />
              <Field label="Destination HTML" value={settings.cloudflareDestination} onChange={(value) => updateSetting("cloudflareDestination", value)} placeholder="/articles/{slug}/index.html" />
              <Field label="Account ID" value={settings.cloudflareAccountId} onChange={(value) => updateSetting("cloudflareAccountId", value)} placeholder="cloudflare_account_id" />
              <Field label="Zone ID" value={settings.cloudflareZoneId} onChange={(value) => updateSetting("cloudflareZoneId", value)} placeholder="cloudflare_zone_id" />
              <Field label="Token API Cloudflare" value={settings.cloudflareToken} onChange={(value) => updateSetting("cloudflareToken", value)} placeholder="cf_..." type="password" />
              <Field label="Domaine articles" value={settings.articleDomain} onChange={(value) => updateSetting("articleDomain", value)} placeholder="https://blog.votredomaine.com" type="url" />
            </div>
          </SettingCard>

          <SettingCard
            title="Google Analytics"
            description="Connecte GA4 pour lire les statistiques des articles. Le Property ID + service account sert a recuperer les donnees ; Measurement ID + API Secret servira ensuite au script de tracking."
            icon={<FileBarChart size={22} />}
            badge={<StatusBadge state={googleAnalyticsState} />}
          >
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="GA4 Property ID" value={settings.googleAnalyticsPropertyId} onChange={(value) => updateSetting("googleAnalyticsPropertyId", value)} placeholder="123456789" help="ID numerique de la propriete GA4, utilise pour lire les rapports." />
                <Field label="Measurement ID" value={settings.googleAnalyticsMeasurementId} onChange={(value) => updateSetting("googleAnalyticsMeasurementId", value)} placeholder="G-XXXXXXXXXX" help="ID du flux web, utile pour le futur script de tracking." />
                <Field label="API Secret Measurement Protocol" value={settings.googleAnalyticsApiSecret} onChange={(value) => updateSetting("googleAnalyticsApiSecret", value)} placeholder="api_secret..." type="password" help="Optionnel maintenant ; utile quand on enverra les events du script." />
              </div>
              <TextAreaField label="Service Account JSON" value={settings.googleAnalyticsServiceAccountJson} onChange={(value) => updateSetting("googleAnalyticsServiceAccountJson", value)} placeholder='{"client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n..."}' help="Pour lire les stats, colle ici le JSON du service account Google qui a acces en lecture a la propriete GA4." />
            </div>
          </SettingCard>

          <SettingCard
            title="Tracking AgenceFlow"
            description="Ce bloc verifie le script, l'endpoint de collecte, la configuration Vercel/Supabase, les droits CORS et les derniers evenements recus."
            icon={<Bug size={22} />}
            badge={<StatusBadge state={trackingState} />}
          >
            <div style={{ display: "grid", gap: 14 }}>
              <Field
                label="Site ID tracking"
                value={settings.analyticsSiteId}
                onChange={(value) => updateSetting("analyticsSiteId", value)}
                placeholder="ruff-agency"
                help="Doit etre identique au data-site-id du script pose dans le head du site article."
              />

              <div style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.62)", fontFamily: "Inter, sans-serif" }}>Script a poser dans le head du site article</span>
                <pre style={{ margin: 0, borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: "#f7f8fb", color: "#121a2e", padding: 14, overflowX: "auto", fontSize: 12, lineHeight: "18px", fontFamily: "monospace" }}>{trackingScriptTag}</pre>
                <span style={{ fontSize: 11, lineHeight: "16px", color: "rgba(18,26,46,0.42)", fontFamily: "Inter, sans-serif" }}>Le `src` et `data-endpoint` doivent pointer vers ton app AgenceFlow deployee, pas vers le domaine de l'article.</span>
              </div>

              <button onClick={runTrackingDiagnostic} disabled={trackingState === "testing"} type="button" style={{ minHeight: 44, borderRadius: 10, border: "1px solid rgba(1,71,255,0.18)", background: "#e8edff", color: "#0147ff", padding: "0 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 750, fontFamily: "Inter, sans-serif", cursor: trackingState === "testing" ? "wait" : "pointer", opacity: trackingState === "testing" ? 0.65 : 1 }}>
                <RefreshCw size={15} /> {trackingState === "testing" ? "Diagnostic en cours" : "Diagnostiquer le tracking"}
              </button>

              {trackingDiagnostic ? (
                <div style={{ borderRadius: 12, border: "1px solid rgba(18,26,46,0.1)", background: "#fbfbfb", padding: 16, display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                    {[
                      { label: "Service role", value: trackingDiagnostic.env.serviceRoleConfigured ? "OK" : "Manquant" },
                      { label: "Table Supabase", value: trackingDiagnostic.db.tableReadable ? "Lisible" : "Erreur" },
                      { label: "CORS domaine", value: trackingDiagnostic.cors.allowed ? "Autorise" : "Bloque" },
                    ].map((item) => (
                      <div key={item.label} style={{ borderRadius: 10, background: "#fff", border: "1px solid rgba(18,26,46,0.07)", padding: 12 }}>
                        <span style={{ display: "block", fontSize: 11, color: "rgba(18,26,46,0.46)", fontFamily: "Inter, sans-serif" }}>{item.label}</span>
                        <strong style={{ display: "block", marginTop: 4, fontSize: 14, color: "#121a2e", fontFamily: "Inter, sans-serif" }}>{item.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "grid", gap: 6, color: "rgba(18,26,46,0.68)", fontSize: 12, lineHeight: "18px", fontFamily: "Inter, sans-serif" }}>
                    <span>Endpoint collecte : {trackingDiagnostic.collectUrl}</span>
                    <span>Domaine article detecte : {trackingDiagnostic.cors.articleOrigin || "non renseigne"}</span>
                    <span>Evenements 24h : {trackingDiagnostic.db.recentEvents24h} · 7 jours : {trackingDiagnostic.db.recentEvents7d} · total : {trackingDiagnostic.db.totalEvents}</span>
                    {trackingDiagnostic.db.error ? <span style={{ color: "#dc2626" }}>Erreur Supabase : {trackingDiagnostic.db.error}</span> : null}
                  </div>

                  {trackingDiagnostic.db.latestEvents.length > 0 ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <strong style={{ fontSize: 12, color: "rgba(18,26,46,0.64)", fontFamily: "Inter, sans-serif" }}>Derniers evenements recus</strong>
                      {trackingDiagnostic.db.latestEvents.map((event, index) => (
                        <div key={`${event.event_time}-${index}`} style={{ borderRadius: 9, background: "#fff", border: "1px solid rgba(18,26,46,0.06)", padding: "8px 10px", fontSize: 12, lineHeight: "17px", color: "rgba(18,26,46,0.68)", fontFamily: "Inter, sans-serif" }}>
                          <strong style={{ color: "#121a2e" }}>{event.event_name}</strong> · {event.site_id || "sans site"} · {event.path || event.url || "URL inconnue"}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {trackingDiagnostic.recommendations.length > 0 ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      {trackingDiagnostic.recommendations.map((recommendation) => (
                        <div key={recommendation} style={{ borderRadius: 9, background: "#fff7ed", border: "1px solid rgba(249,115,22,0.18)", padding: "8px 10px", color: "#9a3412", fontSize: 12, lineHeight: "17px", fontFamily: "Inter, sans-serif" }}>
                          {recommendation}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SettingCard>

          <SettingCard
            title="Boucle IA articles"
            description="Configure le cycle recherche -> creation -> stats -> analyse -> recommandations. Ces valeurs seront lues par la route d'automatisation quand le worker planifie sera branche."
            icon={<Brain size={22} />}
            badge={<span style={{ minHeight: 28, borderRadius: 999, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, background: "#e8edff", color: "#0147ff", whiteSpace: "nowrap" }}><Clock3 size={13} /> Configurable</span>}
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Frequence du cycle (heures)" value={settings.agentCycleFrequencyHours} onChange={(value) => updateSetting("agentCycleFrequencyHours", value)} placeholder="24" help="Exemple: 24 = un cycle par jour, 168 = un cycle par semaine." />
                <Field label="Pages a creer par cycle" value={settings.agentPagesPerCycle} onChange={(value) => updateSetting("agentPagesPerCycle", value)} placeholder="3" help="Limite de production pour eviter que l'IA publie trop de pages d'un coup." />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
                <Field label="Modele recherche" value={settings.agentResearchModel} onChange={(value) => updateSetting("agentResearchModel", value)} placeholder="perplexity/sonar-pro" />
                <Field label="Modele creation" value={settings.agentCreationModel} onChange={(value) => updateSetting("agentCreationModel", value)} placeholder="anthropic/claude-sonnet-4" />
                <Field label="Modele analyse" value={settings.agentAnalysisModel} onChange={(value) => updateSetting("agentAnalysisModel", value)} placeholder="openai/gpt-4.1" />
                <Field label="Modele recommandations" value={settings.agentRecommendationModel} onChange={(value) => updateSetting("agentRecommendationModel", value)} placeholder="anthropic/claude-sonnet-4" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <TextAreaField label="Prompt recherche" value={settings.agentResearchPrompt} onChange={(value) => updateSetting("agentResearchPrompt", value)} placeholder="Instructions pour la veille et la recherche..." />
                <TextAreaField label="Prompt creation" value={settings.agentCreationPrompt} onChange={(value) => updateSetting("agentCreationPrompt", value)} placeholder="Instructions pour creer les pages..." />
                <TextAreaField label="Prompt analyse" value={settings.agentAnalysisPrompt} onChange={(value) => updateSetting("agentAnalysisPrompt", value)} placeholder="Instructions pour analyser la data..." />
                <TextAreaField label="Prompt recommandations" value={settings.agentRecommendationPrompt} onChange={(value) => updateSetting("agentRecommendationPrompt", value)} placeholder="Instructions pour choisir le prochain cycle..." />
              </div>

              <div style={{ borderRadius: 12, border: "1px solid rgba(1,71,255,0.12)", background: "linear-gradient(135deg, rgba(232,237,255,0.9), rgba(255,255,255,0.95))", padding: 14, display: "flex", gap: 10, color: "rgba(18,26,46,0.64)", fontSize: 12, lineHeight: "18px", fontFamily: "Inter, sans-serif" }}>
                <Sparkles size={16} style={{ color: "#0147ff", flexShrink: 0, marginTop: 1 }} />
                Le cycle automatique ne tourne pas encore en arriere-plan ici : cette section prepare les prompts, modeles et limites que le worker utilisera pour eviter une boite noire.
              </div>
            </div>
          </SettingCard>
        </div>

        <aside style={{ display: "grid", gap: 18 }}>
          <section style={{ borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, padding: 22, display: "grid", gap: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, lineHeight: "24px", fontWeight: 750, display: "flex", alignItems: "center", gap: 8 }}><Workflow size={18} /> Etat connexions</h2>
              <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: "20px", color: "rgba(18,26,46,0.54)", fontFamily: "Inter, sans-serif" }}>{message}</p>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {pipelineSteps.map((label, index) => (
                <div key={label} style={{ minHeight: 44, borderRadius: 10, background: "#f7f8fb", border: "1px solid rgba(18,26,46,0.06)", padding: "9px 12px", display: "flex", alignItems: "center", gap: 10, color: "rgba(18,26,46,0.72)", fontSize: 13, fontWeight: 650, lineHeight: "18px", fontFamily: "Inter, sans-serif" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 999, background: "#e8edff", color: "#0147ff", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 12, fontWeight: 800 }}>{index + 1}</span>
                  {label}
                </div>
              ))}
            </div>
          </section>

          <section style={{ borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, padding: 22, display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, lineHeight: "24px", fontWeight: 750 }}>A raccorder ensuite</h2>
            {[
              { icon: <KeyRound size={15} />, label: "Stockage securise des tokens" },
              { icon: <Rocket size={15} />, label: "Plugin Framer de synchronisation CMS" },
              { icon: <UploadCloud size={15} />, label: "Upload HTML vers Cloudflare" },
              { icon: <FileBarChart size={15} />, label: "Lecture des rapports Google Analytics" },
              { icon: <ShieldCheck size={15} />, label: "Validation domaine et purge cache" },
            ].map((item) => (
              <div key={item.label} style={{ minHeight: 38, borderRadius: 10, background: "#f7f8fb", border: "1px solid rgba(18,26,46,0.06)", padding: "0 12px", display: "flex", alignItems: "center", gap: 10, color: "rgba(18,26,46,0.7)", fontSize: 13, fontWeight: 650, fontFamily: "Inter, sans-serif" }}>
                <span style={{ color: "#0147ff", display: "flex" }}>{item.icon}</span>
                {item.label}
              </div>
            ))}

            <a href="https://www.framer.com/developers/cms/" target="_blank" rel="noopener noreferrer" style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgba(18,26,46,0.1)", color: "#121a2e", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
              Docs CMS Framer <ExternalLink size={13} />
            </a>
          </section>
        </aside>
      </section>
    </main>
  );
}
