"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEventHandler } from "react";
import {
  AlignLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Bold,
  Check,
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
  onHistory?: (entry: { label: string; before: string; after: string }) => void;
}

interface SelectionState {
  start: number;
  end: number;
  text: string;
}

interface AiCommand {
  id: string;
  label: string;
  instruction: string;
  category: "Base" | "Attention technique" | "Rythme et structure" | "Engagement" | "Emotion";
  icon: typeof Sparkles;
  color: string;
  script?: (text: string) => string;
}

const AI_COMMANDS: AiCommand[] = [
  { id: "remove-emojis", label: "Retirer les emojis", instruction: "Retire tous les emojis sans changer le sens.", category: "Base", icon: X, color: "#6b7280", script: (text) => text.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/[ \t]+\n/g, "\n").trim() },
  { id: "fix-spelling", label: "Corriger les fautes d'orthographe", instruction: "Corrige uniquement les fautes d'orthographe, de grammaire et de ponctuation sans changer le style.", category: "Base", icon: Check, color: "#168b64" },
  { id: "expand", label: "Développer", instruction: "Développe ce passage tout en gardant le ton et l'idée principale.", category: "Base", icon: Expand, color: "#0147ff" },
  { id: "condense", label: "Condenser", instruction: "Raccourcis ce passage sans perdre l'idée.", category: "Base", icon: Minus, color: "#0147ff" },
  { id: "hook", label: "Transformer en hook", instruction: "Transforme ce passage en hook LinkedIn très accrocheur.", category: "Attention technique", icon: Zap, color: "#ef4444" },
  { id: "open-loop", label: "Transformer en open loop", instruction: "Transforme ce passage en open loop qui donne envie de lire la suite.", category: "Attention technique", icon: Repeat2, color: "#ef4444" },
  { id: "micro-open-loop", label: "Transformer en micro open loop", instruction: "Transforme ce passage en micro open loop court et subtil.", category: "Attention technique", icon: RotateCcw, color: "#ef4444" },
  { id: "pattern-interrupt", label: "Transformer en pattern interrupt", instruction: "Transforme ce passage en pattern interrupt surprenant mais crédible.", category: "Attention technique", icon: Target, color: "#ef4444" },
  { id: "curiosity-gap", label: "Transformer en curiosity gap", instruction: "Transforme ce passage en curiosity gap sans clickbait.", category: "Attention technique", icon: Sparkles, color: "#ef4444" },
  { id: "contrarian", label: "Transformer en accroche contrarienne", instruction: "Transforme ce passage en accroche contrarienne forte mais défendable.", category: "Attention technique", icon: Zap, color: "#ef4444" },
  { id: "rhythmic-list", label: "Transformer en liste rythmée", instruction: "Transforme ce passage en liste courte et rythmée.", category: "Rythme et structure", icon: AlignLeft, color: "#6236AA" },
  { id: "staircase", label: "Transformer en structure escalier", instruction: "Transforme ce passage en structure escalier avec des lignes de longueur variée.", category: "Rythme et structure", icon: ArrowDownLeft, color: "#6236AA" },
  { id: "visual-symbol", label: "Transformer en symbole visuel", instruction: "Ajoute quelques symboles visuels utiles sans surcharger.", category: "Rythme et structure", icon: Sparkles, color: "#6236AA" },
  { id: "short-cadence", label: "Transformer en cadence courte", instruction: "Transforme ce passage avec une cadence courte, nette et percutante.", category: "Rythme et structure", icon: ArrowUpRight, color: "#6236AA" },
  { id: "open-question", label: "Transformer en question ouverte", instruction: "Transforme ce passage en question ouverte qui invite à répondre.", category: "Engagement", icon: MessageCircle, color: "#0f766e" },
  { id: "polarization", label: "Transformer en polarisation", instruction: "Transforme ce passage en prise de position polarisante mais professionnelle.", category: "Engagement", icon: Target, color: "#0f766e" },
  { id: "memorable-quote", label: "Transformer en citation mémorable", instruction: "Transforme ce passage en phrase courte, mémorable et citable.", category: "Engagement", icon: Quote, color: "#0f766e" },
  { id: "personal-insight", label: "Transformer en insight personnel", instruction: "Transforme ce passage en insight personnel crédible et spécifique.", category: "Engagement", icon: Sparkles, color: "#0f766e" },
  { id: "lead-magnet", label: "Transformer en lead magnet", instruction: "Transforme ce passage en invitation subtile à demander une ressource.", category: "Engagement", icon: Clipboard, color: "#0f766e" },
  { id: "voluntary-error", label: "Transformer en erreur volontaire", instruction: "Ajoute une aspérité volontaire qui peut provoquer des réactions, sans nuire à la crédibilité.", category: "Engagement", icon: Zap, color: "#0f766e" },
  { id: "dynamic-repeat", label: "Transformer en répétition dynamique", instruction: "Ajoute une répétition dynamique pour renforcer le rythme.", category: "Emotion", icon: Repeat2, color: "#f97316" },
  { id: "vulnerability", label: "Transformer en vulnérabilité", instruction: "Transforme ce passage avec plus de vulnérabilité, sans dramatiser.", category: "Emotion", icon: Heart, color: "#f97316" },
  { id: "emotional-contrast", label: "Transformer en contraste émotionnel", instruction: "Ajoute un contraste émotionnel clair entre tension et résolution.", category: "Emotion", icon: Heart, color: "#f97316" },
];

const baseButton: CSSProperties = {
  border: 0,
  borderRadius: 10,
  cursor: "pointer",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
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
  onHistory,
}: SmartSelectionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [loadingCommand, setLoadingCommand] = useState<string | null>(null);
  const [result, setResult] = useState<{ command: AiCommand; text: string; original: string; applyToFullText: boolean } | null>(null);

  const hasText = value.trim().length > 0;
  const canTransformSelection = !!selection?.text.trim();
  const textareaStyle = useMemo<CSSProperties>(() => ({
    width: "100%",
    resize: autoFit ? "none" : "vertical",
    overflow: autoFit ? "hidden" : undefined,
    ...style,
  }), [autoFit, style]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !autoFit) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(42, textarea.scrollHeight)}px`;
  }, [autoFit, value]);

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
  }

  function applyTextFormat(prefix: string, suffix = prefix) {
    if (!selection) return;
    const nextText = `${prefix}${selection.text}${suffix}`;
    replaceSelection(nextText, false, "Mise en forme");
  }

  function replaceSelection(nextText: string, applyToFullText: boolean, label: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const before = value;
    const updatedValue = applyToFullText || !selection
      ? nextText
      : `${value.slice(0, selection.start)}${nextText}${value.slice(selection.end)}`;
    const nextCursor = applyToFullText || !selection ? nextText.length : selection.start + nextText.length;
    onChange(updatedValue);
    onHistory?.({ label, before, after: updatedValue });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
    setSelection(null);
    setAiOpen(false);
    setResult(null);
  }

  async function runTransform(command: AiCommand, applyToFullText: boolean) {
    const targetText = applyToFullText ? value : selection?.text ?? "";
    if (!targetText.trim()) return;

    if (command.script) {
      const text = command.script(targetText);
      setResult({ command, text, original: targetText, applyToFullText });
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
          instruction: customPrompt.trim() ? `${command.instruction}\n\nPrécision utilisateur : ${customPrompt}` : command.instruction,
          contextLabel,
          openrouterApiKey: apiKey,
          model,
          prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || "Transformation impossible");
      setResult({ command, text: data.text, original: targetText, applyToFullText });
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingCommand(null);
    }
  }

  const filteredCommands = AI_COMMANDS.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()));
  const categories = Array.from(new Set(filteredCommands.map((command) => command.category)));

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
      {canTransformSelection && !aiOpen && !result && (
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 8, display: "flex", alignItems: "center", gap: 2, padding: 5, borderRadius: 13, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 10px 24px rgba(18,26,46,0.12)" }}>
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
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setAiOpen(true)} style={{ ...baseButton, minHeight: 32, padding: "0 11px", background: "#f4f7ff", color: "#0147ff", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800 }}>
            <Sparkles size={14} />
            Éditer avec IA
          </button>
        </div>
      )}

      {canTransformSelection && aiOpen && !result && (
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 9, width: 360, maxHeight: 520, overflow: "hidden", borderRadius: 17, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 22px 46px rgba(18,26,46,0.16)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 10, borderBottom: "1px solid rgba(18,26,46,0.07)", display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={15} style={{ color: "rgba(18,26,46,0.38)" }} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une commande..." style={{ border: 0, outline: "none", flex: 1, fontSize: 13, fontFamily: '"Plus Jakarta Sans", sans-serif', color: "#121a2e" }} />
            <button type="button" onClick={() => setAiOpen(false)} style={{ ...baseButton, background: "transparent", color: "rgba(18,26,46,0.35)", display: "flex" }}><X size={15} /></button>
          </div>
          <div style={{ padding: 10, borderBottom: "1px solid rgba(18,26,46,0.07)" }}>
            <input value={customPrompt} onChange={(event) => setCustomPrompt(event.target.value)} placeholder="Précision optionnelle..." style={{ width: "100%", boxSizing: "border-box", minHeight: 38, borderRadius: 11, border: "1px solid rgba(18,26,46,0.09)", background: "#f7f7f7", padding: "0 11px", outline: "none", fontSize: 12, fontFamily: '"Plus Jakarta Sans", sans-serif' }} />
          </div>
          <div style={{ overflowY: "auto", padding: 8 }}>
            {categories.map((category) => (
              <div key={category} style={{ marginBottom: 10 }}>
                <p style={{ margin: "8px 10px", fontSize: 11, fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(18,26,46,0.42)" }}>{category}</p>
                {filteredCommands.filter((command) => command.category === category).map((command) => {
                  const Icon = command.icon;
                  return (
                    <button key={command.id} type="button" onClick={() => runTransform(command, false)} disabled={loadingCommand !== null} style={{ ...baseButton, width: "100%", minHeight: 38, padding: "0 10px", background: "transparent", color: "#121a2e", display: "flex", alignItems: "center", gap: 10, textAlign: "left", fontSize: 13, fontWeight: 750 }}>
                      {loadingCommand === command.id ? <Loader2 size={15} style={{ color: command.color, animation: "spin 1s linear infinite" }} /> : <Icon size={15} style={{ color: command.color }} />}
                      <span>{command.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10, width: 520, borderRadius: 18, border: "1px solid rgba(18,26,46,0.1)", background: "#fff", boxShadow: "0 24px 54px rgba(18,26,46,0.18)", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={() => setResult(null)} style={{ ...baseButton, background: "transparent", color: "rgba(18,26,46,0.48)", display: "flex" }}><ArrowDownLeft size={16} /></button>
            {(() => {
              const Icon = result.command.icon;
              return <Icon size={18} style={{ color: result.command.color }} />;
            })()}
            <strong style={{ fontSize: 15, color: "#121a2e" }}>{result.command.label}</strong>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: "#121a2e", whiteSpace: "pre-wrap" }}>{result.text}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(18,26,46,0.45)" }}>{result.original.length} → {result.text.length}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => replaceSelection(result.text, result.applyToFullText, result.command.label)} style={{ ...baseButton, minHeight: 38, padding: "0 15px", background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)", color: "#fff", fontSize: 13, fontWeight: 850 }}>Remplacer</button>
              <button type="button" onClick={() => replaceSelection(`${selection?.text ?? ""}${result.text}`, false, `Insérer - ${result.command.label}`)} style={{ ...baseButton, minHeight: 38, padding: "0 15px", background: "#fff", border: "1px solid rgba(18,26,46,0.12)", color: "#121a2e", fontSize: 13, fontWeight: 800 }}>Insérer</button>
              <button type="button" onClick={() => runTransform(result.command, result.applyToFullText)} style={{ ...baseButton, width: 38, height: 38, background: "#fff", border: "1px solid rgba(18,26,46,0.12)", color: "#121a2e" }} title="Réessayer"><RotateCcw size={15} /></button>
              <button type="button" onClick={() => navigator.clipboard.writeText(result.text)} style={{ ...baseButton, width: 38, height: 38, background: "#fff", border: "1px solid rgba(18,26,46,0.12)", color: "#121a2e" }} title="Copier"><Copy size={15} /></button>
            </div>
          </div>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="smart-selection-textarea"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onMouseUp={refreshSelection}
        onKeyUp={refreshSelection}
        onSelect={refreshSelection}
        placeholder={placeholder}
        style={textareaStyle}
      />

      {showWordCount && (
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 12, fontWeight: 650, color: "rgba(18,26,46,0.42)", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          {countWords(value)} mots
        </div>
      )}

      {showGlobalAction && hasText && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => runTransform(AI_COMMANDS.find((command) => command.id === "fix-spelling") ?? AI_COMMANDS[1], true)} disabled={loadingCommand !== null} style={{ ...baseButton, minHeight: 38, padding: "0 13px", background: "#f0f4ff", border: "1px solid #c7d3ff", color: "#0147ff", display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800 }}>
            {loadingCommand ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
            {globalLabel}
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .smart-selection-textarea::selection {
          background: rgba(1, 71, 255, 0.28);
          color: #0b1736;
        }
      `}</style>
    </div>
  );
}
