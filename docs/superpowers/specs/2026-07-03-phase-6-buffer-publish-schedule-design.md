# Design Specification: Phase 6 Buffer Publish & Scheduling

**Date**: 2026-07-03  
**Status**: APPROVED  
**Target Workspace**: `e:\social`  

---

## 1. Scope & Goals
Phase 6 coordinates content distribution. It integrates the Buffer API to list connected social channels, formats rich markdown into standard plain text, schedules posts or triggers instant deliveries, and aggregates run logs tracking failures or success logs.

### Key Objectives:
1. **Markdown Formatting Parser**: Convert markdown posts (headings, bold, lists, links) into plain text for social networks.
2. **Buffer OAuth Service**: Create the dynamic API client lookup, profiles list fetcher, and posting controller.
3. **Queue Endpoints**: Build Next.js route handlers `/api/posts/profiles`, `/api/posts/[id]/publish`, and `/api/posts/logs`.
4. **Publish Modal Drawer**: Re-configure the Content Studio header to launch profile checkmark forms and schedule time selectors.
5. **Publishing Dashboard**: Create the `/dashboard/publishing` scheduled items list and aggregate history logs.

---

## 2. Endpoints

### 1. `GET /api/posts/profiles`
Fetches authenticated user's connected Buffer profiles dynamically, falling back to mock listings if access tokens are not configured.

### 2. `POST /api/posts/[id]/publish`
Triggers publishing tasks. Accepts `{ profileIds: string[], scheduledAt?: string, publishNow: boolean }`. Formats markdown, updates Supabase logs, and alters post status.

### 3. `GET /api/posts/logs`
Returns database tracking history from `publish_logs` joined with titles.

---

## 3. UI Design Specifications

### 1. Studio Publish Modal
*   **Profiles Grid**: List service cards (LinkedIn, Twitter/X) with checkmark controls.
*   **Time Selector**: Datetime input selector enabling users to schedule dates.

### 2. Publishing Dashboard (`/dashboard/publishing`)
*   **Queue Panel**: Shows scheduled card rows, with force publish buttons and cancel triggers.
*   **Logs Panel**: Lists history of posting events with colored status indicators (green/red) and details toggle cards.
