import { NextRequest, NextResponse } from "next/server";

type PageEntry = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  viewsLastWeek: number;
};

type DiscoveryDebug = {
  domain: string;
  destinationPath: string;
  fetched: Array<{
    label: string;
    url: string;
    ok: boolean;
    status?: number;
    bytes?: number;
    error?: string;
  }>;
  sitemapUrlsFound: number;
  publicLinksFound: number;
  candidateUrlsFound: number;
  rejectedOtherDomain: number;
  rejectedNotResource: number;
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

function extractRobotsSitemaps(robots: string) {
  return robots
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*sitemap\s*:\s*(.+?)\s*$/i)?.[1]?.trim())
    .filter(Boolean) as string[];
}

function discoveryPath(destinationPattern?: string) {
  const pattern = destinationPattern || "/articles/{slug}/index.html";
  const base = pattern.includes("{slug}") ? pattern.split("{slug}")[0] : pattern;
  const cleaned = base.replace(/\/$/, "");
  return cleaned || "/";
}

function isArticleUrl(url: URL, destinationPattern?: string) {
  const path = url.pathname.toLowerCase();
  const pattern = destinationPattern?.toLowerCase() || "/articles/{slug}/index.html";
  const base = pattern.includes("{slug}") ? pattern.split("{slug}")[0] : pattern;
  const normalizedBase = base.replace(/\/index\.html$/, "").replace(/\/$/, "");

  if (normalizedBase && path !== normalizedBase && path.startsWith(`${normalizedBase}/`)) return true;
  return path.includes("/articles/") || path.includes("/blog/");
}

function isSameDomain(url: URL, domain: URL) {
  return url.hostname === domain.hostname || url.hostname.endsWith(`.${domain.hostname}`);
}

async function fetchText(url: URL, debug?: DiscoveryDebug, label = "fetch") {
  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "AgenceFlow-Article-Page-Discovery" },
      redirect: "follow",
    });
    const text = response.ok ? await response.text() : null;
    debug?.fetched.push({
      label,
      url: url.toString(),
      ok: response.ok,
      status: response.status,
      bytes: text?.length ?? 0,
    });
    return text;
  } catch (error) {
    debug?.fetched.push({
      label,
      url: url.toString(),
      ok: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    });
    return null;
  }
}

function buildDebug(domain: URL, destinationPattern?: string): DiscoveryDebug {
  return {
    domain: domain.toString(),
    destinationPath: discoveryPath(destinationPattern),
    fetched: [],
    sitemapUrlsFound: 0,
    publicLinksFound: 0,
    candidateUrlsFound: 0,
    rejectedOtherDomain: 0,
    rejectedNotResource: 0,
  };
}

function filterCandidateUrls(entries: string[], domain: URL, destinationPattern: string | undefined, debug: DiscoveryDebug) {
  const urls: URL[] = [];

  for (const entry of entries) {
    const normalized = normalizeUrl(entry);
    if (!normalized) continue;
    debug.candidateUrlsFound += 1;

    if (!isSameDomain(normalized, domain)) {
      debug.rejectedOtherDomain += 1;
      continue;
    }

    if (!isArticleUrl(normalized, destinationPattern)) {
      debug.rejectedNotResource += 1;
      continue;
    }

    urls.push(normalized);
  }

  return urls;
}

function candidateSitemapUrls(domain: URL, destinationPattern?: string) {
  const discovery = discoveryPath(destinationPattern);
  const candidates = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/sitemap-index.xml",
    "/server-sitemap.xml",
    "/sitemap-pages.xml",
    "/page-sitemap.xml",
    "/post-sitemap.xml",
    "/articles/sitemap.xml",
    "/blog/sitemap.xml",
  ];

  if (discovery !== "/") {
    candidates.push(`${discovery}/sitemap.xml`.replace(/\/{2,}/g, "/"));
  }

  return candidates.map((path) => new URL(path, domain));
}

async function discoverFromSitemaps(domain: URL, destinationPattern: string | undefined, debug: DiscoveryDebug) {
  const urls: string[] = [];
  const queue = candidateSitemapUrls(domain, destinationPattern);
  const robots = await fetchText(new URL("/robots.txt", domain), debug, "robots");

  if (robots) {
    for (const sitemap of extractRobotsSitemaps(robots)) {
      const normalized = normalizeUrl(sitemap);
      if (normalized && isSameDomain(normalized, domain)) queue.push(normalized);
    }
  }

  const seen = new Set<string>();
  let sitemapFound = false;

  while (queue.length > 0 && seen.size < 25) {
    const sitemapUrl = queue.shift()!;
    const key = sitemapUrl.toString();
    if (seen.has(key)) continue;
    seen.add(key);

    const xml = await fetchText(sitemapUrl, debug, "sitemap");
    if (!xml) continue;
    sitemapFound = true;

    for (const loc of extractUrls(xml)) {
      const normalized = normalizeUrl(loc);
      if (!normalized || !isSameDomain(normalized, domain)) continue;
      if (normalized.pathname.toLowerCase().endsWith(".xml")) {
        queue.push(normalized);
      } else {
        urls.push(normalized.toString());
      }
    }
  }

  debug.sitemapUrlsFound = urls.length;
  return { urls, sitemapFound };
}

function crawlSeeds(domain: URL, destinationPattern?: string) {
  const discovery = discoveryPath(destinationPattern);
  const seeds = ["/", discovery, `${discovery}/`, "/articles", "/articles/", "/blog", "/blog/"];
  return Array.from(new Set(seeds)).map((path) => new URL(path, domain));
}

async function discoverFromPublicLinks(domain: URL, destinationPattern: string | undefined, debug: DiscoveryDebug) {
  const urls: string[] = [];
  const queue = crawlSeeds(domain, destinationPattern);
  const visited = new Set<string>();

  while (queue.length > 0 && visited.size < 30) {
    const target = queue.shift()!;
    const key = target.toString();
    if (visited.has(key)) continue;
    visited.add(key);

    const html = await fetchText(target, debug, "public-page");
    if (!html) continue;

    for (const link of extractLinks(html, target)) {
      const normalized = normalizeUrl(link);
      if (!normalized || !isSameDomain(normalized, domain)) continue;

      if (isArticleUrl(normalized, destinationPattern)) {
        urls.push(normalized.toString());
      }

      if (!visited.has(normalized.toString()) && queue.length < 60) {
        queue.push(normalized);
      }
    }
  }

  debug.publicLinksFound = urls.length;
  return urls;
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

  const debug = buildDebug(domain, body.destinationPattern);
  const sitemapDiscovery = await discoverFromSitemaps(domain, body.destinationPattern, debug);
  const fallbackUrls = await discoverFromPublicLinks(domain, body.destinationPattern, debug);
  const urls = filterCandidateUrls([...sitemapDiscovery.urls, ...fallbackUrls], domain, body.destinationPattern, debug);

  const uniqueUrls = Array.from(new Map(urls.map((url) => [url.toString(), url])).values());

  const pages: PageEntry[] = toPages(uniqueUrls);

  return NextResponse.json({
    pages,
    debug,
    message: pages.length > 0
      ? `${pages.length} page(s) article detectee(s) depuis ${sitemapDiscovery.sitemapFound ? "les sitemaps" : "les liens publics"} Cloudflare.`
      : sitemapDiscovery.sitemapFound
        ? `Cloudflare est connecte, mais aucune page article n'a ete detectee dans les sitemaps ou les liens publics ${discoveryPath(body.destinationPattern)}.`
        : `Cloudflare est connecte, mais aucun sitemap public ni lien ${discoveryPath(body.destinationPattern)} n'a permis de lister les pages articles.`,
  });
}
