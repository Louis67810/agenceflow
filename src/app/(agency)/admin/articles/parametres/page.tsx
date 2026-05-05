"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  Code2,
  ExternalLink,
  KeyRound,
  Lock,
  RefreshCw,
  Rocket,
  ShieldCheck,
  UploadCloud,
  Workflow,
} from "lucide-react";

type ConnectionState = "idle" | "testing" | "connected" | "error";

type ArticleFramerSettings = {
  projectId: string;
  collectionName: string;
  apiToken: string;
  siteUrl: string;
  cloudflareUploadUrl: string;
  cloudflareDestination: string;
  cloudflareAccountId: string;
  cloudflareZoneId: string;
  cloudflareToken: string;
  articleDomain: string;
};

const STORAGE_KEY = "agenceflow.articlePublishingSettings.v1";
const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;
const cardShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";
const emptySettings: ArticleFramerSettings = {
  projectId: "",
  collectionName: "Articles",
  apiToken: "",
  siteUrl: "",
  cloudflareUploadUrl: "",
  cloudflareDestination: "/articles/{slug}/index.html",
  cloudflareAccountId: "",
  cloudflareZoneId: "",
  cloudflareToken: "",
  articleDomain: "",
};

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

export default function ArticleSettingsPage() {
  const [settings, setSettings] = useState<ArticleFramerSettings>(emptySettings);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [message, setMessage] = useState("Renseigne les champs Framer, puis teste la connexion.");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      setSettings({ ...emptySettings, ...JSON.parse(stored) });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  function updateSetting<K extends keyof ArticleFramerSettings>(key: K, value: ArticleFramerSettings[K]) {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setConnectionState("idle");
    setMessage("Parametres modifies. Relance le test pour confirmer l'etat de connexion.");
  }

  async function testFramerConnection() {
    setConnectionState("testing");
    setMessage("Test de la configuration Framer en cours...");
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
        setConnectionState("error");
        setMessage(data.message || "Configuration Framer non valide.");
        return;
      }
      setConnectionState("connected");
      setMessage(data.message || "Configuration Framer prete cote app.");
    } catch {
      setConnectionState("error");
      setMessage("Impossible de tester la connexion depuis l'application.");
    }
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
        <button onClick={testFramerConnection} disabled={connectionState === "testing"} type="button" style={{ minHeight: 46, borderRadius: 10, border: "1px solid rgba(1,71,255,0.18)", background: "#e8edff", color: "#0147ff", padding: "0 18px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 750, fontFamily: "Inter, sans-serif", opacity: connectionState === "testing" ? 0.65 : 1, cursor: connectionState === "testing" ? "wait" : "pointer" }}>
          <RefreshCw size={15} /> {connectionState === "testing" ? "Test en cours" : "Tester Framer"}
        </button>
      </header>

      <section style={{ marginTop: 34, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 22, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SettingCard
            title="Connexion Framer"
            description="Framer ne fournit pas un simple lien de creation de page a coller ici. La creation/synchronisation d'articles passe par un plugin Framer connecte a la collection CMS ; ce test verifie que l'app est prete a lui parler."
            icon={<KeyRound size={21} />}
            badge={<StatusBadge state={connectionState} />}
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
            description="Configuration pour publier le fichier HTML genere sur Cloudflare, puis purger le cache du domaine articles."
            icon={<Cloud size={22} />}
            badge={<StatusBadge state="idle" />}
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
        </div>

        <aside style={{ display: "grid", gap: 18 }}>
          <section style={{ borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, padding: 22, display: "grid", gap: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, lineHeight: "24px", fontWeight: 750, display: "flex", alignItems: "center", gap: 8 }}><Workflow size={18} /> Etat Framer</h2>
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
