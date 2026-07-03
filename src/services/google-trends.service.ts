import Parser from "rss-parser";
import { getSettingValue } from "@/utils/settings";

const parser = new Parser();

export interface TrendTopic {
  title: string;
  searches: string;
  source: string;
}

export class GoogleTrendsService {
  static async fetchTrends(): Promise<TrendTopic[]> {
    const serpApiKey = await getSettingValue("serp_api_key", "SERP_API_KEY");

    if (serpApiKey) {
      try {
        const res = await fetch(
          `https://serpapi.com/search.json?engine=google_trends&api_key=${serpApiKey}`
        );
        const data = await res.json();
        const trends = data.trends || [];
        return trends.slice(0, 15).map((t: any) => ({
          title: t.query || t.title || "",
          searches: t.volume || "Unknown",
          source: "SerpApi (Google Trends)",
        }));
      } catch (e) {
        console.error("SerpApi Trends fetch failed, falling back to RSS:", e);
      }
    }

    // Default Daily RSS fallback
    try {
      const feed = await parser.parseURL("https://trends.google.com/trends/trendingsearches/daily/rss?geo=US");
      return (feed.items || []).slice(0, 15).map((item: any) => ({
        title: item.title || "",
        searches: item.ht?.approx_traffic || "10K+ searches",
        source: "Google Trends RSS",
      }));
    } catch (err) {
      console.error("Google Trends RSS parsing failed:", err);
      return [];
    }
  }
}
