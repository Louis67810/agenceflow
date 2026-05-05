"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  ExternalLink,
  KeyRound,
  LayoutTemplate,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

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

function StatusBadge({ connected }: { connected: boolean }) {
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
        background: connected ? "#d1fae5" : "#f4f4f5",
        color: connected ? "#168b64" : "rgba(18,26,46,0.48)",
      }}
    >
      {connected ? <CheckCircle2 size={13} /> : <Lock size={13} />}
      {connected ? "Connecte" : "A connecter"}
    </span>
  );
}

function SettingCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
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
        <StatusBadge connected={false} />
      </div>
      {children}
    </section>
  );
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: "text" | "password" | "url" }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.62)", fontFamily: "Inter, sans-serif" }}>{label}</span>
      <input type={type} placeholder={placeholder} style={{ ...inputStyle, fontFamily: type === "password" ? "monospace" : '"Inter", sans-serif' }} />
    </label>
  );
}

export default function ArticleSettingsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#fbfbfb", padding: "52px 64px", color: "#121a2e", ...jk }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, paddingBottom: 24, borderBottom: "1px solid rgba(18,26,46,0.12)" }}>
        <div>
          <Link href="/admin/articles" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(18,26,46,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            <ArrowLeft size={15} /> Retour aux articles
          </Link>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: "41px", fontWeight: 750, letterSpacing: "-0.04em" }}>Parametres articles</h1>
        </div>
        <button type="button" style={{ minHeight: 46, borderRadius: 10, border: "1px solid rgba(1,71,255,0.18)", background: "#e8edff", color: "#0147ff", padding: "0 18px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 750, fontFamily: "Inter, sans-serif" }}>
          <RefreshCw size={15} /> Tester les connexions
        </button>
      </header>

      <section style={{ marginTop: 34, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 330px", gap: 22, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SettingCard
            title="Framer"
            description="Preparation de la publication des pages article vers un projet Framer. Les champs sont prets pour brancher l'API ensuite."
            icon={<LayoutTemplate size={21} />}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Project ID" placeholder="framer_project_..." />
              <Field label="Collection articles" placeholder="Articles / Blog / SEO" />
              <Field label="Token API" placeholder="framer_..." type="password" />
              <Field label="URL du site Framer" placeholder="https://agence.framer.website" type="url" />
            </div>
          </SettingCard>

          <SettingCard
            title="Cloudflare"
            description="Configuration prevue pour le domaine, le cache, les webhooks et la protection des routes article."
            icon={<Cloud size={22} />}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Account ID" placeholder="cloudflare_account_id" />
              <Field label="Zone ID" placeholder="cloudflare_zone_id" />
              <Field label="Token API" placeholder="cf_..." type="password" />
              <Field label="Domaine articles" placeholder="https://blog.votredomaine.com" type="url" />
            </div>
          </SettingCard>
        </div>

        <aside style={{ borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, padding: 22, display: "grid", gap: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, lineHeight: "24px", fontWeight: 750 }}>Connexion a finaliser</h2>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: "20px", color: "rgba(18,26,46,0.54)", fontFamily: "Inter, sans-serif" }}>
              Cette page pose l'interface de configuration. Le branchement backend pourra ensuite chiffrer les tokens et synchroniser Framer/Cloudflare depuis l'espace articles.
            </p>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {[
              { icon: <KeyRound size={15} />, label: "Stockage securise des tokens" },
              { icon: <LayoutTemplate size={15} />, label: "Creation de page Framer" },
              { icon: <Cloud size={15} />, label: "Purge cache Cloudflare" },
              { icon: <ShieldCheck size={15} />, label: "Validation domaine et SSL" },
            ].map((item) => (
              <div key={item.label} style={{ minHeight: 42, borderRadius: 10, background: "#f7f8fb", border: "1px solid rgba(18,26,46,0.06)", padding: "0 12px", display: "flex", alignItems: "center", gap: 10, color: "rgba(18,26,46,0.7)", fontSize: 13, fontWeight: 650, fontFamily: "Inter, sans-serif" }}>
                <span style={{ color: "#0147ff", display: "flex" }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>

          <a href="https://developers.cloudflare.com/api/" target="_blank" rel="noopener noreferrer" style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgba(18,26,46,0.1)", color: "#121a2e", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>
            Docs Cloudflare <ExternalLink size={13} />
          </a>
        </aside>
      </section>
    </main>
  );
}
