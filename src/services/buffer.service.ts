import { getSettingValue } from "@/utils/settings";

export interface BufferProfile {
  id: string;
  service: string;
  formatted_username: string;
}

export class BufferService {
  private static async getToken(): Promise<string> {
    const token = await getSettingValue("buffer_access_token", "BUFFER_ACCESS_TOKEN");
    if (!token) throw new Error("Buffer access token is not configured.");
    return token;
  }

  // Convert markdown to clean plain text for social networks
  static cleanMarkdown(markdown: string): string {
    if (!markdown) return "";
    let text = markdown;

    // Remove headers (e.g. # Header -> HEADER)
    text = text.replace(/^(#{1,6})\s+(.+)$/gm, (_, __, title) => title.toUpperCase());

    // Remove bold and italics formatting (e.g. **bold** -> bold)
    text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
    text = text.replace(/(\*|_)(.*?)\1/g, "$2");

    // Remove links but keep text (e.g. [text](url) -> text (url))
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)");

    // Clean inline code ticks (e.g. `code` -> code)
    text = text.replace(/`(.*?)`/g, "$1");

    return text.trim();
  }

  // Fetch connected profiles
  static async getProfiles(): Promise<BufferProfile[]> {
    try {
      const token = await this.getToken();
      const res = await fetch(`https://api.bufferapp.com/1/profiles.json?access_token=${token}`);
      if (!res.ok) throw new Error(`Buffer API profiles query failed: ${res.statusText}`);
      const data = await res.json();
      return (data || []).map((p: any) => ({
        id: p.id,
        service: p.service,
        formatted_username: p.formatted_username || p.name || "Profile",
      }));
    } catch (err: any) {
      console.warn("Buffer profiles fetch failed, using fallback mock list:", err.message);
      // Mock Fallback profiles for UI testing if credentials are missing
      return [
        { id: "mock-li", service: "linkedin", formatted_username: "Simulated LinkedIn" },
        { id: "mock-x", service: "twitter", formatted_username: "Simulated X (Twitter)" },
      ];
    }
  }

  // Create update (publish/schedule)
  static async createUpdate(
    profileIds: string[],
    text: string,
    imageUrl?: string,
    scheduledAt?: string,
    publishNow: boolean = false
  ): Promise<any> {
    const token = await this.getToken();
    const cleanText = this.cleanMarkdown(text);

    // Build URLSearchParams form data matching Buffer API requirements
    const params = new URLSearchParams();
    profileIds.forEach((id) => params.append("profile_ids[]", id));
    params.append("text", cleanText);

    if (publishNow) {
      params.append("now", "true");
    } else if (scheduledAt) {
      params.append("scheduled_at", scheduledAt);
    }

    if (imageUrl) {
      params.append("media[photo]", imageUrl);
    }

    const res = await fetch(`https://api.bufferapp.com/1/updates/create.json?access_token=${token}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Buffer post creation failed: ${res.statusText}`);
    }

    return await res.json();
  }
}
