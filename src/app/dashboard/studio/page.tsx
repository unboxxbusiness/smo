"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Sparkles, Save, RotateCw, Copy, Download, Wand2, Image as ImageIcon, X, Send, Calendar } from "lucide-react";
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

  const [postsList, setPostsList] = useState<any[]>([]);

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

  // Publisher Modal inputs
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [submittingPublish, setSubmittingPublish] = useState(false);

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

          // Fetch siblings to show tabs (ponytail: keep interconnected drafts grouped)
          if (post.topic_id) {
            const { data: siblings } = await supabase
              .from("posts")
              .select("*")
              .eq("topic_id", post.topic_id);
            if (siblings) setPostsList(siblings);
          }
        }
      } else if (topicId) {
        // Query if we already have drafts generated for this topicId
        const { data: existingPosts } = await supabase
          .from("posts")
          .select("*")
          .eq("topic_id", topicId);

        if (existingPosts && existingPosts.length > 0) {
          setPostsList(existingPosts);
          const firstPost = existingPosts[0];
          setActivePostId(firstPost.id);
          setTitle(firstPost.title);
          setMarkdown(firstPost.markdown);
          setPlatform(firstPost.content_type);
          setImageUrl(firstPost.image_url || null);
        } else {
          const { data: topic } = await supabase.from("topics").select("*").eq("id", topicId).single();
          if (topic) {
            setTitle(topic.title);
          }
        }
      }
    };
    loadInitialData();
  }, [topicId]);

  // Save post
  const savePost = async () => {
    if (!title || !activePostId) return activePostId;
    setSaving(true);
    try {
      const payload = { title, markdown, content_type: platform, image_url: imageUrl };
      const url = `/api/posts/${activePostId}`;

      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const post = await res.json();
      if (post && post.id) {
        setLastSaved(new Date().toLocaleTimeString());
        // Sync local state
        setPostsList((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, markdown: post.markdown, image_url: post.image_url } : p))
        );
        return post.id;
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
    return activePostId;
  };

  // Auto-save on blur
  const handleBlur = () => {
    savePost();
  };

  // Generate Initial Drafts (All formats in one click)
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    setLoading(true);

    try {
      const res = await fetch("/api/generate/all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId,
          tone,
          audience: audience || "General Audience",
        }),
      });

      const data = await res.json();
      if (data.posts && data.posts.length > 0) {
        setPostsList(data.posts);
        const firstPost = data.posts[0];
        setActivePostId(firstPost.id);
        setMarkdown(firstPost.markdown);
        setPlatform(firstPost.content_type);
        setImageUrl(firstPost.image_url || null);
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

  // Publishing/Scheduling triggers
  const openPublishModal = async () => {
    setShowPublishModal(true);
    setLoadingProfiles(true);
    try {
      const res = await fetch("/api/posts/profiles");
      const data = await res.json();
      if (Array.isArray(data)) {
        setProfiles(data);
        if (data.length > 0) setSelectedProfiles([data[0].id]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProfiles.length === 0) return;

    // Force save first to ensure we push latest edits
    const currentPostId = await savePost();
    if (!currentPostId) return;

    setSubmittingPublish(true);
    try {
      const res = await fetch(`/api/posts/${currentPostId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileIds: selectedProfiles,
          publishNow: publishImmediately,
          scheduledAt: publishImmediately ? undefined : new Date(scheduledDateTime).toISOString(),
        }),
      });

      const data = await res.json();
      if (data.id) {
        setShowPublishModal(false);
        router.push("/dashboard/publishing");
      } else if (data.error) {
        alert(`Publishing failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingPublish(false);
    }
  };

  const handleProfileToggle = (id: string) => {
    if (selectedProfiles.includes(id)) {
      setSelectedProfiles(selectedProfiles.filter((p) => p !== id));
    } else {
      setSelectedProfiles([...selectedProfiles, id]);
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
              <button
                onClick={openPublishModal}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors font-outfit"
              >
                <Send className="h-3.5 w-3.5" />
                Publish / Schedule
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
                className="w-full rounded-lg border border-zinc-800 bg-zinc-955 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-outfit"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2 font-outfit">Target Audience</label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="e.g. Students, Aspirants"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-955 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-outfit"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !title}
              className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors font-outfit"
            >
              {loading ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Generating all formats...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate All Formats in One Click
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          {/* PLATFORM TABS */}
          {postsList.length > 0 && (
            <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
              {postsList.map((p) => {
                const isSelected = p.id === activePostId;
                const platformLabel = platforms.find((pf) => pf.value === p.content_type)?.label || p.content_type;
                
                return (
                  <button
                    key={p.id}
                    onClick={async () => {
                      if (p.id === activePostId) return;
                      // Auto-save current active post before switching
                      await savePost();
                      // Swap states to new post
                      setActivePostId(p.id);
                      setMarkdown(p.markdown);
                      setPlatform(p.content_type);
                      setImageUrl(p.image_url || null);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold font-outfit border transition-all ${
                      isSelected
                        ? "bg-violet-600 border-violet-500 text-white shadow-lg"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
                    }`}
                  >
                    {platformLabel}
                  </button>
                );
              })}
            </div>
          )}

          {/* POST-GENERATION VIEW: SPLIT-SCREEN WORKSPACE */}
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
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-955 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
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
                  className="flex-1 w-full min-h-[450px] p-4 rounded-xl border border-zinc-800 bg-zinc-955 text-sm text-zinc-300 font-mono focus:outline-none focus:border-violet-500 resize-y"
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
                  <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-zinc-800 bg-zinc-955/85 mb-4">
                    <img src={imageUrl} alt="Post Cover" className="object-cover w-full h-full" />
                    <button
                      onClick={() => {
                        setImageUrl(null);
                        setTimeout(savePost, 200);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-zinc-955/80 text-zinc-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEDIA SELECTOR PICKER MODAL */}
      {showMediaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-4xl rounded-xl border border-zinc-800 bg-zinc-955 p-6 shadow-2xl flex flex-col max-h-[85vh]">
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
              <label className="cursor-pointer rounded bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors font-outfit">
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

      {/* PUBLISH / SCHEDULE MODAL */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-outfit">Publish / Schedule Post</h3>
                <p className="text-xs text-zinc-500 font-outfit">Distribute your content via Buffer</p>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                className="rounded-lg p-1.5 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingProfiles ? (
              <div className="flex justify-center items-center py-12">
                <RotateCw className="h-8 w-8 animate-spin text-violet-500" />
              </div>
            ) : (
              <form onSubmit={handlePublishSubmit} className="space-y-6">
                {/* SELECT CHANNELS */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">Select Channels</label>
                  {profiles.length === 0 ? (
                    <p className="text-xs text-yellow-500 border border-yellow-950/40 bg-yellow-950/10 p-3 rounded font-outfit">
                      No profiles returned. Simulated fallback profiles will be used.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {profiles.map((p) => {
                        const isChecked = selectedProfiles.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleProfileToggle(p.id)}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                              isChecked ? "border-violet-500 bg-violet-955/20" : "border-zinc-800 bg-zinc-900/40"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-outfit">
                                {p.service}
                              </div>
                              <span className="text-sm font-semibold text-white font-outfit truncate block max-w-[200px]">
                                {p.formatted_username}
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // Controlled click handles toggle
                              className="rounded border-zinc-800 bg-zinc-950 text-violet-650 focus:ring-violet-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SCHEDULING MODE */}
                <div className="space-y-4">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block font-outfit">Publish Timing</label>
                  <div className="flex gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 cursor-pointer font-outfit text-xs font-bold text-white">
                      <input
                        type="radio"
                        name="timing"
                        checked={publishImmediately}
                        onChange={() => setPublishImmediately(true)}
                        className="text-violet-600 focus:ring-violet-500"
                      />
                      Publish Now
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 cursor-pointer font-outfit text-xs font-bold text-white">
                      <input
                        type="radio"
                        name="timing"
                        checked={!publishImmediately}
                        onChange={() => setPublishImmediately(false)}
                        className="text-violet-600 focus:ring-violet-500"
                      />
                      Schedule Later
                    </label>
                  </div>

                  {!publishImmediately && (
                    <div className="space-y-2">
                      <span className="text-xs text-zinc-500 flex items-center gap-1 font-outfit">
                        <Calendar className="h-3.5 w-3.5 text-violet-400" />
                        Target Date & Time
                      </span>
                      <input
                        type="datetime-local"
                        required
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 font-outfit"
                      />
                    </div>
                  )}
                </div>

                {/* SUBMIT BUTTON */}
                <button
                  type="submit"
                  disabled={submittingPublish || selectedProfiles.length === 0}
                  className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors font-outfit"
                >
                  {submittingPublish ? (
                    <>
                      <RotateCw className="h-4 w-4 animate-spin" />
                      Submitting update...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {publishImmediately ? "Send to Channels" : "Schedule Update"}
                    </>
                  )}
                </button>
              </form>
            )}
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
