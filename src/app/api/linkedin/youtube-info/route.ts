import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url?.trim()) {
      return NextResponse.json({ error: "URL YouTube requise" }, { status: 400 });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "URL YouTube invalide" }, { status: 400 });
    }

    // Use YouTube oEmbed for basic info (no API key needed)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const oembedRes = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(8000),
    });

    if (!oembedRes.ok) {
      return NextResponse.json(
        { error: "Vidéo introuvable ou privée" },
        { status: 400 }
      );
    }

    const oembed = await oembedRes.json();

    // Try to get description from regular YouTube page
    let description = "";
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        // Extract description from meta tag
        const descMatch =
          html.match(/"description":\{"simpleText":"([^"]{20,500})"/i) ||
          html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{20,})["']/i);
        if (descMatch) {
          description = descMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\u[0-9a-f]{4}/gi, "")
            .trim()
            .slice(0, 1000);
        }
      }
    } catch {
      // Description extraction failed — OK, proceed without it
    }

    return NextResponse.json({
      videoId,
      title: oembed.title ?? "Vidéo YouTube",
      author: oembed.author_name ?? "",
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      description,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      return NextResponse.json({ error: "Délai d'attente dépassé" }, { status: 408 });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
