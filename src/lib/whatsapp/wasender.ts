const WASENDER_BASE_URL = "https://www.wasenderapi.com/api";

type WasenderResponse<T> = {
  success?: boolean;
  data?: T;
  inviteLink?: string;
  error?: string;
  message?: string;
};

type WasenderResult<T> =
  | { ok: true; data?: T; inviteLink?: string; raw?: WasenderResponse<T> | null }
  | { ok: false; error: string; status?: number };

export function normalizeWhatsappPhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `33${digits.slice(1)}`;
  return digits;
}

function getWasenderToken() {
  return process.env.WASENDER_API_TOKEN?.trim() || "";
}

async function wasenderFetch<T>(path: string, init?: RequestInit): Promise<WasenderResult<T>> {
  const token = getWasenderToken();
  if (!token) {
    return { ok: false, error: "WASENDER_API_TOKEN manquant cote serveur." };
  }

  const res = await fetch(`${WASENDER_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let payload: WasenderResponse<T> | null = null;
  try {
    payload = text ? JSON.parse(text) as WasenderResponse<T> : null;
  } catch {
    payload = null;
  }

  if (!res.ok || payload?.success === false) {
    return {
      ok: false,
      error: payload?.error || payload?.message || text || `Erreur Wasender ${res.status}`,
      status: res.status,
    };
  }

  return { ok: true, data: payload?.data as T, inviteLink: payload?.inviteLink, raw: payload };
}

export async function createWasenderGroup(input: {
  name: string;
  participants?: string[];
  profilePicUrl?: string | null;
}): Promise<WasenderResult<{ id?: string; subject?: string; inviteLink?: string }>> {
  const participants = (input.participants ?? []).map(normalizeWhatsappPhone).filter(Boolean);
  const group = await wasenderFetch<{ id?: string; subject?: string }>("/groups", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      participants,
    }),
  });

  if (!group.ok) return group;

  const groupJid = group.data?.id;
  if (groupJid && input.profilePicUrl?.trim()) {
    await wasenderFetch(`/groups/${encodeURIComponent(groupJid)}/settings`, {
      method: "PUT",
      body: JSON.stringify({ profilePicUrl: input.profilePicUrl.trim() }),
    });
  }

  let inviteLink: string | undefined;
  if (groupJid) {
    const invite = await getWasenderGroupInviteLink(groupJid);
    if (invite.ok) inviteLink = invite.inviteLink;
  }

  return {
    ok: true,
    data: {
      id: groupJid,
      subject: group.data?.subject ?? input.name,
      inviteLink,
    },
  };
}

export async function getWasenderGroupInviteLink(groupJid: string) {
  return wasenderFetch<never>(`/groups/${encodeURIComponent(groupJid)}/invite-link`);
}

export async function addWasenderGroupParticipants(groupJid: string, phones: string[]): Promise<WasenderResult<Array<{ status: number; jid: string; message: string }>>> {
  const participants = phones.map(normalizeWhatsappPhone).filter(Boolean);
  if (!participants.length) return { ok: true, data: [] };

  return wasenderFetch<Array<{ status: number; jid: string; message: string }>>(
    `/groups/${encodeURIComponent(groupJid)}/participants/add`,
    {
      method: "POST",
      body: JSON.stringify({ participants }),
    }
  );
}

export async function sendWasenderGroupMessage(groupJid: string, text: string) {
  return wasenderFetch<{ msgId?: number; jid?: string; status?: string }>("/send-message", {
    method: "POST",
    body: JSON.stringify({ to: groupJid, text }),
  });
}
