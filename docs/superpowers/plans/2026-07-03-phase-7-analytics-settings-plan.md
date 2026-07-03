# Phase 7: Analytics, Settings & Dashboard Stats — Implementation Plan

**Goal:** Build the analytics visualization dashboard, settings credentials console, live stats API endpoint, and update the home dashboard with dynamic live counts.

**Tech Stack:** Next.js 15, Supabase, Recharts (charts library), Lucide icons, Vanilla CSS animations.

---

### Task 1: Install Recharts & Dashboard Stats API

**Files:**
- Modify: `package.json` (add recharts)
- Create: `src/app/api/dashboard/stats/route.ts`

- [ ] **Step 1: Install recharts**
  Run:
  ```bash
  npm install recharts
  ```

- [ ] **Step 2: Create stats API endpoint**
  Create `E:\social\src\app\api\dashboard\stats\route.ts`:
  ```typescript
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
  ```

---

### Task 2: Settings API & Console UI

**Files:**
- Create: `src/app/api/settings/route.ts`
- Create: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Create settings GET/POST endpoint**
  Create `E:\social\src\app\api\settings\route.ts`:
  ```typescript
  import { NextResponse } from "next/server";
  import { createClient } from "@/utils/supabase/server";

  export async function GET() {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const { data: settings, error } = await supabase
        .from("settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json(settings || {});
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  export async function POST(req: Request) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const body = await req.json();

      const { data, error } = await supabase
        .from("settings")
        .upsert({ ...body, user_id: user.id }, { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Create Settings Console UI page**
  Create `E:\social\src\app\dashboard\settings\page.tsx`:
  ```typescript
  "use client";

  import React, { useState, useEffect } from "react";
  import { Save, RotateCw, Eye, EyeOff, CheckCircle2, Settings } from "lucide-react";

  const credentialFields = [
    { key: "gemini_api_key", label: "Gemini API Key", placeholder: "AIza..." },
    { key: "cloudinary_cloud_name", label: "Cloudinary Cloud Name", placeholder: "my-cloud" },
    { key: "cloudinary_api_key", label: "Cloudinary API Key", placeholder: "123456789..." },
    { key: "cloudinary_api_secret", label: "Cloudinary API Secret", placeholder: "abc123..." },
    { key: "buffer_access_token", label: "Buffer Access Token", placeholder: "1/..." },
    { key: "news_api_key", label: "NewsAPI Key", placeholder: "abc123..." },
    { key: "serp_api_key", label: "SerpApi Key", placeholder: "abc123..." },
    { key: "youtube_api_key", label: "YouTube Data API Key", placeholder: "AIza..." },
  ];

  const platforms = ["linkedin", "facebook", "twitter", "threads", "newsletter", "blog", "website", "marketing"];
  const tones = ["Professional", "Casual", "Inspirational", "Persuasive", "Witty", "Informative"];

  export default function SettingsPage() {
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [revealMap, setRevealMap] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
      const loadSettings = async () => {
        try {
          const res = await fetch("/api/settings");
          const data = await res.json();
          if (data && !data.error) {
            setFormData(data);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      loadSettings();
    }, []);

    const handleChange = (key: string, value: string) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const toggleReveal = (key: string) => {
      setRevealMap((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      setSaved(false);
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data && !data.error) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSaving(false);
      }
    };

    if (loading) {
      return (
        <div className="flex justify-center items-center py-32">
          <RotateCw className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto space-y-8 text-zinc-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">Settings</h1>
            <p className="text-sm text-zinc-400 mt-1">Manage your API credentials and platform preferences</p>
          </div>
          <Settings className="h-8 w-8 text-zinc-600" />
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* API CREDENTIALS */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm space-y-5">
            <div className="border-b border-zinc-800 pb-4">
              <h2 className="text-base font-bold text-white font-outfit">API Credentials</h2>
              <p className="text-xs text-zinc-500 mt-1">Values stored here override environment variables for your account</p>
            </div>
            <div className="space-y-4">
              {credentialFields.map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">{label}</label>
                  <div className="relative flex items-center">
                    <input
                      type={revealMap[key] ? "text" : "password"}
                      value={formData[key] || ""}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 pr-10 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors font-outfit"
                    />
                    <button
                      type="button"
                      onClick={() => toggleReveal(key)}
                      className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {revealMap[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PREFERENCES */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm space-y-5">
            <div className="border-b border-zinc-800 pb-4">
              <h2 className="text-base font-bold text-white font-outfit">Content Preferences</h2>
              <p className="text-xs text-zinc-500 mt-1">These defaults pre-fill the Content Studio generation form</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">Default Platform</label>
                <select
                  value={formData.default_platform || "linkedin"}
                  onChange={(e) => handleChange("default_platform", e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-outfit"
                >
                  {platforms.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">Preferred Tone</label>
                <select
                  value={formData.preferred_tone || "Professional"}
                  onChange={(e) => handleChange("preferred_tone", e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-outfit"
                >
                  {tones.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">Timezone</label>
                <input
                  type="text"
                  value={formData.timezone || "UTC"}
                  onChange={(e) => handleChange("timezone", e.target.value)}
                  placeholder="e.g. America/New_York"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 font-outfit"
                />
              </div>
            </div>
          </div>

          {/* SAVE BUTTON */}
          <div className="flex justify-end items-center gap-4">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-400 font-outfit">
                <CheckCircle2 className="h-4 w-4" />
                Settings saved successfully
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-2 transition-colors font-outfit"
            >
              {saving ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }
  ```

---

### Task 3: Analytics Dashboard UI

**Files:**
- Create: `src/app/dashboard/analytics/page.tsx`

- [ ] **Step 1: Create Analytics Dashboard page**
  Create `E:\social\src\app\dashboard\analytics\page.tsx` with recharts visualizations showing:
  - 4-card stats overview row
  - Recharts ResponsiveContainer BarChart for publishing activity over the last 30 days (from publish_logs)
  - Recharts PieChart donut for post status breakdown
  - Publish success rate ring stat
  - Top topics table ranked by trend_score

  The full page code:
  ```typescript
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
  ```

---

### Task 4: Update Home Dashboard with Live Stats

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Update home dashboard to fetch live stats**
  Replace E:\social\src\app\dashboard\page.tsx with:
  ```typescript
  "use client";

  import { useEffect, useState } from "react";
  import Link from "next/link";
  import { Search, FileText, Image, Rocket, TrendingUp, BarChart2, Settings, Send, RotateCw } from "lucide-react";

  const quickLinks = [
    { href: "/dashboard/research", label: "Research Engine", description: "Ingest trends, news, and YouTube", icon: Search, color: "from-violet-600 to-violet-800" },
    { href: "/dashboard/studio", label: "Content Studio", description: "Generate and refine AI drafts", icon: FileText, color: "from-blue-600 to-blue-800" },
    { href: "/dashboard/drafts", label: "Draft Library", description: "Browse and manage all posts", icon: TrendingUp, color: "from-amber-600 to-amber-800" },
    { href: "/dashboard/media", label: "Media Library", description: "Upload and manage images", icon: Image, color: "from-pink-600 to-pink-800" },
    { href: "/dashboard/publishing", label: "Publishing Queue", description: "View scheduled posts and logs", icon: Send, color: "from-emerald-600 to-emerald-800" },
    { href: "/dashboard/analytics", label: "Analytics", description: "Track performance metrics", icon: BarChart2, color: "from-cyan-600 to-cyan-800" },
    { href: "/dashboard/settings", label: "Settings", description: "Configure API keys and preferences", icon: Settings, color: "from-zinc-600 to-zinc-800" },
  ];

  export default function DashboardPage() {
    const [stats, setStats] = useState<any>(null);
    const [loadingStats, setLoadingStats] = useState(true);

    useEffect(() => {
      const fetchStats = async () => {
        try {
          const res = await fetch("/api/dashboard/stats");
          const data = await res.json();
          if (!data.error) setStats(data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingStats(false);
        }
      };
      fetchStats();
    }, []);

    const statCards = [
      { label: "Research Runs", value: stats?.researchRuns ?? 0, icon: Search, color: "text-violet-400" },
      { label: "Topics Found", value: stats?.topics ?? 0, icon: TrendingUp, color: "text-blue-400" },
      { label: "Drafts Created", value: stats?.totalPosts ?? 0, icon: FileText, color: "text-amber-400" },
      { label: "Posts Published", value: stats?.publishedPosts ?? 0, icon: Rocket, color: "text-emerald-400" },
    ];

    return (
      <div className="max-w-6xl mx-auto space-y-10 text-zinc-300">
        {/* HERO HEADER */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white font-outfit">
            Welcome back 👋
          </h1>
          <p className="text-zinc-400 text-base">
            Your AI-powered content research and social publishing platform.
          </p>
        </div>

        {/* LIVE STATS ROW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-sm space-y-3 hover:border-zinc-700 transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider font-outfit">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              {loadingStats ? (
                <RotateCw className="h-5 w-5 animate-spin text-zinc-600" />
              ) : (
                <p className={`text-3xl font-bold ${color} font-outfit`}>{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* QUICK LINKS GRID */}
        <div>
          <h2 className="text-lg font-bold text-white font-outfit mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickLinks.map(({ href, label, description, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-sm hover:border-zinc-700 transition-all hover:shadow-lg hover:shadow-black/20 space-y-3"
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm font-outfit group-hover:text-violet-300 transition-colors">{label}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5 font-outfit">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Verify compilation**
  Run:
  ```bash
  npx tsc --noEmit && npm run lint
  ```
