import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [
      { count: researchRuns },
      { count: topics },
      { count: totalPosts },
      { count: publishedPosts },
      { count: scheduledPosts },
      { count: draftPosts },
      { data: logs },
    ] = await Promise.all([
      supabase.from("research_runs").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("topics").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "published"),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "scheduled"),
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "draft"),
      supabase.from("publish_logs").select("status").order("created_at", { ascending: false }).limit(100),
    ]);

    const successLogs = (logs || []).filter((l: any) => l.status === "success").length;
    const failedLogs = (logs || []).filter((l: any) => l.status === "failed").length;
    const successRate = logs && logs.length > 0 ? Math.round((successLogs / logs.length) * 100) : 0;

    return NextResponse.json({
      researchRuns: researchRuns || 0,
      topics: topics || 0,
      totalPosts: totalPosts || 0,
      publishedPosts: publishedPosts || 0,
      scheduledPosts: scheduledPosts || 0,
      draftPosts: draftPosts || 0,
      successLogs,
      failedLogs,
      successRate,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
