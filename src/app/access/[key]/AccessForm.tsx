"use client";

import { useState, useEffect } from "react";
import { Briefcase, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const FIELD_META: Record<string, { type: "text" | "email" | "textarea" }> = {
  full_name:    { type: "text" },
  email:        { type: "email" },
  company:      { type: "text" },
  phone:        { type: "text" },
  project_name: { type: "text" },
  description:  { type: "textarea" },
  budget:       { type: "text" },
  deadline:     { type: "text" },
  references:   { type: "textarea" },
  notes:        { type: "textarea" },
};

interface FormField { id: string; label: string; required?: boolean }
interface KeyData { name: string; role: string; form_fields: FormField[]; used_at: string | null }

export default function AccessForm({ accessKey }: { accessKey: string }) {
  const [keyData, setKeyData]     = useState<KeyData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [values, setValues]       = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/keys/${accessKey}`)
      .then((r) => { if (!r.ok) { setNotFound(true); setLoading(false); return null; } return r.json(); })
      .then((d) => { if (d) { setKeyData(d); setLoading(false); } });
  }, [accessKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/keys/${accessKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Erreur lors de l'envoi.");
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Loader2 className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  if (notFound) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h1>
        <p className="text-gray-500 text-sm">Ce lien est invalide ou a expiré. Contactez votre agence.</p>
      </div>
    </div>
  );

  if (keyData?.used_at) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <CheckCircle2 size={40} className="text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Formulaire déjà envoyé</h1>
        <p className="text-gray-500 text-sm">Vous avez déjà rempli ce formulaire. Votre agence a bien reçu vos informations.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <CheckCircle2 size={40} className="text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Merci {keyData?.name.split(" ")[0]} !</h1>
        <p className="text-gray-500 text-sm">Vos informations ont bien été transmises. Nous vous contacterons très prochainement.</p>
      </div>
    </div>
  );

  const fields = keyData?.form_fields ?? [];

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Briefcase size={18} className="text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">AgenceFlow</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Bonjour, {keyData?.name} !
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            Merci de remplir ce formulaire pour que nous puissions démarrer votre projet dans les meilleures conditions.
          </p>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-5">
              <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {fields.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Aucun champ configuré pour ce formulaire.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {fields.map((field) => {
                const meta = FIELD_META[field.id] ?? { type: "text" };
                return (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {meta.type === "textarea" ? (
                      <textarea
                        value={values[field.id] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                        rows={3}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                      />
                    ) : (
                      <input
                        type={meta.type}
                        value={values[field.id] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [field.id]: e.target.value }))}
                        required={field.required}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    )}
                  </div>
                );
              })}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {submitting ? <><Loader2 size={15} className="animate-spin" />Envoi...</> : "Envoyer mon formulaire"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
