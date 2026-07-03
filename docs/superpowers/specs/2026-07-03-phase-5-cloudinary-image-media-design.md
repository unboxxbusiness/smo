# Design Specification: Phase 5 Cloudinary & Media Library

**Date**: 2026-07-03  
**Status**: APPROVED  
**Target Workspace**: `e:\social`  

---

## 1. Scope & Goals
Phase 5 integrates image management. It provides direct serverless uploads to Cloudinary, database-backed media logs in Supabase, a standalone Media Library console, and an inline media picker modal within the Content Studio to attach cover banners and body markdown tags.

### Key Objectives:
1. **Database Tracking**: Create the `media` tracking table inside Supabase schema.
2. **Cloudinary Node Service**: Expose an upload and destroy interface inside a custom Node class.
3. **Upload & Collection APIs**: Build Next.js Route Handlers to upload buffers, write DB logs, query media arrays, and delete resources.
4. **Media Console Interface**: Create the `/dashboard/media` dropzone upload and image grid layout.
5. **Content Studio Integrations**: Implement cover image selection banners and inline text markdown insertions.

---

## 2. Database Schema
```sql
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

---

## 3. Endpoints

### 1. `GET /api/media`
Lists the authenticated user's uploaded assets metadata from the database.

### 2. `POST /api/media`
Extracts files from `multipart/form-data` payloads, uploads buffers to Cloudinary, and saves references in the `media` database.

### 3. `DELETE /api/media/[id]`
Looks up resource by database ID, destroys Cloudinary asset by public ID, and deletes database row.

---

## 4. Studio UI Integrations
*   **Post Cover Banner**: Add `image_url` metadata inputs in editor presets, saving updates to the `posts` table and rendering the image at the top of live previews.
*   **Inline Insertion**: A toolbar icon that pops open a selector modal. Clicking an image appends `![caption](image_url)` to the textarea where the cursor is active.
