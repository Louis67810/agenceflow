"use client";

import { useState, useEffect } from "react";
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

const jakartaSans: CSSProperties = {
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 16px",
  fontSize: 18,
  letterSpacing: "-0.45px",
  lineHeight: "28px",
  color: "rgba(7, 16, 29, 0.7)",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  outline: "none",
  background: "#fff",
};

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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

  const handleRegister = async (e: React.FormEvent) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
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
    else if (data.project_id) router.push(`/client/projects/${data.project_id}`);
    else router.push("/client");
  };

  // ── Field renderer ─────────────────────────────────────────────────────────

  function renderField(field: FormField) {
    const val = (values[field.id] ?? "") as string;
    const setVal = (v: string) => setValues((p) => ({ ...p, [field.id]: v }));

    switch (field.type) {
      case "textarea":
        return <textarea value={val} onChange={(e) => setVal(e.target.value)} required={field.required}
          placeholder={field.placeholder} rows={3}
          style={{ ...inputStyle, resize: "none" }} />;
      case "select":
        return (
          <select value={val} onChange={(e) => setVal(e.target.value)} required={field.required}
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
                border: val === o ? "1px solid rgb(7,16,29)" : "1px solid #e5e7eb",
                background: val === o ? "rgba(7,16,29,0.04)" : "#fff",
                fontSize: 14, cursor: "pointer", color: "rgb(7,16,29)",
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
                border: checked.includes(o) ? "1px solid rgb(7,16,29)" : "1px solid #e5e7eb",
                background: checked.includes(o) ? "rgba(7,16,29,0.04)" : "#fff",
                fontSize: 14, cursor: "pointer", color: "rgb(7,16,29)",
              }}>
                <input type="checkbox" checked={checked.includes(o)} onChange={() => toggle(o)} />
                {o}
              </label>
            ))}
          </div>
        );
      }
      default:
        return <input
          type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "phone" ? "tel" : "text"}
          value={val} onChange={(e) => setVal(e.target.value)} required={field.required}
          placeholder={field.placeholder ?? ""}
          style={inputStyle}
          onFocus={(e) => { e.currentTarget.style.borderColor = "rgb(7,16,29)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
        />;
    }
  }

  // ── Écrans état ────────────────────────────────────────────────────────────

  if (step === "loading") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f9fafb" }}>
      <Loader2 style={{ color: "rgb(7,16,29)", animation: "spin 1s linear infinite" }} size={28} />
    </div>
  );

  if (step === "not_found") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f9fafb", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <AlertCircle size={40} style={{ color: "#ef4444", margin: "0 auto 16px" }} />
        <h1 style={{ ...jakartaSans, fontSize: 24, fontWeight: 600, color: "rgb(7,16,29)", marginBottom: 8 }}>Lien invalide</h1>
        <p style={{ fontSize: 16, color: "rgba(7,16,29,0.7)" }}>Ce lien est invalide ou a expiré. Contactez votre agence.</p>
      </div>
    </div>
  );

  if (step === "already_done") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f9fafb", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <CheckCircle2 size={40} style={{ color: "#22c55e", margin: "0 auto 16px" }} />
        <h1 style={{ ...jakartaSans, fontSize: 24, fontWeight: 600, color: "rgb(7,16,29)", marginBottom: 8 }}>Formulaire déjà envoyé</h1>
        <p style={{ fontSize: 16, color: "rgba(7,16,29,0.7)", marginBottom: 24 }}>Vous avez déjà rempli ce formulaire.</p>
        <button
          onClick={() => router.push(keyData?.role === "designer" || keyData?.role === "developer" ? "/designer" : "/client")}
          style={{
            background: "rgb(7,16,29)", color: "#fff", border: "none", borderRadius: 10,
            padding: "12px 24px", fontSize: 16, fontWeight: 500, cursor: "pointer",
          }}
        >
          Accéder à mon espace
        </button>
      </div>
    </div>
  );

  if (step === "done") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f9fafb", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 360 }}>
        <CheckCircle2 size={40} style={{ color: "#22c55e", margin: "0 auto 16px" }} />
        <h1 style={{ ...jakartaSans, fontSize: 24, fontWeight: 600, color: "rgb(7,16,29)", marginBottom: 8 }}>
          Merci {keyData?.name.split(" ")[0]} !
        </h1>
        <p style={{ fontSize: 16, color: "rgba(7,16,29,0.7)" }}>
          Vos informations ont bien été transmises. Nous vous contacterons très prochainement.
        </p>
      </div>
    </div>
  );

  // ── Shared card layout ────────────────────────────────────────────────────

  const Card = ({ children }: { children: ReactNode }) => (
    <div style={{
      minHeight: "100vh",
      background: "#f8f9fa",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 480,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        overflow: "hidden",
      }}>
        {/* Card header badge */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid #f3f4f6",
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgb(7,16,29)",
            color: "#fff",
            border: "1px solid rgb(7,16,29)",
            borderRadius: 10,
            padding: "8px 16px",
            fontSize: 20,
            fontWeight: 500,
            lineHeight: "102.88%",
          }}>
            {step === "register" ? "Créer mon espace" : "Formulaire"}
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: "28px 24px 32px" }}>
          {children}
        </div>
      </div>
    </div>
  );

  // ── Register ───────────────────────────────────────────────────────────────

  if (step === "register") return (
    <Card>
      {/* Title */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          ...jakartaSans,
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: "-0.45px",
          lineHeight: "28px",
          color: "rgb(7,16,29)",
          marginBottom: 12,
          paddingTop: 4,
        }}>
          Bienvenue, {keyData?.name} !
        </h1>
        <p style={{
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: "-0.45px",
          lineHeight: "28px",
          color: "rgba(7,16,29,0.7)",
        }}>
          {keyData?.role === "designer"
            ? "Créez votre accès prestataire pour rejoindre l'agence."
            : "Remplissez les champs ci dessous pour créer votre compte."}
        </p>
      </div>

      {/* Error */}
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

      {/* Form */}
      <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Email */}
        <div>
          <label style={{
            display: "block",
            ...jakartaSans,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.45px",
            lineHeight: "28px",
            color: "rgb(7,16,29)",
            marginBottom: 8,
          }}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com" required
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgb(7,16,29)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
          />
        </div>

        {/* Password */}
        <div>
          <label style={{
            display: "block",
            ...jakartaSans,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.45px",
            lineHeight: "28px",
            color: "rgb(7,16,29)",
            marginBottom: 8,
          }}>Mot de passe</label>
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères" required minLength={6}
              style={{ ...inputStyle, paddingRight: 44 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "rgb(7,16,29)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              style={{
                position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "rgba(7,16,29,0.4)",
                display: "flex", alignItems: "center",
              }}>
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label style={{
            display: "block",
            ...jakartaSans,
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.45px",
            lineHeight: "28px",
            color: "rgb(7,16,29)",
            marginBottom: 8,
          }}>Confirmez le mot de passe</label>
          <input type={showPwd ? "text" : "password"} value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            placeholder="Répétez votre mot de passe" required
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgb(7,16,29)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
          />
        </div>

        {/* CTA */}
        <button type="submit" disabled={registering}
          style={{
            marginTop: 8,
            background: "rgb(7,16,29)",
            color: "#fff",
            border: "1px solid rgb(7,16,29)",
            borderRadius: 12,
            padding: "14px 24px",
            fontSize: 16,
            fontWeight: 500,
            cursor: registering ? "not-allowed" : "pointer",
            opacity: registering ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}>
          {registering
            ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />Création en cours...</>
            : "Créer mon espace"}
        </button>
      </form>
    </Card>
  );

  // ── Multi-page form ────────────────────────────────────────────────────────

  const fields = currentPage?.fields ?? [];

  return (
    <Card>
      {/* Progress */}
      {totalPages > 1 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: "rgba(7,16,29,0.5)" }}>{currentPage?.title}</span>
            <span style={{ fontSize: 14, color: "rgba(7,16,29,0.5)" }}>{pageIndex + 1} / {totalPages}</span>
          </div>
          <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              background: "rgb(7,16,29)",
              borderRadius: 2,
              width: `${((pageIndex + 1) / totalPages) * 100}%`,
              transition: "width 0.3s",
            }} />
          </div>
        </div>
      )}

      {/* Title */}
      <div style={{ marginBottom: 28 }}>
        {totalPages > 1
          ? <h2 style={{ ...jakartaSans, fontSize: 32, fontWeight: 600, letterSpacing: "-0.45px", color: "rgb(7,16,29)" }}>{currentPage?.title}</h2>
          : (
            <>
              <h1 style={{ ...jakartaSans, fontSize: 32, fontWeight: 600, letterSpacing: "-0.45px", color: "rgb(7,16,29)", marginBottom: 8 }}>
                Votre formulaire
              </h1>
              <p style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.45px", color: "rgba(7,16,29,0.7)" }}>
                Remplissez ces informations pour démarrer votre projet.
              </p>
            </>
          )}
      </div>

      {/* Error */}
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

      {/* Fields */}
      <form onSubmit={isLastPage ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}
        style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {fields.map((field) => (
          <div key={field.id}>
            <label style={{
              display: "block",
              ...jakartaSans,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.45px",
              lineHeight: "28px",
              color: "rgb(7,16,29)",
              marginBottom: 8,
            }}>
              {field.label}
              {field.required && <span style={{ color: "#ef4444", marginLeft: 4 }}>*</span>}
            </label>
            {renderField(field)}
          </div>
        ))}

        <div style={{
          display: "flex",
          gap: 12,
          paddingTop: 8,
          justifyContent: pageIndex > 0 ? "space-between" : "flex-end",
        }}>
          {pageIndex > 0 && (
            <button type="button" onClick={handlePrev}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 20px",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#fff",
                fontSize: 14,
                color: "rgb(7,16,29)",
                cursor: "pointer",
              }}>
              <ChevronLeft size={15} />Précédent
            </button>
          )}
          <button type="submit" disabled={submitting}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 24px",
              background: "rgb(7,16,29)",
              color: "#fff",
              border: "1px solid rgb(7,16,29)",
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 500,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
              marginLeft: "auto",
            }}>
            {submitting
              ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />Envoi...</>
              : isLastPage
              ? "Envoyer mon formulaire"
              : <>Suivant <ChevronRight size={15} /></>}
          </button>
        </div>
      </form>
    </Card>
  );
}
