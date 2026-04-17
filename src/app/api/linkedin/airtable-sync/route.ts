import { NextRequest, NextResponse } from "next/server";

interface ProspectRecord {
  id: string;
  leadId?: string;
  name: string;
  actionType: string;
  status: string;
  generatedMessage: string;
  customMessage?: string;
  isManual?: boolean;
  context?: string;
  profileUrl?: string;
  siteUrl?: string;
  createdAt: string;
  sentAt?: string;
  conversationLength?: number;
  skeletonId?: string;
}

interface AirtableSyncRequest {
  prospects: ProspectRecord[];
  airtableKey: string;
  baseId: string;
  tableName: string;
  pruneMissing?: boolean;
}

interface AirtableField {
  prospect_id: string;
  Nom: string;
  Action: string;
  Statut: string;
  Message: string;
  Contexte: string;
  "Profil LinkedIn": string;
  "Site web": string;
  "Créé le": string | null;
  "Envoyé le": string | null;
  "Nb messages conversation": number;
  Manuel: boolean;
}

function formatAirtableError(errText: string, tableName: string, baseId: string) {
  if (errText.includes('"error":"NOT_FOUND"') || errText.includes('"error": "NOT_FOUND"')) {
    return `Airtable introuvable. Vérifiez le Base ID (${baseId}), le nom exact de la table ("${tableName}") et que le token a bien accès à cette base.`;
  }

  if (errText.includes("INVALID_PERMISSIONS")) {
    return "Permissions Airtable insuffisantes. Vérifiez que le token a les droits data.records:read et data.records:write sur cette base.";
  }

  if (errText.includes("INVALID_VALUE_FOR_COLUMN")) {
    return `Valeur Airtable invalide pour une colonne. Vérifiez surtout les types des champs Date, URL, Number et Checkbox dans la table "${tableName}". Détail: ${errText}`;
  }

  return `Airtable API: ${errText}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AirtableSyncRequest;
    const { prospects, airtableKey, baseId, tableName, pruneMissing } = body;

    if (!airtableKey || !baseId || !tableName) {
      return NextResponse.json({ error: "Configuration Airtable incomplète (clé, base ID, nom de table)." }, { status: 400 });
    }

    const baseUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    const headers = {
      Authorization: `Bearer ${airtableKey}`,
      "Content-Type": "application/json",
    };

    if (!prospects?.length) {
      if (pruneMissing) {
        const remoteRes = await fetch(`${baseUrl}?fields[]=prospect_id`, { headers });
        if (!remoteRes.ok) {
          const errText = await remoteRes.text();
          return NextResponse.json({ error: formatAirtableError(errText, tableName, baseId) }, { status: 500 });
        }

        const remoteData = await remoteRes.json();
        const recordIdsToDelete = (remoteData.records ?? [])
          .filter((record: { id: string; fields?: { prospect_id?: string } }) => !!record.fields?.prospect_id)
          .map((record: { id: string }) => record.id);

        const BATCH_SIZE = 10;
        let deleted = 0;
        for (let i = 0; i < recordIdsToDelete.length; i += BATCH_SIZE) {
          const batchIds = recordIdsToDelete.slice(i, i + BATCH_SIZE);
          const deleteUrl = `${baseUrl}?${batchIds.map((id) => `records[]=${encodeURIComponent(id)}`).join("&")}`;
          const deleteRes = await fetch(deleteUrl, { method: "DELETE", headers });
          if (!deleteRes.ok) {
            const errText = await deleteRes.text();
            return NextResponse.json({ error: formatAirtableError(errText, tableName, baseId) }, { status: 500 });
          }
          deleted += batchIds.length;
        }

        return NextResponse.json({
          synced: deleted,
          created: 0,
          updated: 0,
          deleted,
          message: `0 créés, 0 mis à jour, ${deleted} supprimés`,
        });
      }

      return NextResponse.json({ synced: 0, created: 0, updated: 0, deleted: 0 });
    }

    // Use Airtable's upsert endpoint (available on all plans)
    // Batch in groups of 10 (Airtable limit per request)
    const BATCH_SIZE = 10;
    let created = 0;
    let updated = 0;

    for (let i = 0; i < prospects.length; i += BATCH_SIZE) {
      const batch = prospects.slice(i, i + BATCH_SIZE);

      const records = batch.map((p) => ({
        fields: {
          prospect_id: p.id,
          Nom: p.name,
          Action: p.actionType === "liked" ? "Like"
                : p.actionType === "commented" ? "Commentaire"
                : p.actionType === "visited_profile" ? "Visite profil"
                : "Autre",
          Statut: p.status,
          Message: p.customMessage || p.generatedMessage,
          Contexte: p.context || "",
          "Profil LinkedIn": p.profileUrl || "",
          "Site web": p.siteUrl || "",
          "Créé le": p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : null,
          "Envoyé le": p.sentAt ? new Date(p.sentAt).toISOString().split("T")[0] : null,
          "Nb messages conversation": p.conversationLength || 0,
          Manuel: !!p.isManual,
        } as AirtableField,
      }));

      const res = await fetch(baseUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          records,
          performUpsert: { fieldsToMergeOn: ["prospect_id"] },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        // If upsert not supported, fall back to individual create
        if (res.status === 422 || res.status === 400) {
          return NextResponse.json({
            error: formatAirtableError(errText, tableName, baseId),
          }, { status: 400 });
        }
        return NextResponse.json({ error: formatAirtableError(errText, tableName, baseId) }, { status: 500 });
      }

      const data = await res.json();
      if (data.createdRecords) created += data.createdRecords.length;
      if (data.updatedRecords) updated += data.updatedRecords.length;
    }

    let deleted = 0;
    if (pruneMissing) {
      const remoteRes = await fetch(`${baseUrl}?fields[]=prospect_id`, { headers });
      if (!remoteRes.ok) {
        const errText = await remoteRes.text();
        return NextResponse.json({ error: formatAirtableError(errText, tableName, baseId) }, { status: 500 });
      }

      const remoteData = await remoteRes.json();
      const localIds = new Set(prospects.map((p) => p.id));
      const recordIdsToDelete = (remoteData.records ?? [])
        .filter((record: { id: string; fields?: { prospect_id?: string } }) => {
          const prospectId = record.fields?.prospect_id;
          return prospectId && !localIds.has(prospectId);
        })
        .map((record: { id: string }) => record.id);

      for (let i = 0; i < recordIdsToDelete.length; i += BATCH_SIZE) {
        const batchIds = recordIdsToDelete.slice(i, i + BATCH_SIZE);
        const deleteUrl = `${baseUrl}?${batchIds.map((id) => `records[]=${encodeURIComponent(id)}`).join("&")}`;
        const deleteRes = await fetch(deleteUrl, { method: "DELETE", headers });
        if (!deleteRes.ok) {
          const errText = await deleteRes.text();
          return NextResponse.json({ error: formatAirtableError(errText, tableName, baseId) }, { status: 500 });
        }
        deleted += batchIds.length;
      }
    }

    return NextResponse.json({
      synced: created + updated + deleted,
      created,
      updated,
      deleted,
      message: `${created} créés, ${updated} mis à jour, ${deleted} supprimés`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
