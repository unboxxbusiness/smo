# Design Specification: Phase 2 Research Ingestion Engine

**Date**: 2026-07-03  
**Status**: APPROVED  
**Target Workspace**: `e:\social`  

---

## 1. Scope & Goals
Phase 2 implements the ingestion pipeline that aggregates content research from Google Trends daily RSS, YouTube channel XML feeds (with public view scraping and API fallbacks), NewsAPI.org, and custom blog RSS feeds.

### Key Objectives:
1. **Supabase Schema Ingestion**: Implement the PostgreSQL tables in Supabase for channels, rss feeds, research runs, and settings.
2. **Settings Utility**: Setup a Server Component setting lookup utility that falls back to process environment variables.
3. **Ingestion Service Classes**: Create standalone service files for Google Trends daily RSS parsing, YouTube XML parsing with view scraping, NewsAPI endpoints, and blog RSS readers.
4. **API Orchestrator**: Create a Route Handler `/api/research` that fetches all sources in parallel via `Promise.allSettled`, merges them into a single payload, and writes the raw JSON dump to the `research_runs` database table.
5. **Research & Sources UI**: Build a dashboard interface where the user can trigger new runs, view past runs, and configure monitored YouTube Channels and blog RSS feeds.

---

## 2. Supabase SQL Schema (`schema.sql`)
We will create a `schema.sql` file containing all the tables, relations, and Row Level Security (RLS) policies for the authenticated user, as defined and approved in Section 1.

---

## 3. Services Design & API Routes

### 1. `utils/settings.ts`
Utility to check settings database table overrides and fallback to local environment variables.
```typescript
import { createClient } from "@/utils/supabase/server";

export async function getSettingValue(key: string, envFallbackName: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: settings, error } = await supabase
        .from("settings")
        .select(key)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && settings && settings[key]) {
        return settings[key];
      }
    }
  } catch (e) {
    // Fail silently to environment variables
  }
  return process.env[envFallbackName] || null;
}
```

### 2. `services/rss.service.ts`
Parses XML blog feeds using `rss-parser` package. Returns a clean array of articles containing titles, links, dates, and text descriptions.

### 3. `services/google-trends.service.ts`
Parses daily Google Trends RSS (`https://trends.google.com/trends/trendingsearches/daily/rss?geo=US`). Falls back to SerpApi `google_trends` engine if SerpApi key is present in settings.

### 4. `services/news.service.ts`
Queries `/v2/everything` endpoint of NewsAPI.org. API key resolved using `NEWS_API_KEY`.

### 5. `services/youtube.service.ts`
Reads the channel feed `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`. Resolves video view counts by fetching the watch page source and parsing with regex (`"viewCount":"(\\d+)"`), falling back to the YouTube Data API key if configured.

### 6. `services/research.service.ts`
Orchestrator class. Executes parallel fetches, handles error boundaries, and merges outcomes into a structured JSON payload:
```json
{
  "google_trends": [],
  "news": [],
  "youtube": [],
  "rss": []
}
```

---

## 4. API Endpoints
*   `POST /api/research`: Ingests niche keyword, reads monitored channels/feeds from DB, triggers ingestion services in parallel, inserts result into `research_runs` table, and returns the inserted run.
*   `GET /api/research`: Queries past research runs for the logged-in user.
*   `POST /api/research/sources`: Creates a new monitored source (YouTube channel or RSS feed).
*   `DELETE /api/research/sources`: Deletes a monitored source by UUID.

---

## 5. Frontend UI (`/dashboard/research`)
*   **Niche Query Console**: Allows user to type in search terms and execute an ingestion run, displaying loading feedback (e.g. "Ingesting YouTube RSS...").
*   **Past Runs Grid**: Lists previous ingestion runs with metadata counts.
*   **Monitored Sources Configuration**: Dual-tab dashboard module to list, create, and delete target YouTube channels and blog RSS feed links.
