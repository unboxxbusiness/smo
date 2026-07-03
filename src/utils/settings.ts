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
