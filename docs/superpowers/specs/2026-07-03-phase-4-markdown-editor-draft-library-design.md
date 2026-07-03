# Design Specification: Phase 4 Markdown Editor & Draft Library

**Date**: 2026-07-03  
**Status**: APPROVED  
**Target Workspace**: `e:\social`  

---

## 1. Scope & Goals
Phase 4 builds the core document management system. It introduces a split-screen Markdown Editor with live parsing previews, text-selection AI refiners, and the Draft Library management page supporting CRUD operations, duplicating, and archiving.

### Key Objectives:
1. **API In-Line Refiner**: Create `/api/generate/refine` supporting AI transformations (expand, shorten, polish, custom instructions) for selections or full documents.
2. **Draft Library API**: Establish POST, GET, PUT, DELETE, and clone routes at `/api/posts` and `/api/posts/[id]`.
3. **Monospace Editor & Selection State**: Build editing workspace in Content Studio that captures highlighted text indexes and applies AI updates inline.
4. **Live Markdown Rendering**: Integrate `react-markdown` and style it with sleek dark-themed classes.
5. **Post Cataloging & Actions**: Build the Draft Library page with title searching, status filtering tabs, duplicate clones, archives, and deletes.

---

## 2. API Endpoints

### 1. `POST /api/generate/refine`
Accepts a block of text and returns the Gemini-modified version.
*   **Payload**: `{ text: string, action: 'expand' | 'shorten' | 'polish' | 'custom', instruction?: string }`
*   **Response**: `{ refinedText: string }`

### 2. `GET /api/posts`
Lists all posts for the authenticated user, supporting optional search queries and status filters.

### 3. `POST /api/posts`
Creates a custom post. Supports duplication using search parameters `?duplicateFrom=POST_ID`.

### 4. `PUT /api/posts/[id]`
Updates specific fields: `title`, `markdown`, `status`, `scheduled_for`, `content_type`.

### 5. `DELETE /api/posts/[id]`
Permanently deletes the record.

---

## 3. UI Design Specifications

### 1. Content Studio Split-Screen (`/dashboard/studio`)
*   **Left Editor Workspace**: Textarea styled in a monospace font (`font-mono`). Detects selection changes:
    ```typescript
    const selection = window.getSelection();
    // Reads selectionStart and selectionEnd on the textarea element
    ```
*   **Refinement Toolbar**: Trigger buttons for Polish, Expand, Shorten, and Custom Prompt, indicating if editing "selected text" or the "entire document".
*   **Right Live Preview**: Standard markdown parsing wrapper with custom styling for lists, headings, and code.

### 2. Draft Library Catalog (`/dashboard/drafts`)
*   **Filters**: Full text search on titles and tabs for Status (All, Draft, Scheduled, Published, Archived).
*   **Actions Row**: Clean list design with quick-action buttons for duplicating, deleting, editing, or changing status.
