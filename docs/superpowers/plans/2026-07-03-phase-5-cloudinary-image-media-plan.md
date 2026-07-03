# Phase 5: Cloudinary Integration & Media Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate image uploading to Cloudinary via server-side API proxy, save uploaded media logs in Supabase database, build a media manager page, and write cover selectors and markdown body picker modals inside the Content Studio.

**Architecture:** Next.js Route Handlers parsing form data files, uploading buffers to Cloudinary using their official Node SDK, and storing references in the database.

**Tech Stack:** Next.js 15, Supabase, `cloudinary` Node package, Tailwind CSS.

---

### Task 1: Database Migration Update

**Files:**
*   Modify: `schema.sql`

- [ ] **Step 1: Append Media Table schema**
  Append the SQL script to create the media table to the end of E:\social\schema.sql:
  ```sql
  -- Appended for Phase 5
  CREATE TABLE IF NOT EXISTS public.media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      public_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Users can manage their own media"
      ON public.media
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  ```

- [ ] **Step 2: Commit schema change**
  Run:
  ```bash
  git add schema.sql
  git commit -m "migration: append media table schema definitions"
  ```

---

### Task 2: Cloudinary Service Setup

**Files:**
*   Modify: `package.json`
*   Create: `src/services/cloudinary.service.ts`

- [ ] **Step 1: Install Cloudinary Node SDK**
  Modify E:\social\package.json dependencies block to include:
  `"cloudinary": "^2.5.1"`
  Ensure package.json remains valid JSON.

- [ ] **Step 2: Create Cloudinary Node Service**
  Create `E:\social\src\services\cloudinary.service.ts` with:
  ```typescript
  import { v2 as cloudinary } from "cloudinary";
  import { getSettingValue } from "@/utils/settings";

  export class CloudinaryService {
    private static async configure() {
      const cloudName = await getSettingValue("cloudinary_cloud_name", "CLOUDINARY_CLOUD_NAME");
      const apiKey = await getSettingValue("cloudinary_api_key", "CLOUDINARY_API_KEY");
      const apiSecret = await getSettingValue("cloudinary_api_secret", "CLOUDINARY_API_SECRET");

      if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary API credentials are not configured.");
      }

      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }

    static async uploadBuffer(buffer: Buffer, mimeType: string): Promise<{ url: string; publicId: string }> {
      await this.configure();
      const base64Data = buffer.toString("base64");
      const fileUri = `data:${mimeType};base64,${base64Data}`;

      const res = await cloudinary.uploader.upload(fileUri, {
        folder: "social-media-platform",
      });

      return {
        url: res.secure_url,
        publicId: res.public_id,
      };
    }

    static async deleteAsset(publicId: string): Promise<boolean> {
      await this.configure();
      const res = await cloudinary.uploader.destroy(publicId);
      return res.result === "ok";
    }
  }
  ```

- [ ] **Step 3: Commit Cloudinary service**
  Run:
  ```bash
  git add src/services/cloudinary.service.ts package.json
  git commit -m "feat: implement Cloudinary configuration and upload services"
  ```

---

### Task 3: Media API Endpoints

**Files:**
*   Create: `src/app/api/media/route.ts`
*   Create: `src/app/api/media/[id]/route.ts`

- [ ] **Step 1: Create main upload route**
  Create `E:\social\src\app\api\media\route.ts` containing:
  ```typescript
  import { NextResponse } from "next/server";
  import { createClient } from "@/utils/supabase/server";
  import { CloudinaryService } from "@/services/cloudinary.service";

  export async function GET() {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const { data: media, error } = await supabase
        .from("media")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json(media);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  export async function POST(req: Request) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const formData = await req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }

      // Convert file stream to buffer
      const buffer = Buffer.from(await file.arrayBuffer());

      // Upload to Cloudinary
      const { url, publicId } = await CloudinaryService.uploadBuffer(buffer, file.type);

      // Save database row
      const { data: mediaRow, error } = await supabase
        .from("media")
        .insert({
          user_id: user.id,
          url,
          public_id: publicId,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(mediaRow);
    } catch (err: any) {
      console.error("Upload handler failed:", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Create dynamic delete handler**
  Create `E:\social\src\app\api\media\[id]\route.ts` containing:
  ```typescript
  import { NextResponse } from "next/server";
  import { createClient } from "@/utils/supabase/server";
  import { CloudinaryService } from "@/services/cloudinary.service";

  export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { id } = await params;

      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      // Fetch the media public_id from DB first
      const { data: media, error: fetchErr } = await supabase
        .from("media")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (fetchErr || !media) {
        return NextResponse.json({ error: "Media resource not found" }, { status: 404 });
      }

      // Delete from Cloudinary
      await CloudinaryService.deleteAsset(media.public_id);

      // Delete from Supabase
      const { error: deleteErr } = await supabase
        .from("media")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (deleteErr) throw deleteErr;

      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 3: Commit media routes**
  Run:
  ```bash
  git add src/app/api/media/
  git commit -m "feat: implement media API routes for uploads and deletions"
  ```

---

### Task 4: Standalone Media Library UI

**Files:**
*   Create: `src/app/dashboard/media/page.tsx`

- [ ] **Step 1: Create Media Manager dashboard view**
  Create `E:\social\src\app\dashboard\media\page.tsx` with:
  ```typescript
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
  ```

- [ ] **Step 2: Commit Standalone Media view**
  Run:
  ```bash
  git add src/app/dashboard/media/page.tsx
  git commit -m "feat: implement media catalog dashboard UI"
  ```

---

### Task 5: Content Studio Integration

**Files:**
*   Modify: `src/app/dashboard/studio/page.tsx`

- [ ] **Step 1: Add Cover Banner & Media Picker Modal code**
  Replace E:\social\src\app\dashboard\studio\page.tsx with the version integrating media pickers:
  ```typescript
  "use client";

  import React, { useState, useEffect, useRef, Suspense } from "react";
  import { useSearchParams, useRouter } from "next/navigation";
  import { Sparkles, Save, RotateCw, Copy, Download, Wand2, Image as ImageIcon, X } from "lucide-react";
  import { createClient } from "@/utils/supabase/client";
  import ReactMarkdown from "react-markdown";

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
    const postId = searchParams.get("postId");

    const [activePostId, setActivePostId] = useState<string | null>(postId);
    const [title, setTitle] = useState("");
    const [markdown, setMarkdown] = useState("");
    const [platform, setPlatform] = useState("linkedin");
    const [tone, setTone] = useState("Professional");
    const [audience, setAudience] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    // AI Refine inputs
    const [customPrompt, setCustomPrompt] = useState("");
    const [refining, setRefining] = useState(false);

    // Media Modal inputs
    const [showMediaModal, setShowMediaModal] = useState(false);
    const [mediaTypeMode, setMediaTypeMode] = useState<"cover" | "inline">("cover");
    const [mediaItems, setMediaItems] = useState<any[]>([]);
    const [loadingMedia, setLoadingMedia] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const supabase = createClient();

    // Load initial topic or post data
    useEffect(() => {
      const loadInitialData = async () => {
        if (activePostId) {
          const res = await fetch(`/api/posts/${activePostId}`);
          const post = await res.json();
          if (post && !post.error) {
            setTitle(post.title);
            setMarkdown(post.markdown);
            setPlatform(post.content_type);
            setImageUrl(post.image_url || null);
          }
        } else if (topicId) {
          const { data: topic } = await supabase.from("topics").select("*").eq("id", topicId).single();
          if (topic) {
            setTitle(topic.title);
          }
        }
      };
      loadInitialData();
    }, [activePostId, topicId]);

    // Save post
    const savePost = async () => {
      if (!title) return;
      setSaving(true);
      try {
        const payload = { title, markdown, content_type: platform, image_url: imageUrl };
        const method = activePostId ? "PUT" : "POST";
        const url = activePostId ? `/api/posts/${activePostId}` : "/api/posts";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const post = await res.json();
        if (post && post.id) {
          setActivePostId(post.id);
          setLastSaved(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error("Save failed:", err);
      } finally {
        setSaving(false);
      }
    };

    // Auto-save on blur
    const handleBlur = () => {
      savePost();
    };

    // Generate Initial Draft
    const handleGenerate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title) return;
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
          setMarkdown(data.markdown);
          setActivePostId(data.id);
          setLastSaved(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Run AI inline edits (Polish, Expand, Shorten, Custom Prompt)
    const handleRefine = async (action: "expand" | "shorten" | "polish" | "custom") => {
      if (!markdown) return;
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const hasSelection = start !== end;
      
      const targetText = hasSelection 
        ? markdown.substring(start, end) 
        : markdown;

      setRefining(true);
      try {
        const res = await fetch("/api/generate/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: targetText,
            action,
            instruction: action === "custom" ? customPrompt : undefined,
          }),
        });
        const data = await res.json();
        if (data.refinedText) {
          if (hasSelection) {
            const newContent = markdown.substring(0, start) + data.refinedText + markdown.substring(end);
            setMarkdown(newContent);
          } else {
            setMarkdown(data.refinedText);
          }
          setCustomPrompt("");
          // Auto-save the refined copy
          setTimeout(savePost, 500);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setRefining(false);
      }
    };

    // Copy to clipboard
    const handleCopy = () => {
      navigator.clipboard.writeText(markdown);
    };

    // Download MD file
    const handleDownload = () => {
      const element = document.createElement("a");
      const file = new Blob([markdown], { type: "text/markdown" });
      element.href = URL.createObjectURL(file);
      element.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "post"}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    };

    // Load media files for picker modal
    const loadMediaItems = async () => {
      setLoadingMedia(true);
      try {
        const res = await fetch("/api/media");
        const data = await res.json();
        if (Array.isArray(data)) setMediaItems(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMedia(false);
      }
    };

    const openMediaModal = (mode: "cover" | "inline") => {
      setMediaTypeMode(mode);
      setShowMediaModal(true);
      loadMediaItems();
    };

    const handleSelectImage = (url: string) => {
      if (mediaTypeMode === "cover") {
        setImageUrl(url);
        setShowMediaModal(false);
        // Save immediately
        setTimeout(savePost, 200);
      } else {
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const inlineText = `![Image](${url})`;
          const newContent = markdown.substring(0, start) + inlineText + markdown.substring(end);
          setMarkdown(newContent);
          setShowMediaModal(false);
          // Save immediately
          setTimeout(savePost, 200);
        }
      }
    };

    const handleModalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploadingMedia(true);
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
        console.error(err);
      } finally {
        setUploadingMedia(false);
      }
    };

    return (
      <div className="max-w-7xl mx-auto space-y-6 text-zinc-300">
        {/* HEADER BAR */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white font-outfit">Content Studio</h1>
            {lastSaved && (
              <p className="text-xs text-zinc-500 mt-0.5">Last saved at {lastSaved}</p>
            )}
          </div>
          <div className="flex gap-3">
            {markdown && (
              <>
                <button
                  onClick={handleCopy}
                  className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800 flex items-center gap-1.5 transition-colors font-outfit"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                <button
                  onClick={handleDownload}
                  className="px-3.5 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800 flex items-center gap-1.5 transition-colors font-outfit"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </>
            )}
            <button
              onClick={savePost}
              disabled={saving}
              className="px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1.5 transition-colors font-outfit"
            >
              {saving ? (
                <>
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save Draft
                </>
              )}
            </button>
          </div>
        </div>

        {!markdown ? (
          /* PRE-GENERATION VIEW: RENDER PRESETS CONFIG FORM */
          <div className="max-w-xl mx-auto rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 backdrop-blur-sm shadow-xl space-y-6">
            <h2 className="text-lg font-semibold text-white font-outfit">Configure Draft Presets</h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2 font-outfit">Topic / Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter custom topic name"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-outfit"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2 font-outfit">Target Platform</label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:outline-none bg-zinc-950 font-outfit"
                  >
                    {platforms.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2 font-outfit">Target Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-955 px-4 py-2.5 text-sm text-white focus:outline-none bg-zinc-950 font-outfit"
                  >
                    {tones.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2 font-outfit">Target Audience</label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g. B2B Marketers, Creators"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-outfit"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !title}
                className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors font-outfit"
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
        ) : (
          /* POST-GENERATION VIEW: SPLIT-SCREEN WORKSPACE */
          <div className="grid gap-6 lg:grid-cols-2">
            {/* LEFT COLUMN: TEXTAREA EDITOR */}
            <div className="flex flex-col space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 backdrop-blur-sm shadow-lg space-y-4">
                {/* AI Refinement Actions Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-violet-400" />
                    <span className="text-xs font-semibold text-zinc-400 font-outfit uppercase">Editor Tools</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openMediaModal("inline")}
                      className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white hover:border-violet-800/40 hover:text-violet-400 flex items-center gap-1 font-outfit"
                    >
                      <ImageIcon className="h-3 w-3" />
                      Add Image
                    </button>
                    <button
                      onClick={() => openMediaModal("cover")}
                      className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white hover:border-violet-800/40 hover:text-violet-400 flex items-center gap-1 font-outfit"
                    >
                      <ImageIcon className="h-3 w-3" />
                      Set Cover
                    </button>
                    <button
                      onClick={() => handleRefine("polish")}
                      disabled={refining}
                      className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white hover:border-violet-800/40 hover:text-violet-400 disabled:opacity-50 font-outfit"
                    >
                      Polish
                    </button>
                    <button
                      onClick={() => handleRefine("expand")}
                      disabled={refining}
                      className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white hover:border-violet-800/40 hover:text-violet-400 disabled:opacity-50 font-outfit"
                    >
                      Expand
                    </button>
                    <button
                      onClick={() => handleRefine("shorten")}
                      disabled={refining}
                      className="px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-white hover:border-violet-800/40 hover:text-violet-400 disabled:opacity-50 font-outfit"
                    >
                      Shorten
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Custom refinement prompt (e.g. make it punchy)"
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    onClick={() => handleRefine("custom")}
                    disabled={refining || !customPrompt}
                    className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-1 transition-colors font-outfit"
                  >
                    {refining ? <RotateCw className="h-3 w-3 animate-spin" /> : "Apply"}
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-[500px] flex flex-col">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                  }}
                  onBlur={handleBlur}
                  className="bg-transparent text-white text-xl font-bold border-none outline-none pb-2 block focus:ring-0 font-outfit"
                  placeholder="Draft Title"
                />
                <textarea
                  ref={textareaRef}
                  value={markdown}
                  onChange={(e) => {
                    setMarkdown(e.target.value);
                  }}
                  onBlur={handleBlur}
                  className="flex-1 w-full min-h-[450px] p-4 rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-300 font-mono focus:outline-none focus:border-violet-500 resize-y"
                  placeholder="Write in Markdown..."
                />
              </div>
            </div>

            {/* RIGHT COLUMN: MARKDOWN LIVE PREVIEW */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-sm shadow-lg flex flex-col h-full min-h-[570px] overflow-auto">
              <div className="border-b border-zinc-800 pb-3 mb-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-zinc-400 font-outfit uppercase">Live Preview</span>
              </div>
              <div className="flex-1 markdown-preview text-left text-zinc-300 leading-relaxed overflow-y-auto space-y-4">
                {imageUrl && (
                  <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 mb-4">
                    <img src={imageUrl} alt="Post Cover" className="object-cover w-full h-full" />
                    <button
                      onClick={() => {
                        setImageUrl(null);
                        setTimeout(savePost, 200);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-zinc-950/80 text-zinc-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        {/* MEDIA SELECTOR PICKER MODAL */}
        {showMediaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="w-full max-w-4xl rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white font-outfit">
                    {mediaTypeMode === "cover" ? "Select Post Cover Image" : "Insert Image into Body"}
                  </h3>
                  <p className="text-xs text-zinc-500">Choose an image from your library or upload a new one</p>
                </div>
                <button
                  onClick={() => setShowMediaModal(false)}
                  className="rounded-lg p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* UPLOAD FORM INSIDE MODAL */}
              <div className="border border-dashed border-zinc-800 bg-zinc-900/10 p-4 rounded-lg flex items-center justify-between gap-4 mb-6">
                <span className="text-xs text-zinc-400 font-outfit">Upload new image:</span>
                <label className="cursor-pointer rounded bg-violet-650 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-555 transition-colors font-outfit">
                  {uploadingMedia ? (
                    <span className="flex items-center gap-1">
                      <RotateCw className="h-3 w-3 animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    "Upload File"
                  )}
                  <input type="file" onChange={handleModalUpload} disabled={uploadingMedia} className="hidden" accept="image/*" />
                </label>
              </div>

              {/* IMAGES GRID */}
              <div className="flex-1 overflow-y-auto pr-2 min-h-[300px]">
                {loadingMedia ? (
                  <div className="flex justify-center items-center py-20">
                    <RotateCw className="h-8 w-8 animate-spin text-violet-500" />
                  </div>
                ) : mediaItems.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-12">No media assets found in library.</p>
                ) : (
                  <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                    {mediaItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectImage(item.url)}
                        className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-violet-500 transition-colors cursor-pointer group"
                      >
                        <img src={item.url} alt="Media Asset" className="object-cover w-full h-full" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-xs font-bold text-white font-outfit">Select Image</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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

- [ ] **Step 2: Commit Integrated Studio page**
  Run:
  ```bash
  git add src/app/dashboard/studio/page.tsx
  git commit -m "feat: integrate cover selectors and image pickers inside Content Studio"
  ```
