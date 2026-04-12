"use client";

import { agendaFetch } from "@/lib/agenda/fetchWithAuth";
import { useEffect, useState, type ReactNode } from "react";
import { Save, Clock, Timer, Target, Bell, Calendar, ExternalLink, RefreshCw } from "lucide-react";
import type { AgendaSettings } from "@/types/agenda";

interface ExtSettings extends Partial<AgendaSettings> {
  daily_points_pool?: number;
  google_calendar_connected?: boolean;
  google_calendar_email?: string;
}

export default function AgendaSettingsPage() {
  const [settings, setSettings] = useState<ExtSettings>({
    work_start: "09:00",
    work_end: "18:00",
    slot_duration_minutes: 30,
    pomodoro_work_minutes: 25,
    pomodoro_short_break: 5,
    pomodoro_long_break: 15,
    pomodoro_sessions_before_long: 4,
    weekly_points_goal: 500,
    daily_points_pool: 100,
    auto_schedule_enabled: true,
    recap_reminder_time: "18:30",
    timezone: "Europe/Paris",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gcalSyncing, setGcalSyncing] = useState(false);
  const [gcalMessage, setGcalMessage] = useState("");

  useEffect(() => {
    agendaFetch("/api/agenda/settings")
      .then(r => r.json())
      .then(d => {
        if (d.settings) setSettings(d.settings);
        setLoading(false);
      });

    // Check if Google Calendar is connected (from URL params after OAuth callback)
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal") === "connected") {
      setGcalMessage("Google Calendar connecté avec succès !");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("gcal") === "error") {
      setGcalMessage("Erreur lors de la connexion Google Calendar.");
    }
  }, []);

  async function handleSave() {
    setSaving(true);
    await agendaFetch("/api/agenda/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleGoogleConnect() {
    const res = await agendaFetch("/api/agenda/google-calendar").then(r => r.json());
    if (res.url) window.location.href = res.url;
  }

  async function handleGoogleSync() {
    setGcalSyncing(true);
    setGcalMessage("");
    const res = await agendaFetch("/api/agenda/google-calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 14 }),
    });
    const data = await res.json();
    if (data.error) setGcalMessage(`Erreur: ${data.error}`);
    else setGcalMessage(`${data.imported ?? 0} événement(s) importé(s) comme créneaux bloqués.`);
    setGcalSyncing(false);
  }

  function update(key: keyof ExtSettings, value: unknown) {
    setSettings(s => ({ ...s, [key]: value }));
    setSaved(false);
  }

  if (loading) return <div className="p-8 text-gray-400">Chargement...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres Agenda</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? "Sauvegarde..." : saved ? "Sauvegardé ✓" : "Sauvegarder"}
        </button>
      </div>

      <div className="space-y-6">
        {/* Work hours */}
        <Section icon={<Clock size={16} />} title="Horaires de travail">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Début de journée</label>
              <input type="time" value={settings.work_start ?? "09:00"} onChange={e => update("work_start", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fin de journée</label>
              <input type="time" value={settings.work_end ?? "18:00"} onChange={e => update("work_end", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Durée des créneaux (min)</label>
              <select value={settings.slot_duration_minutes ?? 30} onChange={e => update("slot_duration_minutes", parseInt(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
                <option value={60}>1 heure</option>
              </select>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <label className="text-xs text-gray-500">Auto-planification</label>
              <button onClick={() => update("auto_schedule_enabled", !settings.auto_schedule_enabled)} className={`relative w-11 h-6 rounded-full transition-colors ${settings.auto_schedule_enabled ? "bg-indigo-500" : "bg-gray-200"}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.auto_schedule_enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </Section>

        {/* Points */}
        <Section icon={<Target size={16} />} title="Gamification & Points">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Pool de points journalier
                <span className="ml-1 text-gray-400">(répartis entre les tâches selon leur importance)</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={20} max={500} step={10}
                  value={settings.daily_points_pool ?? 100}
                  onChange={e => update("daily_points_pool", parseInt(e.target.value))}
                  className="flex-1 accent-indigo-500"
                />
                <span className="text-sm font-semibold text-indigo-600 w-20 text-right">{settings.daily_points_pool ?? 100} pts/jour</span>
              </div>
              <div className="mt-2 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                Exemple : 6 tâches (imp. 1,1,1,1,1,5), pool=100pts<br />
                Tâche imp.5 complétée → <strong>{Math.round(5/10*100)}</strong>pts · Tâche imp.1 → <strong>{Math.round(1/10*100)}</strong>pts
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Objectif hebdomadaire de points</label>
              <div className="flex items-center gap-3">
                <input type="range" min={100} max={2000} step={50} value={settings.weekly_points_goal ?? 500} onChange={e => update("weekly_points_goal", parseInt(e.target.value))} className="flex-1 accent-indigo-500" />
                <span className="text-sm font-semibold text-indigo-600 w-20 text-right">{settings.weekly_points_goal ?? 500} pts</span>
              </div>
            </div>
          </div>
        </Section>

        {/* Pomodoro */}
        <Section icon={<Timer size={16} />} title="Pomodoro">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Travail (min)</label>
              <input type="number" value={settings.pomodoro_work_minutes ?? 25} onChange={e => update("pomodoro_work_minutes", parseInt(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" min={1} max={120} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pause courte (min)</label>
              <input type="number" value={settings.pomodoro_short_break ?? 5} onChange={e => update("pomodoro_short_break", parseInt(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" min={1} max={30} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pause longue (min)</label>
              <input type="number" value={settings.pomodoro_long_break ?? 15} onChange={e => update("pomodoro_long_break", parseInt(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" min={1} max={60} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sessions avant grande pause</label>
              <input type="number" value={settings.pomodoro_sessions_before_long ?? 4} onChange={e => update("pomodoro_sessions_before_long", parseInt(e.target.value))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" min={1} max={10} />
            </div>
          </div>
        </Section>

        {/* Google Calendar */}
        <Section icon={<Calendar size={16} />} title="Google Calendar">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Connectez votre Google Calendar pour importer automatiquement vos événements comme créneaux bloqués.
            </p>

            {gcalMessage && (
              <div className={`text-sm px-3 py-2 rounded-lg ${gcalMessage.includes("Erreur") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                {gcalMessage}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleGoogleConnect}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-sm text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Connecter Google Calendar
                <ExternalLink size={12} className="text-gray-400" />
              </button>

              <button
                onClick={handleGoogleSync}
                disabled={gcalSyncing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 text-sm rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                <RefreshCw size={14} className={gcalSyncing ? "animate-spin" : ""} />
                {gcalSyncing ? "Synchronisation..." : "Synchroniser (14 jours)"}
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
              <p><strong>Configuration requise :</strong></p>
              <p>1. Créez un projet Google Cloud Console avec l&apos;API Calendar activée</p>
              <p>2. Ajoutez <code className="bg-gray-100 px-1 rounded">GOOGLE_CLIENT_ID</code> et <code className="bg-gray-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> dans votre <code>.env</code></p>
              <p>3. URI de redirection : <code className="bg-gray-100 px-1 rounded">{typeof window !== "undefined" ? window.location.origin : ""}/api/agenda/google-calendar/callback</code></p>
            </div>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={<Bell size={16} />} title="Rappels">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Heure du récap journalier</label>
              <input type="time" value={settings.recap_reminder_time ?? "18:30"} onChange={e => update("recap_reminder_time", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fuseau horaire</label>
              <select value={settings.timezone ?? "Europe/Paris"} onChange={e => update("timezone", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="Europe/Paris">Europe/Paris (CET)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              </select>
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          <Save size={15} />
          {saving ? "Sauvegarde..." : saved ? "Sauvegardé ✓" : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="flex items-center gap-2 font-semibold text-gray-800 mb-4">
        <span className="text-indigo-500">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}
