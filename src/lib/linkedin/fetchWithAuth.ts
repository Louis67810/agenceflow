"use client";

import { getAccessToken } from "@/lib/supabase/client";

export async function linkedinFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}
