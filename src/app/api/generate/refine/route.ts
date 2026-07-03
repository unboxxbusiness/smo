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
