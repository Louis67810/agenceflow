"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  Code2,
  ExternalLink,
  KeyRound,
  LayoutTemplate,
  Lock,
  RefreshCw,
  Rocket,
  ShieldCheck,
  UploadCloud,
  Workflow,
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
const textareaStyle = {
  ...inputStyle,
  minHeight: 128,
  padding: 14,
  lineHeight: "20px",
  resize: "vertical",
  fontFamily: "monospace",
} as const;

const pipelineSteps = [
  "Creer ou mettre a jour la page article dans Framer via API",
  "Executer le script Python de conversion Framer vers HTML quand il sera fourni",
  "Uploader le fichier HTML genere sur Cloudflare",
  "Purger le cache et verifier le domaine public",
];

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
  statusLabel = "A connecter",
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
  statusLabel?: string;
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
        <span style={{ minHeight: 28, borderRadius: 999, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, background: "#f4f4f5", color: "rgba(18,26,46,0.48)", whiteSpace: "nowrap" }}>
          <Lock size={13} />{statusLabel}
        </span>
      </div>
      {children}
    </section>
  );
}

function Field({ label, placeholder, type = "text", help }: { label: string; placeholder: string; type?: "text" | "password" | "url"; help?: string }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.62)", fontFamily: "Inter, sans-serif" }}>{label}</span>
      <input type={type} placeholder={placeholder} style={{ ...inputStyle, fontFamily: type === "password" ? "monospace" : '"Inter", sans-serif' }} />
      {help ? <span style={{ fontSize: 11, lineHeight: "16px", color: "rgba(18,26,46,0.42)", fontFamily: "Inter, sans-serif" }}>{help}</span> : null}
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

      <section style={{ marginTop: 34, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 22, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SettingCard
            title="Framer API"
            description="Configuration de la creation de page Framer depuis un article AgenceFlow. Le lien API peut pointer vers Framer directement ou vers ton endpoint intermediaire."
            icon={<LayoutTemplate size={21} />}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Lien API de creation" placeholder="https://api.framer.com/... ou https://ton-endpoint.com/framer" type="url" help="C'est ici que tu pourras coller le lien API exact quand tu l'auras." />
              <Field label="Project ID" placeholder="framer_project_..." />
              <Field label="Collection articles" placeholder="Articles / Blog / SEO" />
              <Field label="Token API Framer" placeholder="framer_..." type="password" />
              <Field label="URL du site Framer" placeholder="https://agence.framer.website" type="url" />
              <Field label="Template de page" placeholder="article-seo-default" />
            </div>
          </SettingCard>

          <SettingCard
            title="Script Python a brancher plus tard"
            description="Emplacement reserve pour le script qui transformera le site ou la page Framer en fichier HTML. Rien n'est execute pour le moment."
            icon={<Code2 size={22} />}
            statusLabel="En attente du script"
          >
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Commande prevue" placeholder="python scripts/framer_to_html.py --url ... --out article.html" help="On pourra raccorder cette commande quand tu m'enverras le script Python." />
                <Field label="Chemin de sortie HTML" placeholder="exports/articles/{slug}.html" />
              </div>
              <label style={{ display: "grid", gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.62)", fontFamily: "Inter, sans-serif" }}>Zone reservee au script Python</span>
                <textarea placeholder="# Colle ici le script Python plus tard, ou indique son chemin dans le repo." style={textareaStyle} />
              </label>
            </div>
          </SettingCard>

          <SettingCard
            title="Cloudflare upload HTML"
            description="Configuration pour publier le fichier HTML genere sur Cloudflare, puis purger le cache du domaine articles."
            icon={<Cloud size={22} />}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Lien API upload Cloudflare" placeholder="https://api.cloudflare.com/client/v4/..." type="url" help="Tu pourras aussi mettre ici un Worker, une Pages Function ou ton propre endpoint." />
              <Field label="Destination HTML" placeholder="/articles/{slug}/index.html" />
              <Field label="Account ID" placeholder="cloudflare_account_id" />
              <Field label="Zone ID" placeholder="cloudflare_zone_id" />
              <Field label="Token API Cloudflare" placeholder="cf_..." type="password" />
              <Field label="Domaine articles" placeholder="https://blog.votredomaine.com" type="url" />
            </div>
          </SettingCard>
        </div>

        <aside style={{ display: "grid", gap: 18 }}>
          <section style={{ borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, padding: 22, display: "grid", gap: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, lineHeight: "24px", fontWeight: 750, display: "flex", alignItems: "center", gap: 8 }}><Workflow size={18} /> Pipeline prevu</h2>
              <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: "20px", color: "rgba(18,26,46,0.54)", fontFamily: "Inter, sans-serif" }}>
                La page laisse maintenant la place pour toute la chaine Framer vers HTML puis Cloudflare. Les boutons restent inactifs tant que le backend n'est pas cable.
              </p>
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
              { icon: <Rocket size={15} />, label: "Route API de publication article" },
              { icon: <UploadCloud size={15} />, label: "Upload HTML vers Cloudflare" },
              { icon: <ShieldCheck size={15} />, label: "Validation domaine et purge cache" },
            ].map((item) => (
              <div key={item.label} style={{ minHeight: 38, borderRadius: 10, background: "#f7f8fb", border: "1px solid rgba(18,26,46,0.06)", padding: "0 12px", display: "flex", alignItems: "center", gap: 10, color: "rgba(18,26,46,0.7)", fontSize: 13, fontWeight: 650, fontFamily: "Inter, sans-serif" }}>
                <span style={{ color: "#0147ff", display: "flex" }}>{item.icon}</span>
                {item.label}
              </div>
            ))}

            <a href="https://developers.cloudflare.com/api/" target="_blank" rel="noopener noreferrer" style={{ minHeight: 42, borderRadius: 10, border: "1px solid rgba(18,26,46,0.1)", color: "#121a2e", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", marginTop: 4 }}>
              Docs Cloudflare <ExternalLink size={13} />
            </a>
          </section>
        </aside>
      </section>
    </main>
  );
}
