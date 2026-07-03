import Parser from "rss-parser";
import { getSettingValue } from "@/utils/settings";

const parser = new Parser();

export interface YouTubeVideo {
  title: string;
  videoUrl: string;
  pubDate: string;
  description: string;
  viewCount: number;
  channelName: string;
}

export class YouTubeService {
  static async fetchChannelVideos(channelId: string, channelName: string): Promise<YouTubeVideo[]> {
    try {
      const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      const feed = await parser.parseURL(feedUrl);
      const videos = (feed.items || []).slice(0, 5).map((item: any) => ({
        title: item.title || "",
        videoUrl: item.link || "",
        pubDate: item.pubDate || "",
        description: item.contentSnippet || item.content || "",
        viewCount: 0,
        channelName: channelName,
      }));

      const ytApiKey = await getSettingValue("youtube_api_key", "YOUTUBE_API_KEY");

      if (ytApiKey) {
        try {
          const videoIds = videos.map((v) => {
            const urlParts = v.videoUrl.split("v=");
            return urlParts[urlParts.length - 1];
          }).join(",");

          const res = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${ytApiKey}`
          );
          const stats = await res.json();
          const items = stats.items || [];

          videos.forEach((v) => {
            const urlParts = v.videoUrl.split("v=");
            const id = urlParts[urlParts.length - 1];
            const match = items.find((item: any) => item.id === id);
            if (match) {
              v.viewCount = parseInt(match.statistics?.viewCount || "0", 10);
            }
          });
          return videos;
        } catch (apiErr) {
          console.error("YouTube Data API fetch failed, trying scraper fallback:", apiErr);
        }
      }

      // Regex Scraper Fallback
      for (const video of videos) {
        try {
          const htmlRes = await fetch(video.videoUrl);
          const htmlText = await htmlRes.text();
          
          // Regex to parse view count from script payload inside Youtube page source
          const match = htmlText.match(/"viewCount":"(\d+)"/);
          if (match && match[1]) {
            video.viewCount = parseInt(match[1], 10);
          } else {
            // Alternative regex block match
            const matchAlt = htmlText.match(/"videoViewCountRenderer":\s*\{\s*"viewCount":\s*\{\s*"simpleText":\s*"([\d,]+)/);
            if (matchAlt && matchAlt[1]) {
              video.viewCount = parseInt(matchAlt[1].replace(/,/g, ""), 10);
            }
          }
        } catch (scrapeErr) {
          console.error(`Failed to scrape views for ${video.videoUrl}:`, scrapeErr);
        }
      }

      return videos;
    } catch (err) {
      console.error(`Failed YouTube Ingestion for ${channelName} (${channelId}):`, err);
      return [];
    }
  }
}
