"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  AtSign,
  Building2,
  ChevronRight,
  ChevronsUpDown,
  Hash,
  LockKeyhole,
  Link2,
  Phone,
  Type,
  User,
} from "lucide-react";

interface FieldOption {
  id: string;
  label: string;
  value: string;
  hiddenStepIds?: string[];
}

interface Field {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  key: string;
  showLabel?: boolean;
  options?: FieldOption[];
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

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#fbfbfb",
  fontFamily: '"Inter", sans-serif',
  overflowX: "hidden",
  position: "relative",
};

const centerWrapStyle: CSSProperties = {
  maxWidth: 1220,
  margin: "0 auto",
  padding: "72px 24px 32px",
  position: "relative",
  zIndex: 2,
};

const titleStyle: CSSProperties = {
  fontFamily: '"Plus Jakarta Sans", sans-serif',
  fontWeight: 700,
  fontSize: "clamp(42px, 6vw, 64px)",
  lineHeight: 0.99,
  letterSpacing: "-0.04em",
  color: "#000",
  textAlign: "center",
  margin: "0 auto 18px",
  maxWidth: 940,
};

const subtitleStyle: CSSProperties = {
  color: "rgba(0,0,0,0.7)",
  fontSize: 18,
  lineHeight: 1.46,
  letterSpacing: "-0.03em",
  textAlign: "center",
  maxWidth: 420,
  margin: "0 auto",
  fontWeight: 500,
};

const pillInputStyle: CSSProperties = {
  width: "100%",
  height: 56,
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.16)",
  background: "#fff",
  color: "rgba(0,0,0,0.8)",
  fontSize: 16,
  lineHeight: 1.15,
  letterSpacing: "-0.03em",
  outline: "none",
  boxSizing: "border-box",
  padding: "0 24px 0 52px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const mutedTextStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.46,
  letterSpacing: "-0.03em",
  color: "rgba(0,0,0,0.82)",
  textAlign: "center",
  fontWeight: 500,
};

function formatTimer(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")} : ${String(seconds).padStart(2, "0")}m`;
}

function getFieldIcon(field?: Field | null) {
  if (!field) return Type;

  const haystack = `${field.type} ${field.key} ${field.label} ${field.placeholder}`.toLowerCase();

  if (field.type === "number") return Hash;
  if (field.type === "url") return Link2;
  if (field.type === "select") return ChevronsUpDown;
  if (haystack.includes("email") || haystack.includes("mail")) return AtSign;
  if (haystack.includes("phone") || haystack.includes("tel")) return Phone;
  if (haystack.includes("company") || haystack.includes("entreprise") || haystack.includes("societe")) return Building2;
  if (haystack.includes("name") || haystack.includes("prenom") || haystack.includes("nom")) return User;

  return Type;
}

function getHiddenStepIds(steps: Step[], values: Record<string, string>) {
  const hidden = new Set<string>();

  for (const step of steps) {
    for (const field of step.fields) {
      if (field.type !== "select") continue;
      const selectedValue = values[field.key];
      const matchedOption = (field.options ?? []).find((option) => option.value === selectedValue);
      for (const hiddenStepId of matchedOption?.hiddenStepIds ?? []) {
        hidden.add(hiddenStepId);
      }
    }
  }

  return hidden;
}

export default function LeadMagnetClient({ magnet }: { magnet: LeadMagnetData }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submittedData, setSubmittedData] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resourceUrl, setResourceUrl] = useState(magnet.resource_url);
  const [senderEmail, setSenderEmail] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [focusedFieldKey, setFocusedFieldKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const visibleSteps = useMemo(() => {
    const hiddenStepIds = getHiddenStepIds(magnet.steps, formData);
    return magnet.steps.filter((step) => !hiddenStepIds.has(step.id));
  }, [formData, magnet.steps]);
  const currentStep = visibleSteps[stepIndex] ?? null;
  const currentFields = currentStep?.fields ?? [];
  const remaining = Math.max(0, visibleSteps.length - stepIndex - 1);
  const completion = visibleSteps.length > 0 ? stepIndex / visibleSteps.length : 0;
  const blurPx = submitted ? 0 : Math.max(12, 28 - completion * 14);

  useEffect(() => {
    if (!magnet.timer_minutes) return;

    const storageKey = `lm_timer_${magnet.id}`;
    const stored = sessionStorage.getItem(storageKey);
    const endTime = stored
      ? Number.parseInt(stored, 10)
      : Date.now() + magnet.timer_minutes * 60 * 1000;

    if (!stored) {
      sessionStorage.setItem(storageKey, String(endTime));
    }

    const tick = () => {
      const left = Math.max(0, endTime - Date.now());
      setTimeLeft(left);
      if (left === 0) window.clearInterval(interval);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [magnet.id, magnet.timer_minutes]);

  useEffect(() => {
    if (!submitted) {
      const timeout = window.setTimeout(() => inputRef.current?.focus(), 220);
      return () => window.clearTimeout(timeout);
    }
  }, [stepIndex, submitted]);

  useEffect(() => {
    if (!currentStep && visibleSteps.length > 0) {
      setStepIndex(0);
      return;
    }

    if (stepIndex > visibleSteps.length - 1) {
      setStepIndex(Math.max(0, visibleSteps.length - 1));
    }
  }, [currentStep, stepIndex, visibleSteps.length]);

  function getFieldValue(field: Field) {
    return formData[field.key] ?? "";
  }

  function updateFieldValue(field: Field, nextValue: string) {
    setFormData((current) => ({ ...current, [field.key]: nextValue }));
    setError("");
  }

  function validateCurrentStep() {
    for (const field of currentFields) {
      const trimmed = getFieldValue(field).trim();
      const fieldName = field.label || field.placeholder || field.key || "ce champ";

      if (field.required && !trimmed) {
        setError(`Le champ "${fieldName}" est requis.`);
        return false;
      }

      if (field.type === "email" && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setError(`Adresse email invalide pour "${fieldName}".`);
        return false;
      }

      if (field.type === "phone" && trimmed && !/^[\d\s()+-]{6,}$/.test(trimmed)) {
        setError(`Numero invalide pour "${fieldName}".`);
        return false;
      }

      if (field.type === "number" && trimmed && Number.isNaN(Number(trimmed))) {
        setError(`Nombre invalide pour "${fieldName}".`);
        return false;
      }

      if (field.type === "url" && trimmed) {
        try {
          const parsed = new URL(trimmed);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error("invalid");
          }
        } catch {
          setError(`URL invalide pour "${fieldName}".`);
          return false;
        }
      }
    }

    return true;
  }

  async function submitLead(nextData: Record<string, string>) {
    setSubmitting(true);

    try {
      const res = await fetch("/api/lead-magnet/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadMagnetId: magnet.id, data: nextData }),
      });

      const result = await res.json();
      setResourceUrl(result.resourceUrl || magnet.resource_url);
      setEmailSent(Boolean(result.emailSent));
      setSenderEmail(typeof result.senderEmail === "string" ? result.senderEmail : null);
    } catch {
      setResourceUrl(magnet.resource_url);
    } finally {
      setSubmitting(false);
      setSubmittedData(nextData);
      setSubmitted(true);
    }
  }

  async function goNext() {
    if (!validateCurrentStep()) return;
    setError("");

    const nextData = { ...formData };
    const nextVisibleSteps = magnet.steps.filter((step) => !getHiddenStepIds(magnet.steps, nextData).has(step.id));

    if (stepIndex < nextVisibleSteps.length - 1) {
      setStepIndex((index) => index + 1);
      setFocusedFieldKey(null);
      return;
    }

    await submitLead(nextData);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void goNext();
    }
  }

  const currentData = submitted ? submittedData : formData;
  const email = currentData.email || currentData.mail || "";
  const firstName = currentData.firstname || currentData.prenom || "";
  const isGmailAddress = /@gmail\.com$/i.test(email.trim());
  const successHref =
    isGmailAddress && senderEmail
      ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`in:anywhere from:${senderEmail}`)}`
      : null;

  if (submitted) {
    return (
      <div style={pageStyle}>
        <BackgroundOrnaments />
        <div style={{ ...centerWrapStyle, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 32 }}>
          <div style={{ width: "100%", maxWidth: 760, textAlign: "center" }}>
            {magnet.timer_minutes && timeLeft !== null && (
              <div style={{ marginBottom: 28 }}>
                <TimerBadge label={`Temps restant : ${formatTimer(timeLeft)}`} />
              </div>
            )}

            <h1 style={{ ...titleStyle, fontSize: "clamp(36px, 5vw, 56px)", maxWidth: 760 }}>
              {firstName ? `C'est bon, ${firstName}.` : "C'est bon."}
            </h1>
            <p style={{ ...subtitleStyle, maxWidth: 500, marginBottom: 36 }}>
              {isGmailAddress
                ? "Votre ressource vient d'etre envoyee. Ouvrez directement Gmail pour la recuperer."
                : emailSent && email
                ? `Votre ressource a ete envoyee a ${email}.`
                : "Votre ressource est prete, vous pouvez y acceder maintenant."}
            </p>

            {successHref ? <PrimaryButtonLink href={successHref} label="Ouvrir Gmail" /> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <BackgroundOrnaments />
      <style>{`
        .lm-input::placeholder {
          color: rgba(0, 0, 0, 0.38);
        }
      `}</style>

      <div style={centerWrapStyle}>
        <div style={{ textAlign: "center" }}>
          {magnet.timer_minutes && timeLeft !== null && (
            <div style={{ marginBottom: 22 }}>
              <TimerBadge label={`Temps restant : ${formatTimer(timeLeft)}`} />
            </div>
          )}

          <h1 style={titleStyle}>{magnet.title}</h1>
          <p style={{ ...subtitleStyle, marginBottom: 18 }}>
            {magnet.subtitle || "Veuillez remplir les champs ci-dessous avant de recevoir votre ressource"}
          </p>

          <div style={{ width: "100%", maxWidth: 340, margin: "0 auto" }}>
            <div style={{ display: "grid", gap: 14 }}>
              {currentFields.map((field, fieldIndex) => {
                const FieldIcon = getFieldIcon(field);
                const isFocused = focusedFieldKey === field.key;
                const fieldValue = getFieldValue(field);

                return (
                  <div key={field.id}>
                    {field.showLabel !== false ? (
                      <label
                        style={{
                          display: "block",
                          marginBottom: 8,
                          fontSize: 14,
                          lineHeight: 1.3,
                          fontWeight: 600,
                          color: "rgba(0,0,0,0.82)",
                          textAlign: "left",
                        }}
                      >
                        {field.label}
                        {field.required ? " *" : ""}
                      </label>
                    ) : null}

                    {field.type === "select" ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        {(field.options ?? []).map((option) => {
                          const selected = fieldValue === option.value;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => updateFieldValue(field, option.value)}
                              style={{
                                width: "100%",
                                borderRadius: 18,
                                border: selected ? "1px solid #0147ff" : "1px solid rgba(0,0,0,0.14)",
                                background: selected ? "rgba(1,71,255,0.08)" : "#fff",
                                color: "rgba(0,0,0,0.82)",
                                padding: "14px 16px",
                                textAlign: "left",
                                fontSize: 15,
                                fontWeight: 500,
                                cursor: "pointer",
                                boxShadow: selected ? "0 0 0 1px rgba(1,71,255,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
                                transition: "all 0.18s ease",
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ position: "relative" }}>
                        <FieldIcon
                          size={16}
                          style={{
                            position: "absolute",
                            left: 20,
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "rgba(0,0,0,0.38)",
                            pointerEvents: "none",
                          }}
                        />
                        <input
                          ref={fieldIndex === 0 ? inputRef : undefined}
                          className="lm-input"
                          type={
                            field.type === "email"
                              ? "email"
                              : field.type === "phone"
                              ? "tel"
                              : field.type === "number"
                              ? "number"
                              : field.type === "url"
                              ? "url"
                              : "text"
                          }
                          value={fieldValue}
                          onChange={(event) => updateFieldValue(field, event.target.value)}
                          onFocus={() => setFocusedFieldKey(field.key)}
                          onBlur={() => setFocusedFieldKey((current) => (current === field.key ? null : current))}
                          onKeyDown={handleKeyDown}
                          placeholder={field.placeholder || field.label || "Entrez votre reponse"}
                          style={{
                            ...pillInputStyle,
                            borderColor: error
                              ? "rgba(220,38,38,0.5)"
                              : isFocused
                              ? "#0147ff"
                              : "rgba(0,0,0,0.16)",
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12 }}>
              <PrimaryButton
                disabled={submitting}
                onClick={() => void goNext()}
                label={
                  submitting
                    ? "Envoi en cours..."
                    : stepIndex === visibleSteps.length - 1
                    ? "Acceder a la ressource"
                    : "Continuer"
                }
              />
            </div>

            {error ? (
              <p style={{ color: "#dc2626", fontSize: 13, margin: "10px 0 0", textAlign: "center" }}>
                {error}
              </p>
            ) : null}

            <p style={{ ...mutedTextStyle, margin: "14px 0 0" }}>
              {remaining === 0
                ? "C'est tout, accedez a la ressource tout de suite"
                : remaining === 1
                ? "Plus qu'une etape restante"
                : `Plus que ${remaining} etapes restantes`}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <PreviewStack imageUrl={magnet.image_url} blurPx={blurPx} />
        </div>
      </div>
    </div>
  );
}

function BackgroundOrnaments() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: -80,
          left: -80,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <svg width="536" height="381" viewBox="0 0 536 381" fill="none">
          <path d="M-105.779 298.796L-16.318 200.598C19.5701 161.204 67.5899 134.929 120.117 125.944L165.562 118.171C239.925 105.451 307.961 162.424 308.498 237.865L308.59 250.76C308.852 287.596 288.962 321.63 256.739 339.481C164.916 390.35 66.3265 284.243 123.794 196.399L226.048 40.0931C231.006 32.5132 236.656 25.4082 242.923 18.869L515.967 -266" stroke="black" strokeOpacity="0.04" strokeWidth="54.8704"/>
        </svg>
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          bottom: -56,
          right: -68,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.96,
        }}
      >
        <svg width="639" height="523" viewBox="0 0 639 523" fill="none">
          <path d="M886.172 190.892L755.943 274.388C703.7 307.884 641.765 322.966 579.971 317.241L526.508 312.287C439.026 304.182 379.667 219.588 401.801 134.566L405.584 120.033C416.392 78.5181 449.024 46.2292 490.651 35.8613C609.272 6.31655 688.19 155.388 597.071 236.881L434.937 381.884C427.074 388.915 418.578 395.205 409.557 400.671L16.5576 638.814" stroke="black" strokeOpacity="0.04" strokeWidth="63.8992"/>
        </svg>
      </div>
    </>
  );
}

function TimerBadge({ label }: { label: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#2563eb",
          boxShadow: "0 0 0 0 rgba(37,99,235,0.35)",
          animation: "lm-pulse 1.9s infinite",
          display: "inline-block",
        }}
      />
      <span
        style={{
          color: "rgba(0,0,0,0.9)",
          fontFamily: '"Inter", sans-serif',
          fontSize: 16,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <style>{`
        @keyframes lm-pulse {
          0% { box-shadow: 0 0 0 0 rgba(37,99,235,0.35); }
          70% { box-shadow: 0 0 0 10px rgba(37,99,235,0); }
          100% { box-shadow: 0 0 0 0 rgba(37,99,235,0); }
        }
      `}</style>
    </div>
  );
}

function PreviewStack({ imageUrl, blurPx }: { imageUrl: string | null; blurPx: number }) {
  const shellStyle: CSSProperties = {
    position: "relative",
    maxWidth: 820,
    width: "min(100%, 820px)",
    height: 460,
    margin: "0 auto",
  };

  if (!imageUrl) {
    return (
      <div style={shellStyle}>
        <div
          style={{
            position: "absolute",
            inset: "40px auto auto 50%",
            transform: "translateX(-50%)",
            width: "min(100%, 460px)",
            height: 280,
            borderRadius: 28,
            border: "10px solid white",
            background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(230,230,235,0.85))",
            boxShadow: "0 40px 60px rgba(0,0,0,0.14), 0 10px 20px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              backdropFilter: "blur(12px)",
              background: "rgba(255,255,255,0.28)",
              borderRadius: 18,
            }}
          />
          <LockedOverlay />
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <PreviewCard
        src={imageUrl}
        blurPx={blurPx}
        style={{
          position: "absolute",
          left: "50%",
          top: 116,
          transform: "translateX(-50%) rotate(-14deg) translateX(-128px)",
          width: "min(100%, 470px)",
          height: 310,
          zIndex: 1,
          opacity: 0.92,
        }}
      />
      <PreviewCard
        src={imageUrl}
        blurPx={blurPx}
        style={{
          position: "absolute",
          left: "50%",
          top: 102,
          transform: "translateX(-50%) rotate(13deg) translateX(132px)",
          width: "min(100%, 470px)",
          height: 310,
          zIndex: 2,
          opacity: 0.92,
        }}
      />
      <PreviewCard
        src={imageUrl}
        blurPx={blurPx}
        style={{
          position: "absolute",
          left: "50%",
          top: 62,
          transform: "translateX(-50%)",
          width: "min(100%, 520px)",
          height: 348,
          zIndex: 3,
        }}
        front
      />
      <LockedOverlay />
    </div>
  );
}

function PreviewCard({
  src,
  blurPx,
  style,
  front = false,
}: {
  src: string;
  blurPx: number;
  style: CSSProperties;
  front?: boolean;
}) {
  return (
    <div
      style={{
        border: front ? "11px solid white" : "10px solid white",
        borderRadius: front ? 24 : 22,
        overflow: "hidden",
        boxShadow:
          "0 54px 71px rgba(0,40,54,0.16), 0 16px 21px rgba(0,18,54,0.13), 0 7px 9px rgba(0,18,54,0.1)",
        background: "#fff",
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
          filter: `blur(${blurPx}px)`,
          transform: "scale(1.08)",
          transition: "filter 0.45s ease",
          display: "block",
        }}
      />
      {front ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.36)",
            backdropFilter: "blur(13px)",
          }}
        />
      ) : null}
    </div>
  );
}

function LockedOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10,
      }}
    >
      <div
        style={{
          border: "1.5px solid rgba(0,0,0,0.34)",
          borderRadius: 999,
          background: "#23293a",
          color: "rgba(255,255,255,0.9)",
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 18px",
          boxShadow:
            "0 72px 20px rgba(35,41,58,0), 0 45px 18px rgba(35,41,58,0.04), 0 25px 15px rgba(35,41,58,0.13), 0 11px 11px rgba(35,41,58,0.21), 0 3px 6px rgba(35,41,58,0.25), inset 0 3px 0 rgba(255,255,255,0.25)",
          fontSize: 16,
          fontWeight: 500,
          letterSpacing: "-0.03em",
          whiteSpace: "nowrap",
        }}
      >
        <LockKeyhole size={16} />
        Remplissez les champs
      </div>
    </div>
  );
}

function PrimaryButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: "rgb(225, 228, 237)",
        borderRadius: 15,
        boxShadow: "rgba(0, 0, 0, 0.1) 0px 0px 2px 0px inset",
        display: "inline-block",
        padding: 4,
        width: "100%",
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        style={{
          width: "100%",
          background: "linear-gradient(146.81deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
          borderRadius: 10,
          border: "1px solid rgb(46, 77, 156)",
          boxShadow: [
            "rgba(255,255,255,0.5) 0px 3px 0px 0px inset",
            "rgba(0,0,0,0.08) 0px 2px 6px 4px inset",
            "rgb(14,65,199) 0px -3px 0px 0px inset",
            "rgba(0,18,54,0.07) 0px 2px 3px 0px",
            "rgba(0,18,54,0.1) 0px 7px 9px 0px",
            "rgba(0,18,54,0.13) 0px 16px 21px 0px",
            "rgba(0,40,54,0.16) 0px 24px 34px 0px",
          ].join(", "),
          padding: "16px 18px",
          color: "#fff",
          fontWeight: 500,
          fontSize: 16,
          lineHeight: 1.03,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.72 : 1,
        }}
      >
        <span>{label}</span>
        {!disabled ? <ChevronRight size={16} /> : null}
      </button>
    </div>
  );
}

function PrimaryButtonLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
      <PrimaryButton label={label} />
    </a>
  );
}
