"use client";

import { leadMagnetFetch } from "@/lib/lead-magnet/fetchWithAuth";

export interface LeadMagnetAirtableSettings {
  airtableKey: string;
  airtableBaseId: string;
}

export const DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS: LeadMagnetAirtableSettings = {
  airtableKey: "",
  airtableBaseId: "",
};

const SETTINGS_KEY = "lead_magnet_airtable_settings";
const PENDING_SYNC_KEY = "lead_magnet_airtable_settings_pending_sync";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function normalizeLeadMagnetAirtableSettings(
  settings?: Partial<LeadMagnetAirtableSettings> | null
): LeadMagnetAirtableSettings {
  return {
    ...DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS,
    ...(settings ?? {}),
  };
}

export function loadLeadMagnetAirtableSettings(): LeadMagnetAirtableSettings {
  if (!canUseStorage()) return DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS;
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return normalizeLeadMagnetAirtableSettings(
        JSON.parse(saved) as Partial<LeadMagnetAirtableSettings>
      );
    }
  } catch {}
  return DEFAULT_LEAD_MAGNET_AIRTABLE_SETTINGS;
}

export function saveLeadMagnetAirtableSettingsLocal(
  settings: LeadMagnetAirtableSettings
) {
  const normalized = normalizeLeadMagnetAirtableSettings(settings);
  if (canUseStorage()) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

function persistPendingSettings(settings: LeadMagnetAirtableSettings) {
  if (!canUseStorage()) return;
  localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(normalizeLeadMagnetAirtableSettings(settings)));
}

export function queueRemoteLeadMagnetAirtableSettingsSync(
  settings: LeadMagnetAirtableSettings
) {
  const normalized = saveLeadMagnetAirtableSettingsLocal(settings);
  persistPendingSettings(normalized);
  return normalized;
}

function readPendingSettings() {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(PENDING_SYNC_KEY);
  if (!raw) return null;
  try {
    return normalizeLeadMagnetAirtableSettings(
      JSON.parse(raw) as Partial<LeadMagnetAirtableSettings>
    );
  } catch {
    return null;
  }
}

function clearPendingSettings(expected?: LeadMagnetAirtableSettings) {
  if (!canUseStorage()) return;
  if (!expected) {
    localStorage.removeItem(PENDING_SYNC_KEY);
    return;
  }

  const current = readPendingSettings();
  if (!current) return;
  if (JSON.stringify(current) === JSON.stringify(normalizeLeadMagnetAirtableSettings(expected))) {
    localStorage.removeItem(PENDING_SYNC_KEY);
  }
}

export async function fetchRemoteLeadMagnetAirtableSettings() {
  const res = await leadMagnetFetch("/api/lead-magnet/settings-store", {
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Impossible de charger les reglages Airtable Lead Magnet.");
  }
  return saveLeadMagnetAirtableSettingsLocal(
    normalizeLeadMagnetAirtableSettings(data.settings)
  );
}

export async function saveRemoteLeadMagnetAirtableSettings(
  settings: LeadMagnetAirtableSettings
) {
  const normalized = normalizeLeadMagnetAirtableSettings(settings);
  const res = await leadMagnetFetch("/api/lead-magnet/settings-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings: normalized }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Impossible de sauvegarder les reglages Airtable Lead Magnet.");
  }
  return saveLeadMagnetAirtableSettingsLocal(
    normalizeLeadMagnetAirtableSettings(data.settings)
  );
}

export async function persistRemoteLeadMagnetAirtableSettings(
  settings: LeadMagnetAirtableSettings
) {
  const normalized = queueRemoteLeadMagnetAirtableSettingsSync(settings);
  try {
    const saved = await saveRemoteLeadMagnetAirtableSettings(normalized);
    clearPendingSettings(saved);
    return saved;
  } catch (error) {
    console.error("Lead Magnet Airtable settings remote sync failed", error);
    throw error;
  }
}

export async function flushPendingRemoteLeadMagnetAirtableSettings() {
  const pending = readPendingSettings();
  if (!pending) return null;
  return persistRemoteLeadMagnetAirtableSettings(pending);
}
