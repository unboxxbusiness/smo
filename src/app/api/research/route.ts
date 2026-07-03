import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ResearchService } from "@/services/research.service";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { niche } = body;

    if (!niche || typeof niche !== "string") {
      return NextResponse.json({ error: "Missing or invalid niche keyword" }, { status: 400 });
    }

    const run = await ResearchService.runIngestion(niche, user.id);

    return NextResponse.json(run);
  } catch (err: any) {
    console.error("Research ingestion endpoint failed:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: runs, error } = await supabase
      .from("research_runs")
      .select("*, topics(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(runs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
