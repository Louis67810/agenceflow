"use client";

import { useEffect, useState } from "react";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { ClipboardList, Clock, CheckCircle2, XCircle, AlertCircle, Upload, ExternalLink } from "lucide-react";

interface Submission {
  id: string;
  test_id: string;
  status: "pending" | "submitted" | "accepted" | "rejected";
  submission_url?: string;
  submission_notes?: string;
  admin_feedback?: string;
  deadline?: string;
  freelancer_tests?: {
    title: string;
    description: string;
    instructions: string;
    skills: string[];
  };
}

export default function DesignerTestsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitForm, setSubmitForm] = useState({ url: "", notes: "" });

  useEffect(() => {
    // For designers: fetch their own submissions via designer_id
    agendaFetch("/api/designer/test-submissions").then(r => r.json()).then(d => {
      setSubmissions(d.submissions ?? []);
      setLoading(false);
    });
  }, []);

  const submitTest = async (sub: Submission) => {
    const res = await agendaFetch(`/api/tests/${sub.test_id}/submissions/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "submitted",
        submission_url: submitForm.url,
        submission_notes: submitForm.notes,
      }),
    }).then(r => r.json());
    if (res.submission) {
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, ...res.submission } : s));
      setSubmitting(null);
      setSubmitForm({ url: "", notes: "" });
    }
  };

  const statusInfo = (status: Submission["status"]) => {
    const map = {
      pending: { label: "À faire", icon: <Clock size={14} />, color: "text-amber-600 bg-amber-50" },
      submitted: { label: "Soumis — En attente de review", icon: <AlertCircle size={14} />, color: "text-blue-600 bg-blue-50" },
      accepted: { label: "Accepté ✅", icon: <CheckCircle2 size={14} />, color: "text-green-700 bg-green-50" },
      rejected: { label: "Non retenu", icon: <XCircle size={14} />, color: "text-red-600 bg-red-50" },
    };
    return map[status];
  };

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mes Tests</h1>
        <p className="text-gray-500 text-sm mt-1">Tests qui vous ont été assignés</p>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClipboardList size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun test assigné pour le moment</p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map(sub => {
            const st = statusInfo(sub.status);
            const test = sub.freelancer_tests;
            return (
              <div key={sub.id} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-bold text-gray-900">{test?.title ?? "Test"}</h2>
                    {test?.description && <p className="text-sm text-gray-600 mt-1">{test.description}</p>}
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${st.color}`}>
                    {st.icon}{st.label}
                  </span>
                </div>

                {test?.instructions && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-700 leading-relaxed">
                    <strong className="text-gray-900 block mb-1">Instructions :</strong>
                    {test.instructions}
                  </div>
                )}

                {test?.skills && test.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {test.skills.map(s => (
                      <span key={s} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}

                {sub.deadline && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mb-4">
                    <Clock size={11} />Deadline : {new Date(sub.deadline).toLocaleDateString("fr-FR")}
                  </p>
                )}

                {sub.admin_feedback && (
                  <div className={`p-3 rounded-lg text-sm mb-4 ${sub.status === "accepted" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                    <strong>Feedback de l'agence :</strong> {sub.admin_feedback}
                  </div>
                )}

                {sub.submission_url && sub.status !== "pending" && (
                  <a href={sub.submission_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline mb-3">
                    <ExternalLink size={11} />Voir ma soumission
                  </a>
                )}

                {sub.status === "pending" && (
                  submitting === sub.id ? (
                    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Lien vers votre travail *</label>
                        <input
                          required
                          value={submitForm.url}
                          onChange={e => setSubmitForm(f => ({ ...f, url: e.target.value }))}
                          placeholder="https://figma.com/... ou drive.google.com/..."
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                        <textarea
                          value={submitForm.notes}
                          onChange={e => setSubmitForm(f => ({ ...f, notes: e.target.value }))}
                          rows={3}
                          placeholder="Expliquez vos choix, difficultés, etc."
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setSubmitting(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
                        <button onClick={() => submitTest(sub)} disabled={!submitForm.url} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40">
                          Soumettre
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setSubmitting(sub.id)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
                      <Upload size={14} />Soumettre mon travail
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
