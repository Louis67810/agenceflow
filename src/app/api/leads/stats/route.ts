import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/leads/stats
 *
 * Retourne des statistiques agrégées sur les leads et les outreach_attempts :
 * - Funnel global (new → contacted → responded → meeting → converted → lost)
 * - Par canal (email / whatsapp / linkedin_dm) : envoyés, ouverts, répondus, convertis
 * - Par source : même métriques
 * - Par secteur : même métriques
 * - Taux calculés
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Tous les leads
    const { data: leads } = await supabase
      .from("leads")
      .select("id, source, sector, status, channel_preference, created_at");

    // Tous les outreach_attempts
    const { data: attempts } = await supabase
      .from("outreach_attempts")
      .select("id, lead_id, channel, status, sent_at, opened_at, responded_at, created_at");

    const allLeads = leads ?? [];
    const allAttempts = attempts ?? [];

    // ── Funnel global ──────────────────────────────────────────────────────────
    const funnel = {
      total: allLeads.length,
      new: 0,
      contacted: 0,
      responded: 0,
      meeting: 0,
      converted: 0,
      lost: 0,
    };
    for (const l of allLeads) {
      if (l.status in funnel) (funnel as Record<string, number>)[l.status]++;
    }

    // ── Par canal (outreach) ───────────────────────────────────────────────────
    const channelStats: Record<string, { sent: number; opened: number; responded: number }> = {
      email: { sent: 0, opened: 0, responded: 0 },
      whatsapp: { sent: 0, opened: 0, responded: 0 },
      linkedin_dm: { sent: 0, opened: 0, responded: 0 },
    };

    for (const a of allAttempts) {
      const ch = a.channel as string;
      if (!channelStats[ch]) channelStats[ch] = { sent: 0, opened: 0, responded: 0 };
      if (a.status !== "pending") channelStats[ch].sent++;
      if (["opened", "clicked", "responded"].includes(a.status)) channelStats[ch].opened++;
      if (a.status === "responded") channelStats[ch].responded++;
    }

    // ── Par source (leads) ────────────────────────────────────────────────────
    const sourceStats: Record<string, { total: number; contacted: number; responded: number; meeting: number; converted: number }> = {};
    for (const l of allLeads) {
      if (!sourceStats[l.source]) {
        sourceStats[l.source] = { total: 0, contacted: 0, responded: 0, meeting: 0, converted: 0 };
      }
      sourceStats[l.source].total++;
      if (["contacted", "responded", "meeting", "converted"].includes(l.status)) sourceStats[l.source].contacted++;
      if (["responded", "meeting", "converted"].includes(l.status)) sourceStats[l.source].responded++;
      if (["meeting", "converted"].includes(l.status)) sourceStats[l.source].meeting++;
      if (l.status === "converted") sourceStats[l.source].converted++;
    }

    // ── Par secteur ───────────────────────────────────────────────────────────
    const sectorStats: Record<string, { total: number; contacted: number; responded: number; converted: number }> = {};
    for (const l of allLeads) {
      const sector = l.sector || "Non renseigné";
      if (!sectorStats[sector]) {
        sectorStats[sector] = { total: 0, contacted: 0, responded: 0, converted: 0 };
      }
      sectorStats[sector].total++;
      if (["contacted", "responded", "meeting", "converted"].includes(l.status)) sectorStats[sector].contacted++;
      if (["responded", "meeting", "converted"].includes(l.status)) sectorStats[sector].responded++;
      if (l.status === "converted") sectorStats[sector].converted++;
    }

    // ── Évolution mensuelle (12 derniers mois) ────────────────────────────────
    const now = new Date();
    const monthly: Record<string, { leads: number; contacted: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly[key] = { leads: 0, contacted: 0 };
    }
    for (const l of allLeads) {
      const d = new Date(l.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key in monthly) {
        monthly[key].leads++;
        if (["contacted", "responded", "meeting", "converted"].includes(l.status)) {
          monthly[key].contacted++;
        }
      }
    }

    // ── Taux globaux ──────────────────────────────────────────────────────────
    const totalSent = allAttempts.filter((a) => a.status !== "pending").length;
    const totalOpened = allAttempts.filter((a) =>
      ["opened", "clicked", "responded"].includes(a.status)
    ).length;
    const totalResponded = allAttempts.filter((a) => a.status === "responded").length;

    const rates = {
      openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
      responseRate: totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0,
      contactRate: funnel.total > 0 ? Math.round(((funnel.total - funnel.new) / funnel.total) * 100) : 0,
      conversionRate: funnel.total > 0 ? Math.round((funnel.converted / funnel.total) * 100) : 0,
      meetingRate: funnel.total > 0 ? Math.round((funnel.meeting / funnel.total) * 100) : 0,
    };

    return NextResponse.json({
      funnel,
      channelStats,
      sourceStats,
      sectorStats,
      monthly,
      rates,
      totalAttempts: allAttempts.length,
      totalSent,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
