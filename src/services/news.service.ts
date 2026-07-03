import { getSettingValue } from "@/utils/settings";

export interface NewsArticle {
  title: string;
  url: string;
  publishedAt: string;
  description: string;
  source: string;
}

export class NewsService {
  static async fetchNews(query: string): Promise<NewsArticle[]> {
    const apiKey = await getSettingValue("news_api_key", "NEWS_API_KEY");
    if (!apiKey) {
      console.warn("NewsAPI key not configured.");
      return [];
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://newsapi.org/v2/everything?q=${encodedQuery}&sortBy=popularity&pageSize=15&apiKey=${apiKey}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== "ok") {
        throw new Error(data.message || "Failed to fetch news");
      }

      return (data.articles || []).map((art: any) => ({
        title: art.title || "",
        url: art.url || "",
        publishedAt: art.publishedAt || "",
        description: art.description || "",
        source: art.source?.name || "News",
      }));
    } catch (err) {
      console.error("NewsAPI request failed:", err);
      return [];
    }
  }
}
