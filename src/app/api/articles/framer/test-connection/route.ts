import { NextRequest, NextResponse } from "next/server";

type TestBody = {
  projectId?: string;
  collectionName?: string;
  apiToken?: string;
  siteUrl?: string;
};

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: TestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ connected: false, message: "Requete invalide." }, { status: 400 });
  }

  const projectId = body.projectId?.trim();
  const collectionName = body.collectionName?.trim();
  const apiToken = body.apiToken?.trim();
  const siteUrl = body.siteUrl?.trim();

  const missing = [
    !projectId ? "Project ID" : null,
    !collectionName ? "Collection articles" : null,
    !apiToken ? "Token API Framer" : null,
    !siteUrl ? "URL du site Framer" : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    return NextResponse.json(
      {
        connected: false,
        message: `Configuration incomplete : ${missing.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const url = normalizeUrl(siteUrl!);
  if (!url) {
    return NextResponse.json({ connected: false, message: "URL du site Framer invalide." }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "AgenceFlow-Framer-Connection-Test",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        {
          connected: false,
          message: `Le site Framer repond, mais avec le statut ${response.status}.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      connected: true,
      message: "Configuration complete et site Framer joignable. La connexion CMS reelle devra etre confirmee depuis le plugin Framer.",
      details: {
        projectId,
        collectionName,
        siteUrl: url.toString(),
        status: response.status,
      },
    });
  } catch {
    return NextResponse.json(
      {
        connected: false,
        message: "Impossible de joindre l'URL du site Framer depuis le serveur.",
      },
      { status: 502 }
    );
  }
}
