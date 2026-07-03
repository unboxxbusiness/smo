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
    const { topicId, tone, audience } = body;

    if (!topicId || !tone) {
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

    // Generate all post formats
    const formats = await GeminiService.generateAllPosts(
      topic.title,
      topic.why_trending,
      tone,
      audience || "General Audience"
    );

    // Save all of them as draft posts in parallel (ponytail: quick parallel inserts)
    const insertPromises = Object.entries(formats).map(([platform, markdown]) => {
      return supabase.from("posts").insert({
        user_id: user.id,
        topic_id: topicId,
        title: topic.title,
        content_type: platform,
        markdown,
        status: "draft",
      }).select().single();
    });

    const results = await Promise.all(insertPromises);
    const createdPosts = results
      .filter((res) => res.data)
      .map((res) => res.data);

    return NextResponse.json({ posts: createdPosts });
  } catch (err: any) {
    console.error("Content generation failed:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
