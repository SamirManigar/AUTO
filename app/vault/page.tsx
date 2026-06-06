"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RawYouTubeVideoData } from "@/lib/ai/timeline-generator";
import { generateCompilationAction } from "@/app/actions/generate-compilation";

export default function VaultPage() {
  const router = useRouter();
  const [vault, setVault] = useState<RawYouTubeVideoData[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("clip-vault") ?? "[]");
      setVault(stored);
    } catch {
      setVault([]);
    }
  }, []);

  const toggleSelection = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const removeFromVault = (id: string) => {
    const updated = vault.filter(v => v.youtubeId !== id);
    setVault(updated);
    localStorage.setItem("clip-vault", JSON.stringify(updated));
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  };

  const clearVault = () => {
    if (confirm("Clear all clips from vault?")) {
      setVault([]);
      setSelected(new Set());
      localStorage.removeItem("clip-vault");
    }
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setIsGenerating(true);
    try {
      const selectedVideos = vault.filter(v => selected.has(v.youtubeId));
      const compilationId = await generateCompilationAction("My Vault Compilation", selectedVideos);
      router.push(`/compilation/${compilationId}`);
    } catch (error) {
      console.error(error);
      alert("Failed to generate compilation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between pt-10">
          <div>
            <button onClick={() => router.push("/")} className="text-zinc-500 hover:text-white text-sm mb-2 flex items-center gap-1 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Search
            </button>
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              🗄️ Clip Vault
            </h1>
            <p className="text-zinc-400 mt-1">{vault.length} clip{vault.length !== 1 ? "s" : ""} saved</p>
          </div>

          {vault.length > 0 && (
            <button onClick={clearVault} className="text-zinc-500 hover:text-red-400 text-sm transition-colors">
              Clear All
            </button>
          )}
        </div>

        {/* Empty state */}
        {vault.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-zinc-600 space-y-4">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-xl font-medium">Your vault is empty</p>
            <p className="text-sm">Save clips from your searches to build your vault</p>
            <button onClick={() => router.push("/")} className="mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-all">
              Go Search Clips
            </button>
          </div>
        )}

        {/* Clips Grid */}
        {vault.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-36">
            {vault.map((video) => (
              <div
                key={video.youtubeId}
                onClick={() => toggleSelection(video.youtubeId)}
                className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all group ${
                  selected.has(video.youtubeId)
                    ? "border-amber-500 scale-105 shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                    : "border-zinc-800 hover:border-zinc-600"
                }`}
              >
                {video.thumbnailUrl ? (
                  <img src={video.thumbnailUrl} alt={video.title} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-zinc-900 flex items-center justify-center text-zinc-600">No Thumbnail</div>
                )}

                <div className="p-3 bg-zinc-900">
                  <h3 className="font-bold line-clamp-2 text-sm">{video.title}</h3>
                  <p className="text-zinc-400 text-xs mt-1">{video.channelTitle}</p>
                  <p className="text-zinc-500 text-xs mt-1">{formatDuration(video.durationSeconds)}</p>
                </div>

                {/* Selection badge */}
                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selected.has(video.youtubeId) ? "bg-amber-500 border-amber-500" : "border-white bg-black/50"
                }`}>
                  {selected.has(video.youtubeId) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Preview button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setPreviewVideo(video.youtubeId); }}
                  className="absolute bottom-14 right-3 bg-black/70 hover:bg-black text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </button>

                {/* Remove button */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromVault(video.youtubeId); }}
                  className="absolute top-3 left-3 bg-black/70 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove from vault"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Floating action bar */}
        {selected.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black to-transparent pointer-events-none flex justify-center">
            <div className="pointer-events-auto bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-2xl flex items-center gap-6">
              <div className="text-lg">
                <span className="font-bold text-amber-400">{selected.size}</span> clips selected
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 px-8 py-3 rounded-xl font-bold shadow-lg transition-all"
              >
                {isGenerating ? "Generating..." : "⚡ Generate Compilation"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewVideo(null)}>
          <div className="relative w-full max-w-sm aspect-[9/16] bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewVideo(null)} className="absolute top-4 right-4 z-10 bg-black/70 text-white p-2 rounded-full hover:bg-black transition-colors">
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
