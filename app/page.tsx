import Link from "next/link";

const featuredCategories = ["funniest", "awkward", "cats", "sports", "fails"];

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-8">
          <p className="text-sm font-black uppercase tracking-[0.32em] text-cyan-300">
            ShortRank Studio
          </p>
          <h1 className="max-w-3xl text-5xl font-black uppercase leading-none text-white sm:text-7xl">
            Ranked Shorts with live timeline overlays.
          </h1>
          <p className="max-w-2xl text-base font-semibold leading-7 text-zinc-300 sm:text-lg">
            Curate niche YouTube Shorts, generate timestamped hooks and rank captions,
            then render them as punchy editor-style overlays in the browser.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {featuredCategories.map((category) => (
            <Link
              key={category}
              href={`/category/${category}`}
              className="group rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/60 hover:bg-cyan-300/10"
            >
              <span className="text-xs font-black uppercase tracking-[0.24em] text-yellow-300">
                Category
              </span>
              <span className="mt-3 block text-2xl font-black uppercase text-white group-hover:text-cyan-100">
                {category}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
