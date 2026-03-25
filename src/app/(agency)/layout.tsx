import type { ReactNode } from "react";
import { AgencySidebar } from "@/components/agency/AgencySidebar";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AgencyRole } from "@/types/agency";

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Tente de récupérer le profil — fallback silencieux si la table n'existe pas encore
  let role: AgencyRole = "admin";
  let userName = user.email?.split("@")[0] ?? "Utilisateur";

  try {
    const { data: profile } = await supabase
      .from("agency_profiles")
      .select("role, name")
      .eq("id", user.id)
      .single();

    if (profile) {
      role = profile.role as AgencyRole;
      userName = profile.name ?? userName;
    }
  } catch {
    // Table agency_profiles pas encore créée — on continue avec les valeurs par défaut
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AgencySidebar role={role} userName={userName} />
      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  );
}
