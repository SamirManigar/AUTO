"use client";

import { useState } from "react";
import { searchYouTubeVideosAction } from "@/app/actions/search-youtube";
import { generateCompilationAction } from "@/app/actions/generate-compilation";
import { getTrendingSuggestions } from "@/app/actions/get-suggestions";
import { NICHES, NICHE_KEYS } from "@/lib/constants/niches";
import type { RawYouTubeVideoData } from "@/lib/ai/timeline-generator";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<RawYouTubeVideoData[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const [vaultSaved, setVaultSaved] = useState(false);

  const [selectedNiche, setSelectedNiche] = useState("All Niches");
  const [selectedSubNiche, setSelectedSubNiche] = useState("All Sub-Niches");

  const [allSuggestions, setAllSuggestions] = useState<string[]>([]);
  const [visibleSuggestions, setVisibleSuggestions] = useState<string[]>([]);

  useEffect(() => {
    getTrendingSuggestions(selectedNiche, selectedSubNiche).then((suggestions) => {
      setAllSuggestions(suggestions);
      setVisibleSuggestions([...suggestions].sort(() => 0.5 - Math.random()).slice(0, 5));
    });
  }, [selectedNiche, selectedSubNiche]);

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    if (allSuggestions.length > 5) {
      setVisibleSuggestions([...allSuggestions].sort(() => 0.5 - Math.random()).slice(0, 5));
    }
    performSearch(suggestion);
  };

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const videos = await searchYouTubeVideosAction(searchQuery, selectedNiche, selectedSubNiche);
      setResults(videos);
      setSelected(new Set()); // reset selections on new search
    } catch (error) {
      console.error(error);
      alert("Failed to search YouTube.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await performSearch(query);
  };

  const toggleSelection = (videoId: string) => {
    const newSet = new Set(selected);
    if (newSet.has(videoId)) {
      newSet.delete(videoId);
    } else {
      newSet.add(videoId);
    }
    setSelected(newSet);
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    
    setIsGenerating(true);
    try {
      const selectedVideos = results.filter(v => selected.has(v.youtubeId));
      const compilationId = await generateCompilationAction(query, selectedVideos);
      router.push(`/compilation/${compilationId}`);
    } catch (error) {
      console.error(error);
      alert("Failed to generate compilation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToVault = () => {
    if (selected.size === 0) return;
    const selectedVideos = results.filter(v => selected.has(v.youtubeId));
    try {
      const existing = JSON.parse(localStorage.getItem("clip-vault") ?? "[]");
      const existingIds = new Set(existing.map((v: { youtubeId: string }) => v.youtubeId));
      const newClips = selectedVideos.filter(v => !existingIds.has(v.youtubeId));
      localStorage.setItem("clip-vault", JSON.stringify([...existing, ...newClips]));
      setVaultSaved(true);
      setTimeout(() => setVaultSaved(false), 2500);
    } catch {
      alert("Failed to save to vault.");
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header & Search Bar */}
        <section className="text-center space-y-4 pt-12">
          <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Compilation Generator
          </h1>
          <p className="text-zinc-400 text-lg">Search a topic, pick your clips, and let AI build a viral compilation.</p>
          
          {/* Niche Selectors */}
          <div className="flex justify-center gap-4 mt-8 animate-fade-in">
            <select 
              value={selectedNiche} 
              onChange={(e) => {
                setSelectedNiche(e.target.value);
                setSelectedSubNiche(NICHES[e.target.value][0]);
              }}
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer"
            >
              {NICHE_KEYS.map(niche => <option key={niche} value={niche}>{niche}</option>)}
            </select>

            {NICHES[selectedNiche]?.length > 0 && selectedNiche !== "All Niches" && (
              <select 
                value={selectedSubNiche} 
                onChange={(e) => setSelectedSubNiche(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer animate-fade-in"
              >
                {NICHES[selectedNiche].map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            )}
          </div>

          <form onSubmit={handleSearch} className="flex gap-4 max-w-2xl mx-auto mt-6">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Top 5 funniest moments of cats"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
            <button 
              type="submit" 
              disabled={isSearching || !query.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-8 py-4 rounded-xl font-bold transition-all"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </form>

          {/* Trending Suggestions */}
          {visibleSuggestions.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-6 max-w-3xl mx-auto animate-fade-in">
              <span className="text-zinc-500 text-sm w-full mb-1">🔥 Trending Topics</span>
              {visibleSuggestions.map((suggestion, idx) => (
                <button
                  key={`${suggestion}-${idx}`}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700 text-sm rounded-full transition-all border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Results Grid */}
        {results.length > 0 && (
          <section className="pb-32">
            <h2 className="text-2xl font-bold mb-6">Select Clips ({selected.size} selected)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {results.map((video) => (
                <div 
                  key={video.youtubeId} 
                  onClick={() => toggleSelection(video.youtubeId)}
                  className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all group ${
                    selected.has(video.youtubeId) ? "border-purple-500 scale-105 shadow-[0_0_20px_rgba(168,85,247,0.4)]" : "border-zinc-800 hover:border-zinc-600"
                  }`}
                >
                  {video.thumbnailUrl ? (
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="w-full aspect-video bg-zinc-900 flex items-center justify-center">No Thumbnail</div>
                  )}
                  
                  <div className="p-4 bg-zinc-900 h-full">
                    <h3 className="font-bold line-clamp-2 text-sm">{video.title}</h3>
                    <p className="text-zinc-400 text-xs mt-2">{video.channelTitle}</p>
                    <p className="text-zinc-500 text-xs mt-1">{Math.round(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, '0')}</p>
                  </div>

                  {/* Selection Indicator */}
                  <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selected.has(video.youtubeId) ? "bg-purple-500 border-purple-500" : "border-white bg-black/50"
                  }`}>
                    {selected.has(video.youtubeId) && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Preview Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setPreviewVideo(video.youtubeId); }}
                    className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 shadow-lg"
                    title="Preview Video"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Floating Action Bar */}
        {selected.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black to-transparent pointer-events-none flex justify-center">
            <div className="pointer-events-auto bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <div className="text-lg">
                <span className="font-bold text-purple-400">{selected.size}</span> clips selected
              </div>

              {/* Save to Vault */}
              <button
                onClick={handleSaveToVault}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all border ${
                  vaultSaved
                    ? "bg-green-600 border-green-500 text-white"
                    : "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200"
                }`}
              >
                {vaultSaved ? (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Saved!</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg> Save to Vault</>
                )}
              </button>

              {/* View Vault */}
              <button
                onClick={() => router.push("/vault")}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                Vault
              </button>

              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 px-8 py-3 rounded-xl font-bold shadow-lg transition-all"
              >
                {isGenerating ? "Generating..." : "⚡ Generate Compilation"}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Preview Modal */}
      {previewVideo && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewVideo(null)}
        >
          <div className="relative w-full max-w-sm aspect-[9/16] bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setPreviewVideo(null)}
              className="absolute top-4 right-4 z-10 bg-black/70 text-white p-2 rounded-full hover:bg-black transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <iframe 
              src={`https://www.youtube.com/embed/${previewVideo}?autoplay=1`} 
              className="w-full h-full" 
              allow="autoplay; encrypted-media" 
              allowFullScreen 
            />
          </div>
        </div>
      )}
    </main>
  );
}
