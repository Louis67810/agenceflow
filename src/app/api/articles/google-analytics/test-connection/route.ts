import { createSign } from "crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TestBody = {
  propertyId?: string;
  measurementId?: string;
  apiSecret?: string;
  serviceAccountJson?: string;
};

type ServiceAccount = {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
};

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseServiceAccount(value: string) {
  try {
    const parsed = JSON.parse(value) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

function friendlyGoogleError(message: string) {
  if (message.includes("analyticsdata.googleapis.com") && message.includes("disabled")) {
    return `${message} Concretement : active Google Analytics Data API dans le projet Google Cloud du service account, attends 2 a 5 minutes, puis relance le test.`;
  }
  if (message.includes("User does not have sufficient permissions")) {
    return `${message} Concretement : ajoute le client_email du Service Account dans GA4 > Admin > Acces a la propriete avec le role Lecteur.`;
  }
  return message;
}

async function getAccessToken(serviceAccount: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsignedJwt = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = base64Url(signer.sign(serviceAccount.private_key!.replace(/\\n/g, "\n")));
  const jwt = `${unsignedJwt}.${signature}`;

  const response = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "OAuth Google refuse le service account.");
  }
  return data.access_token as string;
}

async function testAnalyticsData(propertyId: string, accessToken: string) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
      metrics: [{ name: "activeUsers" }],
      dimensions: [{ name: "pagePath" }],
      limit: 1,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "La Data API Google Analytics a refuse la requete.");
  }
  return data;
}

async function testMeasurementProtocol(measurementId: string, apiSecret: string) {
  const url = new URL("https://www.google-analytics.com/debug/mp/collect");
  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", apiSecret);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: "1234567890.1234567890",
      validation_behavior: "ENFORCE_RECOMMENDATIONS",
      events: [{ name: "agenceflow_connection_test", params: { engagement_time_msec: 1 } }],
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error("Google Analytics Measurement Protocol ne repond pas correctement.");
  }
  const messages = data.validationMessages ?? [];
  if (messages.length > 0) {
    throw new Error(messages.map((message: { description?: string }) => message.description).filter(Boolean).join(" "));
  }
}

export async function POST(req: NextRequest) {
  let body: TestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ connected: false, message: "Requete invalide." }, { status: 400 });
  }

  const propertyId = body.propertyId?.trim();
  const measurementId = body.measurementId?.trim();
  const apiSecret = body.apiSecret?.trim();
  const serviceAccountJson = body.serviceAccountJson?.trim();
  const results: string[] = [];
  const errors: string[] = [];
  let analyticsDataConnected = false;
  let measurementProtocolConnected = false;

  if (propertyId && serviceAccountJson) {
    const serviceAccount = parseServiceAccount(serviceAccountJson);
    if (!serviceAccount) {
      errors.push("Lecture GA4 : Service Account JSON invalide.");
    } else {
      try {
        const accessToken = await getAccessToken(serviceAccount);
        await testAnalyticsData(propertyId, accessToken);
        analyticsDataConnected = true;
        results.push("Lecture GA4 OK via Service Account.");
      } catch (error) {
        const message = friendlyGoogleError(error instanceof Error ? error.message : "Impossible de lire Google Analytics.");
        errors.push(`Lecture GA4 bloquee : ${message}`);
      }
    }
  } else {
    errors.push("Lecture GA4 non testee : ajoute Property ID + Service Account JSON.");
  }

  if (measurementId && apiSecret) {
    try {
      await testMeasurementProtocol(measurementId, apiSecret);
      measurementProtocolConnected = true;
      results.push("Measurement Protocol OK.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de valider Measurement Protocol.";
      errors.push(`Measurement Protocol bloque : ${message}`);
    }
  } else {
    errors.push("Measurement Protocol non teste : ajoute Measurement ID + API Secret.");
  }

  if (analyticsDataConnected || measurementProtocolConnected) {
    return NextResponse.json({
      connected: true,
      mode: analyticsDataConnected && measurementProtocolConnected ? "complete" : "partial",
      analyticsDataConnected,
      measurementProtocolConnected,
      message: [...results, ...errors].join(" "),
    });
  }

  return NextResponse.json(
    {
      connected: false,
      analyticsDataConnected,
      measurementProtocolConnected,
      message: `Google Analytics non connecte. ${errors.join(" ")}`,
    },
    { status: 502 }
  );
}
