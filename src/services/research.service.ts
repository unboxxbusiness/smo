import { createClient } from "@/utils/supabase/server";
import { GoogleTrendsService } from "./google-trends.service";
import { NewsService } from "./news.service";
import { YouTubeService } from "./youtube.service";
import { RssService } from "./rss.service";
import { GeminiService } from "./gemini.service";

export class ResearchService {
  static async runIngestion(niche: string, userId: string) {
    const supabase = await createClient();

    // Retrieve configured RSS feeds & Youtube channels
    const [rssResult, ytResult] = await Promise.all([
      supabase.from("rss_feeds").select("feed_url, feed_name").eq("user_id", userId),
      supabase.from("youtube_channels").select("channel_id, channel_name").eq("user_id", userId),
    ]);

    const rssFeeds = rssResult.data || [];
    const ytChannels = ytResult.data || [];

    // Run Ingestions in parallel
    const trendsPromise = GoogleTrendsService.fetchTrends();
    const newsPromise = NewsService.fetchNews(niche);

    const ytPromises = ytChannels.map((c) =>
      YouTubeService.fetchChannelVideos(c.channel_id, c.channel_name)
    );
    const rssPromises = rssFeeds.map((f) =>
      RssService.parseFeed(f.feed_url, f.feed_name)
    );

    const results = await Promise.allSettled([
      trendsPromise,
      newsPromise,
      Promise.all(ytPromises),
      Promise.all(rssPromises),
    ]);

    const trendsData = results[0].status === "fulfilled" ? results[0].value : [];
    const newsData = results[1].status === "fulfilled" ? results[1].value : [];
    const ytData = results[2].status === "fulfilled" ? results[2].value.flat() : [];
    const rssData = results[3].status === "fulfilled" ? results[3].value.flat() : [];

    const rawData = {
      google_trends: trendsData,
      news: newsData,
      youtube: ytData,
      rss: rssData,
    };

    // Call Gemini to generate summary and extract topics
    let summary = "Summary generation failed.";
    let topics: any[] = [];
    try {
      summary = await GeminiService.generateSummary(rawData);
    } catch (sumErr) {
      console.error("Gemini summary failed:", sumErr);
    }

    try {
      topics = await GeminiService.extractRankedTopics(rawData);
    } catch (topErr) {
      console.error("Gemini topic extraction failed:", topErr);
    }

    // Save Research Run
    const { data: run, error: runErr } = await supabase
      .from("research_runs")
      .insert({
        user_id: userId,
        niche: niche,
        raw_data: rawData,
        summary: summary,
      })
      .select()
      .single();

    if (runErr) throw runErr;

    // Save Topics
    const topicsToInsert = topics.map((t) => ({
      research_run_id: run.id,
      title: t.title,
      trend_score: t.trend_score,
      why_trending: t.why_trending,
      related_keywords: t.related_keywords,
      suggested_angles: t.suggested_angles,
      confidence_score: t.confidence_score || 0,
      virality_score: t.virality_score || 0,
      student_impact_score: t.student_impact_score || 0,
      seo_opportunity_score: t.seo_opportunity_score || 0,
    }));

    if (topicsToInsert.length > 0) {
      const { error: topicsErr } = await supabase.from("topics").insert(topicsToInsert);
      if (topicsErr) throw topicsErr;
    }

    // Query complete run with topics
    const { data: completeRun } = await supabase
      .from("research_runs")
      .select("*, topics(*)")
      .eq("id", run.id)
      .single();

    return completeRun || run;
  }
}
