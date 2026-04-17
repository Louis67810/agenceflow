import { NextRequest, NextResponse } from "next/server";
import { parseLinkedInAnalyticsCsv, parseLinkedInAnalyticsXlsx } from "@/lib/linkedin/importAnalytics";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const lowerName = file.name.toLowerCase();

    const analytics = lowerName.endsWith(".csv")
      ? parseLinkedInAnalyticsCsv(buffer.toString("utf8"), file.name)
      : parseLinkedInAnalyticsXlsx(buffer, file.name);

    return NextResponse.json({ analytics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import impossible." },
      { status: 500 }
    );
  }
}
