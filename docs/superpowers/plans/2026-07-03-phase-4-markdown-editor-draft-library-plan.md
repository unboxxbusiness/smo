# Phase 4: Markdown Editor & Draft Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create inline AI text refiner API, implement post CRUD endpoints, write a split-screen workspace in Content Studio (using `react-markdown` and custom prose CSS), and build the Draft Library page with titles search and status filters.

**Architecture:** Split-screen editor with selection tracking. Inline actions replace the highlighted text range using DOM selection hooks. Catalog actions duplicate or edit database posts.

**Tech Stack:** Next.js 15, TypeScript, Supabase Client, `react-markdown` library.

## Global Constraints
*   All editor components must be responsive and styled inside the zinc/charcoal dark-mode theme.
*   Text refinement actions should operate on selection ranges if active, otherwise fallback to the entire document.
*   Draft catalog operations should use API routes for CRUD operations rather than heavy client-side state.

---

### Task 1: Gemini In-Line Refiner API

**Files:**
*   Modify: `src/services/gemini.service.ts`
*   Create: `src/app/api/generate/refine/route.ts`

**Interfaces:**
*   Consumes: `GeminiService` API
*   Produces: `/api/generate/refine` endpoint.

- [ ] **Step 1: Add refineContent to GeminiService**
  Add the `refineContent` helper inside E:\social\src\services\gemini.service.ts:
  ```typescript
  // Add this inside the GeminiService class:
  static async refineContent(text: string, action: "expand" | "shorten" | "polish" | "custom", instruction?: string): Promise<string> {
    const { ai, model } = await this.getClient();
    
    let systemPrompt = "You are an expert editor. Modify the text provided by the user based on the instructions.";
    
    if (action === "expand") {
      systemPrompt = "You are an expert content writer. Expand the provided text by adding relevant details, examples, and depth, while maintaining its original tone.";
    } else if (action === "shorten") {
      systemPrompt = "You are an expert copyeditor. Shorten the provided text to be concise, clear, and punchy, removing fluff while preserving key information.";
    } else if (action === "polish") {
      systemPrompt = "You are an expert writer. Refine the provided text to improve grammar, flow, and professional impact, making it sound highly polished.";
    } else if (action === "custom" && instruction) {
      systemPrompt = `You are a professional assistant. Rewrite the provided text according to this custom instruction: "${instruction}"`;
    }

    const prompt = `Text to modify:
  "${text}"

  Output ONLY the modified text. Do not include any introductory comments, greetings, markdown backtick wrappers, or explanation.`;

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return res.text || text;
  }
  ```

- [ ] **Step 2: Create In-Line Refiner API Route**
  Create `E:\social\src\app\api\generate\refine\route.ts` with:
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
      const { text, action, instruction } = body;

      if (!text || !action) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const refinedText = await GeminiService.refineContent(text, action, instruction);

      return NextResponse.json({ refinedText });
    } catch (err: any) {
      console.error("Refinement API failed:", err);
      return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
    }
  }
  ```

- [ ] **Step 3: Commit refiner API**
  Run:
  ```bash
  git add src/services/gemini.service.ts src/app/api/generate/refine/route.ts
  git commit -m "feat: implement inline AI refiner endpoint"
  ```

---

### Task 2: Draft Library API CRUD Routes

**Files:**
*   Create: `src/app/api/posts/route.ts`
*   Create: `src/app/api/posts/[id]/route.ts`

**Interfaces:**
*   Produces: CRUD endpoints for posts list and individual posts.

- [ ] **Step 1: Create Main Post API Route**
  Create `E:\social\src\app\api\posts\route.ts` with:
  ```typescript
  import { NextResponse } from "next/server";
  import { createClient } from "@/utils/supabase/server";

  export async function GET(req: Request) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const { searchParams } = new URL(req.url);
      const search = searchParams.get("search");
      const status = searchParams.get("status");

      let query = supabase.from("posts").select("*").eq("user_id", user.id);

      if (status && status !== "all") {
        query = query.eq("status", status);
      }
      if (search) {
        query = query.ilike("title", `%${search}%`);
      }

      const { data: posts, error } = await query.order("updated_at", { ascending: false });

      if (error) throw error;
      return NextResponse.json(posts);
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
      const { duplicateFrom, title, contentType, markdown } = body;

      // Duplication logic
      if (duplicateFrom) {
        const { data: original, error: origErr } = await supabase
          .from("posts")
          .select("*")
          .eq("id", duplicateFrom)
          .eq("user_id", user.id)
          .single();

        if (origErr || !original) {
          return NextResponse.json({ error: "Original post not found" }, { status: 404 });
        }

        const { data: duplicate, error: dupErr } = await supabase
          .from("posts")
          .insert({
            user_id: user.id,
            title: `Copy of ${original.title}`,
            content_type: original.content_type,
            markdown: original.markdown,
            status: "draft",
          })
          .select()
          .single();

        if (dupErr) throw dupErr;
        return NextResponse.json(duplicate);
      }

      // Standard custom post creation
      const { data: newPost, error: createErr } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          title: title || "Untitled Draft",
          content_type: contentType || "linkedin",
          markdown: markdown || "",
          status: "draft",
        })
        .select()
        .single();

      if (createErr) throw createErr;
      return NextResponse.json(newPost);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Create Dynamic ID CRUD Route**
  Create `E:\social\src\app\api\posts\[id]\route.ts` with:
  ```typescript
  import { NextResponse } from "next/server";
  import { createClient } from "@/utils/supabase/server";

  export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { id } = await params;

      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const { data: post, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error || !post) {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }

      return NextResponse.json(post);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { id } = await params;

      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const body = await req.json();
      const { title, markdown, status, scheduled_for, content_type } = body;

      const updates: any = { updated_at: new Date().toISOString() };
      if (title !== undefined) updates.title = title;
      if (markdown !== undefined) updates.markdown = markdown;
      if (status !== undefined) updates.status = status;
      if (scheduled_for !== undefined) updates.scheduled_for = scheduled_for;
      if (content_type !== undefined) updates.content_type = content_type;

      const { data: post, error } = await supabase
        .from("posts")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(post);
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { id } = await params;

      if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
  ```

- [ ] **Step 3: Commit CRUD routes**
  Run:
  ```bash
  git add src/app/api/posts/
  git commit -m "feat: implement post CRUD and duplicate routes"
  ```

---

### Task 3: Split-Screen Markdown Editor UI

**Files:**
*   Modify: `package.json`
*   Modify: `src/app/dashboard/studio/page.tsx`

**Interfaces:**
*   Consumes: `react-markdown` library and post API routes
*   Produces: Refactored Content Studio split-screen layout.

- [ ] **Step 1: Install react-markdown dependency**
  Modify E:\social\package.json dependencies block to include:
  `"react-markdown": "^9.0.1"`
  Ensure package.json remains valid JSON.

- [ ] **Step 2: Create Split-Screen Workspace UI**
  Replace E:\social\src\app\dashboard\studio\page.tsx with:
  ```typescript
  "use client";

  import React, { useState, useEffect, useRef, Suspense } from "react";
  import { useSearchParams, useRouter } from "next/navigation";
  import { Sparkles, Save, RotateCw, Copy, Download, Wand2 } from "lucide-react";
  import { createClient } from "@/utils/supabase/client";
  import ReactMarkdown from "react-markdown";

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

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);

    // AI Refine inputs
    const [customPrompt, setCustomPrompt] = useState("");
    const [refining, setRefining] = useState(false);

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
        const payload = { title, markdown, content_type: platform };
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
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-white focus:outline-none bg-zinc-950 font-outfit"
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
                    <span className="text-xs font-semibold text-zinc-400 font-outfit uppercase">AI Rewrite</span>
                  </div>
                  <div className="flex gap-2">
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
              <div className="flex-1 markdown-preview text-left text-zinc-300 leading-relaxed overflow-y-auto">
                <ReactMarkdown>{markdown}</ReactMarkdown>
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

- [ ] **Step 3: Commit Workspace changes**
  Run:
  ```bash
  git add src/app/dashboard/studio/page.tsx package.json
  git commit -m "feat: complete split-screen editor UI with selection AI refiners"
  ```

---

### Task 4: CSS Markdown Styling Setup

**Files:**
*   Modify: `src/app/globals.css`

**Interfaces:**
*   Produces: Tailwind configuration style variables to render markdown formatting elements (`h1`, `h2`, `h3`, `a`, `ul`, `ol`, `code`, `blockquote`) inside the `.markdown-preview` selector class.

- [ ] **Step 1: Update globals.css with Markdown CSS selectors**
  Append custom styles to the end of `src/app/globals.css`:
  ```css
  /* Markdown Preview Selector Styles */
  .markdown-preview h1 {
    font-size: 1.875rem;
    font-weight: 700;
    color: #ffffff;
    margin-top: 1.5rem;
    margin-bottom: 1rem;
    font-family: 'Outfit', sans-serif;
  }
  .markdown-preview h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #ffffff;
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-family: 'Outfit', sans-serif;
  }
  .markdown-preview h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #ffffff;
    margin-top: 1.25rem;
    margin-bottom: 0.5rem;
    font-family: 'Outfit', sans-serif;
  }
  .markdown-preview p {
    margin-bottom: 1rem;
    font-size: 0.875rem;
    color: #d4d4d8;
  }
  .markdown-preview ul {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }
  .markdown-preview ol {
    list-style-type: decimal;
    padding-left: 1.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }
  .markdown-preview li {
    margin-bottom: 0.25rem;
  }
  .markdown-preview blockquote {
    border-left: 4px solid #8b5cf6;
    padding-left: 1rem;
    font-style: italic;
    color: #a1a1aa;
    margin-bottom: 1rem;
  }
  .markdown-preview a {
    color: #a78bfa;
    text-decoration: underline;
  }
  .markdown-preview a:hover {
    color: #c084fc;
  }
  .markdown-preview code {
    font-family: monospace;
    background-color: #18181b;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    color: #ec4899;
  }
  .markdown-preview pre {
    background-color: #09090b;
    border: 1px solid #27272a;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }
  .markdown-preview pre code {
    background-color: transparent;
    padding: 0;
    color: #e4e4e7;
  }
  ```

- [ ] **Step 2: Commit css adjustments**
  Run:
  ```bash
  git add src/app/globals.css
  git commit -m "style: configure custom preview rules in globals.css"
  ```

---

### Task 5: Draft Library Management Page

**Files:**
*   Create: `src/app/dashboard/drafts/page.tsx`

**Interfaces:**
*   Produces: UI Catalog layout displaying all drafts, supporting search queries, status tabs, duplicates, and deletes.

- [ ] **Step 1: Create Draft Library View**
  Create `E:\social\src\app\dashboard\drafts\page.tsx` with:
  ```typescript
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
  ```

- [ ] **Step 2: Commit Draft library view**
  Run:
  ```bash
  git add src/app/dashboard/drafts/page.tsx
  git commit -m "feat: implement Draft Library dashboard interface"
  ```
