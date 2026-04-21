"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEventHandler } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";

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
}

interface SelectionState {
  start: number;
  end: number;
  text: string;
}

const toolbarButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "7px 10px",
  borderRadius: 9,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "#fff",
  color: "#121a2e",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: '"Plus Jakarta Sans", sans-serif',
};

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
}: SmartSelectionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [loadingMode, setLoadingMode] = useState<"selection" | "global" | null>(null);

  const hasText = value.trim().length > 0;
  const canTransformSelection = !!selection?.text.trim();
  const textareaStyle = useMemo<CSSProperties>(() => ({
    width: "100%",
    resize: "none",
    ...style,
  }), [style]);

  function refreshSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    if (end <= start) {
      setSelection(null);
      return;
    }

    const text = textarea.value.slice(start, end);
    if (!text.trim()) {
      setSelection(null);
      return;
    }

    setSelection({ start, end, text });
  }

  function replaceSelection(nextText: string, applyToFullText: boolean) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (applyToFullText || !selection) {
      onChange(nextText);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextText.length, nextText.length);
      });
      setSelection(null);
      return;
    }

    const updatedValue = `${value.slice(0, selection.start)}${nextText}${value.slice(selection.end)}`;
    const nextCursor = selection.start + nextText.length;
    onChange(updatedValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
    setSelection(null);
  }

  async function runTransform(instruction: string, applyToFullText: boolean) {
    const targetText = applyToFullText ? value : selection?.text ?? "";
    if (!targetText.trim()) return;

    setLoadingMode(applyToFullText ? "global" : "selection");
    try {
      const res = await fetch("/api/linkedin/transform-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: targetText,
          fullText: value,
          instruction,
          contextLabel,
          openrouterApiKey: apiKey,
          model,
          prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || "Transformation impossible");
      replaceSelection(data.text, applyToFullText);
      setCustomPrompt("");
      setShowCustomPrompt(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMode(null);
    }
  }

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
      {canTransformSelection && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 10,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.98)",
            boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
            width: 260,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(18,26,46,0.45)", fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
            Texte sélectionné
          </div>
          <div
            style={{
              maxHeight: 84,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              borderRadius: 10,
              border: "1px solid rgba(1,71,255,0.12)",
              background: "#f4f7ff",
              padding: "9px 10px",
              fontSize: 12,
              lineHeight: 1.55,
              color: "#0147ff",
              fontFamily: '"Plus Jakarta Sans", sans-serif',
            }}
          >
            {selection?.text}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button type="button" onClick={() => runTransform("Réécris ce passage de façon plus fluide et naturelle.", false)} disabled={loadingMode !== null} style={toolbarButton}>
              {loadingMode === "selection" ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
              Réécrire
            </button>
            <button type="button" onClick={() => runTransform("Raccourcis ce passage sans perdre l'idée.", false)} disabled={loadingMode !== null} style={toolbarButton}>
              <Wand2 size={13} />
              Raccourcir
            </button>
            <button type="button" onClick={() => runTransform("Développe légèrement ce passage tout en gardant le ton.", false)} disabled={loadingMode !== null} style={toolbarButton}>
              <Wand2 size={13} />
              Développer
            </button>
            <button type="button" onClick={() => setShowCustomPrompt((prev) => !prev)} disabled={loadingMode !== null} style={toolbarButton}>
              <Sparkles size={13} />
              Personnaliser
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 150, overflowY: "auto" }}>
            {[
              ["Hook", "Transforme ce passage en hook LinkedIn accrocheur."],
              ["Open loop", "Transforme ce passage en open loop qui donne envie de lire la suite."],
              ["Micro open loop", "Transforme ce passage en micro open loop court et subtil."],
              ["Pattern interrupt", "Transforme ce passage en pattern interrupt surprenant mais crédible."],
              ["Curiosity gap", "Transforme ce passage en curiosity gap sans clickbait."],
              ["Accroche contrarienne", "Transforme ce passage en accroche contrarienne forte mais défendable."],
              ["Liste rythmée", "Transforme ce passage en liste courte et rythmée."],
              ["Structure escalier", "Transforme ce passage en structure escalier avec des lignes de longueur variée."],
              ["Symbole visuel", "Ajoute quelques symboles visuels utiles sans surcharger."],
              ["Cadence courte", "Transforme ce passage avec une cadence plus courte et percutante."],
              ["Question ouverte", "Transforme ce passage en question ouverte qui invite à répondre."],
              ["Polarisation", "Transforme ce passage en prise de position polarisante mais professionnelle."],
              ["Citation mémorable", "Transforme ce passage en phrase courte, mémorable et citable."],
              ["Insight personnel", "Transforme ce passage en insight personnel crédible et spécifique."],
              ["Lead magnet", "Transforme ce passage en invitation subtile à demander une ressource."],
              ["Erreur volontaire", "Ajoute une aspérité volontaire qui peut provoquer des réactions, sans nuire à la crédibilité."],
              ["Répétition dynamique", "Ajoute une répétition dynamique pour renforcer le rythme."],
              ["Vulnérabilité", "Transforme ce passage avec plus de vulnérabilité, sans dramatiser."],
              ["Contraste émotionnel", "Ajoute un contraste émotionnel clair entre tension et résolution."],
            ].map(([label, instruction]) => (
              <button key={label} type="button" onClick={() => runTransform(instruction, false)} disabled={loadingMode !== null} style={{ ...toolbarButton, justifyContent: "flex-start", fontSize: 11 }}>
                <Wand2 size={12} />
                {label}
              </button>
            ))}
          </div>
          {showCustomPrompt && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ex: rends-le plus direct, plus premium..."
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 9,
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "#f6f6f6",
                  fontSize: 12,
                  color: "#121a2e",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              />
              <button
                type="button"
                onClick={() => runTransform(customPrompt || "Améliore ce passage.", false)}
                disabled={loadingMode !== null}
                style={{
                  ...toolbarButton,
                  background: "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                  color: "#fff",
                  border: "1px solid #2f4d9d",
                }}
              >
                {loadingMode === "selection" ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
                Appliquer
              </button>
            </div>
          )}
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="smart-selection-textarea"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onMouseUp={refreshSelection}
        onKeyUp={refreshSelection}
        onSelect={refreshSelection}
        onBlur={() => setTimeout(() => refreshSelection(), 0)}
        placeholder={placeholder}
        style={textareaStyle}
      />

      {showGlobalAction && hasText && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => runTransform(customPrompt || "Améliore l'ensemble du texte en gardant le fond.", true)}
            disabled={loadingMode !== null}
            style={{
              ...toolbarButton,
              background: "#f0f4ff",
              border: "1px solid #c7d3ff",
              color: "#0147ff",
            }}
          >
            {loadingMode === "global" ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} />}
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
