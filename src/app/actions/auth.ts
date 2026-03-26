"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(email: string, password: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Récupère le rôle pour rediriger
  const { data: profile } = await supabase
    .from("agency_profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const role = profile?.role ?? "admin";
  return { redirectTo: `/${role}` };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
