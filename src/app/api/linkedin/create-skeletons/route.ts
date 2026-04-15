import { NextRequest, NextResponse } from "next/server";
import type { ProspectionSkeleton } from "@/types/linkedin";

interface ProspectData {
  name: string;
  actionType: string;
  status: string;
  message: string;
}

interface CreateSkeletonsRequest {
  prospects: ProspectData[];
  openrouterApiKey?: string;
  bigModel?: string;
  bigPrompt?: string;
}

const DEFAULT_BIG_PROMPT = `Analyse les données de prospection LinkedIn et crée 3 à 5 squelettes de messages optimisés.

Un squelette définit LA STRUCTURE d'un message (ordre des éléments, ton, longueur), pas les mots exacts.

Pour chaque squelette, génère un objet JSON avec :
- "name": nom court et mémorable
- "description": pourquoi ce squelette fonctionne (1-2 phrases)
- "actionTypes": tableau parmi ["liked", "commented", "visited_profile"]
- "structure": le squelette avec étapes numérotées et placeholders [NOM], [DETAIL], [QUESTION]
- "promptFragment": instruction courte (2-3 phrases) à injecter dans le prompt de génération

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown ni texte autour.`;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateSkeletonsRequest;
    const { prospects = [], openrouterApiKey, bigModel = "anthropic/claude-sonnet-4-6", bigPrompt } = body;

    if (prospects.length < 3) {
      return NextResponse.json({ error: "Il faut au moins 3 prospects envoyés pour générer des squelettes." }, { status: 400 });
    }

    const apiKey = openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé OpenRouter manquante." }, { status: 500 });
    }

    // Group by result
    const positive = prospects.filter((p) =>
      ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)
    );
    const negative = prospects.filter((p) => ["rejected", "deal_lost"].includes(p.status));
    const byAction: Record<string, ProspectData[]> = {};
    for (const p of prospects) {
      if (!byAction[p.actionType]) byAction[p.actionType] = [];
      byAction[p.actionType].push(p);
    }

    const formatGroup = (group: ProspectData[], label: string, max = 4) =>
      group.length === 0
        ? ""
        : `\n### ${label} (${group.length} au total) :\n${group
            .slice(0, max)
            .map((p) => `- [${p.actionType}] "${p.message.slice(0, 250)}" → statut: ${p.status}`)
            .join("\n")}`;

    const userPrompt = `Voici les données de prospection LinkedIn :

## Vue d'ensemble :
- Total envoyés : ${prospects.length}
- Positifs (accepté, répondu, conversation, deal) : ${positive.length}
- Négatifs (refusé, deal perdu) : ${negative.length}
- Taux de conversion : ${prospects.length > 0 ? Math.round((positive.length / prospects.length) * 100) : 0}%

## Répartition par type d'action :
${Object.entries(byAction)
  .map(([action, ps]) => {
    const pos = ps.filter((p) => ["accepted", "replied", "conversation", "deal_closed"].includes(p.status)).length;
    return `- ${action}: ${ps.length} prospects, ${pos} positifs (${ps.length > 0 ? Math.round((pos / ps.length) * 100) : 0}%)`;
  })
  .join("\n")}
${formatGroup(positive, "Messages qui ont bien fonctionné")}
${formatGroup(negative, "Messages qui n'ont pas fonctionné")}

Crée maintenant les squelettes.`;

    const systemPrompt = bigPrompt?.trim() || DEFAULT_BIG_PROMPT;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow LinkedIn Skeletons",
      },
      body: JSON.stringify({
        model: bigModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `OpenRouter: ${err}` }, { status: 500 });
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON array robustly
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "L'IA n'a pas retourné un JSON valide.", raw: content }, { status: 422 });
    }

    let rawSkeletons: Partial<ProspectionSkeleton>[];
    try {
      rawSkeletons = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "Erreur de parsing JSON.", raw: content }, { status: 422 });
    }

    const now = new Date().toISOString();
    const skeletons: ProspectionSkeleton[] = rawSkeletons.map((sk, i) => ({
      id: `skel_${Date.now()}_${i}`,
      name: sk.name ?? `Squelette ${i + 1}`,
      description: sk.description ?? "",
      actionTypes: Array.isArray(sk.actionTypes) ? sk.actionTypes : [],
      structure: sk.structure ?? "",
      promptFragment: sk.promptFragment ?? "",
      timesUsed: 0,
      timesSuccess: 0,
      createdAt: now,
      createdBy: "ai",
      isActive: true,
    }));

    return NextResponse.json({ skeletons });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
