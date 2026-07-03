# Design Specification: Phase 7 Analytics, Settings & Dashboard Stats

**Date**: 2026-07-03  
**Status**: APPROVED  
**Target Workspace**: `e:\social`  

---

## 1. Scope & Goals

Phase 7 completes the platform with analytics visualizations, a settings management console, and live dynamic stats on the home dashboard.

### Key Objectives:
1. **Analytics Dashboard**: Charts and tables visualizing content activity using `recharts`.
2. **Settings Console**: Credential and preference management form persisting to Supabase.
3. **Dashboard Stats API**: `/api/dashboard/stats` endpoint returning live aggregated counts.
4. **Home Dashboard Update**: Replace static placeholder stats with live data.

---

## 2. Endpoints

### `GET /api/dashboard/stats`
Runs parallel Supabase count queries:
- `research_runs` total count
- `topics` total count
- `posts` total count
- `posts` filtered by `status = published` count
- `publish_logs` success vs failure breakdown

Returns a single JSON object with all counts.

### `GET /api/settings`
Returns current user settings row from Supabase.

### `POST /api/settings`
Upserts user settings row (credentials + preferences) in Supabase.

---

## 3. UI Design Specifications

### 1. Analytics Dashboard (`/dashboard/analytics`)
- **Stats Row**: 4 stat cards (Research Runs, Topics Found, Drafts Created, Published Posts)
- **Donut Chart**: Post status breakdown (Draft / Scheduled / Published / Archived)
- **Bar Chart**: Publishing activity over last 30 days from `publish_logs`
- **Success Rate Ring**: Ratio of successful to failed publish events
- **Top Topics Table**: Top 10 topics ranked by `trend_score`

### 2. Settings Console (`/dashboard/settings`)
- **API Credentials Section**: Password fields with reveal toggles for Gemini, Cloudinary, Buffer, NewsAPI, SerpApi, YouTube keys
- **Preferences Section**: Default platform, preferred tone, timezone selectors
- **Save Button**: Upserts to Supabase settings table with success toast

### 3. Home Dashboard (`/dashboard`)
- Fetches live counts from `/api/dashboard/stats`
- Renders animated stat cards replacing static placeholder values
