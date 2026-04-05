"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  Briefcase, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff,
  ShieldCheck, ChevronRight, ChevronLeft,
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccessForm({ accessKey }: { accessKey: string }) {
  const router = useRouter();
  const [step, setStep]       = useState<Step>("loading");
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [userId, setUserId]   = useState<string | null>(null);

  // Register
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd]       = useState(false);
  const [registering, setRegistering]   = useState(false);
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

  // ── Pages helpers ──────────────────────────────────────────────────────────

  const pages: FormPage[] = (() => {
    if (keyData?.form_pages?.length) return keyData.form_pages;
    if (keyData?.form_fields?.length) return [{ id: "p0", title: "Formulaire", fields: keyData.form_fields }];
    return [];
  })();

  const totalPages   = pages.length;
  const currentPage  = pages[pageIndex];
  const isLastPage   = pageIndex === totalPages - 1;

  function validatePage() {
    const missing = (currentPage?.fields ?? []).filter(
      (f) => f.required && !values[f.id]
    );
    if (missing.length > 0) {
      setPageError(`Champ${missing.length > 1 ? "s" : ""} requis : ${missing.map((f) => f.label).join(", ")}`);
      return false;
    }
    setPageError(null);
    return true;
  }

  function handleNext() {
    if (!validatePage()) return;
    setPageIndex((i) => i + 1);
  }

  function handlePrev() {
    setPageError(null);
    setPageIndex((i) => i - 1);
  }

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

    // Get user ID from live session (more reliable than state after re-renders)
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
      body: JSON.stringify({
        ...values,
        _user_id: uid,
        _client_name: keyData?.name,
        _client_email: email,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setFormError(data.error ?? "Erreur lors de l'envoi.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    // Designer → designer dashboard, client → project or client dashboard
    if (data.role === "designer") {
      router.push("/designer");
    } else if (data.project_id) {
      router.push(`/client/projects/${data.project_id}`);
    } else {
      router.push("/client");
    }
  };

  // ── Field renderer ─────────────────────────────────────────────────────────

  function renderField(field: FormField) {
    const base = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";
    const val = (values[field.id] ?? "") as string;
    const setVal = (v: string) => setValues((p) => ({ ...p, [field.id]: v }));

    switch (field.type) {
      case "textarea":
        return <textarea value={val} onChange={(e) => setVal(e.target.value)} required={field.required}
          placeholder={field.placeholder} rows={3} className={`${base} resize-none`} />;
      case "select":
        return (
          <select value={val} onChange={(e) => setVal(e.target.value)} required={field.required} className={`${base} bg-white`}>
            <option value="">-- Choisir --</option>
            {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case "radio":
        return (
          <div className="flex flex-wrap gap-2 mt-1">
            {field.options?.map((o) => (
              <label key={o} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${val === o ? "bg-indigo-50 border-indigo-300 text-indigo-800" : "border-gray-200 text-gray-600"}`}>
                <input type="radio" name={field.id} value={o} checked={val === o} onChange={() => setVal(o)} className="accent-indigo-600" />
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
          <div className="flex flex-wrap gap-2 mt-1">
            {field.options?.map((o) => (
              <label key={o} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${checked.includes(o) ? "bg-indigo-50 border-indigo-300 text-indigo-800" : "border-gray-200 text-gray-600"}`}>
                <input type="checkbox" checked={checked.includes(o)} onChange={() => toggle(o)} className="accent-indigo-600 rounded" />
                {o}
              </label>
            ))}
          </div>
        );
      }
      default:
        return <input type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "phone" ? "tel" : "text"}
          value={val} onChange={(e) => setVal(e.target.value)} required={field.required}
          placeholder={field.placeholder} className={base} />;
    }
  }

  // ── Screens ────────────────────────────────────────────────────────────────

  const Logo = () => (
    <div className="flex items-center gap-3 mb-8">
      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
        <Briefcase size={18} className="text-white" />
      </div>
      <span className="text-xl font-bold text-gray-900">AgenceFlow</span>
    </div>
  );

  if (step === "loading") return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  if (step === "not_found") return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h1>
        <p className="text-gray-500 text-sm">Ce lien est invalide ou a expiré. Contactez votre agence.</p>
      </div>
    </div>
  );

  if (step === "already_done") return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <CheckCircle2 size={40} className="text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Formulaire déjà envoyé</h1>
        <p className="text-gray-500 text-sm mb-4">Vous avez déjà rempli ce formulaire. Votre agence a bien reçu vos informations.</p>
        <button
          onClick={() => router.push(keyData?.role === "designer" ? "/designer" : "/client")}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          Accéder à mon espace
        </button>
      </div>
    </div>
  );

  if (step === "done") return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <CheckCircle2 size={40} className="text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Merci {keyData?.name.split(" ")[0]} !</h1>
        <p className="text-gray-500 text-sm">Vos informations ont bien été transmises. Nous vous contacterons très prochainement.</p>
      </div>
    </div>
  );

  if (step === "register") return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <Logo />
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 mb-6">
            <ShieldCheck size={14} className="text-indigo-500" />
            <span className="text-xs text-indigo-700 font-medium">Invitation de votre agence</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Bienvenue, {keyData?.name} !</h1>
          <p className="text-sm text-gray-500 mb-6">
            {keyData?.role === "designer"
              ? "Créez votre accès prestataire pour rejoindre l'agence."
              : "Créez votre accès pour remplir le formulaire."}
          </p>

          {registerError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{registerError}</p>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères" required minLength={6}
                  className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe</label>
              <input type={showPwd ? "text" : "password"} value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Répétez votre mot de passe" required
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <button type="submit" disabled={registering}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 mt-1">
              {registering ? <><Loader2 size={14} className="animate-spin" />Création...</> : "Créer mon accès"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // ── Multi-page form ────────────────────────────────────────────────────────

  const fields = currentPage?.fields ?? [];

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <Logo />

        {/* Progress bar */}
        {totalPages > 1 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>{currentPage?.title}</span>
              <span>{pageIndex + 1} / {totalPages}</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${((pageIndex + 1) / totalPages) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {totalPages > 1 && (
            <h2 className="text-lg font-bold text-gray-900 mb-5">{currentPage?.title}</h2>
          )}
          {totalPages === 1 && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Votre formulaire</h1>
              <p className="text-gray-500 text-sm mb-8">Remplissez ces informations pour démarrer votre projet.</p>
            </>
          )}

          {(pageError || formError) && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-5">
              <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{pageError ?? formError}</p>
            </div>
          )}

          <form onSubmit={isLastPage ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }} className="space-y-5">
            {fields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderField(field)}
              </div>
            ))}

            <div className={`flex gap-3 pt-2 ${pageIndex > 0 ? "justify-between" : "justify-end"}`}>
              {pageIndex > 0 && (
                <button type="button" onClick={handlePrev}
                  className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  <ChevronLeft size={15} />Précédent
                </button>
              )}
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 ml-auto">
                {submitting ? <><Loader2 size={14} className="animate-spin" />Envoi...</>
                  : isLastPage ? "Envoyer mon formulaire"
                  : <>Suivant <ChevronRight size={15} /></>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
