import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 575;
const HEIGHT = 690;

function resolvePlaywrightExecutablePath() {
  if (process.platform !== "win32" || !process.env.USERPROFILE) return undefined;
  const root = join(process.env.USERPROFILE, "AppData", "Local", "ms-playwright");
  if (!existsSync(root)) return undefined;
  const chromiumDir = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("chromium-"))
    .map((entry) => join(root, entry.name, "chrome-win64", "chrome.exe"))
    .find((candidate) => existsSync(candidate));
  return chromiumDir;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const slides = Array.isArray(body?.slides) ? body.slides.filter((slide): slide is string => typeof slide === "string" && slide.length > 0) : [];

    if (slides.length === 0) {
      return NextResponse.json({ error: "Aucune slide a exporter." }, { status: 400 });
    }

    const { chromium } = await import("playwright");
    const executablePath = resolvePlaywrightExecutablePath();
    const browser = await chromium.launch({
      headless: true,
      executablePath,
    });

    try {
      const page = await browser.newPage({
        viewport: { width: WIDTH, height: HEIGHT },
        deviceScaleFactor: 2,
      });

      const origin = new URL(request.url).origin;
      const images: string[] = [];

      for (const slide of slides) {
        const previewUrl = `${origin}/linkedin/carousel-export?slide=${encodeURIComponent(slide)}`;
        await page.goto(previewUrl, { waitUntil: "networkidle" });
        await page.evaluate(async () => {
          await document.fonts.ready;
          const images = Array.from(document.images);
          await Promise.all(images.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            return new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            });
          }));
        });

        const locator = page.locator("[data-carousel-slide-inner]").first();
        const buffer = await locator.screenshot({ type: "png" });
        images.push(buffer.toString("base64"));
      }

      await page.close();

      return NextResponse.json({ images, width: WIDTH, height: HEIGHT });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("Carousel export error:", error);
    return NextResponse.json({ error: "Impossible de generer l'export du carousel." }, { status: 500 });
  }
}
