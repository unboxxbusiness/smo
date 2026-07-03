"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { RotateCw, TrendingUp, FileText, Rocket, Search, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6366f1",
  scheduled: "#f59e0b",
  published: "#10b981",
  archived: "#6b7280",
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsRes, postsRes, logsRes] = await Promise.all([
          fetch("/api/dashboard/stats"),
          fetch("/api/posts"),
          fetch("/api/posts/logs"),
        ]);
        const [statsData, postsData, logsData] = await Promise.all([
          statsRes.json(),
          postsRes.json(),
          logsRes.json(),
        ]);

        if (!statsData.error) setStats(statsData);
        if (Array.isArray(postsData)) setPosts(postsData);
        if (Array.isArray(logsData)) setLogs(logsData);

        // Fetch top topics via research runs
        const researchRes = await fetch("/api/research");
        const researchData = await researchRes.json();
        if (Array.isArray(researchData)) {
          const allTopics = researchData.flatMap((r: any) => r.topics || []);
          const sorted = allTopics.sort((a: any, b: any) => b.trend_score - a.trend_score).slice(0, 10);
          setTopics(sorted);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Build bar chart data: last 30 days publish activity
  const buildActivityData = () => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days[key] = 0;
    }
    logs.forEach((log) => {
      if (log.status === "success") {
        const d = new Date(log.created_at);
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (key in days) days[key]++;
      }
    });
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  };

  // Build donut chart data from post status breakdown
  const buildStatusData = () => {
    if (!stats) return [];
    return [
      { name: "Draft", value: stats.draftPosts || 0, color: STATUS_COLORS.draft },
      { name: "Scheduled", value: stats.scheduledPosts || 0, color: STATUS_COLORS.scheduled },
      { name: "Published", value: stats.publishedPosts || 0, color: STATUS_COLORS.published },
    ].filter((d) => d.value > 0);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <RotateCw className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const activityData = buildActivityData();
  const statusData = buildStatusData();

  const statCards = [
    { label: "Research Runs", value: stats?.researchRuns ?? 0, icon: Search, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
    { label: "Topics Found", value: stats?.topics ?? 0, icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Drafts Created", value: stats?.totalPosts ?? 0, icon: FileText, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "Posts Published", value: stats?.publishedPosts ?? 0, icon: Rocket, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-zinc-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">Analytics</h1>
        <p className="text-sm text-zinc-400 mt-1">Visualize your content performance and publishing activity</p>
      </div>

      {/* STATS OVERVIEW ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border p-5 backdrop-blur-sm space-y-3 ${bg}`}>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-outfit">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`text-3xl font-bold ${color} font-outfit`}>{value}</p>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* BAR CHART: Publishing Activity */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white font-outfit">Publishing Activity (Last 30 Days)</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Number of successful publish events per day</p>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#71717a" }}
                tickLine={false}
                interval={4}
              />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ color: "#e4e4e7" }}
                itemStyle={{ color: "#a78bfa" }}
              />
              <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Published" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* PIE CHART: Post Status Breakdown */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white font-outfit">Post Status Breakdown</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Distribution of all content by status</p>
          </div>
          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px]">
              <p className="text-xs text-zinc-500 font-outfit">No posts yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ color: "#a1a1aa", fontSize: "11px" }}>{value}</span>}
                />
                <Tooltip
                  contentStyle={{ background: "#09090b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }}
                  itemStyle={{ color: "#e4e4e7" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* PUBLISH SUCCESS RATE + TOP TOPICS */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* SUCCESS RATE */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
          <h2 className="text-sm font-bold text-white font-outfit self-start">Publish Success Rate</h2>
          <div className="relative flex items-center justify-center w-36 h-36">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#27272a" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="50" fill="none"
                stroke={stats?.successRate >= 70 ? "#10b981" : stats?.successRate >= 40 ? "#f59e0b" : "#ef4444"}
                strokeWidth="10"
                strokeDasharray={`${(stats?.successRate || 0) * 3.14} 314`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <p className="text-2xl font-bold text-white font-outfit">{stats?.successRate ?? 0}%</p>
              <p className="text-[10px] text-zinc-500 font-outfit">Success</p>
            </div>
          </div>
          <div className="flex gap-4 text-xs font-outfit">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
              {stats?.successLogs ?? 0} Success
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
              {stats?.failedLogs ?? 0} Failed
            </span>
          </div>
        </div>

        {/* TOP TOPICS TABLE */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-sm font-bold text-white font-outfit">Top Trending Topics</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Highest ranked content opportunities by trend score</p>
            </div>
          </div>
          {topics.length === 0 ? (
            <p className="text-xs text-zinc-500 font-outfit py-8 text-center">No topics found. Run a research session first.</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[260px] pr-1">
              {topics.map((topic: any, i: number) => (
                <div key={topic.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800/60 bg-zinc-950/40 hover:border-zinc-700 transition-colors group">
                  <span className="text-xs font-bold text-zinc-600 w-5 shrink-0 font-outfit">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate font-outfit">{topic.title}</p>
                    <div className="mt-1 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                        style={{ width: `${topic.trend_score}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-violet-400 shrink-0 font-outfit">{topic.trend_score}</span>
                  <Link
                    href={`/dashboard/studio?topicId=${topic.id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-violet-400" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
