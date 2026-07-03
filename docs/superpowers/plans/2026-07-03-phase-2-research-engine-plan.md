# Phase 2: Research Ingestion Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create Supabase SQL schema initialization script, implement settings configuration resolution utilities, write ingestion services for Google Trends, YouTube RSS, NewsAPI, and blog RSS, orchestrate parallel ingestion, and build the research control UI dashboard.

**Architecture:** Monolithic services triggered via Next.js Route Handlers. External integrations query in parallel with custom fallback mechanisms. Dynamic overrides are read from the `settings` database table.

**Tech Stack:** Next.js 15, TypeScript, Supabase Client, `rss-parser` library.

## Global Constraints
*   Ensure all database tables map to public schema and enforce user-restricted Row Level Security (RLS) policies.
*   Resolve sensitive credentials (like NewsAPI/SerpApi keys) using a dynamic resolver that prioritizes the user's settings database overrides and falls back to environment variables.
*   Implement all APIs using Next.js 15 App Router Route Handlers.

---

### Task 1: SQL Database Schema Setup

**Files:**
*   Create: `schema.sql`

**Interfaces:**
*   Produces: SQL initialization script that defines tables for `settings`, `youtube_channels`, `rss_feeds`, `research_runs`, `topics`, `posts`, and `publish_logs` with corresponding RLS policies.

- [ ] **Step 1: Create schema.sql script**
  Create `E:\social\schema.sql` with:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS public.settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      gemini_api_key TEXT,
      cloudinary_cloud_name TEXT,
      cloudinary_api_key TEXT,
      cloudinary_api_secret TEXT,
      buffer_access_token TEXT,
      default_platform TEXT DEFAULT 'linkedin',
      timezone TEXT DEFAULT 'UTC',
      preferred_tone TEXT DEFAULT 'Professional',
      preferred_language TEXT DEFAULT 'English',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own settings"
      ON public.settings
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

  CREATE TABLE IF NOT EXISTS public.youtube_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      channel_id TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      thumbnail_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, channel_id)
  );

  ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own YouTube channels"
      ON public.youtube_channels
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

  CREATE TABLE IF NOT EXISTS public.rss_feeds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      feed_url TEXT NOT NULL,
      feed_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, feed_url)
  );

  ALTER TABLE public.rss_feeds ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own RSS feeds"
      ON public.rss_feeds
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

  CREATE TABLE IF NOT EXISTS public.research_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      niche TEXT NOT NULL,
      raw_data JSONB NOT NULL,
      summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own research runs"
      ON public.research_runs
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

  CREATE TABLE IF NOT EXISTS public.topics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      research_run_id UUID NOT NULL REFERENCES public.research_runs(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      trend_score INTEGER NOT NULL CHECK (trend_score >= 0 AND trend_score <= 100),
      why_trending TEXT NOT NULL,
      related_keywords TEXT[] DEFAULT '{}',
      suggested_angles JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage topics of their own research runs"
      ON public.topics
      FOR ALL
      USING (
          EXISTS (
              SELECT 1 FROM public.research_runs r
              WHERE r.id = research_run_id AND r.user_id = auth.uid()
          )
      );

  CREATE TABLE IF NOT EXISTS public.posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      content_type TEXT NOT NULL,
      markdown TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      image_url TEXT,
      scheduled_for TIMESTAMPTZ,
      buffer_post_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own posts"
      ON public.posts
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);

  CREATE TABLE IF NOT EXISTS public.publish_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      log_details TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE public.publish_logs ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage publish logs of their own posts"
      ON public.publish_logs
      FOR ALL
      USING (
          EXISTS (
              SELECT 1 FROM public.posts p
              WHERE p.id = post_id AND p.user_id = auth.uid()
          )
      );
  ```

- [ ] **Step 2: Commit file**
  Run:
  ```bash
  git add E:\social\schema.sql
  git commit -m "db: create database initialization schema script"
  ```

---

### Task 2: Settings Utility & Base RSS Ingestion Service

**Files:**
*   Modify: `package.json`
*   Create: `src/utils/settings.ts`
*   Create: `src/services/rss.service.ts`

**Interfaces:**
*   Consumes: `rss-parser` dependency
*   Produces: `getSettingValue` setting retriever, and `rssService.parseFeed(url)` that parses blog XML URLs.

- [ ] **Step 1: Install rss-parser dependency**
  Modify `package.json` to add `"rss-parser": "^3.13.0"` and `@types/rss-parser` to dependencies.
  Ensure dependencies list contains:
  ```json
  "dependencies": {
    "rss-parser": "^3.13.0"
  }
  ```

- [ ] **Step 2: Create Settings Fallback Resolver**
  Create `src/utils/settings.ts` with:
  ```typescript
  import { createClient } from "@/utils/supabase/server";

  export async function getSettingValue(key: string, envFallbackName: string): Promise<string | null> {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: settings, error } = await supabase
          .from("settings")
          .select(key)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!error && settings && settings[key]) {
          return settings[key];
        }
      }
    } catch (e) {
      // Fail silently to environment variables
    }
    return process.env[envFallbackName] || null;
  }
  ```

- [ ] **Step 3: Create RSS Parser Service**
  Create `src/services/rss.service.ts` with:
  ```typescript
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
  ```

- [ ] **Step 4: Commit changes**
  Run:
  ```bash
  git add package.json src/utils/settings.ts src/services/rss.service.ts
  git commit -m "feat: implement settings utility and rss parsing service"
  ```

---

### Task 3: Ingestion Services (Google Trends, News, & YouTube)

**Files:**
*   Create: `src/services/google-trends.service.ts`
*   Create: `src/services/news.service.ts`
*   Create: `src/services/youtube.service.ts`

**Interfaces:**
*   Consumes: `RssService` and settings utilities
*   Produces: Ingestion service classes for YouTube scraping/API, News API, and Trends.

- [ ] **Step 1: Create Google Trends Service**
  Create `src/services/google-trends.service.ts` with:
  ```typescript
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
  ```

- [ ] **Step 2: Create News API Service**
  Create `src/services/news.service.ts` with:
  ```typescript
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
  ```

- [ ] **Step 3: Create YouTube Ingestion Service**
  Create `src/services/youtube.service.ts` with:
  ```typescript
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
  ```

- [ ] **Step 4: Commit changes**
  Run:
  ```bash
  git add src/services/google-trends.service.ts src/services/news.service.ts src/services/youtube.service.ts
  git commit -m "feat: implement Google Trends, NewsAPI, and YouTube RSS-Scraper services"
  ```

---

### Task 4: Ingestion API Endpoint & Orchestration

**Files:**
*   Create: `src/services/research.service.ts`
*   Create: `src/app/api/research/route.ts`

**Interfaces:**
*   Consumes: All Ingestion services and Supabase client
*   Produces: `researchService.runIngestion(niche, userId)` and Route Handler endpoints `/api/research` for triggers.

- [ ] **Step 1: Create Research Service Orchestrator**
  Create `src/services/research.service.ts` with:
  ```typescript
  import { createClient } from "@/utils/supabase/server";
  import { GoogleTrendsService } from "./google-trends.service";
  import { NewsService } from "./news.service";
  import { YouTubeService } from "./youtube.service";
  import { RssService } from "./rss.service";

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

      // Save to database
      const { data: run, error } = await supabase
        .from("research_runs")
        .insert({
          user_id: userId,
          niche: niche,
          raw_data: rawData,
        })
        .select()
        .single();

      if (error) throw error;

      return run;
    }
  }
  ```

- [ ] **Step 2: Create Ingestion API Route**
  Create `src/app/api/research/route.ts` with:
  ```typescript
  import { NextResponse } from "next/server";
  import { createClient } from "@/utils/supabase/server";
  import { ResearchService } from "@/services/research.service";

  export async function POST(req: Request) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const body = await req.json();
      const { niche } = body;

      if (!niche || typeof niche !== "string") {
        return NextResponse.json({ error: "Missing or invalid niche keyword" }, { status: 400 });
      }

      const run = await ResearchService.runIngestion(niche, user.id);

      return NextResponse.json(run);
    } catch (err: any) {
      console.error("Research ingestion endpoint failed:", err);
      return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
  }

  export async function GET() {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: runs, error } = await supabase
        .from("research_runs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return NextResponse.json(runs);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
  }
  ```

- [ ] **Step 3: Commit API endpoint**
  Run:
  ```bash
  git add src/services/research.service.ts src/app/api/research/route.ts
  git commit -m "feat: establish research orchestrator and api route handler"
  ```

---

### Task 5: Research UI and Configurations Dashboard

**Files:**
*   Create: `src/app/api/research/sources/route.ts`
*   Create: `src/app/dashboard/research/page.tsx`

**Interfaces:**
*   Produces: UI inputs to register YouTube channel monitors, customize RSS links, view run summaries, and kick off niche ingestion.

- [ ] **Step 1: Create API for Monitored Sources (POST/DELETE)**
  Create `src/app/api/research/sources/route.ts` with:
  ```typescript
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
  ```

- [ ] **Step 2: Create Research Main Dashboard UI**
  Create `src/app/dashboard/research/page.tsx` with:
  ```typescript
  "use client";

  import React, { useState, useEffect } from "react";
  import { Plus, Trash2, Search, Radio, Youtube, RotateCw, FileJson } from "lucide-react";
  import { createClient } from "@/utils/supabase/client";

  export default function ResearchPage() {
    const [niche, setNiche] = useState("");
    const [loading, setLoading] = useState(false);
    const [runs, setRuns] = useState<any[]>([]);
    const [selectedRun, setSelectedRun] = useState<any | null>(null);

    // Source Configuration state
    const [activeTab, setActiveTab] = useState<"youtube" | "rss">("youtube");
    const [channels, setChannels] = useState<any[]>([]);
    const [feeds, setFeeds] = useState<any[]>([]);

    const [newChannelName, setNewChannelName] = useState("");
    const [newChannelId, setNewChannelId] = useState("");
    const [newFeedName, setNewFeedName] = useState("");
    const [newFeedUrl, setNewFeedUrl] = useState("");

    const supabase = createClient();

    const loadData = async () => {
      // Fetch runs
      const resRuns = await fetch("/api/research");
      const runsData = await resRuns.json();
      if (Array.isArray(runsData)) setRuns(runsData);

      // Fetch monitored sources from DB
      const { data: yt } = await supabase.from("youtube_channels").select("*");
      const { data: rss } = await supabase.from("rss_feeds").select("*");
      if (yt) setChannels(yt);
      if (rss) setFeeds(rss);
    };

    useEffect(() => {
      loadData();
    }, []);

    const handleRunResearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!niche) return;
      setLoading(true);

      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ niche }),
        });
        const data = await res.json();
        if (data.id) {
          setRuns([data, ...runs]);
          setNiche("");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const handleAddSource = async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = activeTab === "youtube" 
        ? { type: "youtube", name: newChannelName, channelId: newChannelId }
        : { type: "rss", name: newFeedName, url: newFeedUrl };

      try {
        const res = await fetch("/api/research/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.id) {
          if (activeTab === "youtube") {
            setChannels([...channels, data]);
            setNewChannelName("");
            setNewChannelId("");
          } else {
            setFeeds([...feeds, data]);
            setNewFeedName("");
            setNewFeedUrl("");
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    const handleDeleteSource = async (id: string) => {
      try {
        const res = await fetch(`/api/research/sources?id=${id}&type=${activeTab}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (data.success) {
          if (activeTab === "youtube") {
            setChannels(channels.filter((c) => c.id !== id));
          } else {
            setFeeds(feeds.filter((f) => f.id !== id));
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    return (
      <div className="max-w-6xl mx-auto space-y-8 text-zinc-300">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Research Engine</h1>
          <p className="text-sm text-zinc-400 mt-1">Ingest trends and configure tracking sources</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* COLUMN 1: ANALYZER */}
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-violet-500" />
                Analyze Niche
              </h2>
              <form onSubmit={handleRunResearch} className="space-y-4">
                <div>
                  <input
                    type="text"
                    required
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="Enter niche keyword (e.g. Artificial Intelligence)"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      Ingesting sources...
                    </>
                  ) : (
                    "Trigger Research Ingestion"
                  )}
                </button>
              </form>
            </div>

            {/* PAST RUNS */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg space-y-4">
              <h2 className="text-lg font-semibold text-white">Previous Research Runs</h2>
              {runs.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">No runs executed yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {runs.map((run) => (
                    <div
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      className={`p-4 rounded-lg border text-left cursor-pointer transition-colors ${
                        selectedRun?.id === run.id
                          ? "border-violet-500 bg-violet-950/20"
                          : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-white">{run.niche}</span>
                        <span className="text-xs text-zinc-500">
                          {new Date(run.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-4 mt-2 text-xs text-zinc-400">
                        <span>YT: {run.raw_data?.youtube?.length || 0}</span>
                        <span>News: {run.raw_data?.news?.length || 0}</span>
                        <span>Trends: {run.raw_data?.google_trends?.length || 0}</span>
                        <span>RSS: {run.raw_data?.rss?.length || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2: SOURCES CONFIG */}
          <div className="space-y-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg space-y-4">
              <div className="flex border-b border-zinc-800">
                <button
                  onClick={() => setActiveTab("youtube")}
                  className={`flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    activeTab === "youtube"
                      ? "border-violet-500 text-white"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Youtube className="h-4 w-4" />
                  YouTube Channels
                </button>
                <button
                  onClick={() => setActiveTab("rss")}
                  className={`flex-1 pb-3 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    activeTab === "rss"
                      ? "border-violet-500 text-white"
                      : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <Radio className="h-4 w-4" />
                  Blog RSS Feeds
                </button>
              </div>

              {/* LIST & ADD SOURCE FOR YOUTUBE */}
              {activeTab === "youtube" ? (
                <div className="space-y-4">
                  <form onSubmit={handleAddSource} className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="Channel Name"
                      className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newChannelId}
                        onChange={(e) => setNewChannelId(e.target.value)}
                        placeholder="Channel ID"
                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-500"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {channels.map((chan) => (
                      <div key={chan.id} className="flex justify-between items-center p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-sm">
                        <div>
                          <span className="font-semibold text-white block">{chan.channel_name}</span>
                          <span className="text-xs text-zinc-500">{chan.channel_id}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteSource(chan.id)}
                          className="text-zinc-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* LIST & ADD SOURCE FOR RSS */
                <div className="space-y-4">
                  <form onSubmit={handleAddSource} className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={newFeedName}
                      onChange={(e) => setNewFeedName(e.target.value)}
                      placeholder="Blog Name"
                      className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required
                        value={newFeedUrl}
                        onChange={(e) => setNewFeedUrl(e.target.value)}
                        placeholder="Feed URL"
                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-500"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {feeds.map((feed) => (
                      <div key={feed.id} className="flex justify-between items-center p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-sm">
                        <div className="truncate pr-4">
                          <span className="font-semibold text-white block truncate">{feed.feed_name}</span>
                          <span className="text-xs text-zinc-500 block truncate">{feed.feed_url}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteSource(feed.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RAW DATA MODAL VIEWER */}
            {selectedRun && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileJson className="h-5 w-5 text-violet-500" />
                    Data: {selectedRun.niche}
                  </h2>
                  <button
                    onClick={() => setSelectedRun(null)}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    Close
                  </button>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 max-h-72 overflow-auto">
                  <pre className="text-xs text-zinc-400 text-left font-mono">
                    {JSON.stringify(selectedRun.raw_data, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit dashboard UI changes**
  Run:
  ```bash
  git add src/app/api/research/sources/route.ts src/app/dashboard/research/page.tsx
  git commit -m "feat: add sources manager endpoint and research main dashboard UI"
  ```
