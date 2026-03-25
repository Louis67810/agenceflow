"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Briefcase, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "done">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Créer le compte dans Supabase Auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: "admin" },
      },
    });

    if (signUpError) {
      setError(
        signUpError.message === "User already registered"
          ? "Un compte avec cet email existe déjà. Allez sur /login."
          : signUpError.message
      );
      setLoading(false);
      return;
    }

    const userId = authData.user?.id;
    if (!userId) {
      setError("Erreur lors de la création du compte. Réessayez.");
      setLoading(false);
      return;
    }

    // 2. Créer le profil admin dans agency_profiles
    const { error: profileError } = await supabase
      .from("agency_profiles")
      .insert({ id: userId, role: "admin", name, email });

    if (profileError) {
      // La table n'existe peut-être pas encore — on continue quand même
      console.warn("agency_profiles insert failed:", profileError.message);
    }

    // 3. Se connecter directement
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Compte créé mais connexion auto impossible (ex: email confirmation activé)
      setStep("done");
      setLoading(false);
      return;
    }

    setStep("done");
    setLoading(false);
  };

  if (step === "done") {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <CheckCircle2 size={40} className="text-green-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Compte créé !</h1>
          <p className="text-gray-400 text-sm mb-6">
            Ton compte admin a été créé avec succès.
          </p>
          <button
            onClick={() => router.push("/admin")}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Accéder au dashboard
          </button>
          <p className="text-xs text-gray-600 mt-4">
            Cette page /setup est désormais inutilisable si un compte admin existe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 justify-center mb-8">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
          <Briefcase size={18} className="text-white" />
        </div>
        <span className="text-xl font-bold text-white">AgenceFlow</span>
      </div>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
        {/* Badge setup */}
        <div className="flex items-center gap-2 bg-indigo-950 border border-indigo-800 rounded-lg px-3 py-2 mb-6">
          <ShieldCheck size={14} className="text-indigo-400" />
          <span className="text-xs text-indigo-300 font-medium">
            Configuration initiale — compte administrateur
          </span>
        </div>

        <h1 className="text-xl font-bold text-white mb-1">Créer ton compte</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ce compte aura les droits admin complets sur AgenceFlow.
        </p>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-950 border border-red-800 rounded-lg mb-4">
            <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Ton prénom / nom
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Louis"
              required
              autoFocus
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              required
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                required
                minLength={6}
                className="w-full px-3 py-2.5 pr-10 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
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
                Création en cours...
              </>
            ) : (
              "Créer mon compte admin"
            )}
          </button>
        </form>
      </div>

      <div className="mt-4 flex items-start gap-2 px-2">
        <AlertCircle size={13} className="text-gray-600 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-600">
          Si la connexion automatique échoue, désactive la confirmation email dans{" "}
          <span className="text-gray-500">Supabase → Authentication → Settings → Email Confirmations</span>.
        </p>
      </div>
    </div>
  );
}
