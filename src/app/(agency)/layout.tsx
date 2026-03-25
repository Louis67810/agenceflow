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

  // Récupère le profil (rôle + nom) depuis agency_profiles
  const { data: profile } = await supabase
    .from("agency_profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  const role: AgencyRole = (profile?.role as AgencyRole) ?? "admin";
  const userName: string =
    profile?.name ?? user.email?.split("@")[0] ?? "Utilisateur";

  return (
    <div className="min-h-screen bg-gray-50">
      <AgencySidebar role={role} userName={userName} />
      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  );
}
