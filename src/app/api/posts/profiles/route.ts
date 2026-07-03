import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { BufferService } from "@/services/buffer.service";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await BufferService.getProfiles();
    return NextResponse.json(profiles);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
