type PostgrestLikeError = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

export function getMissingSchemaColumn(error: unknown): string | null {
  const candidate = error as PostgrestLikeError | null | undefined;
  const message = [candidate?.message, candidate?.details, candidate?.hint].filter(Boolean).join(" ");

  const schemaCacheMatch = message.match(/Could not find the '([^']+)' column/i);
  if (schemaCacheMatch?.[1]) return schemaCacheMatch[1];

  const postgresMatch = message.match(
    /column\s+((?:"?[A-Za-z_][\w]*"?\.)*"?[A-Za-z_][\w]*"?)\s+does not exist/i
  );
  if (!postgresMatch?.[1]) return null;

  const parts = postgresMatch[1].split(".");
  return parts[parts.length - 1]?.replaceAll('"', "") ?? null;
}
