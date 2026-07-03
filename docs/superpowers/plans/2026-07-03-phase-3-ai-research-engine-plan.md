# Phase 3: AI Research Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Gemini SDK (`@google/genai`), configure dynamic model loading, refactor research orchestrator to automatically extract summaries and ranked topics into Supabase tables, create the `/api/generate` Route Handler, and build the base Content Studio page.

**Architecture:** Monolithic AI services executing structured JSON schemas. Content generation inputs are handled via Next.js Route Handlers and saved directly as drafts.

**Tech Stack:** Next.js 15, TypeScript, Gemini SDK (`@google/genai`), Supabase Client.

## Global Constraints
*   Use official `@google/genai` package for all Gemini API calls.
*   Enforce structured outputs via JSON schema validation during topic ranking.
*   Return clean raw Markdown blocks for draft generation (no wrapper markdown backticks).

---

### Task 1: Gemini SDK Integration & Service Setup

**Files:**
*   Modify: `package.json`
*   Create: `src/services/gemini.service.ts`

**Interfaces:**
*   Consumes: `@google/genai` package
*   Produces: `GeminiService.generateSummary`, `GeminiService.extractRankedTopics`, and `GeminiService.generatePost` helpers.

- [ ] **Step 1: Install Gemini SDK dependency**
  Modify E:\social\package.json dependencies block to include:
  `"@google/genai": "^0.1.1"`
  Ensure package.json remains valid JSON.

- [ ] **Step 2: Create Gemini Service**
  Create `E:\social\src\services\gemini.service.ts` with:
  ```typescript
  import { GoogleGenAI, Type, Schema } from "@google/genai";
  import { getSettingValue } from "@/utils/settings";

  export interface RankedTopicInput {
    title: string;
    trend_score: number;
    why_trending: string;
    related_keywords: string[];
    suggested_angles: { platform: string; angle_description: string }[];
  }

  export class GeminiService {
    private static async getClient(): Promise<{ ai: GoogleGenAI; model: string }> {
      const apiKey = await getSettingValue("gemini_api_key", "GEMINI_API_KEY");
      const model = await getSettingValue("gemini_model", "GEMINI_MODEL") || "gemini-2.5-flash";

      if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
      }

      return {
        ai: new GoogleGenAI({ apiKey }),
        model,
      };
    }

    static async generateSummary(rawData: any): Promise<string> {
      const { ai, model } = await this.getClient();
      const prompt = `You are a research analyst. Read this JSON dataset of trending queries, news articles, and youtube video stats:
  ${JSON.stringify(rawData)}

  Write a concise 2-3 paragraph summary of the trending themes, insights, and content opportunities.`;

      const res = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      return res.text || "No summary generated.";
    }

    static async extractRankedTopics(rawData: any): Promise<RankedTopicInput[]> {
      const { ai, model } = await this.getClient();
      const prompt = `Analyze this research dataset and extract the top 5 trending content opportunities:
  ${JSON.stringify(rawData)}

  Rank them by trend score (0-100) and suggest platform angles.`;

      const schema: Schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            trend_score: { type: Type.INTEGER },
            why_trending: { type: Type.STRING },
            related_keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            suggested_angles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  platform: { type: Type.STRING },
                  angle_description: { type: Type.STRING },
                },
                required: ["platform", "angle_description"],
              },
            },
          },
          required: ["title", "trend_score", "why_trending", "related_keywords", "suggested_angles"],
        },
      };

      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });

      if (!res.text) return [];
      return JSON.parse(res.text) as RankedTopicInput[];
    }

    static async generatePost(topic: string, description: string, platform: string, tone: string, audience: string): Promise<string> {
      const { ai, model } = await this.getClient();
      const prompt = `Write a marketing post or article on:
  Topic: ${topic}
  Why Trending: ${description}
  Target Platform: ${platform}
  Target Tone: ${tone}
  Target Audience: ${audience}

  Write it strictly in raw Markdown format. Do not write backticks around the markdown content or meta introduction text. Just output the content.`;

      const res = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      return res.text || "";
    }
  }
  ```

- [ ] **Step 3: Commit changes**
  Run:
  ```bash
  git add package.json src/services/gemini.service.ts
  git commit -m "feat: install genai sdk and implement gemini service"
  ```

---

### Task 2: API Orchestrator Updates

**Files:**
*   Modify: `src/services/research.service.ts`
*   Modify: `src/app/api/research/route.ts`

**Interfaces:**
*   Consumes: `GeminiService` and research orchestrators
*   Produces: Refactored `/api/research` endpoint that returns runs with associated topics and summaries.

- [ ] **Step 1: Update Research Service Orchestrator**
  Replace E:\social\src\services\research.service.ts with:
  ```typescript
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
  ```

- [ ] **Step 2: Update Ingestion API Route GET method to include topics**
  In `src/app/api/research/route.ts`, modify the GET method query to include topics:
  ```typescript
  // Replace the GET query block:
  const { data: runs, error } = await supabase
    .from("research_runs")
    .select("*, topics(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  ```

- [ ] **Step 3: Commit orchestrator updates**
  Run:
  ```bash
  git add src/services/research.service.ts src/app/api/research/route.ts
  git commit -m "feat: refactor research orchestrator to generate summaries and topics"
  ```

---

### Task 3: Content Generation Endpoint

**Files:**
*   Create: `src/app/api/generate/route.ts`

**Interfaces:**
*   Consumes: `GeminiService` and Supabase client
*   Produces: `/api/generate` Route Handler.

- [ ] **Step 1: Create Content Generation Route Handler**
  Create `E:\social\src\app\api\generate\route.ts` with:
  ```typescript
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
  ```

- [ ] **Step 2: Commit generation endpoint**
  Run:
  ```bash
  git add src/app/api/generate/route.ts
  git commit -m "feat: add content generation endpoint /api/generate"
  ```

---

### Task 4: Research Ingestion UI Dashboard Updates

**Files:**
*   Modify: `src/app/dashboard/research/page.tsx`

**Interfaces:**
*   Produces: Refactored Research page rendering dynamic summaries, topic grids, and navigation routes.

- [ ] **Step 1: Update Research Page UI**
  Replace E:\social\src\app\dashboard\research\page.tsx with:
  ```typescript
  "use client";

  import React, { useState, useEffect } from "react";
  import { Plus, Trash2, Search, Radio, Youtube, RotateCw, FileText, Sparkles, TrendingUp } from "lucide-react";
  import { createClient } from "@/utils/supabase/client";
  import Link from "next/link";

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
      const resRuns = await fetch("/api/research");
      const runsData = await resRuns.json();
      if (Array.isArray(runsData)) {
        setRuns(runsData);
        if (runsData.length > 0) {
          setSelectedRun(runsData[0]);
        }
      }

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
          setSelectedRun(data);
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
          <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">Research Engine</h1>
          <p className="text-sm text-zinc-400 mt-1">Ingest trends and configure tracking sources</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* COLUMN 1: CONTROLS & PAST RUNS */}
          <div className="space-y-6 lg:col-span-1">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Search className="h-5 w-5 text-violet-500" />
                Analyze Niche
              </h2>
              <form onSubmit={handleRunResearch} className="space-y-4">
                <input
                  type="text"
                  required
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Niche (e.g. AI Agents)"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Trigger Research Ingestion"
                  )}
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg space-y-4">
              <h2 className="text-lg font-semibold text-white">Previous Research</h2>
              {runs.length === 0 ? (
                <p className="text-sm text-zinc-500 py-4 text-center">No runs executed yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {runs.map((run) => (
                    <button
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      className={`w-full p-4 rounded-lg border text-left cursor-pointer transition-colors ${
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
                        <span>Topics: {run.topics?.length || 0}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* SOURCE CONFIGURATION */}
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
                  YouTube
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
                  RSS
                </button>
              </div>

              {activeTab === "youtube" ? (
                <div className="space-y-4">
                  <form onSubmit={handleAddSource} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      placeholder="Name"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newChannelId}
                        onChange={(e) => setNewChannelId(e.target.value)}
                        placeholder="Channel ID"
                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                      />
                      <button type="submit" className="rounded-lg bg-violet-600 p-2 text-white"><Plus className="h-4 w-4" /></button>
                    </div>
                  </form>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {channels.map((chan) => (
                      <div key={chan.id} className="flex justify-between items-center p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-sm">
                        <span className="text-white block truncate">{chan.channel_name}</span>
                        <button onClick={() => handleDeleteSource(chan.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={handleAddSource} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={newFeedName}
                      onChange={(e) => setNewFeedName(e.target.value)}
                      placeholder="Name"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="url"
                        required
                        value={newFeedUrl}
                        onChange={(e) => setNewFeedUrl(e.target.value)}
                        placeholder="Feed URL"
                        className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
                      />
                      <button type="submit" className="rounded-lg bg-violet-600 p-2 text-white"><Plus className="h-4 w-4" /></button>
                    </div>
                  </form>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {feeds.map((feed) => (
                      <div key={feed.id} className="flex justify-between items-center p-3 rounded-lg border border-zinc-800 bg-zinc-950 text-sm">
                        <span className="text-white block truncate">{feed.feed_name}</span>
                        <button onClick={() => handleDeleteSource(feed.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* COLUMN 2 & 3: RESEARCH SUMMARY & TOPIC CARDS */}
          <div className="lg:col-span-2 space-y-6">
            {selectedRun ? (
              <>
                {/* SUMMARY CARD */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-violet-500" />
                    AI Trends Summary: {selectedRun.niche}
                  </h2>
                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">
                    {selectedRun.summary}
                  </p>
                </div>

                {/* TOPICS CARD GRID */}
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-white">Trending Opportunity Topics</h2>
                  {(!selectedRun.topics || selectedRun.topics.length === 0) ? (
                    <p className="text-sm text-zinc-500 py-4 text-center">No ranked topics extracted for this run.</p>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      {selectedRun.topics.map((topic: any) => {
                        const score = topic.trend_score;
                        const scoreColor = score >= 90 
                          ? "bg-orange-500/20 text-orange-400 border-orange-500/30" 
                          : score >= 80 
                          ? "bg-violet-500/20 text-violet-400 border-violet-500/30" 
                          : "bg-blue-500/20 text-blue-400 border-blue-500/30";

                        return (
                          <div key={topic.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between shadow-md space-y-4 hover:border-zinc-700 transition-colors">
                            <div className="space-y-3">
                              <div className="flex justify-between items-start gap-4">
                                <h3 className="font-bold text-white text-base leading-snug">{topic.title}</h3>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${scoreColor}`}>
                                  {score}/100
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 leading-relaxed">{topic.why_trending}</p>
                              <div className="flex flex-wrap gap-1.5 pt-2">
                                {topic.related_keywords?.map((k: string) => (
                                  <span key={k} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                                    #{k}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="pt-2">
                              <Link
                                href={`/dashboard/studio?topicId=${topic.id}`}
                                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-violet-950/20 hover:border-violet-800/40 px-3 py-2.5 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
                              >
                                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                                Generate Content
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-12 backdrop-blur-sm text-center">
                <p className="text-sm text-zinc-500">Run an ingestion analysis to discover trending opportunities.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit UI updates**
  Run:
  ```bash
  git add src/app/dashboard/research/page.tsx
  git commit -m "feat: complete research dashboard to display summary and topics"
  ```

---

### Task 5: Base Content Studio UI

**Files:**
*   Create: `src/app/dashboard/studio/page.tsx`

**Interfaces:**
*   Produces: Base Content Studio page allowing topic fetching, platform selection, tone selection, and draft creation.

- [ ] **Step 1: Create Content Studio view**
  Create `E:\social\src\app\dashboard\studio\page.tsx` with:
  ```typescript
  "use client";

  import React, { useState, useEffect, Suspense } from "react";
  import { useSearchParams, useRouter } from "next/navigation";
  import { Sparkles, Save, RotateCw, PenTool } from "lucide-react";
  import { createClient } from "@/utils/supabase/client";

  const platforms = [
    { value: "linkedin", label: "LinkedIn Post" },
    { value: "facebook", label: "Facebook Post" },
    { value: "twitter", label: "X (Twitter) Post" },
    { value: "threads", label: "Threads Post" },
    { value: "newsletter", label: "Newsletter Section" },
    { value: "blog", label: "Blog Article" },
    { value: "website", label: "Website Copy" },
    { value: "marketing", label: "Marketing Copy" },
  ];

  const tones = [
    { value: "Professional", label: "Professional" },
    { value: "Casual", label: "Casual" },
    { value: "Inspirational", label: "Inspirational" },
    { value: "Persuasive", label: "Persuasive" },
    { value: "Witty", label: "Witty" },
    { value: "Informative", label: "Informative" },
  ];

  function StudioContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const topicId = searchParams.get("topicId");

    const [topicTitle, setTopicTitle] = useState("");
    const [topicDescription, setTopicDescription] = useState("");
    const [platform, setPlatform] = useState("linkedin");
    const [tone, setTone] = useState("Professional");
    const [audience, setAudience] = useState("");

    const [loading, setLoading] = useState(false);
    const [generatedMarkdown, setGeneratedMarkdown] = useState("");
    const supabase = createClient();

    useEffect(() => {
      const fetchTopicDetails = async () => {
        if (!topicId) return;
        const { data, error } = await supabase
          .from("topics")
          .select("*")
          .eq("id", topicId)
          .single();

        if (data && !error) {
          setTopicTitle(data.title);
          setTopicDescription(data.why_trending);
        }
      };

      fetchTopicDetails();
    }, [topicId]);

    const handleGenerate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!topicTitle) return;
      setLoading(true);

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicId,
            platform,
            tone,
            audience: audience || "General Audience",
          }),
        });

        const data = await res.json();
        if (data.markdown) {
          setGeneratedMarkdown(data.markdown);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="max-w-6xl mx-auto space-y-8 text-zinc-300">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">Content Studio</h1>
          <p className="text-sm text-zinc-400 mt-1">Configure draft presets and generate high-fidelity AI copy</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* PRESENTS CONFIGURATION FORM */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg space-y-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <PenTool className="h-5 w-5 text-violet-500" />
                Draft Presets
              </h2>

              <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Selected Topic</label>
                  <input
                    type="text"
                    required
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    disabled={!!topicId}
                    placeholder="Enter custom topic name"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Target Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    {platforms.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Target Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    {tones.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">Target Audience</label>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder="e.g. SaaS Founders, Engineers"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !topicTitle}
                  className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      Generating copy...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate AI Draft
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* GENERATED MARKDOWN OUTPUT DISPLAY */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg h-full flex flex-col justify-between min-h-[500px]">
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">Generated Draft Content</h2>
                  {generatedMarkdown && (
                    <button
                      onClick={() => router.push("/dashboard/drafts")}
                      className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      View in Drafts
                    </button>
                  )}
                </div>

                {generatedMarkdown ? (
                  <div className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-400 overflow-auto whitespace-pre-wrap">
                    {generatedMarkdown}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500">
                    Your generated draft markdown will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  export default function StudioPage() {
    return (
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <RotateCw className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      }>
        <StudioContent />
      </Suspense>
    );
  }
  ```

- [ ] **Step 2: Commit Studio UI**
  Run:
  ```bash
  git add src/app/dashboard/studio/page.tsx
  git commit -m "feat: complete base Content Studio page with draft controls"
  ```
