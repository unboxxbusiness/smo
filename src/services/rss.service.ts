import Parser from "rss-parser";

const parser = new Parser();

export interface RssArticle {
  title: string;
  link: string;
  pubDate?: string;
  snippet: string;
  sourceName: string;
}

export class RssService {
  static async parseFeed(url: string, sourceName: string): Promise<RssArticle[]> {
    try {
      const feed = await parser.parseURL(url);
      return (feed.items || []).slice(0, 10).map((item) => ({
        title: item.title || "No Title",
        link: item.link || "",
        pubDate: item.pubDate,
        snippet: item.contentSnippet || item.content || "",
        sourceName: sourceName,
      }));
    } catch (err) {
      console.error(`Failed to parse RSS feed at ${url}:`, err);
      return [];
    }
  }
}
