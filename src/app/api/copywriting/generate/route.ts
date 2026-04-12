import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { section_type, prompt, notes, language, element_count, form_data, model: bodyModel, business_context } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt requis" }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY non configurée" }, { status: 500 });
    }

    const langLabel = language === "en" ? "English" : language === "es" ? "Spanish" : "French";

    const systemPrompt = `You are an expert copywriter for websites. You write clear, compelling, conversion-focused web copy.
Always respond in ${langLabel}. Return ONLY the copywriting content, no explanations or meta-commentary.
Format the output as clean, ready-to-use copy with proper structure.${business_context ? `\n\n## Agency Context\n${business_context}` : ""}`;

    const contextFromForm = form_data
      ? `\n\n## Client & Project Context\n${JSON.stringify(form_data, null, 2)}`
      : "";

    const userPrompt = `## Section: ${section_type}
## Task: ${prompt}
${notes ? `\n## Additional Notes\n${notes}` : ""}
${element_count ? `\n## Number of elements/items to generate: ${element_count}` : ""}
${contextFromForm}

Generate the copywriting for this website section now.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenceflow.app",
        "X-Title": "AgenceFlow Copywriting",
      },
      body: JSON.stringify({
        model: bodyModel ?? "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `OpenRouter error: ${errText}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ content });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
