"use client";

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Toast, ToastType } from "@/hooks/useToast";

const toastConfig: Record<ToastType, { icon: React.ReactNode; className: string }> = {
  success: {
    icon: <CheckCircle size={16} />,
    className: "bg-green-50 border-green-200 text-green-800",
  },
  error: {
    icon: <AlertCircle size={16} />,
    className: "bg-red-50 border-red-200 text-red-800",
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    className: "bg-orange-50 border-orange-200 text-orange-800",
  },
  info: {
    icon: <Info size={16} />,
    className: "bg-blue-50 border-blue-200 text-blue-800",
  },
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => {
        const config = toastConfig[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm",
              config.className
            )}
          >
            {config.icon}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => onRemove(toast.id)}
              className="opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
