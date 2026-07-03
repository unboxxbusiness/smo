import { GoogleGenAI, Type, Schema } from "@google/genai";
import { getSettingValue } from "@/utils/settings";

export const KAMPUS_FILTER_STYLE_GUIDE = `# Kampus Filter Editorial Style Guide

## Identity
- Kampus Filter is a daily intelligence platform that helps ambitious students make education and career decisions. It is NOT a news website, a blog, or a media company.
- Every article must reduce uncertainty, increase confidence, and end with a clear action.
- The reader should finish knowing exactly what to do next.

## Writing Objective
- Do not report news. Interpret news, explain why it matters, explain how it affects students, and explain what action students should take.
- Always answer: What happened? Why does it matter? What should students do next?

## Tone of Voice
- Professional, calm, confident, helpful, trustworthy, objective, optimistic.
- Never sensational, dramatic, preachy, or fear-based.
- Write like an experienced mentor helping a younger student.

## Writing Style
- Use simple English.
- Short paragraphs. Heavy whitespace. One idea per paragraph.
- Avoid long introductions. Get to the point quickly.
- Every sentence should provide value. Every paragraph should answer: "So what?". If it doesn't, remove it.
- Mobile First: Max paragraph length is 3 sentences. Prefer 1 sentence paragraphs. Leave whitespace. Use bullets instead of long lists.

## Reading Level
- Target: 16-18 years old. Simple vocabulary. Explain technical terms simply with examples. Never assume prior knowledge.

## Hook & Headlines
- Start with the most important information. No clickbait (e.g. Good: "The CUET UG 2026 results are out, and counselling starts next." Bad: "This changes everything."). Never exaggerate.
- Headlines must promise clarity, not curiosity (e.g. Good: "CUET UG 2026 Results Are Out: What Students Should Do Next").

## Language
- Use active voice. Avoid passive voice. Specific nouns. Avoid filler.
- Replace "Due to the fact that" with "Because".
- Replace "It is important to note" with "Remember".
- NEVER use AI-generated phrases: "In today's rapidly evolving world", "As we navigate", "Game changer", "Revolutionary", "This changes everything", "In the digital age", "Needless to say", "It goes without saying", "Without further ado".

## Numbers & Sources
- Always use numbers when available (e.g., "More than 15 lakh students" instead of "Many students").
- Prefer official sources (Government, University, Company, Research papers, then trusted media).

## Layout & Article Structure (CRITICAL: Apply this structure if Target Platform is 'blog', 'newsletter', 'article', 'website', or long-form copy)
The output MUST strictly follow this exact markdown heading structure:
1. Headline (An engaging clear headline)
2. TL;DR (Maximum 5 bullets. Each bullet is 1 actionable sentence, easy to scan)
3. What's Happening? (Explain facts only. No opinions/predictions/fluff)
4. Why It Matters (Connect news to students: education, career, future, or opportunity impact)
5. The Opportunity (Identify opportunities: scholarships, internships, courses, AI skills, certifications, projects, competitions, research programs, campus hiring, exchange programs. Always show opportunities)
6. What Students Should Do Next (Provide a checklist of actions using action verbs like Download, Register, Apply, Compare, Prepare, Learn, Practice, Build, Track, Bookmark. Avoid vague advice)
7. Key Takeaways (Maximum 5 points using checkmarks, e.g. ✓ Register early.)
8. Final Take (Never summarize. Answer: "What does this mean for students over the next 6-12 months?". End with one memorable sentence)

## Short-Form Adaptation (LinkedIn, Twitter/X, Threads, Facebook)
If the Target Platform is a social media/short-form platform (like linkedin, twitter/x, threads, facebook):
- Do not use the full 8-section layout. Instead, write a single engaging post suitable for that platform.
- It must still adhere strictly to the tone (mentor-like, calm, confident), simple English, heavy whitespace, very short paragraphs (1-3 sentences max), a strong clear hook, numbers instead of vague adjectives, a clear call to action, and strictly avoid all forbidden AI-generated phrases.`;


export interface RankedTopicInput {
  title: string;
  trend_score: number;
  why_trending: string;
  related_keywords: string[];
  suggested_angles: { platform: string; angle_description: string }[];
  confidence_score: number;
  virality_score: number;
  student_impact_score: number;
  seo_opportunity_score: number;
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
    const prompt = `Analyze this research dataset to discover the highest-value content topics for Kampus Filter (an intelligence platform helping students make career and education decisions).
Input Data:
${JSON.stringify(rawData)}

Instructions:
1. Apply the Signal Convergence Rule: Select a topic only when multiple independent sources align (Priority 1: Official Announcements from NTA/UGC/DU/IITs etc., Priority 2: Google Trends/Search Demand, Priority 3: Education News like Careers360/CollegeDunia, Priority 4-6: Tech Blogs/AI Newsletters/YouTube creators, Priority 7-8: Community & Job market signals like Reddit/LinkedIn/Internshala, Priority 9: National Scholarship portals, Priority 10: Competitor Gaps). The confidence score increases with the number of aligning signals.
2. For each candidate topic, evaluate the following Editorial Questions:
   - Would a student search for this within the next 7 days?
   - Will this still be useful in 6 months (evergreen potential)?
   - Can Kampus Filter provide unique analysis instead of repeating the news?
   - Can the article naturally generate a blog, LinkedIn post, Instagram carousel, X thread, newsletter, and video script from one core idea?
   - Does it help a student make a better decision today?
   *IF the answer to any of these questions is NO, REJECT the topic.*
3. For the remaining top 5 topics, compute:
   - Confidence Score (0–100) based on signal convergence.
   - Virality Score (0–100) based on search growth and social/community indicators.
   - Student Impact Score (0–100) based on how much it affects decisions/outcomes.
   - SEO Opportunity Score (0–100) based on search demand and competitor gaps.
   - Overall Trend Score (0–100) using this selection framework:
     - Search Demand (30%) + Search Growth (15%) + Student Impact (20%) + Career Impact (15%) + Education Relevance (10%) + SEO Opportunity (5%) + Social Shareability (5%)`;

    const schema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          trend_score: { type: Type.INTEGER },
          why_trending: { type: Type.STRING },
          confidence_score: { type: Type.INTEGER },
          virality_score: { type: Type.INTEGER },
          student_impact_score: { type: Type.INTEGER },
          seo_opportunity_score: { type: Type.INTEGER },
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
        required: [
          "title",
          "trend_score",
          "why_trending",
          "confidence_score",
          "virality_score",
          "student_impact_score",
          "seo_opportunity_score",
          "related_keywords",
          "suggested_angles"
        ],
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
    const prompt = `Write a post or article based on:
Topic: ${topic}
Why Trending/Description: ${description}
Target Platform: ${platform}
Target Tone: ${tone}
Target Audience: ${audience}

Instructions:
1. Apply the Kampus Filter Editorial Style Guide constraints.
2. If the Target Platform is an article, blog post, newsletter, website copy, or general long-form, you MUST strictly structure it with the following headings exactly:
   # Headline
   ## TL;DR
   ## What's Happening?
   ## Why It Matters
   ## The Opportunity
   ## What Students Should Do Next
   ## Key Takeaways
   ## Final Take
3. If the Target Platform is social media (such as linkedin, twitter/x, threads, facebook), adapt the format to a short-form post with heavy whitespace and short paragraphs, keeping a strong hook and clear action list at the end.
4. Output strictly raw Markdown content. Do not enclose the output in markdown code block wrappers (do not start with \`\`\`markdown or end with \`\`\`).`;

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: KAMPUS_FILTER_STYLE_GUIDE,
      }
    });

    return res.text || "";
  }

  static async generateAllPosts(topic: string, description: string, tone: string, audience: string): Promise<Record<string, string>> {
    const { ai, model } = await this.getClient();
    const prompt = `Write content in 6 different formats based on this topic:
Topic: ${topic}
Why Trending/Context: ${description}
Target Tone: ${tone}
Target Audience: ${audience}

Formats to generate:
1. blog (Blog Article): Strictly structure with these headings: # Headline, ## TL;DR, ## What's Happening?, ## Why It Matters, ## The Opportunity, ## What Students Should Do Next, ## Key Takeaways, ## Final Take. Detailed and comprehensive.
2. linkedin (LinkedIn Post): Engaging professional copy, heavy whitespace, short paragraphs, strong hook, bulleted action items, relevant hashtags.
3. twitter (X / Twitter Thread): Multiple tweets numbered 1/x to x/x, separated by "---".
4. instagram (Instagram Carousel Concept): A slide-by-slide text breakdown (Slide 1: Hook, Slide 2: Context, Slide 3: Core Tip, Slide 4: Key Steps, Slide 5: Action Check).
5. newsletter (Newsletter Section): An informative summary, structured with a title, a short message, a checklist, and a call to action.
6. video (Video Script): A video script with speaker lines (Speaker: "Here is...") and visual cues (like [Visual: show web screen]).

Return a JSON object containing keys: "blog", "linkedin", "twitter", "instagram", "newsletter", "video", where each value is the raw markdown content for that format. Do not write markdown code block wrappers around the JSON.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        blog: { type: Type.STRING },
        linkedin: { type: Type.STRING },
        twitter: { type: Type.STRING },
        instagram: { type: Type.STRING },
        newsletter: { type: Type.STRING },
        video: { type: Type.STRING },
      },
      required: ["blog", "linkedin", "twitter", "instagram", "newsletter", "video"],
    };

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: KAMPUS_FILTER_STYLE_GUIDE,
      }
    });

    if (!res.text) {
      throw new Error("No content generated.");
    }

    return JSON.parse(res.text) as Record<string, string>;
  }

  static async refineContent(text: string, action: "expand" | "shorten" | "polish" | "custom", instruction?: string): Promise<string> {
    const { ai, model } = await this.getClient();
    
    let systemPrompt = "You are an expert editor. Modify the text provided by the user based on the instructions.";
    
    if (action === "expand") {
      systemPrompt = "You are an expert content writer. Expand the provided text by adding relevant details, examples, and depth, while maintaining its original tone.";
    } else if (action === "shorten") {
      systemPrompt = "You are an expert copyeditor. Shorten the provided text to be concise, clear, and punchy, removing fluff while preserving key information.";
    } else if (action === "polish") {
      systemPrompt = "You are an expert writer. Refine the provided text to improve grammar, flow, and professional impact, making it sound highly polished.";
    } else if (action === "custom" && instruction) {
      systemPrompt = `You are a professional assistant. Rewrite the provided text according to this custom instruction: "${instruction}"`;
    }

    const prompt = `Text to modify:
  "${text}"

  Output ONLY the modified text. Do not include any introductory comments, greetings, markdown backtick wrappers, or explanation.`;

    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: `${systemPrompt}\n\nApply the following style guide constraints in your modifications:\n${KAMPUS_FILTER_STYLE_GUIDE}`,
      }
    });

    return res.text || text;
  }
}
