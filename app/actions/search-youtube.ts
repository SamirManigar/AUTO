"use server";

import { searchYouTubeVideos } from "@/lib/youtube/data-api";
import type { RawYouTubeVideoData } from "@/lib/ai/timeline-generator";

// Keyword-based pre-filter: removes videos that are clearly off-topic
// This runs BEFORE the LLM so at minimum obviously irrelevant content is gone
function preFilter(videos: RawYouTubeVideoData[], coreKeywords: string[]): RawYouTubeVideoData[] {
  if (coreKeywords.length === 0) return videos;
  
  return videos.filter(v => {
    const haystack = `${v.title} ${v.channelTitle} ${v.description}`.toLowerCase();
    // At least ONE of the core keywords must appear somewhere in the video metadata
    return coreKeywords.some(kw => haystack.includes(kw.toLowerCase()));
  });
}

// LLM filter: only removes the most obvious AI slop and pre-existing compilations
async function filterWithLLM(videos: RawYouTubeVideoData[]): Promise<RawYouTubeVideoData[]> {
  if (videos.length === 0) return [];
  
  const videoPayload = videos.map(v => ({
    id: v.youtubeId,
    title: v.title,
    channel: v.channelTitle,
  }));

  const prompt = `You are a content filter for a YouTube Shorts curation tool. Be GENEROUS — your only job is to remove spam.

REMOVE ONLY if a video is CLEARLY one of:
- An AI-narrated Reddit/story video (e.g. "Am I the villain for...", story time AI)
- A pre-existing "Top X" countdown compilation someone already assembled
- Pure promotional/ad content

KEEP everything else. If unsure → KEEP IT.

Videos to evaluate:
${JSON.stringify(videoPayload, null, 2)}

Return JSON: { "allowed_ids": ["id1", "id2", ...] }`;

  let resultText = "";

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    
    if (groqRes.ok) {
      const data = await groqRes.json();
      resultText = data.choices[0].message.content;
    } else {
      throw new Error("Groq unavailable");
    }
  } catch {
    try {
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (orRes.ok) {
        const data = await orRes.json();
        resultText = data.choices[0].message.content;
      } else {
        // Both AI services unavailable — return as-is (pre-filter already ran)
        return videos;
      }
    } catch {
      return videos;
    }
  }

  if (resultText.includes("```")) {
    resultText = resultText.replace(/```json/g, "").replace(/```/g, "");
  }

  try {
    const parsed = JSON.parse(resultText);
    if (parsed.allowed_ids && Array.isArray(parsed.allowed_ids)) {
      const allowedSet = new Set(parsed.allowed_ids);
      return videos.filter(v => allowedSet.has(v.youtubeId));
    }
  } catch (e) {
    console.error("[filter] Failed to parse LLM response:", e);
  }

  return videos;
}

// Extract 2-4 most meaningful/unique keywords from the combined topic + niche
function extractCoreKeywords(topic: string, niche: string, subNiche: string): string[] {
  const keywords: string[] = [];

  if (subNiche && subNiche !== "All Sub-Niches") {
    keywords.push(...subNiche.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  }

  const stopWords = new Set([
    "the", "most", "and", "for", "with", "that", "this", "from", "your", "their",
    "when", "what", "how", "a", "an", "to", "in", "of", "on", "at", "by", "or",
    "be", "are", "is", "was", "top", "best", "all", "rank", "ranked", "ranking",
    "moments", "moment", "highlights", "highlight", "funniest", "insane", "epic",
    "incredible", "amazing", "ultimate", "viral", "trending", "worst", "compilation",
    "list", "ever", "most", "crazy", "shocking", "wildest", "greatest", "biggest"
  ]);
  const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  keywords.push(...topicWords.slice(0, 3));

  return [...new Set(keywords)];
}

// Build a clean, targeted YouTube query — short and focused
function buildYouTubeQuery(topic: string, niche: string, subNiche: string): string {
  let queryParts: string[] = [];

  // Use sub-niche as the primary anchor if available
  if (subNiche && subNiche !== "All Sub-Niches") {
    // Clean emoji from sub-niche
    queryParts.push(subNiche.replace(/[\p{Emoji}]/gu, "").trim());
  } else if (niche && niche !== "All Niches") {
    queryParts.push(niche.replace(/[\p{Emoji}]/gu, "").trim());
  }

  // Strip all aggregate/ranking/superlative framing words — keep only the raw subject
  const cleanTopic = topic
    .replace(/top\s*\d+\s*/gi, "")
    .replace(/\b(compilation|list|ranking|rank|ranked|best|worst|funniest|insane|epic|most|incredible|amazing|ultimate|moments?|highlights?|all|trending|viral|crazy|shocking|wildest|greatest|biggest|ever|best of|the)\b/gi, "")
    .replace(/['"#]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(" ");

  if (cleanTopic) queryParts.push(cleanTopic);

  // Keep the final query short and punchy for YouTube's search engine
  const query = queryParts.join(" ").trim().substring(0, 100);
  
  return `${query} shorts`;
}

export async function searchYouTubeVideosAction(
  topic: string,
  niche: string = "All Niches",
  subNiche: string = "All Sub-Niches"
): Promise<RawYouTubeVideoData[]> {
  const ytQuery = buildYouTubeQuery(topic, niche, subNiche);
  const coreKeywords = extractCoreKeywords(topic, niche, subNiche);

  console.log(`[search] Query: "${ytQuery}"`);
  console.log(`[search] Core keywords for pre-filter:`, coreKeywords);

  // Fetch up to 50 from page 1
  const page1 = await searchYouTubeVideos({ query: ytQuery, maxResults: 50 });
  let allVideos = page1.videos;

  // Fetch page 2 if available
  if (page1.nextPageToken) {
    try {
      const page2 = await searchYouTubeVideos({
        query: ytQuery,
        maxResults: 25,
        pageToken: page1.nextPageToken,
      });
      allVideos = [...allVideos, ...page2.videos];
    } catch {
      // Page 2 failed — proceed with what we have
    }
  }

  // Deduplicate by ID
  const seen = new Set<string>();
  const unique = allVideos.filter(v => {
    if (seen.has(v.youtubeId)) return false;
    seen.add(v.youtubeId);
    return true;
  });

  // Duration filter: only keep clips 30 seconds or under
  const shortOnly = unique.filter(v => v.durationSeconds > 0 && v.durationSeconds <= 30);

  console.log(`[search] Raw candidates: ${unique.length}, ≤30s clips: ${shortOnly.length}`);

  // Step 1: Keyword pre-filter — removes obviously off-topic results fast
  const preFiltered = coreKeywords.length > 0 ? preFilter(shortOnly, coreKeywords) : shortOnly;
  
  console.log(`[search] After pre-filter: ${preFiltered.length}`);

  // Step 2: LLM filter — removes AI narration / existing compilations
  const filtered = await filterWithLLM(preFiltered);
  
  console.log(`[search] After LLM filter: ${filtered.length}`);

  return filtered.slice(0, 50);
}
