"use client";

import { useState, useEffect, useMemo } from "react";
import type { CSSProperties, ReactNode, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  CheckCircle2, AlertCircle, Loader2, Eye, EyeOff,
  ChevronRight, ChevronLeft,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormField {
  id: string; label: string; type: string;
  required?: boolean; placeholder?: string; options?: string[];
}

interface FormPage { id: string; title: string; fields: FormField[] }

interface KeyData {
  name: string; role: string;
  form_fields: FormField[];
  form_pages: FormPage[];
  used_at: string | null;
}

type Step = "loading" | "not_found" | "already_done" | "register" | "form" | "done";

// ─── Styles partagés ──────────────────────────────────────────────────────────

const jakartaSans: CSSProperties = { fontFamily: '"Plus Jakarta Sans", sans-serif' };
const inter: CSSProperties       = { fontFamily: '"Inter", sans-serif' };

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 16px",
  fontSize: 14,
  letterSpacing: "-0.45px",
  lineHeight: "24px",
  color: "#121a2e",          // full opacity — placeholder stays lighter via browser default
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: 8,
  outline: "none",
  background: "#f6f6f6",
  boxSizing: "border-box" as const,
};

// ─── Card — OUTSIDE component so it never remounts on re-render ───────────────
// (Définir Card à l'intérieur d'AccessForm cause un bug : chaque frappe
//  crée un nouveau type de composant → React démonte/remonte → le champ
//  perd le focus.)

function Card({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#fbfbfb",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Formes vectorielles décoratives */}
      <div style={{ position: "fixed", top: -80, left: -80, pointerEvents: "none", zIndex: 0, opacity: 1 }}>
        <svg width="536" height="381" viewBox="0 0 536 381" fill="none">
          <path d="M-105.779 298.796L-16.318 200.598C19.5701 161.204 67.5899 134.929 120.117 125.944L165.562 118.171C239.925 105.451 307.961 162.424 308.498 237.865L308.59 250.76C308.852 287.596 288.962 321.63 256.739 339.481C164.916 390.35 66.3265 284.243 123.794 196.399L226.048 40.0931C231.006 32.5132 236.656 25.4082 242.923 18.869L515.967 -266" stroke="black" strokeOpacity="0.04" strokeWidth="54.8704"/>
        </svg>
      </div>
      <div style={{ position: "fixed", bottom: -120, right: -150, pointerEvents: "none", zIndex: 0, opacity: 1 }}>
        <svg width="639" height="523" viewBox="0 0 639 523" fill="none">
          <path d="M886.172 190.892L755.943 274.388C703.7 307.884 641.765 322.966 579.971 317.241L526.508 312.287C439.026 304.182 379.667 219.588 401.801 134.566L405.584 120.033C416.392 78.5181 449.024 46.2292 490.651 35.8613C609.272 6.31655 688.19 155.388 597.071 236.881L434.937 381.884C427.074 388.915 418.578 395.205 409.557 400.671L16.5576 638.814" stroke="black" strokeOpacity="0.04" strokeWidth="63.8992"/>
        </svg>
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <svg width="94" height="71" viewBox="0 0 141 106" fill="none">
            <defs>
              <filter id="logo_filter" x="0" y="0" width="140.428" height="105.921" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="-1.42326" dy="1.42326"/><feGaussianBlur stdDeviation="2.37209"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"/>
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="-5.2186" dy="6.64186"/><feGaussianBlur stdDeviation="4.26977"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.09 0"/>
                <feBlend mode="normal" in2="effect1_dropShadow" result="effect2_dropShadow"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="-11.8605" dy="14.707"/><feGaussianBlur stdDeviation="5.69302"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0"/>
                <feBlend mode="normal" in2="effect2_dropShadow" result="effect3_dropShadow"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="-21.3488" dy="26.093"/><feGaussianBlur stdDeviation="6.87907"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.01 0"/>
                <feBlend mode="normal" in2="effect3_dropShadow" result="effect4_dropShadow"/>
                <feBlend mode="normal" in="SourceGraphic" in2="effect4_dropShadow" result="shape"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dy="2.37209"/><feGaussianBlur stdDeviation="1.82651"/>
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
                <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.2 0"/>
                <feBlend mode="normal" in2="shape" result="effect5_innerShadow"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dy="-1.42326"/><feGaussianBlur stdDeviation="1.66047"/>
                <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/>
                <feBlend mode="normal" in2="effect5_innerShadow" result="effect6_innerShadow"/>
              </filter>
            </defs>
            <g filter="url(#logo_filter)">
              <path d="M35.1074 23.2284C35.1074 19.6945 37.7007 16.696 41.1976 16.1865L128.965 3.39741C133.258 2.77181 137.107 6.10068 137.107 10.4393V58.9532C137.107 63.1877 133.432 66.4853 129.222 66.0278L41.4547 56.4878C37.8434 56.0953 35.1074 53.0458 35.1074 49.4132V23.2284Z" fill="#1A1A1A"/>
            </g>
            <path d="M110.839 36.5656L110.902 56.8713L114.848 57.4017L118.803 57.9326V43.3015L118.846 40.5358H123.239H127.675V36.3154V33.5001L123.304 33.4584L118.911 33.3958L118.846 31.8735L118.803 20.8691C118.803 20.8691 121.98 20.2718 124.023 19.9289C125.77 19.6357 128.504 19.2237 128.504 19.2237L128.974 19.1658V12.5581L119.665 13.8082L110.839 14.9936V36.5656Z" fill="white"/>
            <path d="M90.8359 35.3848V54.1769L94.7851 54.7065L98.7996 55.2461V42.1207L98.8428 39.355H103.236H107.672V35.1346V32.3193L103.301 32.2776L98.9078 32.215L98.8428 30.6927L98.7996 22.2574L104.023 21.3608L108.47 20.5514L108.971 20.4576V15.2453L99.8538 16.4701L90.7959 17.687L90.8359 35.3848Z" fill="white"/>
            <path d="M67.6309 20.7996V24.1488V33.5693V44.6388C67.6309 47.9069 69.6669 51.3068 71.7685 51.6169L81.6776 52.9475C86.6583 53.6166 88.1961 48.3788 88.1961 44.9637V43.8288V33.4487V18.037L84.6818 18.5085L80.7304 19.039L80.7942 32.8436V44.3788C80.3974 46.1958 76.0976 46.1455 75.3095 44.3788C75.2259 44.1771 75.179 32.7392 75.179 32.7392V19.7859L72.0285 20.2086L67.6309 20.7996Z" fill="white"/>
            <path d="M44.3438 36.0216V47.9313L48.1736 48.445L51.0821 48.8352V44.2121V40.6183H52.6805C53.5854 40.5594 53.9176 40.6183 54.6489 41.3496C55.249 41.9448 55.1313 42.2115 55.8887 44.2121L57.1153 49.6462L61.2271 50.1982L66.0476 50.8457L64.0104 45.3456L61.9785 40.9317L61.2263 39.4691L62.1456 38.508C63.9007 36.7111 64.6529 33.9949 64.2142 31.1115C63.6709 27.3923 61.5549 22.8986 57.8984 22.1046L50.5337 23.0933L44.3438 23.9234V36.0216ZM55.705 30.2234C56.384 30.9025 56.3109 32.9919 55.705 33.7441C55.3498 34.1829 54.7386 34.3292 53.276 34.3918H51.0821V32.5949V29.5183H53.276C54.5088 29.5183 55.3132 29.8317 55.705 30.2234Z" fill="white"/>
          </svg>
        </div>

        {/* Card body */}
        <div style={{
          width: "100%",
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.13)",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0px 96px 27px rgba(0,0,0,0), 0px 62px 25px rgba(0,0,0,0.01), 0px 35px 21px rgba(0,0,0,0.03), 0px 15px 15px rgba(0,0,0,0.04), 0px 4px 8px rgba(0,0,0,0.05)",
          padding: "40px 40px",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccessForm({ accessKey }: { accessKey: string }) {
  const router = useRouter();
  const [step, setStep]       = useState<Step>("loading");
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [userId, setUserId]   = useState<string | null>(null);

  // Register
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirmPwd, setConfirmPwd]   = useState("");
  const [showPwd, setShowPwd]         = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Form (multi-page)
  const [pageIndex, setPageIndex]   = useState(0);
  const [values, setValues]         = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);
  const [pageError, setPageError]   = useState<string | null>(null);

  // useMemo évite de recréer le client à chaque re-render
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    fetch(`/api/keys/${accessKey}`)
      .then((r) => { if (!r.ok) { setStep("not_found"); return null; } return r.json(); })
      .then((d) => {
        if (!d) return;
        setKeyData(d);
        setStep(d.used_at ? "already_done" : "register");
      });
  }, [accessKey]);

  // ── Pages ──────────────────────────────────────────────────────────────────

  const pages: FormPage[] = (() => {
    if (keyData?.form_pages?.length) return keyData.form_pages;
    if (keyData?.form_fields?.length) return [{ id: "p0", title: "Formulaire", fields: keyData.form_fields }];
    return [];
  })();

  const totalPages  = pages.length;
  const currentPage = pages[pageIndex];
  const isLastPage  = pageIndex === totalPages - 1;

  function validatePage() {
    const missing = (currentPage?.fields ?? []).filter((f) => f.required && !values[f.id]);
    if (missing.length > 0) {
      setPageError(`Champ${missing.length > 1 ? "s" : ""} requis : ${missing.map((f) => f.label).join(", ")}`);
      return false;
    }
    setPageError(null);
    return true;
  }

  function handleNext() { if (!validatePage()) return; setPageIndex((i) => i + 1); }
  function handlePrev() { setPageError(null); setPageIndex((i) => i - 1); }

  // ── Register ───────────────────────────────────────────────────────────────

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPwd) { setRegisterError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 6) { setRegisterError("Le mot de passe doit faire au moins 6 caractères."); return; }
    setRegistering(true);
    setRegisterError(null);

    const res = await fetch(`/api/keys/${accessKey}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.error === "already_exists") {
        const { data: siData, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
        if (siErr) { setRegisterError("Un compte existe déjà. Vérifiez votre mot de passe."); setRegistering(false); return; }
        if (siData.user) setUserId(siData.user.id);
      } else {
        setRegisterError(data.error ?? "Erreur lors de la création du compte.");
        setRegistering(false);
        return;
      }
    } else {
      const { data: siData, error: siErr } = await supabase.auth.signInWithPassword({ email, password });
      if (siErr) { setRegisterError("Compte créé mais connexion échouée : " + siErr.message); setRegistering(false); return; }
      if (siData.user) setUserId(siData.user.id);
    }

    setRegistering(false);
    setStep("form");
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validatePage()) return;
    setSubmitting(true);
    setFormError(null);

    let uid = userId;
    if (!uid) {
      const { data: { session } } = await supabase.auth.getSession();
      uid = session?.user?.id ?? null;
    }

    if (!uid) {
      setFormError("Session expirée. Rechargez la page et reconnectez-vous.");
      setSubmitting(false);
      return;
    }

    const res = await fetch(`/api/keys/${accessKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, _user_id: uid, _client_name: keyData?.name, _client_email: email }),
    });
    const data = await res.json();

    if (!res.ok) {
      setFormError(data.error ?? "Erreur lors de l'envoi.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    if (data.role === "designer" || data.role === "developer") router.push("/designer");
    else router.push("/client");
  };

  // ── Field renderer ─────────────────────────────────────────────────────────

  function renderField(field: FormField) {
    const val = (values[field.id] ?? "") as string;
    const setVal = (v: string) => setValues((p) => ({ ...p, [field.id]: v }));

    const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = "rgba(78,126,250,0.5)";
      e.currentTarget.style.background  = "#fff";
    };
    const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)";
      e.currentTarget.style.background  = "#f6f6f6";
    };

    switch (field.type) {
      case "textarea":
        return <textarea value={val} onChange={(e) => setVal(e.target.value)} required={field.required}
          placeholder={field.placeholder} rows={3}
          onFocus={focusStyle as React.FocusEventHandler<HTMLTextAreaElement>}
          onBlur={blurStyle as React.FocusEventHandler<HTMLTextAreaElement>}
          style={{ ...inputStyle, resize: "none" }} />;
      case "select":
        return (
          <select value={val} onChange={(e) => setVal(e.target.value)} required={field.required}
            onFocus={focusStyle as React.FocusEventHandler<HTMLSelectElement>}
            onBlur={blurStyle as React.FocusEventHandler<HTMLSelectElement>}
            style={inputStyle}>
            <option value="">-- Choisir --</option>
            {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case "radio":
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {field.options?.map((o) => (
              <label key={o} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px", borderRadius: 10,
                border: val === o ? "1px solid rgba(78,126,250,0.6)" : "1px solid rgba(0,0,0,0.08)",
                background: val === o ? "rgba(78,126,250,0.05)" : "#fff",
                fontSize: 14, cursor: "pointer", color: "#121a2e",
              }}>
                <input type="radio" name={field.id} value={o} checked={val === o} onChange={() => setVal(o)} />
                {o}
              </label>
            ))}
          </div>
        );
      case "checkbox": {
        const checked = (values[field.id] as string[] | undefined) ?? [];
        const toggle = (o: string) => setValues((p) => {
          const arr = (p[field.id] as string[] | undefined) ?? [];
          return { ...p, [field.id]: arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o] };
        });
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
            {field.options?.map((o) => (
              <label key={o} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px", borderRadius: 10,
                border: checked.includes(o) ? "1px solid rgba(78,126,250,0.6)" : "1px solid rgba(0,0,0,0.08)",
                background: checked.includes(o) ? "rgba(78,126,250,0.05)" : "#fff",
                fontSize: 14, cursor: "pointer", color: "#121a2e",
              }}>
                <input type="checkbox" checked={checked.includes(o)} onChange={() => toggle(o)} />
                {o}
              </label>
            ))}
          </div>
        );
      }
      default:
        return (
          <input
            type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "phone" ? "tel" : "text"}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            required={field.required}
            placeholder={field.placeholder ?? ""}
            style={inputStyle}
            onFocus={focusStyle}
            onBlur={blurStyle}
          />
        );
    }
  }

  // ── Shared CTA button ─────────────────────────────────────────────────────

  function BlueBtn({ loading, label, loadingLabel }: { loading: boolean; label: string; loadingLabel: string }) {
    return (
      <div style={{ padding: 6, background: "#e1e5ee", borderRadius: 15, marginTop: 8 }}>
        <button type="submit" disabled={loading}
          style={{
            width: "100%",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "16px 24px",
            background: "linear-gradient(146.81deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
            color: "#fff",
            border: "1px solid #2f4d9d",
            borderRadius: 10,
            fontSize: 16, fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: [
              "inset 0px -3px 0px 0px #0e42c8",
              "inset 0px 2px 6px 4px rgba(0,0,0,0.08)",
              "inset 0px 3px 0px 0px rgba(255,255,255,0.5)",
              "0px 4px 12px rgba(1,71,255,0.25)",
            ].join(", "),
          }}>
          {loading
            ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />{loadingLabel}</>
            : label}
        </button>
      </div>
    );
  }

  // ── Écrans état ────────────────────────────────────────────────────────────

  if (step === "loading") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#fbfbfb" }}>
      <Loader2 style={{ color: "#121a2e", animation: "spin 1s linear infinite" }} size={28} />
    </div>
  );

  if (step === "not_found") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#fbfbfb", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <AlertCircle size={40} style={{ color: "#ef4444", margin: "0 auto 16px" }} />
        <h1 style={{ ...jakartaSans, fontSize: 24, fontWeight: 600, color: "#121a2e", marginBottom: 8 }}>Lien invalide</h1>
        <p style={{ fontSize: 16, color: "rgba(7,16,29,0.7)" }}>Ce lien est invalide ou a expiré. Contactez votre agence.</p>
      </div>
    </div>
  );

  if (step === "already_done") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#fbfbfb", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <CheckCircle2 size={40} style={{ color: "#22c55e", margin: "0 auto 16px" }} />
        <h1 style={{ ...jakartaSans, fontSize: 24, fontWeight: 600, color: "#121a2e", marginBottom: 8 }}>Formulaire déjà envoyé</h1>
        <p style={{ fontSize: 16, color: "rgba(7,16,29,0.7)", marginBottom: 24 }}>Vous avez déjà rempli ce formulaire.</p>
        <button
          onClick={() => router.push(keyData?.role === "designer" || keyData?.role === "developer" ? "/designer" : "/client")}
          style={{
            background: "#121a2e", color: "#fff", border: "none", borderRadius: 10,
            padding: "12px 24px", fontSize: 16, fontWeight: 500, cursor: "pointer",
          }}
        >
          Accéder à mon espace
        </button>
      </div>
    </div>
  );

  if (step === "done") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#fbfbfb", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <CheckCircle2 size={40} style={{ color: "#22c55e", margin: "0 auto 16px" }} />
        <h1 style={{ ...jakartaSans, fontSize: 24, fontWeight: 600, color: "#121a2e", marginBottom: 8 }}>
          Merci {keyData?.name.split(" ")[0]} !
        </h1>
        <p style={{ fontSize: 16, color: "rgba(7,16,29,0.7)" }}>
          Vos informations ont bien été transmises. Nous vous contacterons très prochainement.
        </p>
      </div>
    </div>
  );

  // ── Register ───────────────────────────────────────────────────────────────

  if (step === "register") return (
    <Card>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          ...jakartaSans,
          fontSize: 28, fontWeight: 700,
          letterSpacing: "-0.5px", lineHeight: "32px",
          color: "#121a2e", marginBottom: 10,
        }}>
          Bienvenue, {keyData?.name} !
        </h1>
        <p style={{
          ...inter,
          fontSize: 16, fontWeight: 400,
          letterSpacing: "-0.2px", lineHeight: "24px",
          color: "rgba(18,26,46,0.55)",
        }}>
          {keyData?.role === "designer"
            ? "Créez votre accès prestataire pour rejoindre l'agence."
            : "Remplissez les champs ci-dessous pour créer votre compte."}
        </p>
      </div>

      {registerError && (
        <div style={{
          display: "flex", gap: 10, padding: "12px 16px",
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 10, marginBottom: 20,
        }}>
          <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 14, color: "#b91c1c" }}>{registerError}</p>
        </div>
      )}

      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ ...jakartaSans, display: "block", fontSize: 14, fontWeight: 600, color: "#121a2e", marginBottom: 6 }}>
            Email
          </label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com" required
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(78,126,250,0.5)"; e.currentTarget.style.background = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)"; e.currentTarget.style.background = "#f6f6f6"; }}
          />
        </div>

        <div>
          <label style={{ ...jakartaSans, display: "block", fontSize: 14, fontWeight: 600, color: "#121a2e", marginBottom: 6 }}>
            Mot de passe
          </label>
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères" required minLength={6}
              style={{ ...inputStyle, paddingRight: 44 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(78,126,250,0.5)"; e.currentTarget.style.background = "#fff"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)"; e.currentTarget.style.background = "#f6f6f6"; }}
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)",
                display: "flex", alignItems: "center", padding: 0,
              }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label style={{ ...jakartaSans, display: "block", fontSize: 14, fontWeight: 600, color: "#121a2e", marginBottom: 6 }}>
            Confirmez le mot de passe
          </label>
          <input type={showPwd ? "text" : "password"} value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Répétez votre mot de passe" required
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(78,126,250,0.5)"; e.currentTarget.style.background = "#fff"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)"; e.currentTarget.style.background = "#f6f6f6"; }}
          />
        </div>

        <BlueBtn loading={registering} label="Créer mon espace" loadingLabel="Création en cours..." />
      </form>
    </Card>
  );

  // ── Multi-page form ────────────────────────────────────────────────────────

  const fields = currentPage?.fields ?? [];

  return (
    <Card>
      {totalPages > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ ...inter, fontSize: 13, color: "rgba(18,26,46,0.5)" }}>{currentPage?.title}</span>
            <span style={{ ...inter, fontSize: 13, color: "rgba(18,26,46,0.5)" }}>{pageIndex + 1} / {totalPages}</span>
          </div>
          <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: "linear-gradient(90deg, rgb(78,126,250), rgb(1,71,255))",
              borderRadius: 2, width: `${((pageIndex + 1) / totalPages) * 100}%`, transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        {totalPages > 1
          ? <h2 style={{ ...jakartaSans, fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", color: "#121a2e" }}>{currentPage?.title}</h2>
          : (
            <>
              <h1 style={{ ...jakartaSans, fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px", color: "#121a2e", marginBottom: 8 }}>
                Votre formulaire
              </h1>
              <p style={{ ...inter, fontSize: 16, color: "rgba(18,26,46,0.55)" }}>
                Remplissez ces informations pour démarrer votre projet.
              </p>
            </>
          )}
      </div>

      {(pageError || formError) && (
        <div style={{
          display: "flex", gap: 10, padding: "12px 16px",
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 10, marginBottom: 20,
        }}>
          <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 14, color: "#b91c1c" }}>{pageError ?? formError}</p>
        </div>
      )}

      <form onSubmit={isLastPage ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {fields.map((field) => (
          <div key={field.id}>
            <label style={{
              ...jakartaSans, display: "block",
              fontSize: 14, fontWeight: 600,
              color: "#121a2e", marginBottom: 6,
            }}>
              {field.label}
              {field.required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
            </label>
            {renderField(field)}
          </div>
        ))}

        <div style={{
          display: "flex", gap: 12, paddingTop: 4,
          justifyContent: pageIndex > 0 ? "space-between" : "flex-end",
          alignItems: "center",
        }}>
          {pageIndex > 0 && (
            <button type="button" onClick={handlePrev}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 20px",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 10, background: "#fff",
                fontSize: 14, color: "#121a2e", cursor: "pointer",
              }}>
              <ChevronLeft size={15} />Précédent
            </button>
          )}
          <div style={{ padding: 6, background: "#e1e5ee", borderRadius: 15, flex: pageIndex === 0 ? 1 : "none" }}>
            <button type="submit" disabled={submitting}
              style={{
                width: "100%",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "14px 24px",
                background: "linear-gradient(146.81deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                color: "#fff",
                border: "1px solid #2f4d9d",
                borderRadius: 10,
                fontSize: 16, fontWeight: 500,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
                whiteSpace: "nowrap",
                boxShadow: [
                  "inset 0px -3px 0px 0px #0e42c8",
                  "inset 0px 2px 6px 4px rgba(0,0,0,0.08)",
                  "inset 0px 3px 0px 0px rgba(255,255,255,0.5)",
                  "0px 4px 12px rgba(1,71,255,0.25)",
                ].join(", "),
              }}>
              {submitting
                ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Envoi...</>
                : isLastPage
                  ? "Envoyer mon formulaire"
                  : <>Suivant <ChevronRight size={15} /></>}
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}
