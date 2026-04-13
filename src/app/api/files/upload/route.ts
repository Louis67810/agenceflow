import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const projectId = formData.get("project_id") as string | null;

    if (!file || !projectId) {
      return NextResponse.json({ error: "file et project_id requis" }, { status: 400 });
    }

    const supabase = admin();
    const ext      = file.name.split(".").pop() ?? "bin";
    const path     = `${projectId}/${Date.now()}-${file.name}`;

    // Upload dans le bucket "project-files"
    const arrayBuffer = await file.arrayBuffer();
    const buffer      = Buffer.from(arrayBuffer);

    const { error: storageError } = await supabase.storage
      .from("project-files")
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (storageError) {
      // Bucket peut-être inexistant : on crée et on réessaie
      await supabase.storage.createBucket("project-files", { public: true });
      const { error: retryErr } = await supabase.storage
        .from("project-files")
        .upload(path, buffer, { contentType: file.type, upsert: false });
      if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage
      .from("project-files")
      .getPublicUrl(path);

    // Détecter type
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const type    = isImage ? "image" : isVideo ? "video" : ext;

    // Sauvegarder en base
    const { data: fileRecord, error: dbError } = await supabase
      .from("project_files")
      .insert({ project_id: projectId, name: file.name, url: publicUrl, type })
      .select("id, name, url, type, created_at")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ file: fileRecord });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
