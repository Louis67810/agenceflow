import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LeadMagnetClient from "./_client";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_magnets")
    .select("title, subtitle")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  return {
    title: data?.title ?? "Ressource gratuite",
    description: data?.subtitle ?? "",
  };
}

export default async function LeadMagnetPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: magnet } = await supabase
    .from("lead_magnets")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .single();

  if (!magnet) {
    notFound();
  }

  return <LeadMagnetClient magnet={magnet} />;
}
