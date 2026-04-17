import { inflateRawSync } from "zlib";
import type { LinkedInPostAnalytics } from "@/types/linkedin";

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#xA;/g, "\n")
    .replace(/&#160;|&nbsp;/g, " ");
}

function cleanCell(value: string | undefined): string {
  return decodeXml((value ?? "").replace(/<[^>]+>/g, "").trim());
}

function parseFrenchNumber(value: string | undefined): number {
  if (!value) return 0;
  const normalized = value
    .replace(/\u00A0/g, "")
    .replace(/\s/g, "")
    .replace("%", "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeFrenchDate(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function normalizeTime(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const match = input.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return undefined;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let eocdOffset = -1;

  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) throw new Error("Archive XLSX invalide.");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let cursor = centralDirectoryOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("Répertoire ZIP invalide.");
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.toString("utf8", cursor + 46, cursor + 46 + fileNameLength);

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    let fileBuffer: Buffer;
    if (compressionMethod === 0) fileBuffer = Buffer.from(compressed);
    else if (compressionMethod === 8) fileBuffer = inflateRawSync(compressed);
    else throw new Error(`Méthode ZIP non supportée: ${compressionMethod}`);

    entries.set(fileName, fileBuffer);
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function parseSharedStrings(xml: string): string[] {
  const matches = xml.match(/<si[\s\S]*?<\/si>/g) ?? [];
  return matches.map((entry) => cleanCell(entry));
}

function extractCellValue(cellXml: string, sharedStrings: string[]): string {
  const typeMatch = cellXml.match(/\bt="([^"]+)"/);
  const rawValue = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  const inlineValue = cellXml.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/)?.[1];

  if (typeMatch?.[1] === "s") return sharedStrings[Number(rawValue)] ?? "";
  if (inlineValue) return cleanCell(inlineValue);
  return cleanCell(rawValue);
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rowMatches = xml.match(/<row[\s\S]*?<\/row>/g) ?? [];
  return rowMatches.map((rowXml) => {
    const cells = rowXml.match(/<c\b[\s\S]*?<\/c>/g) ?? [];
    const row = ["", "", ""];
    for (const cellXml of cells) {
      const ref = cellXml.match(/\br="([A-Z]+)\d+"/)?.[1] ?? "A";
      const columnIndex = ref.charCodeAt(0) - 65;
      row[columnIndex] = extractCellValue(cellXml, sharedStrings);
    }
    return row;
  });
}

function rowsToAnalytics(rows: string[][], sourceFileName?: string): LinkedInPostAnalytics {
  const analytics: LinkedInPostAnalytics = {
    impressions: 0,
    reach: 0,
    profileViews: 0,
    followersGained: 0,
    socialEngagement: 0,
    reactions: 0,
    comments: 0,
    reposts: 0,
    saves: 0,
    sends: 0,
    linkClicks: 0,
    customButtonClicks: 0,
    engagementRate: 0,
    importedAt: new Date().toISOString(),
    sourceFileName,
  };

  for (const [label, rawValue, thirdValue] of rows) {
    const key = label.trim();
    const value = rawValue.trim();
    if (!key) continue;

    switch (key) {
      case "URL du post":
        analytics.postUrl = value;
        break;
      case "Date de publication":
        analytics.publishedDate = normalizeFrenchDate(value);
        break;
      case "Heure de publication du post":
        analytics.publishedTime = normalizeTime(value);
        break;
      case "Impressions":
        analytics.impressions = parseFrenchNumber(value);
        break;
      case "Membres touchés":
        analytics.reach = parseFrenchNumber(value);
        break;
      case "Vues du profil depuis ce post":
        analytics.profileViews = parseFrenchNumber(value);
        break;
      case "Abonnés gagnés grâce à ce post":
        analytics.followersGained = parseFrenchNumber(value);
        break;
      case "Engagement sur les réseaux sociaux":
        analytics.socialEngagement = parseFrenchNumber(value);
        break;
      case "Réactions":
        analytics.reactions = parseFrenchNumber(value);
        break;
      case "Commentaires":
        analytics.comments = parseFrenchNumber(value);
        break;
      case "Republications":
        analytics.reposts = parseFrenchNumber(value);
        break;
      case "Enregistrements":
        analytics.saves = parseFrenchNumber(value);
        break;
      case "Envois sur LinkedIn":
        analytics.sends = parseFrenchNumber(value);
        break;
      case "Engagement avec le lien":
        analytics.linkClicks = parseFrenchNumber(value);
        break;
      case "Engagements avec le bouton personnalisé Premium":
        analytics.customButtonClicks = parseFrenchNumber(value);
        break;
      default:
        if (key.startsWith("http")) {
          analytics.linkUrl = key;
          if (!analytics.linkClicks) analytics.linkClicks = parseFrenchNumber(value);
        }
        if (thirdValue.includes("%") && !analytics.engagementRate) {
          analytics.engagementRate = parseFrenchNumber(thirdValue);
        }
        break;
    }
  }

  if (analytics.impressions > 0 && analytics.socialEngagement > 0) {
    analytics.engagementRate = analytics.engagementRate || Number(((analytics.socialEngagement / analytics.impressions) * 100).toFixed(2));
  }

  return analytics;
}

export function parseLinkedInAnalyticsCsv(content: string, sourceFileName?: string): LinkedInPostAnalytics {
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.split(/[;,]/).map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
  return rowsToAnalytics(rows, sourceFileName);
}

export function parseLinkedInAnalyticsXlsx(buffer: Buffer, sourceFileName?: string): LinkedInPostAnalytics {
  const entries = readZipEntries(buffer);
  const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
  const sheetXml = entries.get("xl/worksheets/sheet1.xml")?.toString("utf8");

  if (!sharedStringsXml || !sheetXml) {
    throw new Error("Le fichier LinkedIn exporté est incomplet.");
  }

  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseSheetRows(sheetXml, sharedStrings);
  return rowsToAnalytics(rows, sourceFileName);
}
