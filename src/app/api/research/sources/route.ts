import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type, name, url, channelId } = body;

    if (type === "rss") {
      if (!name || !url) return NextResponse.json({ error: "Missing RSS name or url" }, { status: 400 });
      const { data, error } = await supabase
        .from("rss_feeds")
        .insert({ user_id: user.id, feed_name: name, feed_url: url })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    } else if (type === "youtube") {
      if (!name || !channelId) return NextResponse.json({ error: "Missing YouTube channel ID or name" }, { status: 400 });
      const { data, error } = await supabase
        .from("youtube_channels")
        .insert({ user_id: user.id, channel_name: name, channel_id: channelId })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");

    if (!id || !type) return NextResponse.json({ error: "Missing details" }, { status: 400 });

    if (type === "rss") {
      const { error } = await supabase.from("rss_feeds").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    } else if (type === "youtube") {
      const { error } = await supabase.from("youtube_channels").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
