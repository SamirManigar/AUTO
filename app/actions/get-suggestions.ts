"use server";

import { unstable_cache } from "next/cache";
import { fetchTrendingVideos } from "@/lib/youtube/data-api";

export async function getTrendingSuggestions(niche: string = "All Niches", subNiche: string = "All Sub-Niches") {
  return unstable_cache(
    async () => {
      try {
        const trending = await fetchTrendingVideos(20);
        const trendingTitles = trending.map(v => v.title).join("\n");
        
        let nicheContext = "";
        if (niche !== "All Niches") {
          nicheContext = ` Focus STRICTLY on the Niche: "${niche}"`;
          if (subNiche !== "All Sub-Niches") {
            nicheContext += ` and specifically the Sub-Niche: "${subNiche}".`;
          }
        }
        
        const prompt = `You are an expert YouTube Shorts channel strategist specializing in viral compilation content for 2026.

The most effective and monetizable Shorts compilations in 2026 are THEMATIC and CURATED — not random. They frame the clips with a clear, specific angle like:
- "Comedians Destroying Hecklers" (not just "Funny moments")
- "GTA Roleplay Drama That Went Too Far" (not just "GTA clips")
- "Streamers Reacting to Their Own Old Clips" (specific angle)
- "When the Crowd Turns on the Comedian" (story-driven)

IMPORTANT RULES for topic generation:
1. Topics must be SPECIFIC and THEMATIC, not generic.
2. Topics must be findable as raw, single-moment clips on YouTube (not existing compilations).
3. Avoid generic topics like "Top 5 funny videos" or "Best moments."
4. Topics should feel like a curator's unique angle, not a random list.
${nicheContext}

Based on currently trending YouTube content (listed below for format inspiration), generate 20 unique and thematic compilation topics for a YouTube Shorts channel.

You MUST return a JSON object with a single key "topics" containing an array of exactly 20 strings.

Trending Titles for inspiration only:
${trendingTitles}`;

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
             throw new Error("Groq failed");
          }
        } catch (err) {
          // Fallback to OpenRouter
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
             return ["Comedians Destroying Hecklers", "Streamers Losing Their Mind at Viewers", "Sunday League Football Carnage", "VTubers Having an Existential Crisis Live", "Podcasters Getting Called Out Mid-Episode", "Crowd Work Gone Horribly Wrong", "Local Combat Sports Knockouts", "Streamers Caught in 4K", "When the Prank Goes Too Far", "GTA Roleplay Drama That Escalated Fast"];
          }
        }

        if (resultText.includes("```")) {
          resultText = resultText.replace(/```json/g, "").replace(/```/g, "");
        }

        const parsed = JSON.parse(resultText);
        if (parsed.topics && Array.isArray(parsed.topics)) {
          return parsed.topics;
        }
        return ["Comedians Destroying Hecklers", "Streamers Losing Their Mind", "Sunday League Football Carnage", "VTubers Having a Crisis Live", "Podcasters Getting Called Out"];
      } catch (error) {
        console.error("Failed to generate suggestions:", error);
        return ["Comedians Destroying Hecklers", "Streamers Losing Their Mind", "Sunday League Football Carnage", "VTubers Having a Crisis Live", "Podcasters Getting Called Out"];
      }
    },
    [`trending-suggestions-v3-${niche.replace(/\s+/g, '-')}-${subNiche.replace(/\s+/g, '-')}`],
    {
      revalidate: 86400, // 24 hours cache
    }
  )();
}
