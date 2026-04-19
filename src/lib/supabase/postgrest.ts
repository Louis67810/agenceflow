type PostgrestLikeError = {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

export function getMissingSchemaColumn(error: unknown): string | null {
  const candidate = error as PostgrestLikeError | null | undefined;
  const message = [candidate?.message, candidate?.details, candidate?.hint].filter(Boolean).join(" ");
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
}
