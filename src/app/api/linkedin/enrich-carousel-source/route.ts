import { NextRequest, NextResponse } from "next/server";

type SourceType = "url" | "youtube";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getBasicYouTubeContext(url: string) {
  const videoId = extractVideoId(url);
  if (!videoId) return "";
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!oembedRes.ok) return "";
    const oembed = await oembedRes.json();
    return [
      `Titre YouTube: ${oembed.title ?? ""}`,
      `Auteur: ${oembed.author_name ?? ""}`,
      `URL: https://www.youtube.com/watch?v=${videoId}`,
      `Miniature: https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    ].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

async function getBasicUrlContext(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return "";
    const html = await response.text();
    const title =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      "";
    const description =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      "";
    const bodyHtml = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
    const text = bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
      .replace(/<\/p>|<br\s*\/?>|<\/h[1-6]>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{3,}/g, "\n\n")
      .trim()
      .slice(0, 5000);
    return [
      title ? `Titre: ${title.trim()}` : "",
      description ? `Description: ${description.trim()}` : "",
      text ? `Contenu extrait:\n${text}` : "",
    ].filter(Boolean).join("\n\n");
  } catch {
    return "";
  }
}

function parseMaybeJson(raw: string) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as { title?: string; summary?: string; keyPoints?: string[] };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      type?: SourceType;
      url?: string;
      context?: string;
      openrouterApiKey?: string;
      model?: string;
    };
    const type = body.type;
    const url = body.url?.trim() ?? "";
    if (!type || !["url", "youtube"].includes(type)) return NextResponse.json({ error: "Type de source invalide." }, { status: 400 });
    if (!url) return NextResponse.json({ error: "URL requise." }, { status: 400 });

    const apiKey = body.openrouterApiKey?.trim() || process.env.OPENROUTER_API_KEY;
    const basicContext = type === "youtube" ? await getBasicYouTubeContext(url) : await getBasicUrlContext(url);
    const manualContext = body.context?.trim() || "";

    if (!apiKey) {
      return NextResponse.json({
        title: type === "youtube" ? "Video YouTube" : "Source web",
        content: [basicContext, manualContext ? `Contexte ajoute:\n${manualContext}` : ""].filter(Boolean).join("\n\n"),
      });
    }

    const sourceLabel = type === "youtube" ? "video YouTube" : "page web";
    const prompt = [
      `Analyse cette ${sourceLabel} pour preparer un carrousel LinkedIn.`,
      `URL: ${url}`,
      basicContext ? `Contexte extrait automatiquement:\n${basicContext}` : "Aucun contexte technique extrait automatiquement.",
      manualContext ? `Contexte ajoute par l'utilisateur:\n${manualContext}` : "",
      "Retourne uniquement un JSON valide avec: title, summary, keyPoints.",
      "summary doit etre une synthese precise et utile pour creer un carrousel.",
      "keyPoints doit contenir les idees, angles, preuves, exemples ou etapes importantes.",
    ].filter(Boolean).join("\n\n");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow Carousel Source Enrichment",
      },
      body: JSON.stringify({
        model: body.model?.trim() || "google/gemini-2.5-pro-preview",
        plugins: [{ id: "web" }],
        messages: [
          { role: "system", content: "Tu es un assistant de recherche pour preparer des carrousels LinkedIn. Tu synthetises sans inventer." },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        max_tokens: 2200,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({
        title: type === "youtube" ? "Video YouTube" : "Source web",
        content: [basicContext, manualContext ? `Contexte ajoute:\n${manualContext}` : ""].filter(Boolean).join("\n\n"),
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = parseMaybeJson(raw);
    if (!parsed) {
      return NextResponse.json({
        title: type === "youtube" ? "Video YouTube" : "Source web",
        content: [raw, basicContext, manualContext ? `Contexte ajoute:\n${manualContext}` : ""].filter(Boolean).join("\n\n"),
      });
    }

    return NextResponse.json({
      title: parsed.title || (type === "youtube" ? "Video YouTube" : "Source web"),
      content: [
        parsed.summary ? `Synthese:\n${parsed.summary}` : "",
        Array.isArray(parsed.keyPoints) && parsed.keyPoints.length ? `Points cles:\n${parsed.keyPoints.map((point) => `- ${point}`).join("\n")}` : "",
        manualContext ? `Contexte ajoute:\n${manualContext}` : "",
      ].filter(Boolean).join("\n\n"),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
