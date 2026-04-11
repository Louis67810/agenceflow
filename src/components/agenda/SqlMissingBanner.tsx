"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface SqlMissingBannerProps {
  error: string;
}

export function SqlMissingBanner({ error }: SqlMissingBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const isTableMissing = error.toLowerCase().includes("does not exist") || error.toLowerCase().includes("relation");

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3">
      <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {isTableMissing ? (
          <>
            <p className="font-semibold text-amber-800 text-sm">Tables Supabase manquantes</p>
            <p className="text-xs text-amber-700 mt-1">
              Exécutez le fichier <code className="bg-amber-100 px-1 rounded">src/lib/supabase/agenda.sql</code> dans votre projet Supabase (SQL Editor) pour créer les tables nécessaires.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-amber-800 text-sm">Erreur</p>
            <p className="text-xs text-amber-700 mt-1">{error}</p>
          </>
        )}
      </div>
      <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}
