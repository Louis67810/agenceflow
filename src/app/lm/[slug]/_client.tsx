"use client";

import { useState, useEffect, useRef } from "react";
import { Lock } from "lucide-react";

interface Field {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  key: string;
}

interface Step {
  id: string;
  fields: Field[];
}

export interface LeadMagnetData {
  id: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  resource_url: string;
  timer_minutes: number | null;
  steps: Step[];
  cta_text: string;
  email_subject: string;
  email_body: string;
  from_name: string;
}

export default function LeadMagnetClient({ magnet }: { magnet: LeadMagnetData }) {
  // Flatten all fields into a single ordered array
  const flatFields: Field[] = magnet.steps.flatMap((s) => s.fields);

  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resourceUrl, setResourceUrl] = useState(magnet.resource_url);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentField = flatFields[stepIndex] ?? null;
  const remaining = flatFields.length - stepIndex - 1;
  const progress = flatFields.length > 0 ? stepIndex / flatFields.length : 0;
  // Blur reduces as user fills steps, but always stays slightly blurred until done
  const blurPx = submitted ? 0 : Math.max(8, 22 - progress * 14);

  // ─── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!magnet.timer_minutes) return;
    const key = `lm_timer_${magnet.id}`;
    let endTime: number;
    const stored = sessionStorage.getItem(key);
    if (stored) {
      endTime = parseInt(stored);
    } else {
      endTime = Date.now() + magnet.timer_minutes * 60 * 1000;
      sessionStorage.setItem(key, String(endTime));
    }
    const tick = () => {
      const left = Math.max(0, endTime - Date.now());
      setTimeLeft(left);
      if (left === 0) clearInterval(iv);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [magnet.id, magnet.timer_minutes]);

  // ─── Auto-focus input ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!submitted) setTimeout(() => inputRef.current?.focus(), 350);
  }, [stepIndex, submitted]);

  function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")} : ${String(sec).padStart(2, "0")}`;
  }

  function validate(): boolean {
    if (!currentField) return true;
    if (currentField.required && !value.trim()) {
      setError("Ce champ est requis");
      return false;
    }
    if (
      currentField.type === "email" &&
      value.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      setError("Adresse email invalide");
      return false;
    }
    if (
      currentField.type === "phone" &&
      value.trim() &&
      !/^[\d\s\+\-\(\)]{6,}$/.test(value)
    ) {
      setError("Numéro invalide");
      return false;
    }
    return true;
  }

  async function goNext() {
    if (!validate()) return;
    setError("");

    const newData = {
      ...formData,
      ...(currentField ? { [currentField.key]: value } : {}),
    };
    setFormData(newData);

    if (stepIndex < flatFields.length - 1) {
      setExiting(true);
      setTimeout(() => {
        setStepIndex((i) => i + 1);
        setValue("");
        setExiting(false);
        setEntering(true);
        setTimeout(() => setEntering(false), 300);
      }, 220);
    } else {
      // Last field — submit
      setSubmitting(true);
      try {
        const res = await fetch("/api/lead-magnet/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadMagnetId: magnet.id, data: newData }),
        });
        const result = await res.json();
        setResourceUrl(result.resourceUrl || magnet.resource_url);
        setEmailSent(!!result.emailSent);
      } catch {
        // Still show success
        setResourceUrl(magnet.resource_url);
      } finally {
        setSubmitting(false);
        setSubmitted(true);
      }
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      goNext();
    }
  }

  const email = formData.email || formData.mail || "";
  const firstname = formData.firstname || formData.prenom || "";

  // ─── SUCCESS SCREEN ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f5f7",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {magnet.timer_minutes && timeLeft !== null && (
          <TimerBadge timeLeft={timeLeft} formatTime={formatTime} />
        )}

        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 900,
              color: "#0f172a",
              lineHeight: 1.1,
              margin: "0 0 12px",
            }}
          >
            C'est tout bon{firstname ? `, ${firstname}` : ""} !
          </h1>
          <p style={{ color: "#6b7280", fontSize: 16, lineHeight: 1.6, maxWidth: 380, margin: "0 auto" }}>
            {emailSent && email
              ? `Votre ressource a été envoyée à ${email}`
              : "Voici votre ressource :"}
          </p>
        </div>

        <CTAButton href={resourceUrl} text={magnet.cta_text || "Accéder à la ressource"} />
      </div>
    );
  }

  // ─── FORM SCREEN ──────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f7",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 48,
        paddingBottom: 0,
        paddingLeft: 24,
        paddingRight: 24,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflowX: "hidden",
      }}
    >
      {/* Timer */}
      {magnet.timer_minutes && timeLeft !== null && (
        <div style={{ marginBottom: 28 }}>
          <TimerBadge timeLeft={timeLeft} formatTime={formatTime} />
        </div>
      )}

      {/* Title */}
      <h1
        style={{
          fontSize: "clamp(28px, 5vw, 56px)",
          fontWeight: 900,
          color: "#0f172a",
          textAlign: "center",
          lineHeight: 1.1,
          maxWidth: 720,
          margin: "0 0 16px",
          letterSpacing: "-0.02em",
        }}
      >
        {magnet.title}
      </h1>

      {/* Subtitle */}
      <p
        style={{
          color: "#9ca3af",
          textAlign: "center",
          maxWidth: 380,
          marginBottom: 32,
          fontSize: 15,
          lineHeight: 1.6,
        }}
      >
        {magnet.subtitle}
      </p>

      {/* Input + progress */}
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          transition: "opacity 0.22s ease, transform 0.22s ease",
          opacity: exiting ? 0 : 1,
          transform: exiting
            ? "translateY(-10px)"
            : entering
            ? "translateY(6px)"
            : "translateY(0)",
        }}
      >
        <div style={{ width: "100%", position: "relative" }}>
          <input
            ref={inputRef}
            key={stepIndex}
            type={
              currentField?.type === "email"
                ? "email"
                : currentField?.type === "phone"
                ? "tel"
                : "text"
            }
            placeholder={currentField?.placeholder || ""}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            onKeyDown={onKey}
            style={{
              width: "100%",
              padding: "15px 28px",
              borderRadius: 999,
              border: error ? "1.5px solid #ef4444" : "1.5px solid #e5e7eb",
              background: "white",
              fontSize: 15,
              textAlign: "center",
              outline: "none",
              boxSizing: "border-box",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              transition: "border-color 0.15s",
              color: "#0f172a",
            }}
          />
        </div>

        {error && (
          <p style={{ color: "#ef4444", fontSize: 12, marginTop: 6, textAlign: "center" }}>
            {error}
          </p>
        )}

        <button
          onClick={goNext}
          disabled={submitting}
          style={{
            marginTop: 14,
            padding: "11px 32px",
            borderRadius: 999,
            background: "#1f2937",
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
            letterSpacing: "0.01em",
            transition: "opacity 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!submitting) (e.currentTarget.style.background = "#111827");
          }}
          onMouseLeave={(e) => {
            (e.currentTarget.style.background = "#1f2937");
          }}
        >
          {submitting
            ? "Envoi en cours..."
            : stepIndex === flatFields.length - 1
            ? "Obtenir ma ressource →"
            : "Continuer →"}
        </button>

        {remaining > 0 && (
          <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 12, textAlign: "center" }}>
            Plus que{" "}
            <strong style={{ color: "#6b7280" }}>
              {remaining} étape{remaining > 1 ? "s" : ""}
            </strong>{" "}
            restante{remaining > 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Blurred image stack */}
      <div
        style={{
          marginTop: 40,
          position: "relative",
          width: 540,
          maxWidth: "100%",
          height: 360,
          flexShrink: 0,
        }}
      >
        {magnet.image_url ? (
          <>
            {/* Card back-left */}
            <ImageCard
              src={magnet.image_url}
              blur={blurPx}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%) rotate(-10deg) translate(-90px, 24px)",
                width: 340,
                height: 248,
                zIndex: 1,
                opacity: 0.85,
              }}
            />
            {/* Card back-right */}
            <ImageCard
              src={magnet.image_url}
              blur={blurPx}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%) rotate(7deg) translate(78px, 14px)",
                width: 340,
                height: 248,
                zIndex: 2,
                opacity: 0.9,
              }}
            />
            {/* Card front */}
            <ImageCard
              src={magnet.image_url}
              blur={blurPx}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%) rotate(-2deg)",
                width: 370,
                height: 266,
                zIndex: 3,
              }}
            />
            {/* Lock overlay */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "13px 22px",
                  borderRadius: 999,
                  background: "#1f2937",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                  letterSpacing: "0.01em",
                  whiteSpace: "nowrap",
                }}
              >
                <Lock size={15} />
                Remplissez les champs
              </div>
            </div>
          </>
        ) : (
          // Placeholder when no image
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 370,
              height: 260,
              borderRadius: 16,
              background: "#e5e7eb",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "#9ca3af",
            }}
          >
            <Lock size={24} />
            <span style={{ fontSize: 13, fontWeight: 500 }}>Aperçu de la ressource</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ImageCard({
  src,
  blur,
  style,
}: {
  src: string;
  blur: number;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        background: "white",
        boxShadow: "0 6px 28px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
        ...style,
      }}
    >
      <img
        src={src}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: `blur(${blur}px)`,
          transform: "scale(1.08)",
          display: "block",
          transition: "filter 0.6s ease",
        }}
      />
    </div>
  );
}

function TimerBadge({
  timeLeft,
  formatTime,
}: {
  timeLeft: number;
  formatTime: (ms: number) => string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#2563eb",
          boxShadow: "0 0 0 0 rgba(37, 99, 235, 0.4)",
          animation: "pulse-blue 2s infinite",
        }}
      />
      <span
        style={{
          fontSize: 14,
          color: "#374151",
          fontWeight: 500,
          letterSpacing: "0.01em",
        }}
      >
        Temps restant : {formatTime(timeLeft)}m
      </span>
      <style>{`
        @keyframes pulse-blue {
          0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.5); }
          70% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
      `}</style>
    </div>
  );
}

function CTAButton({ href, text }: { href: string; text: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        backgroundColor: "rgb(225, 228, 237)",
        borderRadius: 15,
        boxShadow: "rgba(0, 0, 0, 0.1) 0px 0px 2px 0px inset",
        display: "inline-block",
        padding: 4,
        textDecoration: "none",
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(161deg, rgb(78, 125, 250) 0%, rgb(1, 71, 255) 100%)",
          borderRadius: 10,
          border: "1px solid rgb(46, 77, 156)",
          boxShadow: [
            "rgba(255, 255, 255, 0.5) 0px 3px 0px 0px inset",
            "rgba(0, 0, 0, 0.08) 0px 2px 6px 4px inset",
            "rgb(14, 65, 199) 0px -3px 0px 0px inset",
            "rgba(0, 18, 54, 0.07) 0px 2.44555px 3.21545px 0px",
            "rgba(0, 18, 54, 0.1) 0px 6.76164px 8.8903px 0px",
            "rgba(0, 18, 54, 0.13) 0px 16.2794px 21.4044px 0px",
            "rgba(0, 40, 54, 0.16) 0px 54px 71px 0px",
          ].join(", "),
          padding: "15px 40px",
          willChange: "auto",
        }}
      >
        <p
          style={{
            color: "white",
            fontWeight: 500,
            fontSize: 16,
            margin: 0,
            lineHeight: 1.03,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
          }}
        >
          {text}
        </p>
      </div>
    </a>
  );
}
