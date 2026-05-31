import { createHash } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_LINKEDIN_WORKSPACE,
  normalizeLinkedInWorkspaceData,
} from "@/lib/linkedin/workspace";
import { createServiceClient } from "@/lib/supabase/service";
import type { ConversationMessage, LinkedInProspect, LinkedInWorkspaceData } from "@/types/linkedin";
import type { LinkedInExtensionMessage } from "@/types/linkedin-extension";

export function normalizeText(value?: string | null) {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function normalizeProfileUrl(value?: string | null) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.replace(/\/$/, "").trim().toLowerCase();
  }
}

export function stableMessageHash(input: {
  sender?: string;
  text?: string;
  sentAt?: string;
  links?: string[];
  images?: { url?: string; alt?: string }[];
}) {
  const payload = [
    input.sender ?? "",
    normalizeText(input.text),
    input.sentAt ?? "",
    [...(input.links ?? [])].sort().join("|"),
    (input.images ?? []).map((image) => image.url ?? image.alt ?? "").sort().join("|"),
  ].join("\n");

  return createHash("sha256").update(payload).digest("hex");
}

export function getExtensionBearer(req: Request) {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

export function authenticateExtensionRequest(req: Request) {
  const expectedKey = process.env.AGENCEFLOW_EXTENSION_KEY?.trim();
  const workspaceUserId = process.env.AGENCEFLOW_EXTENSION_USER_ID?.trim();
  const receivedKey = getExtensionBearer(req);

  if (!expectedKey || !workspaceUserId) {
    console.error("[linkedin-extension] server configuration missing", {
      hasExtensionKey: Boolean(expectedKey),
      hasWorkspaceUserId: Boolean(workspaceUserId),
    });
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Extension LinkedIn non configuree cote serveur.",
          code: "LINKEDIN_EXTENSION_SERVER_CONFIG_MISSING",
          missing: {
            AGENCEFLOW_EXTENSION_KEY: !expectedKey,
            AGENCEFLOW_EXTENSION_USER_ID: !workspaceUserId,
          },
        },
        { status: 500 }
      ),
    };
  }

  if (!receivedKey || receivedKey !== expectedKey) {
    console.warn("[linkedin-extension] unauthorized request", {
      hasAuthorizationHeader: Boolean(receivedKey),
      receivedLength: receivedKey.length,
    });
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Cle d'extension invalide ou manquante.",
          code: "LINKEDIN_EXTENSION_UNAUTHORIZED",
        },
        { status: 401 }
      ),
    };
  }

  const supabase = createServiceClient();
  if (!supabase) {
    console.error("[linkedin-extension] Supabase service role missing");
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "SUPABASE_SERVICE_ROLE_KEY manquante cote serveur.",
          code: "SUPABASE_SERVICE_ROLE_KEY_MISSING",
        },
        { status: 500 }
      ),
    };
  }

  return { ok: true as const, supabase, userId: workspaceUserId };
}

export async function loadWorkspace(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("linkedin_user_workspace")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return normalizeLinkedInWorkspaceData(
    (data?.data as Partial<LinkedInWorkspaceData> | null) ?? DEFAULT_LINKEDIN_WORKSPACE
  );
}

export async function saveWorkspace(
  supabase: SupabaseClient,
  userId: string,
  workspace: LinkedInWorkspaceData
) {
  const normalized = normalizeLinkedInWorkspaceData(workspace);
  const { error } = await supabase
    .from("linkedin_user_workspace")
    .upsert(
      {
        user_id: userId,
        data: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
  return normalized;
}

export function findProspect(
  prospects: LinkedInProspect[],
  prospect: { name?: string; profileUrl?: string }
) {
  const profileUrl = normalizeProfileUrl(prospect.profileUrl);
  if (profileUrl) {
    const byProfile = prospects.find((item) => normalizeProfileUrl(item.profileUrl) === profileUrl);
    if (byProfile) return byProfile;
  }

  const name = normalizeText(prospect.name);
  if (!name) return null;
  return prospects.find((item) => normalizeText(item.name) === name) ?? null;
}

export function mapImportedMessage(message: LinkedInExtensionMessage): ConversationMessage {
  const hash = message.rawHash || stableMessageHash(message);
  return {
    id: message.externalId || `linkedin_${hash.slice(0, 16)}`,
    externalId: message.externalId,
    sender: message.sender,
    senderName: message.senderName,
    content: message.text,
    links: message.links ?? [],
    images: (message.images ?? [])
      .map((image) => image.url)
      .filter((url): url is string => Boolean(url)),
    rawHash: hash,
    source: "linkedin_chrome_extension",
    pendingLinkedInSend: false,
    confirmedSentAt: message.sender === "me" ? message.sentAt ?? new Date().toISOString() : undefined,
    sentAt: message.sentAt ?? new Date().toISOString(),
  };
}

export function textMatches(a?: string, b?: string) {
  return normalizeText(a) === normalizeText(b);
}

export function resolvePendingMessage(prospect: LinkedInProspect) {
  if (prospect.pendingLinkedInSend?.text?.trim()) {
    return {
      id: prospect.pendingLinkedInSend.id,
      text: prospect.pendingLinkedInSend.text,
    };
  }

  const pendingConversationMessage = [...(prospect.conversation ?? [])]
    .reverse()
    .find((message) => message.sender === "me" && message.pendingLinkedInSend && message.content.trim());

  if (pendingConversationMessage) {
    return {
      id: pendingConversationMessage.id,
      text: pendingConversationMessage.content,
    };
  }

  if (prospect.status === "draft") {
    const text = prospect.customMessage || prospect.generatedMessage;
    if (text?.trim()) {
      return {
        id: `prospect_message_${prospect.id}`,
        text,
      };
    }
  }

  return null;
}

export function markPendingAsSent(
  prospect: LinkedInProspect,
  messageText: string,
  detectedHash?: string
): LinkedInProspect {
  const now = new Date().toISOString();
  const nextConversation = (prospect.conversation ?? []).map((message) => {
    if (message.sender !== "me") return message;
    const hashMatches = Boolean(detectedHash && message.rawHash === detectedHash);
    const contentMatches = textMatches(message.content, messageText);
    if (!hashMatches && !contentMatches) return message;
    return {
      ...message,
      pendingLinkedInSend: false,
      confirmedSentAt: message.confirmedSentAt ?? now,
      rawHash: detectedHash ?? message.rawHash,
    };
  });

  const pendingMatches =
    textMatches(prospect.pendingLinkedInSend?.text, messageText) ||
    textMatches(prospect.customMessage || prospect.generatedMessage, messageText);

  return {
    ...prospect,
    conversation: nextConversation,
    pendingLinkedInSend: pendingMatches ? undefined : prospect.pendingLinkedInSend,
    status: prospect.status === "draft" ? "sent" : prospect.status,
    sentAt: prospect.sentAt ?? now,
  };
}
