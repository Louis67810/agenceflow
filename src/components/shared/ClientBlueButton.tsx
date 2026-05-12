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
        background: "#E1E5EE",
        boxShadow: "inset 0px 0px 2px rgba(0,0,0,0.1)",
        borderRadius: compact ? 13 : 15,
        display: "inline-flex",
        width: compact ? "fit-content" : "100%",
        boxSizing: "border-box",
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
          gap: 12,
          padding: compact ? "10px 14px" : "18px 24px",
          background: "linear-gradient(96.83deg, #4E7EFA 9.99%, #0147FF 82.49%)",
          color: "#fff",
          border: "1px solid #2F4D9D",
          borderRadius: 10,
          fontSize: compact ? 13 : 16,
          fontWeight: 500,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.7 : 1,
          boxShadow: [
            "0px 54px 71px rgba(0,40,54,0.16)",
            "0px 16.2794px 21.4044px rgba(0,40,54,0.130318)",
            "0px 6.76164px 8.8903px rgba(0,40,54,0.1)",
            "0px 2.44555px 3.21545px rgba(0,40,54,0.0696822)",
            "inset 0px -3px 0px #0E42C8",
            "inset 0px 2px 6px 4px rgba(0,0,0,0.08)",
            "inset 0px 3px 0px rgba(255,255,255,0.5)",
          ].join(", "),
          fontFamily: "Inter, sans-serif",
          lineHeight: "102.88%",
          whiteSpace: "nowrap",
          boxSizing: "border-box",
          ...style,
        }}
      >
        {loading ? <Loader2 size={compact ? 13 : 16} style={{ animation: "spin 1s linear infinite" }} /> : icon}
        {children}
      </button>
    </div>
  );
}
