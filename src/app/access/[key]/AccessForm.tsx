"use client";

import { useState, useEffect, useMemo } from "react";
import type { CSSProperties, ReactNode, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  CheckCircle2, AlertCircle, Loader2, Eye, EyeOff,
  ChevronRight, ChevronLeft, Briefcase,
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
      {/* Formes décoratives */}
      <div style={{
        position: "fixed", top: -120, left: -120,
        width: 450, height: 450,
        background: "radial-gradient(circle, rgba(78,126,250,0.09) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", bottom: -120, right: -120,
        width: 550, height: 550,
        background: "radial-gradient(circle, rgba(1,71,255,0.07) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none", zIndex: 0,
      }} />
      <div style={{
        position: "fixed", top: "40%", right: -80,
        width: 280, height: 280,
        background: "radial-gradient(circle, rgba(98,54,170,0.06) 0%, transparent 70%)",
        borderRadius: "50%", pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 18px",
            background: "#121a2e",
            borderRadius: 10,
            boxShadow: "0px 4px 12px rgba(18,26,46,0.15)",
          }}>
            <Briefcase size={15} color="#fff" />
            <span style={{
              ...jakartaSans,
              fontSize: 16, fontWeight: 700,
              letterSpacing: "-0.3px", color: "#fff",
            }}>
              Ruff
            </span>
          </div>
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
