"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

const jk = { fontFamily: '"Plus Jakarta Sans", sans-serif' } as const;
const cardShadow = "0px 20px 12px rgba(0,0,0,0.02), 0px 9px 9px rgba(0,0,0,0.03), 0px 2px 5px rgba(0,0,0,0.03)";

export default function ArticleStatsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#fbfbfb", padding: "52px 64px", color: "#121a2e", ...jk }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, paddingBottom: 24, borderBottom: "1px solid rgba(18,26,46,0.12)" }}>
        <div>
          <Link href="/admin/articles" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "rgba(18,26,46,0.62)", textDecoration: "none", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            <ArrowLeft size={15} /> Retour aux articles
          </Link>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: "41px", fontWeight: 750, letterSpacing: "-0.04em" }}>Statistiques articles</h1>
        </div>
      </header>
      <section style={{ marginTop: 38, minHeight: 520, borderRadius: 13, border: "1px solid rgba(0,0,0,0.13)", background: "#fff", boxShadow: cardShadow, display: "grid", placeItems: "center", textAlign: "center", padding: 32 }}>
        <div style={{ maxWidth: 460 }}>
          <span style={{ width: 54, height: 54, borderRadius: 16, background: "#f3f3f3", color: "#6d82c7", display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
            <BarChart3 size={24} />
          </span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 750 }}>Aucune donnée SEO connectée</h2>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.7, color: "rgba(18,26,46,0.52)" }}>
            Les vues, performances et analyses automatiques apparaîtront ici quand le tracking des articles sera branché.
          </p>
        </div>
      </section>
    </main>
  );
}
