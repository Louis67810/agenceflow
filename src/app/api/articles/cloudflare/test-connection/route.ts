import { NextRequest, NextResponse } from "next/server";

type TestBody = {
  accountId?: string;
  zoneId?: string;
  apiToken?: string;
  uploadUrl?: string;
  articleDomain?: string;
};

type CloudflareEnvelope<T = unknown> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ message?: string }>;
};

type CloudflareZone = {
  id?: string;
  name?: string;
  status?: string;
  account?: { id?: string; name?: string };
};

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function cloudflareError(data: CloudflareEnvelope) {
  return data.errors?.map((error) => error.message).filter(Boolean).join(" ") || "Reponse Cloudflare non valide.";
}

async function cloudflareFetch<T>(path: string, apiToken: string) {
  const response = await fetch(`${CLOUDFLARE_API}${path}`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = (await response.json().catch(() => ({}))) as CloudflareEnvelope<T>;
  if (!response.ok || !data.success) {
    throw new Error(cloudflareError(data));
  }

  return data.result;
}

export async function POST(req: NextRequest) {
  let body: TestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ connected: false, message: "Requete invalide." }, { status: 400 });
  }

  const accountId = body.accountId?.trim();
  const zoneId = body.zoneId?.trim();
  const apiToken = body.apiToken?.trim();
  const uploadUrl = body.uploadUrl?.trim();
  const articleDomain = body.articleDomain?.trim();

  const missing = [
    !accountId ? "Account ID" : null,
    !zoneId ? "Zone ID" : null,
    !apiToken ? "Token API Cloudflare" : null,
    !articleDomain ? "Domaine articles" : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    return NextResponse.json(
      {
        connected: false,
        message: `Configuration Cloudflare incomplete : ${missing.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const domainUrl = normalizeUrl(articleDomain!);
  if (!domainUrl) {
    return NextResponse.json({ connected: false, message: "Domaine articles invalide." }, { status: 400 });
  }

  if (uploadUrl && !normalizeUrl(uploadUrl)) {
    return NextResponse.json({ connected: false, message: "Lien API upload Cloudflare invalide." }, { status: 400 });
  }

  try {
    const tokenResult = await cloudflareFetch<{ status?: string }>("/user/tokens/verify", apiToken!);
    if (tokenResult?.status && tokenResult.status !== "active") {
      return NextResponse.json(
        {
          connected: false,
          message: `Token Cloudflare trouve, mais statut ${tokenResult.status}.`,
        },
        { status: 401 }
      );
    }

    await cloudflareFetch(`/accounts/${accountId}`, apiToken!);
    const zone = await cloudflareFetch<CloudflareZone>(`/zones/${zoneId}`, apiToken!);

    if (zone?.account?.id && zone.account.id !== accountId) {
      return NextResponse.json(
        {
          connected: false,
          message: "La Zone ID Cloudflare n'appartient pas a l'Account ID indique.",
        },
        { status: 400 }
      );
    }

    if (zone?.name) {
      const host = domainUrl.hostname.replace(/^www\./, "");
      const zoneName = zone.name.replace(/^www\./, "");
      if (host !== zoneName && !host.endsWith(`.${zoneName}`)) {
        return NextResponse.json(
          {
            connected: false,
            message: `Le domaine articles (${domainUrl.hostname}) ne correspond pas a la zone Cloudflare (${zone.name}).`,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      connected: true,
      message: `Cloudflare connecte : token actif, compte accessible, zone ${zone?.name ?? zoneId} valide.`,
      details: {
        accountId,
        zoneId,
        zoneName: zone?.name,
        zoneStatus: zone?.status,
        articleDomain: domainUrl.toString(),
        uploadUrl: uploadUrl || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de tester Cloudflare.";
    return NextResponse.json({ connected: false, message: `Cloudflare non connecte : ${message}` }, { status: 502 });
  }
}
