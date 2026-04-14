"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Bell, ClipboardCheck, CheckCircle2, ExternalLink, Loader2,
  ChevronRight, Mail, Phone, Hash, ArrowLeft,
} from "lucide-react";
import { AgencySidebar } from "@/components/agency/AgencySidebar";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

interface Project {
  id: string;
  client_name: string | null;
  notif_email_enabled: boolean;
  notif_whatsapp_phone: string | null;
  notif_whatsapp_group: string | null;
  notif_whatsapp_enabled: boolean;
  notif_slack_webhook: string | null;
  notif_slack_enabled: boolean;
}

interface StageReview {
  id: string;
  stage_label: string;
  message: string | null;
  link_url: string | null;
  status: "pending" | "validated" | "refused";
}

export default function TachesPage() {
  const [project, setProject]         = useState<Project | null>(null);
  const [reviews, setReviews]         = useState<StageReview[]>([]);
  const [loading, setLoading]         = useState(true);
  const [clientName, setClientName]   = useState("Moi");
  const [notifMethod, setNotifMethod] = useState<"whatsapp" | "email" | "slack" | null>(null);
  const [configuring, setConfiguring] = useState<"whatsapp" | "slack" | null>(null);
  const [waPhone, setWaPhone]         = useState("");
  const [savingNotif, setSavingNotif] = useState(false);
  const [validating, setValidating]   = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const r = await fetch("/api/projects/me", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const d = await r.json();
      const projects = d.projects ?? [];
      if (!projects.length) { setLoading(false); return; }
      const proj = projects[0];
      setProject(proj);
      setClientName(proj.client_name ?? session.user.email?.split("@")[0] ?? "Moi");
      if (proj.notif_whatsapp_phone) setWaPhone(proj.notif_whatsapp_phone);
      if (proj.notif_whatsapp_enabled) setNotifMethod("whatsapp");
      else if (proj.notif_email_enabled) setNotifMethod("email");
      else if (proj.notif_slack_enabled) setNotifMethod("slack");
      const rr = await fetch(`/api/reviews?project_id=${proj.id}`);
      const rd = await rr.json();
      setReviews(rd.reviews ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function saveNotification(updates: Record<string, unknown>) {
    if (!project) return;
    setSavingNotif(true);
    const r = await fetch(`/api/projects/${project.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const d = await r.json();
    if (r.ok) setProject(d.project);
    setSavingNotif(false);
  }

  async function handleAction(reviewId: string, status: "validated" | "refused") {
    setValidating(reviewId);
    const r = await fetch(`/api/reviews/${reviewId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const d = await r.json();
    if (r.ok) setReviews(prev => prev.map(rv => rv.id === reviewId ? d.review : rv));
    setValidating(null);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#fbfbfb" }}>
      <Loader2 size={28} style={{ color: "#121a2e", animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (!project) return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(18,26,46,0.4)", ...jakartaSans }}>Aucun projet trouvé.</p>
      </div>
    </div>
  );

  const pendingReviews = reviews.filter(r => r.status === "pending");

  // ── Ecran de configuration d'une méthode ─────────────────────────────────────
  if (configuring) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
        <AgencySidebar role="client" userName={clientName} />
        <div style={{ flex: 1, padding: "32px 24px", ...jakartaSans }}>
          <button onClick={() => setConfiguring(null)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(18,26,46,0.5)", background: "none", border: "none", cursor: "pointer", marginBottom: 24, padding: 0 }}>
            <ArrowLeft size={14} />Retour
          </button>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.45px", margin: "0 0 24px" }}>
            {configuring === "whatsapp" ? "Configurer WhatsApp" : "Configurer Slack"}
          </h1>
          <div style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
            {configuring === "whatsapp" && (
              <>
                <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(18,26,46,0.5)", letterSpacing: "-0.3px" }}>Votre numéro WhatsApp</label>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "#f7f7f9", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10 }}>
                    <Phone size={14} style={{ color: "rgba(18,26,46,0.35)", flexShrink: 0 }} />
                    <input type="tel" value={waPhone} onChange={e => setWaPhone(e.target.value)} placeholder="+33 6 00 00 00 00"
                      style={{ flex: 1, border: "none", outline: "none", fontSize: 14, background: "transparent", color: "#121a2e", fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
                  </div>
                  <button
                    onClick={async () => { await saveNotification({ notif_whatsapp_phone: waPhone, notif_whatsapp_enabled: true }); setNotifMethod("whatsapp"); setConfiguring(null); }}
                    disabled={!waPhone.trim() || savingNotif}
                    style={{ padding: "0 20px", background: "linear-gradient(121deg,rgb(78,126,250) 10%,rgb(1,71,255) 82%)", color: "#fff", border: "1px solid #2f4d9d", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: !waPhone.trim() ? 0.5 : 1 }}>
                    {savingNotif ? "..." : "Enregistrer"}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)" }}>Un groupe WhatsApp sera créé et vous y serez invité.</p>
              </>
            )}
            {configuring === "slack" && (
              <>
                <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(18,26,46,0.5)", letterSpacing: "-0.3px" }}>Webhook URL Slack</label>
                <input type="url" defaultValue={project.notif_slack_webhook ?? ""} placeholder="https://hooks.slack.com/services/..."
                  onBlur={async e => { if (e.target.value) { await saveNotification({ notif_slack_webhook: e.target.value, notif_slack_enabled: true }); setNotifMethod("slack"); setConfiguring(null); } }}
                  style={{ padding: "12px 14px", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10, fontSize: 14, background: "#f7f7f9", outline: "none", fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
                <p style={{ fontSize: 12, color: "rgba(18,26,46,0.4)" }}>Obtenez votre webhook dans Paramètres Slack → Intégrations.</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Ecran initial : choisir la méthode ───────────────────────────────────────
  if (!notifMethod) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
        <AgencySidebar role="client" userName={clientName} />
        <div style={{ flex: 1, padding: "32px 24px", ...jakartaSans }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.45px", margin: "0 0 6px" }}>Tâches à faire</h1>
          <p style={{ fontSize: 14, color: "rgba(18,26,46,0.45)", margin: "0 0 28px" }}>Suivez les actions à réaliser sur votre projet.</p>

          <div style={{ maxWidth: 480 }}>
            {/* Alert */}
            <div style={{ background: "#fff7ed", border: "1px solid rgba(234,88,12,0.15)", borderRadius: 14, padding: "20px", marginBottom: 24, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fde8d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Bell size={18} style={{ color: "#ea580c" }} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#9a3412", margin: "0 0 4px" }}>Veuillez paramétrer vos notifications</p>
                <p style={{ fontSize: 13, color: "#c2410c", margin: 0, lineHeight: "1.5" }}>Pour recevoir des tâches et être notifié, choisissez d'abord votre méthode de notification.</p>
              </div>
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(18,26,46,0.5)", margin: "0 0 12px" }}>Choisissez une méthode :</p>

            {[
              { id: "whatsapp" as const, label: "WhatsApp", sub: "Notifications instantanées sur votre téléphone", bg: "#25D366", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> },
              { id: "email" as const, label: "Email", sub: "Alertes envoyées à votre adresse email", bg: "#4285f4", icon: <Mail size={18} style={{ color: "#fff" }} /> },
              { id: "slack" as const, label: "Slack", sub: "Notifications dans votre espace de travail", bg: "#4A154B", icon: <Hash size={18} style={{ color: "#fff" }} /> },
            ].map(m => (
              <button key={m.id}
                onClick={() => { if (m.id === "email") { saveNotification({ notif_email_enabled: true }); setNotifMethod("email"); } else setConfiguring(m.id as "whatsapp" | "slack"); }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", background: "#fff", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 12, cursor: "pointer", textAlign: "left", width: "100%", marginBottom: 10, boxShadow: "0px 2px 4px rgba(0,0,0,0.03)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.icon}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#121a2e", margin: 0 }}>{m.label}</p>
                  <p style={{ fontSize: 12, color: "rgba(18,26,46,0.45)", margin: "3px 0 0" }}>{m.sub}</p>
                </div>
                <ChevronRight size={15} style={{ color: "rgba(18,26,46,0.3)", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Vue principale : tâches ───────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fbfbfb" }}>
      <AgencySidebar role="client" userName={clientName} />
      <div style={{ flex: 1, padding: "32px 24px", ...jakartaSans }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.45px", margin: "0 0 6px" }}>Tâches à faire</h1>
            <p style={{ fontSize: 14, color: "rgba(18,26,46,0.45)", margin: 0 }}>
              {pendingReviews.length > 0 ? `${pendingReviews.length} action${pendingReviews.length > 1 ? "s" : ""} en attente` : "Aucune action en attente"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "#f7f7f9", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#168b64" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(18,26,46,0.6)" }}>
              {notifMethod === "whatsapp" ? "WhatsApp" : notifMethod === "email" ? "Email" : "Slack"} activé
            </span>
            <button onClick={() => setNotifMethod(null)} style={{ fontSize: 11, color: "rgba(18,26,46,0.35)", background: "none", border: "none", cursor: "pointer", marginLeft: 4 }}>Changer</button>
          </div>
        </div>

        <div style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 12 }}>
          {pendingReviews.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: "52px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle2 size={28} style={{ color: "#168b64" }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#121a2e", margin: 0, letterSpacing: "-0.3px" }}>Tout est à jour !</p>
              <p style={{ fontSize: 13, color: "rgba(18,26,46,0.4)", margin: 0 }}>Aucune tâche en attente pour le moment.</p>
            </div>
          ) : (
            pendingReviews.map(rv => (
              <div key={rv.id} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.13)", borderRadius: 13, padding: "20px", boxShadow: "0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#e8edff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <ClipboardCheck size={16} style={{ color: "#0147ff" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#121a2e", margin: "0 0 4px", letterSpacing: "-0.3px" }}>À valider : {rv.stage_label}</p>
                    {rv.message && <p style={{ fontSize: 13, color: "rgba(18,26,46,0.55)", margin: 0, lineHeight: "1.5" }}>{rv.message}</p>}
                  </div>
                </div>
                {rv.link_url && (
                  <a href={rv.link_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "#f0f3ff", border: "1px solid rgba(1,71,255,0.12)", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#0147ff", textDecoration: "none", width: "fit-content" }}>
                    <ExternalLink size={13} />Ouvrir le lien
                  </a>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => handleAction(rv.id, "validated")} disabled={validating === rv.id}
                    style={{ flex: 1, padding: "13px", borderRadius: 10, background: "linear-gradient(121deg,rgb(78,126,250) 10%,rgb(1,71,255) 82%)", color: "#fff", border: "1px solid #2f4d9d", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: "inset 0px -2px 0px #0e42c8, 0px 4px 10px rgba(1,71,255,0.2)", opacity: validating === rv.id ? 0.7 : 1, letterSpacing: "-0.3px" }}>
                    {validating === rv.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={14} />}
                    Valider
                  </button>
                  <button onClick={() => handleAction(rv.id, "refused")} disabled={validating === rv.id}
                    style={{ flex: 1, padding: "13px", borderRadius: 10, background: "#f7f7f9", color: "#121a2e", border: "1px solid rgba(0,0,0,0.09)", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: validating === rv.id ? 0.5 : 1, letterSpacing: "-0.3px" }}>
                    Refuser
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
