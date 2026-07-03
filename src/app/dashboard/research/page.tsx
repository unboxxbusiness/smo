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
            <h2 className="text-lg font-semibold text-white font-outfit">Previous Research</h2>
            {runs.length === 0 ? (
              <p className="text-sm text-zinc-500 py-4 text-center font-outfit">No runs executed yet.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRun(run)}
                    className={`w-full p-4 rounded-lg border text-left cursor-pointer transition-colors ${
                      selectedRun?.id === run.id
                        ? "border-violet-500 bg-violet-955/20"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-white font-outfit">{run.niche}</span>
                      <span className="text-xs text-zinc-500 font-outfit">
                        {new Date(run.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-zinc-400 font-outfit">
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
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-955 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
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
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-955 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
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
                <h2 className="text-xl font-bold text-white flex items-center gap-2 font-outfit">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                  AI Trends Summary: {selectedRun.niche}
                </h2>
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line font-outfit">
                  {selectedRun.summary}
                </p>
              </div>

              {/* TOPICS CARD GRID */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white font-outfit">Trending Opportunity Topics</h2>
                {(!selectedRun.topics || selectedRun.topics.length === 0) ? (
                  <p className="text-sm text-zinc-500 py-4 text-center font-outfit">No ranked topics extracted for this run.</p>
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
                              <h3 className="font-bold text-white text-base leading-snug font-outfit">{topic.title}</h3>
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border font-outfit ${scoreColor}`}>
                                {score}/100
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 leading-relaxed font-outfit">{topic.why_trending}</p>
                            <div className="flex flex-wrap gap-1.5 pt-2">
                              {topic.related_keywords?.map((k: string) => (
                                <span key={k} className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-outfit">
                                  #{k}
                                </span>
                              ))}
                            </div>

                            {/* Score Metrics Grid */}
                            <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] font-outfit">
                              <div className="flex items-center justify-between bg-zinc-900/40 px-2.5 py-1.5 rounded border border-zinc-900">
                                <span className="text-zinc-500">🎯 Confidence:</span>
                                <span className="font-bold text-zinc-300">
                                  {topic.confidence_score !== undefined && topic.confidence_score !== null ? `${topic.confidence_score}%` : 'N/A'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between bg-zinc-900/40 px-2.5 py-1.5 rounded border border-zinc-900">
                                <span className="text-zinc-500">🔥 Virality:</span>
                                <span className="font-bold text-zinc-300">
                                  {topic.virality_score !== undefined && topic.virality_score !== null ? `${topic.virality_score}%` : 'N/A'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between bg-zinc-900/40 px-2.5 py-1.5 rounded border border-zinc-900">
                                <span className="text-zinc-500">🎓 Student Impact:</span>
                                <span className="font-bold text-zinc-300">
                                  {topic.student_impact_score !== undefined && topic.student_impact_score !== null ? `${topic.student_impact_score}%` : 'N/A'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between bg-zinc-900/40 px-2.5 py-1.5 rounded border border-zinc-900">
                                <span className="text-zinc-500">🔍 SEO Opp:</span>
                                <span className="font-bold text-zinc-300">
                                  {topic.seo_opportunity_score !== undefined && topic.seo_opportunity_score !== null ? `${topic.seo_opportunity_score}%` : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="pt-2">
                            <Link
                              href={`/dashboard/studio?topicId=${topic.id}`}
                              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-violet-955/20 hover:border-violet-800/40 px-3 py-2.5 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors font-outfit"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-violet-400 animate-pulse" />
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
              <p className="text-sm text-zinc-500 font-outfit">Run an ingestion analysis to discover trending opportunities.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
