"use client";

import { useState } from "react";
import { Briefcase, Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) =>
    setLogs((prev) => [...prev, `[${new Date().toISOString().slice(11, 23)}] ${msg}`]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    log("Soumission du formulaire");

    log("Appel /api/auth/login...");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    log(`Réponse HTTP ${res.status} : ${JSON.stringify(data)}`);

    if (!res.ok) {
      setError(
        data.error === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : data.error ?? "Erreur inconnue."
      );
      setLoading(false);
      return;
    }

    log("Cookies set, navigation vers /admin...");
    window.location.href = "/admin";
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-3 justify-center mb-8">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
          <Briefcase size={18} className="text-white" />
        </div>
        <span className="text-xl font-bold text-gray-900">AgenceFlow</span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Connexion</h1>
        <p className="text-sm text-gray-500 mb-6">
          Accédez à votre espace de travail
        </p>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
            <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@agence.com"
              required
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Connexion...
              </>
            ) : (
              "Se connecter"
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        Pas encore de compte ? Contactez l&apos;administrateur.
      </p>

      {logs.length > 0 && (
        <div className="mt-4 bg-black border border-gray-700 rounded-xl p-4 w-full">
          <p className="text-xs text-gray-400 font-mono mb-2 select-all">— Debug log —</p>
          {logs.map((l, i) => (
            <p key={i} className="text-xs font-mono text-green-400 break-all leading-relaxed select-all">
              {l}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
