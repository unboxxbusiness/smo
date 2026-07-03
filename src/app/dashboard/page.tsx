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
