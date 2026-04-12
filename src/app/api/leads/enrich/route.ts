import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { lead_id, company, address } = body;

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_MAPS_API_KEY non configurée" },
        { status: 500 }
      );
    }

    const query = encodeURIComponent(`${company}${address ? " " + address : ""}`);
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=place_id,name,formatted_address,website,international_phone_number,rating,user_ratings_total,business_status&key=${apiKey}`
    );

    if (!searchRes.ok) {
      return NextResponse.json({ error: "Erreur Google Maps" }, { status: 500 });
    }

    const searchData = await searchRes.json();
    const place = searchData.candidates?.[0];

    if (!place) {
      return NextResponse.json({ enriched: null, message: "Aucun résultat trouvé" });
    }

    const enrichment = {
      google_maps_name: place.name,
      google_maps_address: place.formatted_address,
      google_maps_website: place.website,
      google_maps_phone: place.international_phone_number,
      google_maps_rating: place.rating,
      google_maps_reviews: place.user_ratings_total,
      google_maps_status: place.business_status,
      google_maps_place_id: place.place_id,
    };

    // Update the lead with enrichment data
    if (lead_id) {
      const { data: currentLead } = await supabase
        .from("leads")
        .select("metadata")
        .eq("id", lead_id)
        .single();

      await supabase
        .from("leads")
        .update({
          metadata: { ...(currentLead?.metadata ?? {}), ...enrichment },
          ...(place.international_phone_number ? { phone: place.international_phone_number } : {}),
        })
        .eq("id", lead_id);
    }

    return NextResponse.json({ enriched: enrichment });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
