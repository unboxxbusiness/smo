"use client";

import React, { useState, useEffect } from "react";
import { Upload, Copy, Trash2, Loader, Image as ImageIcon } from "lucide-react";

export default function MediaPage() {
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media");
      const data = await res.json();
      if (Array.isArray(data)) setMediaItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", files[0]);

    try {
      const res = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });
      const newItem = await res.json();
      if (newItem.id) {
        setMediaItems([newItem, ...mediaItems]);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this image from database and Cloudinary?")) return;
    try {
      const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMediaItems(mediaItems.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 text-zinc-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white font-outfit">Media Library</h1>
        <p className="text-sm text-zinc-400 mt-1">Upload and manage visual assets for publishing</p>
      </div>

      {/* UPLOAD ZONE */}
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/10 p-10 text-center flex flex-col items-center justify-center space-y-4">
        <div className="rounded-full bg-zinc-900 p-4 border border-zinc-800">
          <Upload className="h-6 w-6 text-violet-500" />
        </div>
        <div>
          <label className="cursor-pointer rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors inline-block font-outfit">
            {uploading ? (
              <span className="flex items-center gap-1.5">
                <Loader className="h-3.5 w-3.5 animate-spin" />
                Uploading file...
              </span>
            ) : (
              "Choose Image to Upload"
            )}
            <input type="file" onChange={handleUpload} disabled={uploading} className="hidden" accept="image/*" />
          </label>
        </div>
        <p className="text-xs text-zinc-500">Supports PNG, JPG, JPEG, GIF, WEBP files (Max 10MB)</p>
      </div>

      {/* GRID LISTINGS */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : mediaItems.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-16 text-center">
          <ImageIcon className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-sm text-zinc-500 font-outfit">No images uploaded yet.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {mediaItems.map((item) => (
            <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex flex-col justify-between shadow-md space-y-4 hover:border-zinc-700 transition-colors group">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
                <img src={item.url} alt="Uploaded Media" className="object-cover w-full h-full" />
              </div>
              <div className="flex gap-2 justify-between">
                <button
                  onClick={() => copyToClipboard(item.url)}
                  className="flex-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white hover:border-violet-800/40 hover:text-violet-400 transition-colors font-outfit"
                >
                  Copy Link
                </button>
                <button
                  onClick={() => copyToClipboard(`![Image](${item.url})`)}
                  className="flex-1 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white hover:border-violet-800/40 hover:text-violet-400 transition-colors font-outfit"
                >
                  Copy MD
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-900/40 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
