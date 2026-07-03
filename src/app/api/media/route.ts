import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { CloudinaryService } from "@/services/cloudinary.service";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: media, error } = await supabase
      .from("media")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(media);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert file stream to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Cloudinary
    const { url, publicId } = await CloudinaryService.uploadBuffer(buffer, file.type);

    // Save database row
    const { data: mediaRow, error } = await supabase
      .from("media")
      .insert({
        user_id: user.id,
        url,
        public_id: publicId,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(mediaRow);
  } catch (err: any) {
    console.error("Upload handler failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
