"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Save, Clock, Timer, Target, Bell } from "lucide-react";
import type { AgendaSettings } from "@/types/agenda";

export default function AgendaSettingsPage() {
  const [settings, setSettings] = useState<Partial<AgendaSettings>>({
    work_start: "09:00",
    work_end: "18:00",
    slot_duration_minutes: 30,
    pomodoro_work_minutes: 25,
    pomodoro_short_break: 5,
    pomodoro_long_break: 15,
    pomodoro_sessions_before_long: 4,
    weekly_points_goal: 500,
    auto_schedule_enabled: true,
    recap_reminder_time: "18:30",
    timezone: "Europe/Paris",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/agenda/settings")
      .then(r => r.json())
      .then(d => {
        if (d.settings) setSettings(d.settings);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/agenda/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function update(key: keyof AgendaSettings, value: unknown) {
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
              <input
                type="time"
                value={settings.work_start ?? "09:00"}
                onChange={e => update("work_start", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fin de journée</label>
              <input
                type="time"
                value={settings.work_end ?? "18:00"}
                onChange={e => update("work_end", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Durée des créneaux (min)</label>
              <select
                value={settings.slot_duration_minutes ?? 30}
                onChange={e => update("slot_duration_minutes", parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 heure</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="block text-xs text-gray-500">Auto-planification</label>
              <button
                onClick={() => update("auto_schedule_enabled", !settings.auto_schedule_enabled)}
                className={`relative w-11 h-6 rounded-full transition-colors ${settings.auto_schedule_enabled ? "bg-indigo-500" : "bg-gray-200"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${settings.auto_schedule_enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
        </Section>

        {/* Pomodoro */}
        <Section icon={<Timer size={16} />} title="Paramètres Pomodoro">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Durée de travail (min)</label>
              <input
                type="number"
                value={settings.pomodoro_work_minutes ?? 25}
                onChange={e => update("pomodoro_work_minutes", parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                min={1} max={120}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pause courte (min)</label>
              <input
                type="number"
                value={settings.pomodoro_short_break ?? 5}
                onChange={e => update("pomodoro_short_break", parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                min={1} max={30}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Pause longue (min)</label>
              <input
                type="number"
                value={settings.pomodoro_long_break ?? 15}
                onChange={e => update("pomodoro_long_break", parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                min={1} max={60}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sessions avant grande pause</label>
              <input
                type="number"
                value={settings.pomodoro_sessions_before_long ?? 4}
                onChange={e => update("pomodoro_sessions_before_long", parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                min={1} max={10}
              />
            </div>
          </div>
          <div className="mt-4 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-600">
            Cycle : {settings.pomodoro_sessions_before_long ?? 4} × {settings.pomodoro_work_minutes ?? 25}min de travail
            → pause longue de {settings.pomodoro_long_break ?? 15}min
          </div>
        </Section>

        {/* Gamification */}
        <Section icon={<Target size={16} />} title="Gamification">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Objectif hebdomadaire de points</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                value={settings.weekly_points_goal ?? 500}
                onChange={e => update("weekly_points_goal", parseInt(e.target.value))}
                className="flex-1 accent-indigo-500"
              />
              <span className="text-sm font-semibold text-indigo-600 w-20 text-right">
                {settings.weekly_points_goal ?? 500} pts
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              ≈ {Math.round((settings.weekly_points_goal ?? 500) / 7)} pts/jour · {Math.round((settings.weekly_points_goal ?? 500) / 50)} tâches imp.5/jour
            </p>
          </div>
        </Section>

        {/* Notifications */}
        <Section icon={<Bell size={16} />} title="Rappels">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Heure du récap journalier</label>
              <input
                type="time"
                value={settings.recap_reminder_time ?? "18:30"}
                onChange={e => update("recap_reminder_time", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fuseau horaire</label>
              <select
                value={settings.timezone ?? "Europe/Paris"}
                onChange={e => update("timezone", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
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
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save size={15} />
          {saving ? "Sauvegarde..." : saved ? "Sauvegardé ✓" : "Sauvegarder les paramètres"}
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
