"use client";

import { useState } from "react";
import { curateCategory } from "@/app/actions/curate-category";

interface IngestButtonProps {
  category: string;
  /** Displayed in labels */
  categoryTitle: string;
  variant?: "primary" | "ghost";
}

export default function IngestButton({
  category,
  categoryTitle,
  variant = "primary",
}: IngestButtonProps) {
  const [status, setStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [summary, setSummary] = useState<string | null>(null);

  async function handleClick() {
    setStatus("running");
    setSummary(null);

    try {
      const result = await curateCategory(category, 8);
      const failCount = result.failures.length;
      const inserted = result.inserted;

      if (inserted === 0 && failCount > 0) {
        setStatus("error");
        const firstReason = result.failures[0]?.reason ?? "Unknown error";
        setSummary(`All ${failCount} video(s) failed. First error: ${firstReason}`);
        return;
      }

      setStatus("done");
      setSummary(
        `Ingested ${inserted} video${inserted !== 1 ? "s" : ""}${
          failCount > 0 ? ` (${failCount} skipped)` : ""
        }. Reloading…`,
      );

      // Hard reload to bypass the ISR cache (revalidate:60) and show new videos.
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setStatus("error");
      setSummary(
        err instanceof Error ? err.message : "Ingestion failed unexpectedly.",
      );
    }
  }

  const isRunning = status === "running";

  if (variant === "ghost") {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          id={`ingest-btn-ghost-${category}`}
          type="button"
          disabled={isRunning}
          onClick={handleClick}
          className="group relative overflow-hidden rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-8 py-4 text-sm font-black uppercase tracking-[0.24em] text-cyan-200 transition-all duration-200 hover:border-cyan-300/70 hover:bg-cyan-400/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="relative z-10 flex items-center gap-2">
            {isRunning ? (
              <>
                <SpinnerIcon />
                Fetching &amp; generating…
              </>
            ) : status === "done" ? (
              "✓ Done — reloading"
            ) : status === "error" ? (
              "⚠ Retry ingestion"
            ) : (
              <>
                <BoltIcon />
                Ingest {categoryTitle} Shorts
              </>
            )}
          </span>
        </button>
        {summary && (
          <p
            className={`text-xs font-semibold ${
              status === "error" ? "text-red-400" : "text-zinc-400"
            }`}
          >
            {summary}
          </p>
        )}
      </div>
    );
  }

  // primary (header variant)
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        id={`ingest-btn-${category}`}
        type="button"
        disabled={isRunning}
        onClick={handleClick}
        className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-cyan-200 transition-all duration-200 hover:border-cyan-300/70 hover:bg-cyan-400/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning ? (
          <>
            <SpinnerIcon />
            Ingesting…
          </>
        ) : status === "done" ? (
          "✓ Reloading"
        ) : status === "error" ? (
          "⚠ Retry"
        ) : (
          <>
            <BoltIcon />
            Ingest &amp; Generate
          </>
        )}
      </button>
      {summary && (
        <p
          className={`text-right text-xs font-semibold ${
            status === "error" ? "text-red-400" : "text-zinc-400"
          }`}
        >
          {summary}
        </p>
      )}
    </div>
  );
}

function BoltIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 animate-spin"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
