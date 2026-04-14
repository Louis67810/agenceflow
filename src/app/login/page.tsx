"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react";

const jakartaSans = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : signInError.message
      );
      setLoading(false);
      return;
    }

    router.push("/admin");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#fbfbfb",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 16px",
      position: "relative",
      overflow: "hidden",
      ...jakartaSans,
    }}>
      {/* Formes décoratives */}
      <div style={{ position: "fixed", top: -80, left: -80, pointerEvents: "none", zIndex: 0 }}>
        <svg width="536" height="381" viewBox="0 0 536 381" fill="none">
          <path d="M-105.779 298.796L-16.318 200.598C19.5701 161.204 67.5899 134.929 120.117 125.944L165.562 118.171C239.925 105.451 307.961 162.424 308.498 237.865L308.59 250.76C308.852 287.596 288.962 321.63 256.739 339.481C164.916 390.35 66.3265 284.243 123.794 196.399L226.048 40.0931C231.006 32.5132 236.656 25.4082 242.923 18.869L515.967 -266" stroke="black" strokeOpacity="0.04" strokeWidth="54.8704"/>
        </svg>
      </div>
      <div style={{ position: "fixed", bottom: -120, right: -150, pointerEvents: "none", zIndex: 0 }}>
        <svg width="639" height="523" viewBox="0 0 639 523" fill="none">
          <path d="M886.172 190.892L755.943 274.388C703.7 307.884 641.765 322.966 579.971 317.241L526.508 312.287C439.026 304.182 379.667 219.588 401.801 134.566L405.584 120.033C416.392 78.5181 449.024 46.2292 490.651 35.8613C609.272 6.31655 688.19 155.388 597.071 236.881L434.937 381.884C427.074 388.915 418.578 395.205 409.557 400.671L16.5576 638.814" stroke="black" strokeOpacity="0.04" strokeWidth="63.8992"/>
        </svg>
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <svg width="94" height="71" viewBox="0 0 141 106" fill="none">
            <defs>
              <filter id="lf" x="0" y="0" width="140.428" height="105.921" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="-1.42326" dy="1.42326"/><feGaussianBlur stdDeviation="2.37209"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"/>
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dx="-5.2186" dy="6.64186"/><feGaussianBlur stdDeviation="4.26977"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.09 0"/>
                <feBlend mode="normal" in2="effect1_dropShadow" result="effect2_dropShadow"/>
                <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow" result="shape"/>
              </filter>
            </defs>
            <g filter="url(#lf)">
              <path d="M35.1074 23.2284C35.1074 19.6945 37.7007 16.696 41.1976 16.1865L128.965 3.39741C133.258 2.77181 137.107 6.10068 137.107 10.4393V58.9532C137.107 63.1877 133.432 66.4853 129.222 66.0278L41.4547 56.4878C37.8434 56.0953 35.1074 53.0458 35.1074 49.4132V23.2284Z" fill="#1A1A1A"/>
            </g>
            <path d="M110.839 36.5656L110.902 56.8713L114.848 57.4017L118.803 57.9326V43.3015L118.846 40.5358H123.239H127.675V36.3154V33.5001L123.304 33.4584L118.911 33.3958L118.846 31.8735L118.803 20.8691C118.803 20.8691 121.98 20.2718 124.023 19.9289C125.77 19.6357 128.504 19.2237 128.504 19.2237L128.974 19.1658V12.5581L119.665 13.8082L110.839 14.9936V36.5656Z" fill="white"/>
            <path d="M90.8359 35.3848V54.1769L94.7851 54.7065L98.7996 55.2461V42.1207L98.8428 39.355H103.236H107.672V35.1346V32.3193L103.301 32.2776L98.9078 32.215L98.8428 30.6927L98.7996 22.2574L104.023 21.3608L108.47 20.5514L108.971 20.4576V15.2453L99.8538 16.4701L90.7959 17.687L90.8359 35.3848Z" fill="white"/>
            <path d="M67.6309 20.7996V24.1488V33.5693V44.6388C67.6309 47.9069 69.6669 51.3068 71.7685 51.6169L81.6776 52.9475C86.6583 53.6166 88.1961 48.3788 88.1961 44.9637V43.8288V33.4487V18.037L84.6818 18.5085L80.7304 19.039L80.7942 32.8436V44.3788C80.3974 46.1958 76.0976 46.1455 75.3095 44.3788C75.2259 44.1771 75.179 32.7392 75.179 32.7392V19.7859L72.0285 20.2086L67.6309 20.7996Z" fill="white"/>
            <path d="M44.3438 36.0216V47.9313L48.1736 48.445L51.0821 48.8352V44.2121V40.6183H52.6805C53.5854 40.5594 53.9176 40.6183 54.6489 41.3496C55.249 41.9448 55.1313 42.2115 55.8887 44.2121L57.1153 49.6462L61.2271 50.1982L66.0476 50.8457L64.0104 45.3456L61.9785 40.9317L61.2263 39.4691L62.1456 38.508C63.9007 36.7111 64.6529 33.9949 64.2142 31.1115C63.6709 27.3923 61.5549 22.8986 57.8984 22.1046L50.5337 23.0933L44.3438 23.9234V36.0216ZM55.705 30.2234C56.384 30.9025 56.3109 32.9919 55.705 33.7441C55.3498 34.1829 54.7386 34.3292 53.276 34.3918H51.0821V32.5949V29.5183H53.276C54.5088 29.5183 55.3132 29.8317 55.705 30.2234Z" fill="white"/>
          </svg>
        </div>

        {/* Card */}
        <div style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.13)",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0px 35px 21px rgba(0,0,0,0.03), 0px 15px 15px rgba(0,0,0,0.04), 0px 4px 8px rgba(0,0,0,0.05)",
          padding: "40px 40px",
        }}>
          <h1 style={{ ...jakartaSans, fontSize: 28, fontWeight: 700, color: "#121a2e", letterSpacing: "-0.45px", margin: "0 0 6px" }}>
            Connexion
          </h1>
          <p style={{ ...jakartaSans, fontSize: 14, color: "rgba(18,26,46,0.5)", margin: "0 0 28px" }}>
            Accédez à votre espace de travail
          </p>

          {error && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 14px", background: "#fef2f2", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, marginBottom: 20 }}>
              <AlertCircle size={15} style={{ color: "#ef4444", marginTop: 1, flexShrink: 0 }} />
              <p style={{ ...jakartaSans, fontSize: 13, color: "#b91c1c", margin: 0 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ ...jakartaSans, display: "block", fontSize: 13, fontWeight: 600, color: "rgba(18,26,46,0.6)", marginBottom: 6, letterSpacing: "-0.3px" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@agence.com"
                required
                autoFocus
                style={{
                  width: "100%", padding: "12px 16px", fontSize: 14, letterSpacing: "-0.3px",
                  color: "#121a2e", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10,
                  outline: "none", background: "#f6f6f6", boxSizing: "border-box",
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                }}
              />
            </div>

            <div>
              <label style={{ ...jakartaSans, display: "block", fontSize: 13, fontWeight: 600, color: "rgba(18,26,46,0.6)", marginBottom: 6, letterSpacing: "-0.3px" }}>
                Mot de passe
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%", padding: "12px 44px 12px 16px", fontSize: 14, letterSpacing: "-0.3px",
                    color: "#121a2e", border: "1px solid rgba(0,0,0,0.09)", borderRadius: 10,
                    outline: "none", background: "#f6f6f6", boxSizing: "border-box",
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(18,26,46,0.4)", display: "flex" }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "15px 20px", marginTop: 8,
                background: loading
                  ? "linear-gradient(121deg, rgb(40,80,200) 9.99%, rgb(0,45,180) 82.49%)"
                  : "linear-gradient(121deg, rgb(78,126,250) 9.99%, rgb(1,71,255) 82.49%)",
                color: "#fff",
                border: "1px solid #2f4d9d",
                borderRadius: 12,
                fontSize: 14, fontWeight: 600,
                letterSpacing: "-0.45px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.8 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "inset 0px -3px 0px 0px #0e42c8, 0px 4px 12px rgba(1,71,255,0.2)",
                fontFamily: '"Plus Jakarta Sans", sans-serif',
              }}
            >
              {loading ? (
                <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />Connexion...</>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>
        </div>

        <p style={{ ...jakartaSans, textAlign: "center", fontSize: 12, color: "rgba(18,26,46,0.35)", marginTop: 20 }}>
          Pas encore de compte ? Contactez l&apos;administrateur.
        </p>
      </div>
    </div>
  );
}
