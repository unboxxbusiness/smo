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
