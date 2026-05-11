"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEventHandler } from "react";
import {
  AlignLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Copy,
  Expand,
  Heart,
  Italic,
  Loader2,
  MessageCircle,
  Minus,
  Quote,
  Repeat2,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import {
  DEFAULT_LINKEDIN_EDIT_ACTIONS,
  fillLinkedInEditActionPrompt,
  normalizeLinkedInEditActions,
  type LinkedInEditAction,
  type LinkedInEditActionCategory,
} from "@/lib/linkedin/edit-ai-actions";

interface SmartSelectionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  style?: CSSProperties;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  apiKey?: string;
  model?: string;
  prompt?: string;
  contextLabel: string;
  globalLabel?: string;
  showGlobalAction?: boolean;
  autoFit?: boolean;
  showWordCount?: boolean;
  richFormatting?: boolean;
  onUseSelection?: (text: string) => void;
  aiCommands?: AiCommand[];
  autoApplyAiActions?: boolean;
  onHistory?: (entry: { label: string; before: string; after: string }) => void;
  onAiAction?: (entry: { label: string; before: string; after: string; scope: "selection" | "full" | "format" }) => void;
}

interface SelectionState {
  start: number;
  end: number;
  text: string;
}

export interface AiCommand {
  id: string;
  label: string;
  instruction: string;
  category: LinkedInEditActionCategory;
  icon: typeof Sparkles;
  color: string;
  script?: (text: string) => string;
}

interface AiResult {
  command: AiCommand;
  text: string;
  original: string;
  applyToFullText: boolean;
  variations: string[];
  index: number;
}

const commandVisuals: Record<string, Pick<AiCommand, "icon" | "color" | "script">> = {
  faire_variation: { icon: Repeat2, color: "#0147ff" },
  retirer_emojis: { icon: X, color: "#6b7280", script: (text) => text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/[ \t]+\n/g, "\n").trim() },
  corriger_fautes: { icon: Check, color: "#168b64" },
  developper: { icon: Expand, color: "#0147ff" },
  condenser: { icon: Minus, color: "#0147ff" },
  attention_technique: { icon: Zap, color: "#ef4444" },
  transformer_hook: { icon: Zap, color: "#ef4444" },
  transformer_open_loop: { icon: Repeat2, color: "#ef4444" },
  transformer_micro_open_loop: { icon: RotateCcw, color: "#ef4444" },
  transformer_pattern_interrupt: { icon: Target, color: "#ef4444" },
  transformer_curiosity_gap: { icon: Sparkles, color: "#ef4444" },
  transformer_accroche_contrarienne: { icon: Zap, color: "#ef4444" },
  rythme_structure: { icon: AlignLeft, color: "#6236AA" },
  transformer_liste_rytmee: { icon: AlignLeft, color: "#6236AA" },
  transformer_structure_escalier: { icon: ArrowDownLeft, color: "#6236AA" },
  transformer_symbole_visuel: { icon: Sparkles, color: "#6236AA" },
  transformer_cadence_courte: { icon: ArrowUpRight, color: "#6236AA" },
  transformer_question_ouverte: { icon: MessageCircle, color: "#0f766e" },
  transformer_polarisation: { icon: Target, color: "#0f766e" },
  transformer_citation_memorable: { icon: Quote, color: "#0f766e" },
  transformer_insight_personnel: { icon: Sparkles, color: "#0f766e" },
  transformer_lead_magnet: { icon: Clipboard, color: "#0f766e" },
  transformer_erreur_volontaire: { icon: Zap, color: "#0f766e" },
  transformer_repetition_dynamique: { icon: Repeat2, color: "#f97316" },
  transformer_vulnerabilite: { icon: Heart, color: "#f97316" },
  transformer_contraste_emotionnel: { icon: Heart, color: "#f97316" },
};

export function buildSmartSelectionCommands(actions?: LinkedInEditAction[] | null): AiCommand[] {
  return normalizeLinkedInEditActions(actions ?? DEFAULT_LINKEDIN_EDIT_ACTIONS).map((action) => {
    const visual = commandVisuals[action.id] ?? { icon: Sparkles, color: "#0147ff" };
    return {
      id: action.id,
      label: action.label,
      instruction: action.prompt,
      category: action.category,
      ...visual,
    };
  });
}

export const SMART_SELECTION_COMMANDS: AiCommand[] = buildSmartSelectionCommands();

const baseButton: CSSProperties = {
  border: 0,
  borderRadius: 10,
  cursor: "pointer",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markdownToHtml(text: string) {
  return text
    .split("\n")
    .map((line) => {
      const escaped = escapeHtml(line);
      const formatted = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
      return line.startsWith("> ") ? `<blockquote>${formatted.replace(/^&gt;\s?/, "")}</blockquote>` : formatted;
    })
    .join("<br>");
}

function htmlToMarkdown(html: string) {
  if (typeof document === "undefined") return html;
  const container = document.createElement("div");
  container.innerHTML = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div><div>/gi, "\n")
    .replace(/<div>/gi, "")
    .replace(/<\/div>/gi, "")
    .replace(/<blockquote[^>]*>/gi, "> ")
    .replace(/<\/blockquote>/gi, "\n")
    .replace(/<(strong|b)[^>]*>/gi, "**")
    .replace(/<\/(strong|b)>/gi, "**")
    .replace(/<(em|i)[^>]*>/gi, "*")
    .replace(/<\/(em|i)>/gi, "*");
  return container.textContent ?? "";
}

export default function SmartSelectionTextarea({
  value,
  onChange,
  rows = 6,
  placeholder,
  style,
  onKeyDown,
  apiKey,
  model,
  prompt,
  contextLabel,
  globalLabel = "Faire un changement global",
  showGlobalAction = true,
  autoFit = false,
  showWordCount = false,
  richFormatting = false,
  onUseSelection,
  aiCommands,
  autoApplyAiActions = false,
  onHistory,
  onAiAction,
}: SmartSelectionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selectingRef = useRef(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<{ top: number; left: number } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loadingCommand, setLoadingCommand] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [copiedResult, setCopiedResult] = useState(false);
  const [aiError, setAiError] = useState("");

  const hasText = value.trim().length > 0;
  const canTransformSelection = !!selection?.text.trim();
  const textareaStyle = useMemo<CSSProperties>(() => ({
    width: "100%",
    resize: autoFit ? "none" : "vertical",
    overflow: autoFit ? "hidden" : undefined,
    ...style,
  }), [autoFit, style]);

  const floatingLeft = (width: number) => selectionToolbar
    ? Math.max(8, Math.min(selectionToolbar.left, (wrapperRef.current?.clientWidth ?? width + 16) - width - 8))
    : undefined;
  const floatingRight = selectionToolbar ? undefined : 10;
  const commands = aiCommands?.length ? aiCommands : SMART_SELECTION_COMMANDS;
  const filteredCommands = commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()));
  const categories = Array.from(new Set(filteredCommands.map((command) => command.category)));
  const currentResultText = result ? result.variations[result.index] ?? result.text : "";
  const isOriginalVariation = result?.index === 0;

  function getTextareaSelectionToolbar(start: number) {
    const textarea = textareaRef.current;
    const wrapper = wrapperRef.current;
    if (!textarea || !wrapper || typeof document === "undefined") return null;

    const textareaRect = textarea.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const computed = window.getComputedStyle(textarea);
    const mirror = document.createElement("div");
    const span = document.createElement("span");
    const properties = [
      "boxSizing",
      "width",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "fontStyle",
      "letterSpacing",
      "lineHeight",
      "textTransform",
      "textIndent",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
    ] as const;

    properties.forEach((property) => {
      mirror.style[property] = computed[property];
    });
    mirror.style.position = "absolute";
    mirror.style.visibility = "hidden";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.overflowWrap = "break-word";
    mirror.style.wordBreak = computed.wordBreak;
    mirror.style.top = "0";
    mirror.style.left = "-9999px";
    mirror.style.height = "auto";
    mirror.textContent = textarea.value.slice(0, start);
    span.textContent = textarea.value.slice(start, start + 1) || ".";
    mirror.appendChild(span);
    document.body.appendChild(mirror);

    const top = textareaRect.top - wrapperRect.top + span.offsetTop - textarea.scrollTop - 48;
    const left = textareaRect.left - wrapperRect.left + span.offsetLeft - textarea.scrollLeft;
    mirror.remove();

    return {
      top: Math.max(8, top),
      left: Math.max(8, Math.min(left, wrapper.clientWidth - 420)),
    };
  }

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !autoFit) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(42, textarea.scrollHeight)}px`;
  }, [autoFit, value]);

  useEffect(() => {
    if (!richFormatting) return;
    const editor = editorRef.current;
    if (!editor || document.activeElement === editor) return;
    const nextHtml = markdownToHtml(value);
    if (editor.innerHTML !== nextHtml) editor.innerHTML = nextHtml;
  }, [richFormatting, value]);

  useEffect(() => {
    function handleDocumentMouseUp() {
      if (!selectingRef.current) return;
      selectingRef.current = false;
      window.setTimeout(() => {
        if (richFormatting) refreshRichSelection();
        else refreshSelection();
      }, 0);
    }

    document.addEventListener("mouseup", handleDocumentMouseUp);
    return () => document.removeEventListener("mouseup", handleDocumentMouseUp);
  });

  function refreshSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (end <= start) {
      setSelection(null);
      setAiOpen(false);
      return;
    }
    const text = textarea.value.slice(start, end);
    if (!text.trim()) {
      setSelection(null);
      setAiOpen(false);
      return;
    }
    setSelection({ start, end, text });
    setSelectionToolbar(getTextareaSelectionToolbar(start));
  }

  function syncRichValue(label?: string, beforeValue?: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const after = htmlToMarkdown(editor.innerHTML);
    onChange(after);
    if (label && beforeValue !== undefined) {
      onHistory?.({ label, before: beforeValue, after });
      onAiAction?.({ label, before: beforeValue, after, scope: label === "Mise en forme" ? "format" : "selection" });
    }
  }

  function refreshRichSelection() {
    const editor = editorRef.current;
    const wrapper = wrapperRef.current;
    const currentSelection = window.getSelection();
    if (!editor || !wrapper || !currentSelection || currentSelection.rangeCount === 0 || currentSelection.isCollapsed) {
      setSelection(null);
      setSelectionToolbar(null);
      setAiOpen(false);
      return;
    }
    const range = currentSelection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      setSelection(null);
      setSelectionToolbar(null);
      setAiOpen(false);
      return;
    }
    const text = currentSelection.toString();
    if (!text.trim()) {
      setSelection(null);
      setSelectionToolbar(null);
      setAiOpen(false);
      return;
    }
    const rect = range.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    setSelection({ start: 0, end: text.length, text });
    setSelectionToolbar({
      top: Math.max(8, rect.top - wrapperRect.top - 50),
      left: Math.max(8, Math.min(rect.left - wrapperRect.left, wrapperRect.width - 420)),
    });
  }

  function applyTextFormat(prefix: string, suffix = prefix) {
    if (!selection) return;
    if (richFormatting) {
      const command = prefix === "**" ? "bold" : prefix === "*" ? "italic" : null;
      editorRef.current?.focus();
      if (command) document.execCommand(command, false);
      else document.execCommand("formatBlock", false, "blockquote");
      syncRichValue();
      setSelection(null);
      setSelectionToolbar(null);
      setAiOpen(false);
      return;
    }
    replaceSelection(`${prefix}${selection.text}${suffix}`, false, "Mise en forme");
  }

  function replaceSelection(nextText: string, applyToFullText: boolean, label: string) {
    const textarea = textareaRef.current;
    const before = value;
    if (richFormatting) {
      if (applyToFullText) {
        onChange(nextText);
        onHistory?.({ label, before, after: nextText });
        onAiAction?.({ label, before, after: nextText, scope: "full" });
      } else {
        const selectedText = selection?.text ?? "";
        const after = selectedText && value.includes(selectedText)
          ? value.replace(selectedText, nextText)
          : nextText;
        onChange(after);
        onHistory?.({ label, before, after });
        onAiAction?.({ label, before, after, scope: "selection" });
      }
      setSelection(null);
      setSelectionToolbar(null);
      setAiOpen(false);
      setResult(null);
      return;
    }
    if (!textarea) return;
    const updatedValue = applyToFullText || !selection ? nextText : `${value.slice(0, selection.start)}${nextText}${value.slice(selection.end)}`;
    const nextCursor = applyToFullText || !selection ? nextText.length : selection.start + nextText.length;
    onChange(updatedValue);
    onHistory?.({ label, before, after: updatedValue });
    onAiAction?.({ label, before, after: updatedValue, scope: label === "Mise en forme" ? "format" : applyToFullText ? "full" : "selection" });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
    setSelection(null);
    setAiOpen(false);
    setResult(null);
  }

  async function runTransform(command: AiCommand, applyToFullText: boolean) {
    const existing = result;
    const targetText = existing?.original || (applyToFullText ? value : selection?.text ?? "");
    if (!targetText.trim()) return;
    setAiError("");

    if (command.script) {
      const text = command.script(targetText);
      if (autoApplyAiActions) {
        replaceSelection(text, applyToFullText, command.label);
        return;
      }
      setCopiedResult(false);
      setResult({ command, text, original: targetText, applyToFullText, variations: [targetText, text], index: 1 });
      return;
    }

    setLoadingCommand(command.id);
    try {
      const res = await fetch("/api/linkedin/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: targetText,
          fullText: value,
          instruction: customPrompt.trim()
            ? `${fillLinkedInEditActionPrompt(command.instruction, targetText)}\n\nPrecision utilisateur : ${customPrompt}`
            : fillLinkedInEditActionPrompt(command.instruction, targetText),
          contextLabel,
          openrouterApiKey: apiKey,
          model,
          prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || "Transformation impossible");
      if (autoApplyAiActions) {
        replaceSelection(data.text, applyToFullText, command.label);
        return;
      }
      setCopiedResult(false);
      setResult((current) => {
        if (current && current.command.id === command.id && current.original === targetText && current.applyToFullText === applyToFullText) {
          const variations = [...current.variations, data.text];
          return { ...current, text: data.text, variations, index: variations.length - 1 };
        }
        return { command, text: data.text, original: targetText, applyToFullText, variations: [targetText, data.text], index: 1 };
      });
    } catch (error) {
      console.error(error);
      setAiError(error instanceof Error ? error.message : "Transformation impossible.");
    } finally {
      setLoadingCommand(null);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8, minHeight: style?.minHeight, flex: style?.flex }}>
      {canTransformSelection && !aiOpen && !result && (
        <div style={{ position: "absolute", top: selectionToolbar?.top ?? 10, left: floatingLeft(420), right: selectionToolbar ? undefined : 10, zIndex: 8, display: "flex", alignItems: "center", gap: 2, padding: 5, borderRadius: 13, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 10px 24px rgba(18,26,46,0.12)" }}>
          {[
            { label: "Gras", icon: <Bold size={14} />, action: () => applyTextFormat("**") },
            { label: "Italique", icon: <Italic size={14} />, action: () => applyTextFormat("*") },
            { label: "Citation", icon: <Quote size={14} />, action: () => applyTextFormat("> ", "") },
          ].map((button) => (
            <button key={button.label} type="button" title={button.label} onMouseDown={(event) => event.preventDefault()} onClick={button.action} style={{ ...baseButton, width: 34, height: 32, background: "#fff", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {button.icon}
            </button>
          ))}
          <span style={{ width: 1, height: 22, background: "rgba(18,26,46,0.09)", margin: "0 4px" }} />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setAiOpen(true)} style={{ ...baseButton, minHeight: 32, padding: "0 11px", background: "#fbfbfb", color: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800 }}>
            <Sparkles size={14} style={{ color: "rgba(0,0,0,0.8)" }} />
            Editer avec IA
          </button>
          {onUseSelection ? (
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { if (!selection) return; onUseSelection(selection.text); setSelection(null); setSelectionToolbar(null); }} style={{ ...baseButton, minHeight: 32, padding: "0 11px", background: "#fbfbfb", color: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800 }}>
              Selectionner ce texte
            </button>
          ) : null}
        </div>
      )}

      {canTransformSelection && aiOpen && !result && (
        <div style={{ position: "absolute", top: selectionToolbar?.top ?? 10, left: floatingLeft(360), right: floatingRight, zIndex: 9, width: 360, maxHeight: 520, overflow: "hidden", borderRadius: 17, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 22px 46px rgba(18,26,46,0.16)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 10, borderBottom: "1px solid rgba(18,26,46,0.07)", display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} style={{ color: "rgba(18,26,46,0.38)" }} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une commande..." style={{ border: 0, outline: "none", flex: 1, fontSize: 13, fontFamily: '"Plus Jakarta Sans", sans-serif', color: "#121a2e" }} />
            <button type="button" onClick={() => setAiOpen(false)} style={{ ...baseButton, background: "transparent", color: "rgba(18,26,46,0.35)", display: "flex" }}><X size={15} /></button>
          </div>
          <div style={{ padding: 10, borderBottom: "1px solid rgba(18,26,46,0.07)" }}>
            <input value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} placeholder="Precision optionnelle..." style={{ width: "100%", boxSizing: "border-box", minHeight: 38, borderRadius: 11, border: "1px solid rgba(18,26,46,0.09)", background: "#f7f7f7", padding: "0 11px", outline: "none", fontSize: 12, fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
          </div>
          <div style={{ overflowY: "auto", padding: 8 }}>
            {categories.map((category) => (
              <div key={category} style={{ marginBottom: 10 }}>
                <p style={{ margin: "8px 10px", fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(18,26,46,0.42)" }}>{category}</p>
                {filteredCommands.filter((command) => command.category === category).map((command) => {
                  const Icon = command.icon;
                  return (
                    <button key={command.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runTransform(command, false)} disabled={loadingCommand !== null} style={{ ...baseButton, width: "100%", minHeight: 38, padding: "0 10px", background: "transparent", color: "#121a2e", display: "flex", alignItems: "center", gap: 10, textAlign: "left", fontSize: 13, fontWeight: 750 }}>
                      {loadingCommand === command.id ? <Loader2 size={15} style={{ color: command.color, animation: "spin 1s linear infinite" }} /> : <Icon size={15} style={{ color: command.color }} />}
                      <span>{command.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {aiError ? (
              <p style={{ margin: "8px 10px 6px", borderRadius: 12, background: "rgba(239,68,68,0.08)", color: "#b91c1c", padding: "9px 10px", fontSize: 12, fontWeight: 700, lineHeight: 1.45 }}>
                {aiError}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {result && (
        <div style={{ position: "absolute", top: selectionToolbar?.top ?? 10, left: floatingLeft(520), right: floatingRight, zIndex: 10, width: 520, borderRadius: 18, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 24px 54px rgba(18,26,46,0.18)", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={() => setResult(null)} style={{ ...baseButton, background: "transparent", color: "rgba(18,26,46,0.48)", display: "flex" }}><ArrowDownLeft size={16} /></button>
            {(() => {
              const Icon = result.command.icon;
              return <Icon size={18} style={{ color: result.command.color }} />;
            })()}
            <strong style={{ fontSize: 15, color: "#121a2e" }}>{result.command.label}</strong>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" onClick={() => setResult((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current)} disabled={result.index === 0} style={{ ...baseButton, width: 30, height: 30, background: "#F7F7F7", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", opacity: result.index === 0 ? 0.42 : 1 }}><ChevronLeft size={15} /></button>
              <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(18,26,46,0.48)", minWidth: 44, textAlign: "center" }}>{result.index + 1}/{result.variations.length}</span>
              <button type="button" onClick={() => setResult((current) => current ? { ...current, index: Math.min(current.variations.length - 1, current.index + 1) } : current)} disabled={result.index >= result.variations.length - 1} style={{ ...baseButton, width: 30, height: 30, background: "#F7F7F7", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", opacity: result.index >= result.variations.length - 1 ? 0.42 : 1 }}><ChevronRight size={15} /></button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ borderRadius: 14, background: "#FBFBFB", padding: 12, minHeight: 120, maxHeight: 220, overflowY: "auto" }}>
              <span style={{ display: "block", marginBottom: 7, fontSize: 11, fontWeight: 850, color: "rgba(18,26,46,0.42)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Avant</span>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "rgba(18,26,46,0.62)", whiteSpace: "pre-wrap" }}>{result.original}</div>
            </div>
            <div style={{ borderRadius: 14, background: "#fff", border: "1px solid rgba(18,26,46,0.08)", padding: 12, minHeight: 120, maxHeight: 220, overflowY: "auto" }}>
              <span style={{ display: "block", marginBottom: 7, fontSize: 11, fontWeight: 850, color: "rgba(18,26,46,0.42)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{isOriginalVariation ? "Version originale" : "Apres"}</span>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: "#121a2e", whiteSpace: "pre-wrap" }}>{currentResultText}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.45)" }}>{result.original.length} -&gt; {currentResultText.length}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => replaceSelection(currentResultText, result.applyToFullText, result.command.label)} disabled={isOriginalVariation} style={{ ...baseButton, minHeight: 38, padding: "0 15px", border: "1px solid #2f4d9d", background: "linear-gradient(146.81deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", color: "#fff", boxShadow: "inset 0px -3px 0px 0px #0e42c8, inset 0px 2px 6px 4px rgba(0,0,0,0.08), inset 0px 3px 0px 0px rgba(255,255,255,0.5), 0px 4px 12px rgba(1,71,255,0.25)", fontSize: 13, fontWeight: 850, opacity: isOriginalVariation ? 0.52 : 1 }}>Remplacer</button>
              <button type="button" onClick={() => replaceSelection(`${selection?.text ?? ""}${currentResultText}`, false, `Inserer - ${result.command.label}`)} disabled={isOriginalVariation} style={{ ...baseButton, minHeight: 38, padding: "0 15px", background: "#fff", border: "1px solid rgba(18,26,46,0.12)", color: "#121a2e", fontSize: 13, fontWeight: 800, opacity: isOriginalVariation ? 0.52 : 1 }}>Inserer</button>
              <button type="button" onClick={() => runTransform(result.command, result.applyToFullText)} style={{ ...baseButton, minHeight: 38, padding: "0 12px", background: "#fff", border: "1px solid rgba(18,26,46,0.12)", color: "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12, fontWeight: 800 }} title="Faire une nouvelle version"><RotateCcw size={15} /> Nouvelle version</button>
              <button type="button" onClick={() => { void navigator.clipboard.writeText(currentResultText); setCopiedResult(true); window.setTimeout(() => setCopiedResult(false), 1200); }} style={{ ...baseButton, width: 38, height: 38, background: copiedResult ? "rgba(22,139,100,0.1)" : "#fff", border: "1px solid rgba(18,26,46,0.12)", color: copiedResult ? "#168b64" : "#121a2e", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.18s ease, color 0.18s ease" }} title="Copier">{copiedResult ? <Check size={15} /> : <Copy size={15} />}</button>
            </div>
          </div>
        </div>
      )}

      {richFormatting ? (
        <div
          ref={editorRef}
          className="smart-selection-textarea smart-selection-rich"
          contentEditable
          suppressContentEditableWarning
          onInput={() => syncRichValue()}
          onMouseDown={() => { selectingRef.current = true; }}
          onMouseUp={refreshRichSelection}
          onKeyUp={refreshRichSelection}
          onBlur={() => setSelectionToolbar(null)}
          data-placeholder={placeholder}
          style={textareaStyle}
        />
      ) : (
        <textarea
          ref={textareaRef}
          className="smart-selection-textarea"
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onMouseDown={() => { selectingRef.current = true; }}
          onMouseUp={refreshSelection}
          onKeyUp={refreshSelection}
          onSelect={refreshSelection}
          placeholder={placeholder}
          style={textareaStyle}
        />
      )}

      {showWordCount && (
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 12, fontWeight: 650, color: "rgba(18,26,46,0.42)", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          {countWords(value)} mots
        </div>
      )}

      {showGlobalAction && hasText && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => runTransform(commands.find((command) => command.id === "corriger_fautes") ?? commands[0], true)} disabled={loadingCommand !== null} style={{ ...baseButton, minHeight: 38, padding: "0 13px", background: "#f0f4ff", border: "1px solid #c7d3ff", color: "#0147ff", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800 }}>
            {loadingCommand ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
            {globalLabel}
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .smart-selection-textarea::selection { background: rgba(1, 71, 255, 0.28); color: #0b1736; }
        .smart-selection-rich:empty::before { content: attr(data-placeholder); color: rgba(18, 26, 46, 0.32); }
        .smart-selection-rich blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid rgba(18, 26, 46, 0.16); color: rgba(18, 26, 46, 0.72); }
      `}</style>
    </div>
  );
}
