"use client";

import { useEffect, useState } from "react";
import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import {
  Plus, ClipboardList, Users, Clock, CheckCircle2,
  XCircle, AlertCircle, Trash2, X, Check, ChevronRight,
} from "lucide-react";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

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

  const [form, setForm] = useState({
    title: "", description: "", instructions: "", skills: "", deadline_days: 7,
  });
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
      body: JSON.stringify({ ...form, skills: form.skills.split(",").map(s => s.trim()).filter(Boolean) }),
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
    const map: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
      pending:   { label: "En attente", bg: "#fee6d0", color: "#663b12", icon: <Clock size={11} /> },
      submitted: { label: "Soumis",     bg: "#d5eeff", color: "#073e63", icon: <AlertCircle size={11} /> },
      accepted:  { label: "Accepté",    bg: "#d1fae5", color: "#168b64", icon: <CheckCircle2 size={11} /> },
      rejected:  { label: "Refusé",     bg: "#fee2e2", color: "#b91c1c", icon: <XCircle size={11} /> },
    };
    const s = map[status];
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: s.bg, color: s.color }}>
        {s.icon}{s.label}
      </span>
    );
  };

  const cardStyle = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.13)",
    borderRadius: 13,
    boxShadow: "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)",
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px",
    border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10,
    fontSize: 13, background: "#f6f6f6", color: "#121a2e",
    outline: "none", boxSizing: "border-box" as const,
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    resize: "none" as const,
  };

  const primaryBtn = {
    display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 10,
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
    color: "#fff", border: "1px solid #2f4d9d",
    boxShadow: "inset 0px -2px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.2)",
    letterSpacing: "-0.3px",
  } as const;

  return (
    <div style={{ padding: 32, background: "#fbfbfb", minHeight: "100vh", ...jakartaSans }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.45px" }}>Tests Prestataires</h1>
          <p style={{ color: "rgba(18,26,46,0.5)", margin: "4px 0 0", fontSize: 14 }}>Créez des tests techniques et évaluez vos prestataires</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={primaryBtn}>
          <Plus size={15} />Nouveau test
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
        {/* Tests list */}
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "rgba(18,26,46,0.5)", margin: "0 0 12px", letterSpacing: "-0.2px", textTransform: "uppercase" }}>Tests disponibles ({tests.length})</h2>
          {loading ? (
            <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)" }}>Chargement...</p>
          ) : tests.length === 0 ? (
            <div style={{ ...cardStyle, padding: 48, textAlign: "center" }}>
              <ClipboardList size={32} style={{ color: "rgba(18,26,46,0.15)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)" }}>Aucun test créé</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tests.map(test => (
                <div
                  key={test.id}
                  onClick={() => selectTest(test)}
                  style={{
                    ...cardStyle,
                    padding: 16, cursor: "pointer",
                    border: selectedTest?.id === test.id ? "1px solid #0147ff" : "1px solid rgba(0,0,0,0.13)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, color: "#121a2e", fontSize: 13, margin: 0, letterSpacing: "-0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{test.title}</p>
                      <p style={{ fontSize: 12, color: "rgba(18,26,46,0.5)", margin: "4px 0 0", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{test.description}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteTest(test.id); }} style={{ width: 26, height: 26, borderRadius: 7, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Trash2 size={13} style={{ color: "rgba(18,26,46,0.3)" }} />
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(18,26,46,0.45)" }}><Clock size={11} />{test.deadline_days}j</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(18,26,46,0.45)" }}><Users size={11} />{test.test_submissions?.[0]?.count ?? 0} soumissions</span>
                  </div>
                  {test.skills.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                      {test.skills.slice(0, 3).map(s => (
                        <span key={s} style={{ fontSize: 11, background: "#e8edff", color: "#0147ff", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submissions */}
        <div>
          {selectedTest ? (
            <div style={cardStyle}>
              <div style={{ padding: 20, borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ fontWeight: 700, color: "#121a2e", margin: 0, fontSize: 16, letterSpacing: "-0.45px" }}>{selectedTest.title}</h2>
                    <p style={{ fontSize: 13, color: "rgba(18,26,46,0.5)", margin: "4px 0 0" }}>{selectedTest.description}</p>
                  </div>
                  <button onClick={() => setShowAssign(true)} style={{ ...primaryBtn, padding: "9px 14px" }}>
                    <Plus size={13} />Assigner
                  </button>
                </div>
                {selectedTest.instructions && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "#f9f9fb", borderRadius: 9, fontSize: 12, color: "rgba(18,26,46,0.65)", lineHeight: "1.6" }}>
                    <strong>Instructions :</strong> {selectedTest.instructions}
                  </div>
                )}
              </div>

              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.45)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 16px" }}>Soumissions ({submissions.length})</h3>
                {submissions.length === 0 ? (
                  <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)", textAlign: "center", padding: "32px 0" }}>Aucune soumission pour ce test</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {submissions.map(sub => (
                      <div key={sub.id} style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 11, padding: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <div>
                            <p style={{ fontWeight: 700, color: "#121a2e", fontSize: 13, margin: 0, letterSpacing: "-0.3px" }}>{sub.designer_name || "Prestataire"}</p>
                            <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", margin: "2px 0 0" }}>{sub.designer_email}</p>
                          </div>
                          {statusBadge(sub.status)}
                        </div>
                        {sub.submission_url && (
                          <a href={sub.submission_url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#0147ff", textDecoration: "none", fontWeight: 500 }}>
                            Voir la soumission <ChevronRight size={11} />
                          </a>
                        )}
                        {sub.admin_feedback && (
                          <p style={{ fontSize: 12, color: "rgba(18,26,46,0.6)", marginTop: 8, background: "#f9f9fb", padding: "8px 12px", borderRadius: 8 }}><strong>Feedback :</strong> {sub.admin_feedback}</p>
                        )}
                        {sub.status === "submitted" && (
                          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                            <button onClick={() => setFeedbackModal({ sub, action: "accepted" })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#d1fae5", border: "1px solid rgba(22,139,100,0.2)", color: "#168b64", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                              <Check size={12} />Accepter
                            </button>
                            <button onClick={() => setFeedbackModal({ sub, action: "rejected" })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#fee2e2", border: "1px solid rgba(239,68,68,0.2)", color: "#b91c1c", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
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
            <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 256 }}>
              <div style={{ textAlign: "center" }}>
                <ClipboardList size={32} style={{ color: "rgba(18,26,46,0.12)", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)" }}>Sélectionnez un test pour voir les soumissions</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Créer un test */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 24, width: "100%", maxWidth: 520, boxShadow: "0 24px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, color: "#121a2e", margin: 0, fontSize: 16, letterSpacing: "-0.3px" }}>Nouveau test</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} style={{ color: "rgba(18,26,46,0.4)" }} /></button>
            </div>
            <form onSubmit={createTest} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Titre *", key: "title", required: true, rows: 1 },
                { label: "Description", key: "description", required: false, rows: 2 },
                { label: "Instructions détaillées", key: "instructions", required: false, rows: 4, placeholder: "Décrivez précisément ce que le prestataire doit réaliser..." },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", marginBottom: 6 }}>{f.label}</label>
                  {f.rows > 1 ? (
                    <textarea required={f.required} value={(form as Record<string, string | number>)[f.key] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} rows={f.rows} placeholder={f.placeholder} style={inputStyle} />
                  ) : (
                    <input required={f.required} value={(form as Record<string, string | number>)[f.key] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                  )}
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", marginBottom: 6 }}>Compétences (séparées par virgule)</label>
                  <input value={form.skills} onChange={e => setForm(p => ({ ...p, skills: e.target.value }))} placeholder="Figma, CSS, Motion..." style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", marginBottom: 6 }}>Délai (jours)</label>
                  <input type="number" value={form.deadline_days} onChange={e => setForm(p => ({ ...p, deadline_days: Number(e.target.value) }))} min={1} max={30} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, paddingTop: 8 }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{ flex: 1, padding: "11px", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, fontSize: 13, background: "#fff", cursor: "pointer", color: "rgba(18,26,46,0.6)", fontWeight: 500 }}>Annuler</button>
                <button type="submit" style={{ flex: 1, ...primaryBtn, justifyContent: "center" }}>Créer le test</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assigner */}
      {showAssign && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 24px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontWeight: 700, color: "#121a2e", margin: 0, fontSize: 16, letterSpacing: "-0.3px" }}>Assigner le test</h2>
              <button onClick={() => setShowAssign(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} style={{ color: "rgba(18,26,46,0.4)" }} /></button>
            </div>
            <form onSubmit={assignTest} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", marginBottom: 6 }}>Nom du prestataire</label>
                <input required value={assignForm.designer_name} onChange={e => setAssignForm(p => ({ ...p, designer_name: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.55)", marginBottom: 6 }}>Email *</label>
                <input required type="email" value={assignForm.designer_email} onChange={e => setAssignForm(p => ({ ...p, designer_email: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: "flex", gap: 12, paddingTop: 8 }}>
                <button type="button" onClick={() => setShowAssign(false)} style={{ flex: 1, padding: "11px", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, fontSize: 13, background: "#fff", cursor: "pointer", color: "rgba(18,26,46,0.6)", fontWeight: 500 }}>Annuler</button>
                <button type="submit" style={{ flex: 1, ...primaryBtn, justifyContent: "center" }}>Assigner</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Feedback */}
      {feedbackModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 24px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700, color: "#121a2e", margin: 0, fontSize: 15, letterSpacing: "-0.3px" }}>
                {feedbackModal.action === "accepted" ? "Accepter" : "Refuser"} la soumission
              </h2>
              <button onClick={() => setFeedbackModal(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} style={{ color: "rgba(18,26,46,0.4)" }} /></button>
            </div>
            <p style={{ fontSize: 13, color: "rgba(18,26,46,0.6)", marginBottom: 16 }}>Prestataire : <strong>{feedbackModal.sub.designer_name}</strong></p>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback (optionnel, sera envoyé par email)..." rows={4} style={inputStyle} />
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button onClick={() => setFeedbackModal(null)} style={{ flex: 1, padding: "11px", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10, fontSize: 13, background: "#fff", cursor: "pointer", color: "rgba(18,26,46,0.6)", fontWeight: 500 }}>Annuler</button>
              <button onClick={evaluate} style={{
                flex: 1, padding: "11px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                background: feedbackModal.action === "accepted"
                  ? "linear-gradient(121deg, rgb(34,197,94) 0%, rgb(22,163,74) 100%)"
                  : "linear-gradient(121deg, rgb(248,113,113) 0%, rgb(220,38,38) 100%)",
                color: "#fff",
              }}>
                {feedbackModal.action === "accepted" ? "Confirmer l'acceptation" : "Confirmer le refus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
