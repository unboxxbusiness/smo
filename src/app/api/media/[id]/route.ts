import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { CloudinaryService } from "@/services/cloudinary.service";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { id } = await params;

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch the media public_id from DB first
    const { data: media, error: fetchErr } = await supabase
      .from("media")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !media) {
      return NextResponse.json({ error: "Media resource not found" }, { status: 404 });
    }

    // Delete from Cloudinary
    await CloudinaryService.deleteAsset(media.public_id);

    // Delete from Supabase
    const { error: deleteErr } = await supabase
      .from("media")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
