# Design Specification: Phase 3 AI Research Engine

**Date**: 2026-07-03  
**Status**: APPROVED  
**Target Workspace**: `e:\social`  

---

## 1. Scope & Goals
Phase 3 integrates the Gemini API to analyze raw content research datasets, automatically extract/rank trending opportunities into database-managed topics, and generate custom platform-specific marketing copy in Markdown formatting.

### Key Objectives:
1. **Gemini SDK Integration**: Install the official `@google/genai` library and instantiate client connections.
2. **Dynamic Model Settings**: Support reading the Gemini model name dynamically from Supabase database settings overrides.
3. **Structured Ingestion & Extraction**: Modify `/api/research` POST handler to generate a text summary and use Gemini responseSchema to output typed arrays of ranked topics, saving them into the `topics` table.
4. **Draft Generation API**: Create `/api/generate` Route Handler to generate markdown drafts based on selected parameters.
5. **UI Integration**: Update `/dashboard/research` to render summary, ranked topics, and add redirection to the base Content Studio page `/dashboard/studio`.

---

## 2. Service Implementation

### 1. `services/gemini.service.ts`
Interacts with `@google/genai` to analyze runs and generate copy.
```typescript
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { getSettingValue } from "@/utils/settings";

export interface RankedTopicInput {
  title: string;
  trend_score: number;
  why_trending: string;
  related_keywords: string[];
  suggested_angles: { platform: string; angle_description: string }[];
}

export class GeminiService {
  private static async getClient(): Promise<{ ai: GoogleGenAI; model: string }> {
    const apiKey = await getSettingValue("gemini_api_key", "GEMINI_API_KEY");
    const model = await getSettingValue("gemini_model", "GEMINI_MODEL") || "gemini-2.5-flash";

    if (!apiKey) {
      throw new Error("Gemini API key is not configured.");
    }

    return {
      ai: new GoogleGenAI({ apiKey }),
      model,
    };
  }

  static async generateSummary(rawData: any): Promise<string> {
    const { ai, model } = await this.getClient();
    const prompt = `You are a research analyst. Read this JSON dataset of trending queries, news articles, and youtube video stats:
${JSON.stringify(rawData)}

Write a concise 2-3 paragraph summary of the trending themes, insights, and content opportunities.`;

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return res.text || "No summary generated.";
  }

  static async extractRankedTopics(rawData: any): Promise<RankedTopicInput[]> {
    const { ai, model } = await this.getClient();
    const prompt = `Analyze this research dataset and extract the top 5 trending content opportunities:
${JSON.stringify(rawData)}

Rank them by trend score (0-100) and suggest platform angles.`;

    const schema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          trend_score: { type: Type.INTEGER },
          why_trending: { type: Type.STRING },
          related_keywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          suggested_angles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                platform: { type: Type.STRING },
                angle_description: { type: Type.STRING },
              },
              required: ["platform", "angle_description"],
            },
          },
        },
        required: ["title", "trend_score", "why_trending", "related_keywords", "suggested_angles"],
      },
    };

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    if (!res.text) return [];
    return JSON.parse(res.text) as RankedTopicInput[];
  }

  static async generatePost(topic: string, description: string, platform: string, tone: string, audience: string): Promise<string> {
    const { ai, model } = await this.getClient();
    const prompt = `Write a marketing post or article on:
Topic: ${topic}
Why Trending: ${description}
Target Platform: ${platform}
Target Tone: ${tone}
Target Audience: ${audience}

Write it strictly in raw Markdown format. Do not write backticks around the markdown content or meta introduction text. Just output the content.`;

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return res.text || "";
  }
}
```

---

## 3. Route Updates

### `POST /api/research` Orchestration Update
Refactor the post-ingestion step to run Gemini Summary and extraction:
```typescript
// ... Ingest rawData ...
const summary = await GeminiService.generateSummary(rawData);
const topics = await GeminiService.extractRankedTopics(rawData);

// Save Research Run
const { data: run, error: runErr } = await supabase
  .from("research_runs")
  .insert({ user_id: userId, niche, raw_data: rawData, summary })
  .select().single();

if (runErr) throw runErr;

// Save Topics
const topicsToInsert = topics.map((t) => ({
  research_run_id: run.id,
  title: t.title,
  trend_score: t.trend_score,
  why_trending: t.why_trending,
  related_keywords: t.related_keywords,
  suggested_angles: t.suggested_angles,
}));

if (topicsToInsert.length > 0) {
  const { error: topicsErr } = await supabase.from("topics").insert(topicsToInsert);
  if (topicsErr) throw topicsErr;
}
```

### `POST /api/generate` Route Handler
Creates and saves a new Markdown draft post based on selected parameters.

---

## 4. UI Layout Updates
*   **Research Ingestion Overview**: Displays Summary block and Opportunity cards. Opportunity cards display keywords and platform angle descriptions, and link to Content Studio.
*   **Base Content Studio**: Input controls for Topic Title, Platform, Tone, and Target Audience. Submitting prompts executes `/api/generate` and displays output inside a base Markdown viewer container.
