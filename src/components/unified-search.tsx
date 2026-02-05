"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AnswerResponse } from "@/lib/types/answer";
import type { Space } from "@/lib/types/space";

type Thread = AnswerResponse & {
  title?: string | null;
  tags?: string[];
  spaceId?: string | null;
  spaceName?: string | null;
};

const THREADS_KEY = "signal-history-v2";
const SPACES_KEY = "signal-spaces-v1";
const RECENT_SEARCH_KEY = "signal-unified-recent-v1";

export default function UnifiedSearch() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "threads" | "spaces">("all");
  const [recentQueries, setRecentQueries] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(RECENT_SEARCH_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as string[];
    } catch {
      return [];
    }
  });
  const threads = useMemo(() => {
    if (typeof window === "undefined") return [] as Thread[];
    const storedThreads = localStorage.getItem(THREADS_KEY);
    if (!storedThreads) return [] as Thread[];
    try {
      return JSON.parse(storedThreads) as Thread[];
    } catch {
      return [] as Thread[];
    }
  }, []);

  const spaces = useMemo(() => {
    if (typeof window === "undefined") return [] as Space[];
    const storedSpaces = localStorage.getItem(SPACES_KEY);
    if (!storedSpaces) return [] as Space[];
    try {
      return JSON.parse(storedSpaces) as Space[];
    } catch {
      return [] as Space[];
    }
  }, []);

  const normalized = query.trim().toLowerCase();

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentQueries));
  }, [recentQueries]);

  const filteredThreads = useMemo(() => {
    if (!normalized) return threads;
    return threads.filter((thread) => {
      const title = (thread.title ?? thread.question).toLowerCase();
      const tags = (thread.tags ?? []).join(" ").toLowerCase();
      const space = (thread.spaceName ?? "").toLowerCase();
      return (
        title.includes(normalized) ||
        thread.question.toLowerCase().includes(normalized) ||
        tags.includes(normalized) ||
        space.includes(normalized)
      );
    });
  }, [threads, normalized]);

  const filteredSpaces = useMemo(() => {
    if (!normalized) return spaces;
    return spaces.filter((space) => {
      return (
        space.name.toLowerCase().includes(normalized) ||
        space.instructions.toLowerCase().includes(normalized)
      );
    });
  }, [spaces, normalized]);

  function pushRecentQuery(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setRecentQueries((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)];
      return next.slice(0, 5);
    });
  }

  function exportResults() {
    const lines: string[] = [
      "# Signal Search Unified Export",
      "",
      `Query: ${query || "None"}`,
      `Filter: ${filter}`,
      "",
      `Threads: ${filteredThreads.length}`,
      `Spaces: ${filteredSpaces.length}`,
      "",
      "## Threads",
      ...filteredThreads.map((thread, index) => {
        const title = thread.title ?? thread.question;
        return [
          `${index + 1}. ${title}`,
          `   - Space: ${thread.spaceName ?? "None"} · Mode: ${thread.mode}`,
          `   - Created: ${new Date(thread.createdAt).toLocaleString()}`,
        ].join("\n");
      }),
      "",
      "## Spaces",
      ...filteredSpaces.map((space, index) => {
        return [
          `${index + 1}. ${space.name}`,
          `   - Instructions: ${space.instructions || "None"}`,
          `   - Created: ${new Date(space.createdAt).toLocaleString()}`,
        ].join("\n");
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signal-search-export-${Date.now()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const lines = [
      ["type", "title", "space", "mode", "created_at"].join(","),
      ...filteredThreads.map((thread) =>
        [
          "thread",
          `"${(thread.title ?? thread.question).replace(/\"/g, '""')}"`,
          `"${(thread.spaceName ?? "None").replace(/\"/g, '""')}"`,
          thread.mode,
          thread.createdAt,
        ].join(",")
      ),
      ...filteredSpaces.map((space) =>
        [
          "space",
          `"${space.name.replace(/\"/g, '""')}"`,
          "",
          "",
          space.createdAt,
        ].join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signal-search-export-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-signal-bg text-signal-text">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-signal-muted">
            Unified Search
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Signal Search</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Back to Library
          </Link>
          <button
            onClick={exportResults}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Export results
          </button>
          <button
            onClick={exportCsv}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Export CSV
          </button>
        </div>
      </header>

      <main className="px-6 py-10">
        <div className="max-w-3xl space-y-3">
          <input
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              if (!value.endsWith(" ")) return;
              pushRecentQuery(value);
            }}
            onBlur={() => pushRecentQuery(query)}
            placeholder="Search threads and spaces"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-signal-text outline-none placeholder:text-signal-muted"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {(["all", "threads", "spaces"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded-full border px-3 py-1 ${
                  filter === option
                    ? "border-signal-accent text-signal-text"
                    : "border-white/10 text-signal-muted"
                }`}
              >
                {option === "all"
                  ? "All"
                  : option === "threads"
                    ? "Threads only"
                    : "Spaces only"}
              </button>
            ))}
          </div>
          {recentQueries.length ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {recentQueries.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setQuery(item);
                    pushRecentQuery(item);
                  }}
                  className="rounded-full border border-white/10 px-3 py-1 text-signal-muted"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {filter !== "spaces" ? (
            <section className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
              <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
                Threads
              </p>
              <div className="mt-4 space-y-2">
                {filteredThreads.length === 0 ? (
                  <p className="text-xs text-signal-muted">
                    No matching threads.
                  </p>
                ) : (
                  filteredThreads.slice(0, 20).map((thread) => (
                    <div
                      key={thread.id}
                      className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                    >
                      <p className="text-sm text-signal-text">
                        {thread.title ?? thread.question}
                      </p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        {thread.spaceName ?? "No space"} · {thread.mode}
                      </p>
                      <Link
                        href={`/?thread=${thread.id}`}
                        className="mt-2 inline-block rounded-full border border-white/10 px-2 py-1 text-[11px]"
                      >
                        Open
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {filter !== "threads" ? (
            <section className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
              <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
                Spaces
              </p>
              <div className="mt-4 space-y-2">
                {filteredSpaces.length === 0 ? (
                  <p className="text-xs text-signal-muted">
                    No matching spaces.
                  </p>
                ) : (
                  filteredSpaces.slice(0, 20).map((space) => (
                    <div
                      key={space.id}
                      className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                    >
                      <p className="text-sm text-signal-text">{space.name}</p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        {space.instructions || "No instructions"}
                      </p>
                      <Link
                        href={`/?space=${space.id}`}
                        className="mt-2 inline-block rounded-full border border-white/10 px-2 py-1 text-[11px]"
                      >
                        Open
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
