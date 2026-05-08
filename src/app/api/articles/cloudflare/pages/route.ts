import { NextRequest, NextResponse } from "next/server";

type PageEntry = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  viewsLastWeek: number;
};

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.pathname = url.pathname.replace(/\/$/, "");
    url.hash = "";
    url.search = "";
    return url;
  } catch {
    return null;
  }
}

function titleFromUrl(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);
  const slug = segments[segments.length - 1] || url.hostname;
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractUrls(xml: string) {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g))
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];
}

function extractLinks(html: string, baseUrl: URL) {
  return Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => match[1]?.trim())
    .filter(Boolean)
    .map((href) => {
      try {
        return new URL(href!, baseUrl).toString();
      } catch {
        return null;
      }
    })
    .filter(Boolean) as string[];
}

function discoveryPath(destinationPattern?: string) {
  const pattern = destinationPattern || "/articles/{slug}/index.html";
  const base = pattern.includes("{slug}") ? pattern.split("{slug}")[0] : "/articles/";
  const cleaned = base.replace(/\/$/, "");
  return cleaned || "/";
}

function isArticleUrl(url: URL, destinationPattern?: string) {
  const path = url.pathname.toLowerCase();
  const pattern = destinationPattern?.toLowerCase() || "/articles/{slug}/index.html";
  const base = pattern.includes("{slug}") ? pattern.split("{slug}")[0] : "/articles/";
  const normalizedBase = base.replace(/\/index\.html$/, "").replace(/\/$/, "");

  if (normalizedBase && path !== normalizedBase && path.startsWith(`${normalizedBase}/`)) return true;
  return path.includes("/articles/") || path.includes("/blog/");
}

async function fetchText(url: URL) {
  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "AgenceFlow-Article-Page-Discovery" },
    redirect: "follow",
  });
  if (!response.ok) return null;
  return response.text();
}

function toPages(urls: URL[]) {
  return urls.map((url) => ({
    id: url.pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || url.hostname,
    title: titleFromUrl(url),
    url: url.toString(),
    createdAt: new Date().toISOString(),
    viewsLastWeek: 0,
  }));
}

export async function POST(req: NextRequest) {
  let body: { articleDomain?: string; destinationPattern?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ pages: [], message: "Requete invalide." }, { status: 400 });
  }

  const domain = normalizeUrl(body.articleDomain?.trim() ?? "");
  if (!domain) {
    return NextResponse.json({ pages: [], message: "Domaine articles invalide." }, { status: 400 });
  }

  const sitemapUrl = new URL("/sitemap.xml", domain);
  const sitemap = await fetchText(sitemapUrl);
  const sitemapUrls = sitemap ? extractUrls(sitemap) : [];
  const fallbackUrls: string[] = [];

  if (!sitemap) {
    const htmlTargets = [new URL("/", domain), new URL(discoveryPath(body.destinationPattern), domain)];
    for (const target of htmlTargets) {
      const html = await fetchText(target);
      if (html) fallbackUrls.push(...extractLinks(html, target));
    }
  }

  const urls = [...sitemapUrls, ...fallbackUrls]
    .map((entry) => normalizeUrl(entry))
    .filter((entry): entry is URL => Boolean(entry))
    .filter((entry) => entry.hostname === domain.hostname || entry.hostname.endsWith(`.${domain.hostname}`))
    .filter((entry) => isArticleUrl(entry, body.destinationPattern));

  const uniqueUrls = Array.from(new Map(urls.map((url) => [url.toString(), url])).values());

  const pages: PageEntry[] = toPages(uniqueUrls);

  return NextResponse.json({
    pages,
    message: pages.length > 0
      ? `${pages.length} page(s) article detectee(s) depuis ${sitemap ? "le sitemap" : "les liens publics"} Cloudflare.`
      : sitemap
        ? "Cloudflare est connecte, mais aucune page article n'a ete detectee dans le sitemap."
        : `Cloudflare est connecte, mais aucun sitemap public ni lien ${discoveryPath(body.destinationPattern)} n'a permis de lister les pages articles.`,
  });
}
