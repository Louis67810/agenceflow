"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, GripVertical, Image as ImageIcon, Loader2, MessageSquare, Plus, Send, Trash2, User, X } from "lucide-react";
import { ACTION_LABELS, ConversationMessage, LinkedInProspect, PROSPECT_STATUS_LABELS } from "@/types/linkedin";
import { loadLinkedInSettings, MODELS_SMALL } from "@/lib/linkedin/settings";
import {
  fetchRemoteLinkedInWorkspace,
  loadLinkedInWorkspaceCache,
  persistLinkedInWorkspacePatch,
} from "@/lib/linkedin/workspace";

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

const card = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  boxShadow: "0px 6px 24px rgba(0,0,0,0.05)",
} as const;

const input = {
  width: "100%",
  border: "1px solid rgba(0,0,0,0.09)",
  borderRadius: 12,
  background: "#f7f7f7",
  color: "#121a2e",
  outline: "none",
  padding: "11px 13px",
  fontSize: 13,
  lineHeight: 1.45,
  boxSizing: "border-box" as const,
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

const blueCta = {
  minHeight: 46,
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.06)",
  background: "linear-gradient(146.81deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
  color: "#fff",
  boxShadow: "inset 0px -3px 0px 0px #0e42c8, inset 0px 2px 6px 4px rgba(0,0,0,0.08), inset 0px 3px 0px 0px rgba(255,255,255,0.5), 0px 4px 12px rgba(1,71,255,0.25)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 650,
  fontFamily: '"Plus Jakarta Sans", sans-serif',
} as const;

const VISIBLE_STATUS_OPTIONS: LinkedInProspect["status"][] = [
  "draft",
  "sent",
  "conversation",
  "deal_closed",
  "deal_lost",
];

const DETAIL_STATUS_LABELS: Record<string, string> = {
  ...PROSPECT_STATUS_LABELS,
  deal_closed: "Conclu",
  deal_lost: "Perdu",
};

function formatTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export default function ProspectDetailPage() {
  const params = useParams<{ id: string }>();
  const prospectId = params.id;
  const [prospects, setProspects] = useState<LinkedInProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [sender, setSender] = useState<"me" | "them">("me");
  const [messageDraft, setMessageDraft] = useState("");
  const [messageImages, setMessageImages] = useState<string[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<{ id: string; role: "user" | "assistant"; content: string }[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeModel, setActiveModel] = useState(() => loadLinkedInSettings().prospectionSmallModel);
  const [draggedMessageId, setDraggedMessageId] = useState<string | null>(null);

  useEffect(() => {
    const cached = loadLinkedInWorkspaceCache();
    setProspects(cached.prospects);
    setLoading(false);

    void (async () => {
      try {
        const remote = await fetchRemoteLinkedInWorkspace();
        if (remote.hasStoredData) setProspects(remote.workspace.prospects);
      } catch {}
    })();
  }, []);

  const prospect = useMemo(
    () => prospects.find((item) => item.id === prospectId) ?? null,
    [prospects, prospectId]
  );

  const saveProspect = (next: LinkedInProspect) => {
    const updated = prospects.map((item) => (item.id === next.id ? next : item));
    setProspects(updated);
    persistLinkedInWorkspacePatch({ prospects: updated });
  };

  const conversation = prospect?.conversation ?? [];
  const aiRows = Math.min(7, Math.max(1, ...aiInput.split("\n").map((line) => Math.max(1, Math.ceil(line.length / 24)))));
  const aiComposerExpanded = aiRows > 1;
  const canAddMessage = messageDraft.trim().length > 0 || messageImages.length > 0;

  const updateConversation = (nextConversation: ConversationMessage[]) => {
    if (!prospect) return;
    saveProspect({ ...prospect, conversation: nextConversation });
  };

  const deleteMessage = (id: string) => {
    updateConversation(conversation.filter((message) => message.id !== id));
  };

  const moveMessage = (targetId: string) => {
    if (!draggedMessageId || draggedMessageId === targetId) return;
    const fromIndex = conversation.findIndex((message) => message.id === draggedMessageId);
    const toIndex = conversation.findIndex((message) => message.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...conversation];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    updateConversation(next);
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const readers = Array.from(files).slice(0, 6).map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }));
    try {
      const images = await Promise.all(readers);
      setMessageImages((current) => [...current, ...images].slice(0, 8));
    } catch (error) {
      console.error(error);
    }
  };

  const addMessage = () => {
    if (!prospect || !canAddMessage) return;
    const nextMessage: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sender,
      content: messageDraft.trim(),
      images: messageImages,
      pendingLinkedInSend: sender === "me",
      source: "agenceflow",
      sentAt: new Date().toISOString(),
    };
    const pendingText = messageDraft.trim();
    saveProspect({
      ...prospect,
      conversation: [...conversation, nextMessage],
      status: sender === "them" ? "replied" : prospect.status,
      generatedMessage: sender === "me" ? messageDraft.trim() : prospect.generatedMessage,
      customMessage: sender === "me" ? messageDraft.trim() : prospect.customMessage,
      pendingLinkedInSend: sender === "me" && pendingText
        ? {
            id: nextMessage.id,
            text: pendingText,
            createdAt: nextMessage.sentAt,
          }
        : prospect.pendingLinkedInSend,
    });
    setMessageDraft("");
    setMessageImages([]);
  };

  const askAi = async () => {
    if (!prospect || !aiInput.trim() || aiLoading) return;
    const instruction = aiInput.trim();
    setAiInput("");
    setAiMessages((items) => [...items, { id: `u_${Date.now()}`, role: "user", content: instruction }]);
    setAiLoading(true);

    try {
      const settings = loadLinkedInSettings();
      const res = await fetch("/api/linkedin/generate-prospection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "reply",
          name: prospect.name,
          actionType: prospect.actionType,
          siteUrl: prospect.siteUrl,
          context: [prospect.context, `Instruction actuelle: ${instruction}`].filter(Boolean).join("\n\n"),
          conversationHistory: conversation.map((message) => ({
            role: message.sender === "me" ? "assistant" : "user",
            content: [
              message.content,
              message.images?.length ? `[${message.images.length} image(s) jointe(s) dans ce message]` : "",
            ].filter(Boolean).join("\n"),
          })),
          openrouterApiKey: settings.openrouterApiKey || undefined,
          model: activeModel,
          smallPrompt: settings.prospectionSmallPrompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation impossible");
      const reply = data.message || "";
      setSender("me");
      setMessageDraft(reply);
      setAiMessages((items) => [
        ...items,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: "J'ai rempli le champ message avec une proposition que tu peux modifier avant de l'ajouter.",
        },
      ]);
    } catch (error) {
      setAiMessages((items) => [
        ...items,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "Impossible de preparer le message.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: "rgba(18,26,46,0.5)", ...jk }}>Chargement...</div>;
  }

  if (!prospect) {
    return (
      <div style={{ padding: 24, ...jk }}>
        <Link href="/admin/linkedin/prospection" style={{ color: "#0147ff", fontWeight: 700, textDecoration: "none" }}>
          Retour aux prospects
        </Link>
        <p style={{ color: "rgba(18,26,46,0.55)" }}>Prospect introuvable.</p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fbfbfb", ...jk }}>
      <div style={{ background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "15px 22px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Link
              href="/admin/linkedin/prospection"
              style={{ width: 36, height: 36, borderRadius: 11, border: "1px solid rgba(0,0,0,0.08)", background: "#f7f7f7", display: "flex", alignItems: "center", justifyContent: "center", color: "#121a2e", textDecoration: "none" }}
            >
              <ArrowLeft size={17} />
            </Link>
            {prospect.avatarUrl ? (
              <img
                src={prospect.avatarUrl}
                alt=""
                style={{ width: 38, height: 38, borderRadius: 999, objectFit: "cover", border: "1px solid rgba(18,26,46,0.1)", boxShadow: "0px 5px 14px rgba(18,26,46,0.08)", flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: 999, background: "#f0f0f0", color: "rgba(18,26,46,0.45)", display: "grid", placeItems: "center", border: "1px solid rgba(18,26,46,0.08)", flexShrink: 0 }}>
                <User size={17} />
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, color: "#121a2e", fontSize: 18, fontWeight: 800, letterSpacing: "-0.45px" }}>{prospect.name}</h1>
              <p style={{ margin: "3px 0 0", color: "rgba(18,26,46,0.48)", fontSize: 12 }}>
                {ACTION_LABELS[prospect.actionType]} - {PROSPECT_STATUS_LABELS[prospect.status]}
              </p>
            </div>
          </div>
          {prospect.profileUrl && (
            <a href={prospect.profileUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 7, color: "#0147ff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              Profil LinkedIn <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "620px minmax(420px, 1fr) 300px", overflow: "hidden" }}>
        <aside style={{ width: 620, minHeight: 0, background: "#fff", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "24px 24px 16px" }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#121a2e" }}>Conversation IA</p>
            <select
              value={activeModel}
              onChange={(event) => setActiveModel(event.target.value)}
              style={{ maxWidth: 230, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 999, background: "#fff", color: "rgba(18,26,46,0.72)", padding: "8px 12px", fontSize: 12, fontWeight: 650, outline: "none", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              {MODELS_SMALL.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24, padding: "0 24px" }}>
            {aiMessages.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(18,26,46,0.42)" }}>Demande une reponse IA basee sur le prospect et la conversation.</p>
            ) : aiMessages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} style={{ width: "fit-content", maxWidth: "75%", alignSelf: isUser ? "flex-end" : "flex-start", borderRadius: 20, background: isUser ? "#F4F4F4" : "transparent", padding: isUser ? "14px 16px" : 0 }}>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "rgba(18,26,46,0.82)", whiteSpace: "pre-wrap" }}>{message.content}</p>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: "12px 24px 16px" }}>
            <div style={{ position: "relative", width: "100%", minHeight: 66, borderRadius: 34, border: "1px solid rgba(18,26,46,0.18)", background: "#fff", boxShadow: "0px 18px 40px rgba(18,26,46,0.08)", display: "flex", flexDirection: aiComposerExpanded ? "column" : "row", alignItems: aiComposerExpanded ? "stretch" : "center", justifyContent: "space-between", gap: aiComposerExpanded ? 10 : 12, padding: 12, transition: "min-height 0.18s ease, gap 0.18s ease" }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: aiComposerExpanded ? "wrap" : "nowrap", gap: aiComposerExpanded ? "10px 12px" : 12, width: "100%", minWidth: 0 }}>
                <button type="button" aria-label="Ajouter" style={{ width: 40, height: 40, borderRadius: 34, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default", flexShrink: 0 }}>
                  <Plus size={18} />
                </button>
                <textarea
                  wrap="soft"
                  value={aiInput}
                  disabled={aiLoading}
                  rows={aiRows}
                  onChange={(event) => setAiInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void askAi();
                    }
                  }}
                  placeholder="Taper un texte ici"
                  style={{ order: aiComposerExpanded ? -1 : 0, flex: aiComposerExpanded ? "0 0 100%" : 1, width: aiComposerExpanded ? "100%" : "auto", minWidth: 0, minHeight: 24, maxHeight: 168, height: aiComposerExpanded ? "auto" : 24, border: 0, outline: "none", color: "rgba(18,26,46,0.7)", fontSize: 16, fontWeight: 500, lineHeight: aiComposerExpanded ? "22px" : "24px", letterSpacing: "-0.2px", fontFamily: "Inter, sans-serif", resize: "none", overflowY: aiInput.split("\n").length > 7 || aiInput.length > 238 ? "auto" : "hidden", overflowX: "hidden", background: "transparent", padding: 0, opacity: aiLoading ? 0.55 : 1, transition: "height 0.18s ease, line-height 0.18s ease", whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" }}
                />
                <button type="button" onClick={() => void askAi()} disabled={aiLoading || !aiInput.trim()} style={{ width: 46, height: 46, borderRadius: 34, background: "#121a2e", color: "#fff", border: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: aiLoading || !aiInput.trim() ? "not-allowed" : "pointer", flexShrink: 0, opacity: aiLoading || !aiInput.trim() ? 0.72 : 1 }}>
                  {aiLoading ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </div>
        </aside>

        <main style={{ minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fbfbfb" }}>
          <div style={{ padding: "22px 28px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <MessageSquare size={17} style={{ color: "#0147ff" }} />
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#121a2e" }}>Conversation</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {prospect.pendingLinkedInSend && (
                <span style={{ fontSize: 11, color: "#c2410c", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 999, padding: "4px 9px", fontWeight: 750 }}>
                  Pret a copier
                </span>
              )}
              <span style={{ fontSize: 12, color: "rgba(18,26,46,0.42)" }}>{conversation.length} message{conversation.length > 1 ? "s" : ""}</span>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 28px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
            {conversation.length === 0 ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: "rgba(18,26,46,0.42)", fontSize: 13 }}>
                Aucun message pour le moment. Ajoute les messages LinkedIn ou demande a l'assistant de preparer une reponse.
              </div>
            ) : conversation.map((message) => (
              <div
                key={message.id}
                draggable
                onDragStart={() => setDraggedMessageId(message.id)}
                onDragOver={(event) => {
                  event.preventDefault();
                  moveMessage(message.id);
                }}
                onDragEnd={() => setDraggedMessageId(null)}
                style={{ alignSelf: message.sender === "me" ? "flex-end" : "flex-start", maxWidth: "72%", opacity: draggedMessageId === message.id ? 0.45 : 1, transition: "transform 0.16s ease, opacity 0.16s ease" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, justifyContent: message.sender === "me" ? "flex-end" : "flex-start" }}>
                  <GripVertical size={12} style={{ color: "rgba(18,26,46,0.25)", cursor: "grab" }} />
                  <User size={11} style={{ color: "rgba(18,26,46,0.36)" }} />
                  <span style={{ color: "rgba(18,26,46,0.38)", fontSize: 11 }}>{message.sender === "me" ? "Moi" : prospect.name} - {formatTime(message.sentAt)}</span>                  <button
                    type="button"
                    onClick={() => deleteMessage(message.id)}
                    aria-label="Supprimer le message"
                    style={{ width: 22, height: 22, border: 0, borderRadius: 999, background: "transparent", color: "rgba(18,26,46,0.35)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div style={{ padding: "12px 14px", borderRadius: message.sender === "me" ? "16px 16px 5px 16px" : "16px 16px 16px 5px", background: message.sender === "me" ? "#0147ff" : "#f2f3f5", color: message.sender === "me" ? "#fff" : "#121a2e", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                  {message.content}
                  {message.images?.length ? (
                    <div style={{ marginTop: message.content ? 10 : 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                      {message.images.map((src, index) => (
                        <img key={`${message.id}_${index}`} src={src} alt="" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 12, border: message.sender === "me" ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(18,26,46,0.08)" }} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div style={{ position: "sticky", bottom: 0, zIndex: 3, padding: "10px 28px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "rgba(251,251,251,0.96)", backdropFilter: "blur(10px)" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {(["me", "them"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setSender(value)}
                  style={{ padding: "7px 11px", borderRadius: 999, border: sender === value ? "1px solid #2f4d9d" : "1px solid rgba(0,0,0,0.08)", background: sender === value ? "#0147ff" : "#f7f7f7", color: sender === value ? "#fff" : "rgba(18,26,46,0.62)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {value === "me" ? "Moi" : prospect.name}
                </button>
              ))}
            </div>
            {messageImages.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {messageImages.map((src, index) => (
                  <div key={`${src.slice(0, 24)}_${index}`} style={{ position: "relative", width: 68, aspectRatio: "1 / 1" }}>
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: "1px solid rgba(18,26,46,0.1)" }} />
                    <button type="button" onClick={() => setMessageImages((images) => images.filter((_, i) => i !== index))} style={{ position: "absolute", top: -7, right: -7, width: 22, height: 22, borderRadius: 999, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", color: "#121a2e", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0px 4px 10px rgba(18,26,46,0.12)" }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ minHeight: 142, border: "1px solid rgba(18,26,46,0.12)", borderRadius: 18, background: "#fff", boxShadow: "0px 8px 24px rgba(18,26,46,0.06)", display: "flex", flexDirection: "column", padding: 12 }}>
              <textarea
                value={messageDraft}
                onChange={(e) => setMessageDraft(e.target.value)}
                placeholder="Ecris ou fais remplir ce message par l'assistant..."
                rows={5}
                style={{ width: "100%", flex: 1, minHeight: 92, border: 0, outline: "none", resize: "vertical", background: "transparent", color: "#121a2e", fontSize: 14, lineHeight: 1.5, fontFamily: '"Plus Jakarta Sans", sans-serif', padding: 0 }}
              />
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <label style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid rgba(18,26,46,0.10)", background: "#f6f6f6", color: "rgba(18,26,46,0.62)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <ImageIcon size={18} />
                  <input type="file" accept="image/*" multiple onChange={(event) => { void addImages(event.target.files); event.currentTarget.value = ""; }} style={{ display: "none" }} />
                </label>
                <button
                  onClick={addMessage}
                  disabled={!canAddMessage}
                  style={{ ...blueCta, width: "fit-content", minWidth: 116, padding: "0 16px", cursor: canAddMessage ? "pointer" : "not-allowed", opacity: canAddMessage ? 1 : 0.55 }}
                >
                  <Plus size={15} />
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </main>

        <aside style={{ minHeight: 0, background: "#fff", borderLeft: "1px solid rgba(0,0,0,0.07)", padding: "24px 20px", overflowY: "auto" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#121a2e" }}>Infos prospect</h2>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <Info label="Source" value={ACTION_LABELS[prospect.actionType]} />
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 11, color: "rgba(18,26,46,0.38)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>Statut</p>
              <select
                value={VISIBLE_STATUS_OPTIONS.includes(prospect.status) ? prospect.status : "conversation"}
                onChange={(event) => saveProspect({ ...prospect, status: event.target.value as LinkedInProspect["status"] })}
                style={{ width: "100%", border: "1px solid rgba(18,26,46,0.12)", borderRadius: 10, background: "#f7f7f7", color: "#121a2e", padding: "10px 11px", fontSize: 13, fontWeight: 700, outline: "none", fontFamily: '"Plus Jakarta Sans", sans-serif' }}
              >
                {VISIBLE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{DETAIL_STATUS_LABELS[status]}</option>
                ))}
              </select>
              {prospect.status === "replied" && (
                <p style={{ margin: "7px 0 0", fontSize: 12, color: "rgba(18,26,46,0.45)", lineHeight: 1.45 }}>
                  Reponse detectee automatiquement.
                </p>
              )}
            </div>
            {prospect.siteUrl && (
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 11, color: "rgba(18,26,46,0.38)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>Site</p>
                <a
                  href={prospect.siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#0147ff", fontSize: 13, fontWeight: 700, lineHeight: 1.45, textDecoration: "none", wordBreak: "break-word" }}
                >
                  {prospect.siteUrl}
                  <ExternalLink size={13} />
                </a>
              </div>
            )}
            {prospect.context && <Info label="Contexte" value={prospect.context} multiline />}
          </div>
        </aside>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
function Info({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p style={{ margin: "0 0 4px", fontSize: 11, color: "rgba(18,26,46,0.38)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, color: "rgba(18,26,46,0.72)", lineHeight: 1.55, wordBreak: multiline ? "normal" : "break-word", whiteSpace: multiline ? "pre-wrap" : "normal" }}>{value}</p>
    </div>
  );
}
