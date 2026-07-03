# Design Specification: AI-Powered Content Research & Publishing Platform

**Date**: 2026-07-03  
**Status**: APPROVED  
**Target Workspace**: `e:\social`  

---

## 1. Project Overview & Scope
This is a single-user productivity platform designed to automate the workflow of content research, synthesis, generation, and social publishing. It replaces manual web searches, news curation, writing, and scheduling with an integrated dashboard.

### Core Goals:
1. **Automate Ingestion**: Collect content opportunities from Google Trends, YouTube RSS, News API, and custom RSS feeds.
2. **AI-Driven Synthesis**: Synthesize raw research, score/rank trends, and suggest angles via the Gemini API.
3. **Markdown Studio**: Edit and polish AI-generated copy inside an editor with live previews.
4. **Cloudinary Asset Storage**: Store generated post graphics and thumbnails, storing only secure URLs in the database.
5. **One-Click Publishing/Scheduling**: Push content immediately or schedule it via the Buffer API.

---

## 2. Technology Stack
*   **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
*   **Backend**: Next.js Server Actions & Route Handlers
*   **Database**: Supabase PostgreSQL (using Supabase Auth for single-user sign-in)
*   **AI Engine**: Gemini API (`@google/genai` or direct API calls)
*   **Asset Management**: Cloudinary
*   **Social Publishing**: Buffer API

---

## 3. Database Schema Design (Supabase PostgreSQL)

We will use the following tables in the `public` schema. All tables will implement Row-Level Security (RLS) pointing to the single authenticated user's ID.

### `settings`
Stores user-specific integration configurations.
```sql
CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    gemini_api_key TEXT,
    cloudinary_cloud_name TEXT,
    cloudinary_api_key TEXT,
    cloudinary_api_secret TEXT,
    buffer_access_token TEXT,
    default_platform TEXT DEFAULT 'linkedin',
    timezone TEXT DEFAULT 'UTC',
    preferred_tone TEXT DEFAULT 'Professional',
    preferred_language TEXT DEFAULT 'English',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `youtube_channels`
Stores target YouTube channels to monitor.
```sql
CREATE TABLE public.youtube_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id TEXT UNIQUE NOT NULL,
    channel_name TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `rss_feeds`
Stores custom blog or site feeds to monitor.
```sql
CREATE TABLE public.rss_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feed_url TEXT UNIQUE NOT NULL,
    feed_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `research_runs`
Records niche-based research runs and raw merged inputs.
```sql
CREATE TABLE public.research_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    niche TEXT NOT NULL,
    raw_data JSONB NOT NULL,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `topics`
Identifies high-value opportunities extracted and ranked by Gemini.
```sql
CREATE TABLE public.topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    research_run_id UUID NOT NULL REFERENCES public.research_runs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    trend_score INTEGER NOT NULL CHECK (trend_score >= 0 AND trend_score <= 100),
    why_trending TEXT NOT NULL,
    related_keywords TEXT[] DEFAULT '{}',
    suggested_angles JSONB DEFAULT '[]', -- array of: { platform, tone, angle_description }
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `posts`
Manages content drafts and publishing states.
```sql
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content_type TEXT NOT NULL, -- e.g., 'linkedin', 'twitter', 'blog'
    markdown TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'archived'
    image_url TEXT,
    scheduled_for TIMESTAMPTZ,
    buffer_post_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `publish_logs`
Stores responses, errors, and responses from social integrations.
```sql
CREATE TABLE public.publish_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    status TEXT NOT NULL, -- 'success', 'failed'
    log_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. API & Service Architecture

We will isolate our logic into dedicated modules inside `services/`:

1.  **`supabase.service.ts`**: Handles DB writes, checks, and updates.
2.  **`rss.service.ts`**: Ingests XML/RSS data. Used for user RSS feeds and Google Trends RSS feed (`https://trends.google.com/trends/trendingsearches/daily/rss?geo=US`).
3.  **`news.service.ts`**: Queries `newsapi.org` for recent articles.
4.  **`youtube.service.ts`**: Fetches latest video items from Channel XML (`https://www.youtube.com/feeds/videos.xml?channel_id=...`). Scrapes view counts from the watch page with regex as the primary mechanism, falling back to YouTube Data API if a key is present.
5.  **`gemini.service.ts`**: Handles prompt execution. Uses Gemini's Structured JSON schema to return ranked topics in the exact database structure.
6.  **`buffer.service.ts`**: Calls `/profiles` to find connected profiles, and `/updates/create` to schedule/publish.
7.  **`cloudinary.service.ts`**: Handles asset streaming and uploads.
8.  **`research.service.ts`**: Orchestrates parallel fetches and combines them into one JSON payload for Gemini.

### Next.js Route Handlers (`app/api/`)
*   `POST /api/research`: Ingests niche, queries sources, synthesizes topics, saves to database, and returns topics.
*   `POST /api/generate`: Generates Markdown draft for a selected topic, platform, and tone.
*   `POST /api/publish`: Triggers Buffer API calls (Publish Now or Schedule) and writes to `publish_logs` and updates `posts` status.
*   `GET /api/dashboard`: Aggregates metrics (generated posts, scheduler lists, recent news/video highlights).

---

## 5. UI Layout & User Experience

We will implement a **Midnight Slate** theme utilizing modern dark-mode aesthetics:
*   **Colors**: Primary backgrounds `#09090b` / `#0f0f13`, cards `#18181b` (70% opacity + backdrop blur), borders `zinc-800`.
*   **Accents**: Neon Violet `#8b5cf6` for main branding and AI highlights, Electric Teal `#0d9488` for success/published states.
*   **Layout Pages**:
    *   `Sidebar`: Permanent layout on desktop, drawer on mobile. Paths: `/dashboard`, `/research`, `/studio`, `/drafts`, `/publishing`, `/analytics`, `/settings`.
    *   `Research`: Niche analyzer query panel with live status message updates (e.g. "Fetching Google Trends...", "Asking Gemini to rank opportunities...").
    *   `Content Studio`: Horizontal split screen: Markdown Editor on the left; markdown-rendered Preview on the right. Side panel for AI editing actions (Tone shift, Expand, Shorten, Polishing).
    *   `Settings`: Central screen to test/save API keys, configure default social profiles, languages, and timezones.

---

## 6. Verification & Robustness Plan
*   **Input Validation**: Strict input validations using `zod` for all client payloads (e.g., niche requests, post creation, settings forms).
*   **Error Boundaries**: React Error Boundaries to isolate UI widget failures (e.g., RSS widget failing doesn't crash the entire dashboard).
*   **Integration Tests**: Mocked runs for YouTube scrapers, NewsAPI, and Gemini schemas to verify ingestion stability.
