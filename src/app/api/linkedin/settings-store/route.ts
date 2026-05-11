import { NextRequest, NextResponse } from "next/server";
import { formatSupabaseError } from "@/lib/supabase/format-error";
import { getRouteAuthenticatedUser } from "@/lib/supabase/route-client";
import { DEFAULT_LINKEDIN_GLOBAL_SYSTEM_PROMPT } from "@/lib/linkedin/post-style-prompts";
import {
  DEFAULT_LINKEDIN_EDIT_ACTION_GENERAL_PROMPT,
  DEFAULT_LINKEDIN_EDIT_ACTIONS,
} from "@/lib/linkedin/edit-ai-actions";

const DEFAULT_SETTINGS = {
  openrouterApiKey: "",
  model: "anthropic/claude-sonnet-4-6",
  businessContext: "",
  postSystemPrompt: DEFAULT_LINKEDIN_GLOBAL_SYSTEM_PROMPT,
  editActionGeneralPrompt: DEFAULT_LINKEDIN_EDIT_ACTION_GENERAL_PROMPT,
  editActions: DEFAULT_LINKEDIN_EDIT_ACTIONS,
  carouselTemplate: `Pour chaque slide, genere exactement ce format :

TITRE: [3-5 mots - accroche courte et percutante]
SOUS-TITRE: [8-12 mots - developpe et complete le titre]
TEXTE: [2-4 phrases - contenu principal du slide, concret et actionnable]
VISUEL: [1 phrase - description precise du visuel ou image ideale pour ce slide]

---

Slide 1 = accroche / problematique principale
Slides intermediaires = une idee cle par slide
Dernier slide = resume + appel a l'action fort`,
  carouselContentModel: "anthropic/claude-sonnet-4-6",
  carouselImageModel: "openai/gpt-image-1",
  carouselSkillPrompt: `# Role
Tu es un systeme expert de generation de carrousels LinkedIn.

# Objectif
Genere un carrousel coherent slide par slide en respectant strictement :
- le style selectionne
- le nom du carrousel
- la categorie
- le prompt global du carrousel
- le pre-prompt de chaque page
- tous les champs et options de chaque page

# Regles
- N'invente aucun champ hors structure
- Respecte exactement l'intention de chaque slide
- Si une option permet d'afficher ou cacher un element, tiens-en compte dans le texte genere
- Pour les slides avec image, decris precisement l'image attendue pour qu'un modele image puisse la produire
- Garde un ton adapte a LinkedIn, clair, expert, impactant
- Assure une progression logique entre les slides
- Evite les repetitions entre slides`,
  language: "fr",
  prospectionBigModel: "anthropic/claude-sonnet-4-6",
  prospectionSmallModel: "google/gemini-2.0-flash-001",
  prospectionBigPrompt: `Analyse les donnees de prospection LinkedIn et cree 3 a 5 squelettes de messages optimises.

Un squelette definit LA STRUCTURE d'un message (ordre des elements, ton, longueur), pas les mots exacts. Il doit capturer ce qui rend les messages performants dans les donnees.

Pour chaque squelette, genere un objet JSON avec :
- "name": nom court et memorable (ex: "Compliment -> Probleme -> Question directe")
- "description": pourquoi ce squelette fonctionne (1-2 phrases)
- "actionTypes": tableau parmi ["liked", "commented", "visited_profile"]
- "structure": le squelette avec etapes numerotees et placeholders [NOM], [DETAIL_CONTEXTE], [QUESTION]
- "promptFragment": instruction courte (2-4 phrases) a injecter dans le prompt de generation pour guider l'IA dans la personnalisation

Reponds UNIQUEMENT avec un tableau JSON valide, sans markdown ni texte autour.`,
  prospectionSmallPrompt: `Tu es un expert en prospection LinkedIn. Genere un message personnalise, authentique et court (3-5 phrases max).
Regles absolues :
- Commence par le prenom du prospect
- Ne pitche JAMAIS dans le premier message
- Termine par une seule question ouverte simple
- Sonne comme un humain, pas un template
- Si un squelette est fourni, respecte sa structure tout en personnalisant chaque element`,
  prospectionAutoAnalysis: false,
  prospectionAutoAnalysisEvery: 10,
  airtableKey: "",
  airtableBaseId: "",
  airtableTableName: "Prospects LinkedIn",
  airtableAutoSync: false,
  viralityOpenAiApiKey: "",
  viralityAnalyzerModel: "",
  viralityImageModel: "qwen/qwen2.5-vl-72b-instruct",
  viralitySystemPrompt: "",
};

function normalizeSettings(settings?: Record<string, unknown> | null) {
  const airtableKey = typeof settings?.airtableKey === "string"
    ? settings.airtableKey
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .trim()
        .replace(/^authorization:\s*/i, "")
        .replace(/^Bearer\s+/i, "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim()
    : DEFAULT_SETTINGS.airtableKey;

  return {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
    airtableKey,
    airtableBaseId: typeof settings?.airtableBaseId === "string"
      ? settings.airtableBaseId.trim()
      : DEFAULT_SETTINGS.airtableBaseId,
    airtableTableName: typeof settings?.airtableTableName === "string"
      ? settings.airtableTableName.trim()
      : DEFAULT_SETTINGS.airtableTableName,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error: fetchError } = await supabase
      .from("linkedin_user_settings")
      .select("settings")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!data) {
      const bootstrappedSettings = normalizeSettings();
      const { data: inserted, error: insertError } = await supabase
        .from("linkedin_user_settings")
        .upsert(
          {
            user_id: user.id,
            settings: bootstrappedSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select("settings")
        .single();

      if (insertError) throw insertError;
      return NextResponse.json({ settings: normalizeSettings(inserted?.settings ?? null) });
    }

    return NextResponse.json({ settings: normalizeSettings(data.settings ?? null) });
  } catch (e) {
    return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await getRouteAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const settings = normalizeSettings(body?.settings ?? null);

    // 1. Upsert
    const { error: upsertError } = await supabase
      .from("linkedin_user_settings")
      .upsert(
        {
          user_id: user.id,
          settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) throw upsertError;

    // 2. Re-fetch fresh data (upsert+select can return stale data in Supabase)
    const { data: freshData, error: fetchError } = await supabase
      .from("linkedin_user_settings")
      .select("settings")
      .eq("user_id", user.id)
      .single();

    if (fetchError) throw fetchError;

    return NextResponse.json({ settings: normalizeSettings(freshData?.settings ?? null) });
  } catch (e) {
    return NextResponse.json({ error: formatSupabaseError(e) }, { status: 500 });
  }
}
