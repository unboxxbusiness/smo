import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { BufferService } from "@/services/buffer.service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { id } = await params;

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { profileIds, scheduledAt, publishNow } = body;

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json({ error: "No profile IDs provided" }, { status: 400 });
    }

    // Fetch post details
    const { data: post, error: postErr } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (postErr || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    let status = "success";
    let logDetails = "";
    let bufferResponse: any = null;

    try {
      bufferResponse = await BufferService.createUpdate(
        profileIds,
        post.markdown,
        post.image_url || undefined,
        scheduledAt,
        publishNow
      );
      logDetails = JSON.stringify(bufferResponse);
    } catch (bufErr: any) {
      status = "failed";
      logDetails = bufErr.message || "Unknown Buffer API failure";
    }

    // Log publishing event
    await supabase.from("publish_logs").insert({
      post_id: id,
      status,
      log_details: logDetails,
    });

    if (status === "failed") {
      return NextResponse.json({ error: logDetails }, { status: 500 });
    }

    // Update post status
    const nextStatus = publishNow ? "published" : "scheduled";
    const { data: updatedPost, error: updateErr } = await supabase
      .from("posts")
      .update({
        status: nextStatus,
        scheduled_for: publishNow ? null : scheduledAt,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return NextResponse.json(updatedPost);
  } catch (err: any) {
    console.error("Publish handler failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
