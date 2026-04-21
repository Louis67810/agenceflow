"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ClientBlueButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
  compact?: boolean;
  wrapperStyle?: CSSProperties;
  icon?: ReactNode;
};

export default function ClientBlueButton({
  children,
  loading = false,
  compact = false,
  wrapperStyle,
  icon,
  disabled,
  style,
  ...props
}: ClientBlueButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <div
      style={{
        padding: compact ? 4 : 6,
        background: "#e1e5ee",
        borderRadius: compact ? 13 : 15,
        display: "inline-flex",
        width: compact ? "fit-content" : "100%",
        ...wrapperStyle,
      }}
    >
      <button
        {...props}
        disabled={isDisabled}
        style={{
          width: compact ? "auto" : "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: compact ? "10px 14px" : "16px 24px",
          background: "linear-gradient(146.81deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
          color: "#fff",
          border: "1px solid #2f4d9d",
          borderRadius: 10,
          fontSize: compact ? 13 : 16,
          fontWeight: 500,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.7 : 1,
          boxShadow: [
            "inset 0px -3px 0px 0px #0e42c8",
            "inset 0px 2px 6px 4px rgba(0,0,0,0.08)",
            "inset 0px 3px 0px 0px rgba(255,255,255,0.5)",
            "0px 4px 12px rgba(1,71,255,0.25)",
          ].join(", "),
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          ...style,
        }}
      >
        {loading ? <Loader2 size={compact ? 13 : 16} style={{ animation: "spin 1s linear infinite" }} /> : icon}
        {children}
      </button>
    </div>
  );
}
