"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, PenTool, Copy, Trash2, Archive, Loader, FileText, CheckCircle, Clock } from "lucide-react";

const statuses = [
  { value: "all", label: "All Posts" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export default function DraftsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadPosts = async () => {
    setLoading(true);
    try {
      const url = `/api/posts?status=${statusFilter}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) setPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [statusFilter, search]);

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateFrom: id }),
      });
      const duplicate = await res.json();
      if (duplicate.id) {
        loadPosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this post?")) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setPosts(posts.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleArchive = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "archived" ? "draft" : "archived";
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.id) {
        loadPosts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-zinc-300">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">Draft Library</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage and edit your saved drafts</p>
        </div>
        <button
          onClick={async () => {
            const res = await fetch("/api/posts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: "New Draft", markdown: "" }),
            });
            const post = await res.json();
            if (post.id) router.push(`/dashboard/studio?postId=${post.id}`);
          }}
          className="px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-colors font-outfit"
        >
          Create Blank Draft
        </button>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900/40 p-4 border border-zinc-800 rounded-xl">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drafts by title..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {statuses.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                statusFilter === tab.value
                  ? "border-violet-500 bg-violet-950/20 text-violet-400"
                  : "border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* LISTINGS */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-16 text-center">
          <p className="text-sm text-zinc-500 font-outfit">No documents found matching this filter.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((post) => {
            const date = new Date(post.updated_at).toLocaleDateString();
            
            let statusBadge = "bg-zinc-900/40 text-zinc-400 border-zinc-800";
            let StatusIcon = FileText;

            if (post.status === "scheduled") {
              statusBadge = "bg-blue-500/20 text-blue-400 border-blue-500/30";
              StatusIcon = Clock;
            } else if (post.status === "published") {
              statusBadge = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
              StatusIcon = CheckCircle;
            }

            return (
              <div
                key={post.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between shadow-md space-y-4 hover:border-zinc-700 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-bold text-white text-base truncate font-outfit">{post.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 font-outfit ${statusBadge}`}>
                      <StatusIcon className="h-3 w-3" />
                      {post.status}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-zinc-500">
                    <span className="uppercase font-semibold tracking-wider font-outfit">{post.content_type}</span>
                    <span>•</span>
                    <span className="font-outfit">Updated: {date}</span>
                  </div>
                </div>

                <div className="flex justify-between gap-2 border-t border-zinc-800/80 pt-4">
                  <button
                    onClick={() => router.push(`/dashboard/studio?postId=${post.id}`)}
                    className="px-3 py-2 rounded-lg border border-zinc-800 hover:border-violet-800/40 hover:text-violet-400 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors font-outfit"
                  >
                    <PenTool className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDuplicate(post.id)}
                      title="Duplicate"
                      className="p-2 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleArchive(post.id, post.status)}
                      title={post.status === "archived" ? "Restore" : "Archive"}
                      className="p-2 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      title="Delete"
                      className="p-2 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
