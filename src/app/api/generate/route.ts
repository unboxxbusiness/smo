import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { GeminiService } from "@/services/gemini.service";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { topicId, platform, tone, audience } = body;

    if (!topicId || !platform || !tone || !audience) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch topic details
    const { data: topic, error: topicErr } = await supabase
      .from("topics")
      .select("*")
      .eq("id", topicId)
      .single();

    if (topicErr || !topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    // Generate post markdown
    const markdown = await GeminiService.generatePost(
      topic.title,
      topic.why_trending,
      platform,
      tone,
      audience
    );

    // Save post as draft
    const { data: post, error: postErr } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        topic_id: topicId,
        title: topic.title,
        content_type: platform,
        markdown,
        status: "draft",
      })
      .select()
      .single();

    if (postErr) throw postErr;

    return NextResponse.json(post);
  } catch (err: any) {
    console.error("Content generation failed:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
