"use client";

import React, { useState, useEffect } from "react";
import { Send, Clock, FileText, CheckCircle2, AlertCircle, RotateCw, Loader, Eye, ArrowUpRight, X } from "lucide-react";
import Link from "next/link";

export default function PublishingPage() {
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"queue" | "logs">("queue");

  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Logs modal details
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const loadQueue = async () => {
    setLoadingQueue(true);
    try {
      const res = await fetch("/api/posts?status=scheduled");
      const data = await res.json();
      if (Array.isArray(data)) setScheduledPosts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQueue(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/posts/logs");
      const data = await res.json();
      if (Array.isArray(data)) setHistoryLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadQueue();
    loadLogs();
  }, []);

  const handleForcePublish = async (id: string) => {
    if (!confirm("Are you sure you want to publish this post immediately?")) return;
    try {
      const res = await fetch(`/api/posts/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Fetch the first default mock profile since we are publishing instantly
        body: JSON.stringify({
          profileIds: ["mock-li"], 
          publishNow: true,
        }),
      });
      const data = await res.json();
      if (data.id) {
        loadQueue();
        loadLogs();
      } else if (data.error) {
        alert(`Publishing failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    if (!confirm("Are you sure you want to unschedule this post? it will revert back to a draft.")) return;
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft", scheduled_for: null }),
      });
      const data = await res.json();
      if (data.id) {
        loadQueue();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-zinc-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">Publishing Queue</h1>
        <p className="text-sm text-zinc-400 mt-1">Manage scheduled releases and review publishing history logs</p>
      </div>

      {/* WORKSPACE SWITCHER */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("queue")}
          className={`pb-4 px-6 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === "queue"
              ? "border-violet-500 text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Clock className="h-4 w-4" />
          Scheduled Queue ({scheduledPosts.length})
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`pb-4 px-6 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeTab === "logs"
              ? "border-violet-500 text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <FileText className="h-4 w-4" />
          Publishing History Logs
        </button>
      </div>

      {/* TAB WORKSPACES */}
      {activeTab === "queue" ? (
        /* SCHEDULED QUEUE WORKSPACE */
        loadingQueue ? (
          <div className="flex justify-center items-center py-20">
            <Loader className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : scheduledPosts.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-16 text-center">
            <p className="text-sm text-zinc-500 font-outfit">No posts currently scheduled in queue.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {scheduledPosts.map((post) => {
              const date = new Date(post.scheduled_for).toLocaleString();
              return (
                <div
                  key={post.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between shadow-md space-y-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-bold text-white text-base truncate font-outfit">{post.title}</h3>
                      <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 font-outfit">
                        {post.content_type}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5 font-outfit">
                      <Clock className="h-3.5 w-3.5 text-violet-400" />
                      Scheduled for: {date}
                    </p>
                  </div>

                  <div className="flex justify-between gap-2 border-t border-zinc-800/80 pt-4">
                    <Link
                      href={`/dashboard/studio?postId=${post.id}`}
                      className="px-3 py-2 rounded-lg border border-zinc-800 hover:border-violet-850 hover:text-violet-400 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors font-outfit"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Edit Draft
                    </Link>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleForcePublish(post.id)}
                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1 transition-colors font-outfit"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Publish Now
                      </button>
                      <button
                        onClick={() => handleCancelSchedule(post.id)}
                        className="px-3 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-xs font-semibold text-zinc-400 hover:text-white transition-colors font-outfit"
                      >
                        Unschedule
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* PUBLISHING LOGS WORKSPACE */
        loadingLogs ? (
          <div className="flex justify-center items-center py-20">
            <Loader className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : historyLogs.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-16 text-center">
            <p className="text-sm text-zinc-500 font-outfit">No publishing history logs logged yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {historyLogs.map((log) => {
              const date = new Date(log.created_at).toLocaleString();
              const isSuccess = log.status === "success";

              return (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl border border-zinc-800 bg-zinc-950 gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm font-outfit">{log.posts?.title || "Deleted Post"}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 font-outfit ${
                        isSuccess
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }`}>
                        {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 font-outfit">Executed at: {date}</p>
                  </div>

                  <button
                    onClick={() => setSelectedLog(log)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:text-white text-xs font-semibold text-zinc-400 flex items-center gap-1 transition-colors font-outfit"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Details
                  </button>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* LOG DETAILS MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-outfit">Publish Log Payload Details</h3>
                <p className="text-xs text-zinc-500 font-outfit">Post: {selectedLog.posts?.title || "Deleted Post"}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-400 max-h-96 overflow-auto whitespace-pre-wrap">
              {selectedLog.log_details}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
