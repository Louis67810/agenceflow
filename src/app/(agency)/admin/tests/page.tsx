"use client";

import { useEffect, useState } from "react";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import {
  Plus, ClipboardList, ChevronRight, Users, Clock, CheckCircle2,
  XCircle, AlertCircle, Trash2, X, Check, ChevronDown,
} from "lucide-react";

interface Test {
  id: string;
  title: string;
  description: string;
  instructions: string;
  skills: string[];
  deadline_days: number;
  status: "active" | "archived";
  created_at: string;
  test_submissions?: { count: number }[];
}

interface Submission {
  id: string;
  designer_name: string;
  designer_email: string;
  status: "pending" | "submitted" | "accepted" | "rejected";
  submission_url?: string;
  submission_notes?: string;
  admin_feedback?: string;
  deadline?: string;
  submitted_at?: string;
}

export default function TestsPage() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{ sub: Submission; action: "accepted" | "rejected" } | null>(null);
  const [feedback, setFeedback] = useState("");

  // Create form
  const [form, setForm] = useState({
    title: "", description: "", instructions: "", skills: "", deadline_days: 7,
  });

  // Assign form
  const [assignForm, setAssignForm] = useState({ designer_email: "", designer_name: "" });

  useEffect(() => { loadTests(); }, []);

  const loadTests = async () => {
    const res = await agendaFetch("/api/tests").then(r => r.json());
    setTests(res.tests ?? []);
    setLoading(false);
  };

  const selectTest = async (test: Test) => {
    setSelectedTest(test);
    const res = await agendaFetch(`/api/tests/${test.id}/submissions`).then(r => r.json());
    setSubmissions(res.submissions ?? []);
  };

  const createTest = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await agendaFetch("/api/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        skills: form.skills.split(",").map(s => s.trim()).filter(Boolean),
      }),
    }).then(r => r.json());
    if (res.test) {
      setTests(prev => [res.test, ...prev]);
      setShowCreate(false);
      setForm({ title: "", description: "", instructions: "", skills: "", deadline_days: 7 });
    }
  };

  const assignTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTest) return;
    const res = await agendaFetch(`/api/tests/${selectedTest.id}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assignForm),
    }).then(r => r.json());
    if (res.submission) {
      setSubmissions(prev => [...prev, res.submission]);
      setShowAssign(false);
      setAssignForm({ designer_email: "", designer_name: "" });
    }
  };

  const evaluate = async () => {
    if (!feedbackModal) return;
    const res = await agendaFetch(`/api/tests/${selectedTest?.id}/submissions/${feedbackModal.sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: feedbackModal.action, admin_feedback: feedback }),
    }).then(r => r.json());
    if (res.submission) {
      setSubmissions(prev => prev.map(s => s.id === res.submission.id ? res.submission : s));
      setFeedbackModal(null);
      setFeedback("");
    }
  };

  const deleteTest = async (id: string) => {
    await agendaFetch(`/api/tests/${id}`, { method: "DELETE" });
    setTests(prev => prev.filter(t => t.id !== id));
    if (selectedTest?.id === id) { setSelectedTest(null); setSubmissions([]); }
  };

  const statusBadge = (status: Submission["status"]) => {
    const map = {
      pending: { label: "En attente", color: "bg-gray-100 text-gray-600", icon: <Clock size={11} /> },
      submitted: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: <AlertCircle size={11} /> },
      accepted: { label: "Accepté", color: "bg-green-100 text-green-700", icon: <CheckCircle2 size={11} /> },
      rejected: { label: "Refusé", color: "bg-red-100 text-red-600", icon: <XCircle size={11} /> },
    };
    const s = map[status];
    return <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.color}`}>{s.icon}{s.label}</span>;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tests Prestataires</h1>
          <p className="text-gray-500 text-sm mt-1">Créez des tests techniques et évaluez vos prestataires</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
          <Plus size={16} />Nouveau test
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Tests list */}
        <div className="col-span-1">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Tests disponibles ({tests.length})</h2>
          {loading ? (
            <p className="text-sm text-gray-400">Chargement...</p>
          ) : tests.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Aucun test créé</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tests.map(test => (
                <div
                  key={test.id}
                  onClick={() => selectTest(test)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all ${selectedTest?.id === test.id ? "border-indigo-400 shadow-md" : "border-gray-200"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{test.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{test.description}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteTest(test.id); }} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <span className="flex items-center gap-1 text-xs text-gray-500"><Clock size={11} />{test.deadline_days}j</span>
                    <span className="flex items-center gap-1 text-xs text-gray-500"><Users size={11} />{test.test_submissions?.[0]?.count ?? 0} submissions</span>
                  </div>
                  {test.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {test.skills.slice(0, 3).map(s => (
                        <span key={s} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submissions */}
        <div className="col-span-2">
          {selectedTest ? (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-5 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900">{selectedTest.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">{selectedTest.description}</p>
                  </div>
                  <button onClick={() => setShowAssign(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-indigo-700">
                    <Plus size={13} />Assigner
                  </button>
                </div>
                {selectedTest.instructions && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 leading-relaxed">
                    <strong>Instructions :</strong> {selectedTest.instructions}
                  </div>
                )}
              </div>

              <div className="p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Soumissions ({submissions.length})</h3>
                {submissions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Aucune soumission pour ce test</p>
                ) : (
                  <div className="space-y-3">
                    {submissions.map(sub => (
                      <div key={sub.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{sub.designer_name || "Prestataire"}</p>
                            <p className="text-xs text-gray-500">{sub.designer_email}</p>
                          </div>
                          {statusBadge(sub.status)}
                        </div>
                        {sub.submission_url && (
                          <a href={sub.submission_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-1">
                            Voir la soumission <ChevronRight size={11} />
                          </a>
                        )}
                        {sub.admin_feedback && (
                          <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded"><strong>Feedback :</strong> {sub.admin_feedback}</p>
                        )}
                        {sub.status === "submitted" && (
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => setFeedbackModal({ sub, action: "accepted" })} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">
                              <Check size={12} />Accepter
                            </button>
                            <button onClick={() => setFeedbackModal({ sub, action: "rejected" })} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">
                              <X size={12} />Refuser
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center h-64">
              <div className="text-center text-gray-400">
                <ClipboardList size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sélectionnez un test pour voir les soumissions</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Créer un test */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Nouveau test</h2>
              <button onClick={() => setShowCreate(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={createTest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Titre *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Instructions détaillées</label>
                <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={4} placeholder="Décrivez précisément ce que le prestataire doit réaliser..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Compétences (séparées par virgule)</label>
                  <input value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="Figma, CSS, Motion..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Délai (jours)</label>
                  <input type="number" value={form.deadline_days} onChange={e => setForm(f => ({ ...f, deadline_days: Number(e.target.value) }))} min={1} max={30} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Annuler</button>
                <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Créer le test</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assigner */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Assigner le test</h2>
              <button onClick={() => setShowAssign(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <form onSubmit={assignTest} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom du prestataire</label>
                <input required value={assignForm.designer_name} onChange={e => setAssignForm(f => ({ ...f, designer_name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input required type="email" value={assignForm.designer_email} onChange={e => setAssignForm(f => ({ ...f, designer_email: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAssign(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Annuler</button>
                <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Assigner</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Feedback accepter/refuser */}
      {feedbackModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">
                {feedbackModal.action === "accepted" ? "✅ Accepter" : "❌ Refuser"} la soumission
              </h2>
              <button onClick={() => setFeedbackModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-600 mb-4">Prestataire : <strong>{feedbackModal.sub.designer_name}</strong></p>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Feedback (optionnel, sera envoyé par email)..."
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setFeedbackModal(null)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50">Annuler</button>
              <button onClick={evaluate} className={`flex-1 py-2.5 text-white rounded-lg text-sm font-medium ${feedbackModal.action === "accepted" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
                {feedbackModal.action === "accepted" ? "Confirmer l'acceptation" : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
