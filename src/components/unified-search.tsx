"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AnswerResponse } from "@/lib/types/answer";
import type { Space } from "@/lib/types/space";
import type { Collection } from "@/lib/types/collection";
import type { LibraryFile } from "@/lib/types/file";
import type { Task } from "@/lib/types/task";

type Thread = AnswerResponse & {
  title?: string | null;
  tags?: string[];
  spaceId?: string | null;
  spaceName?: string | null;
};

const THREADS_KEY = "signal-history-v2";
const SPACES_KEY = "signal-spaces-v1";
const COLLECTIONS_KEY = "signal-collections-v1";
const FILES_KEY = "signal-files-v1";
const TASKS_KEY = "signal-tasks-v1";
const RECENT_SEARCH_KEY = "signal-unified-recent-v1";

export default function UnifiedSearch() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "threads" | "spaces" | "collections" | "files" | "tasks"
  >("all");
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

  const collections = useMemo(() => {
    if (typeof window === "undefined") return [] as Collection[];
    const storedCollections = localStorage.getItem(COLLECTIONS_KEY);
    if (!storedCollections) return [] as Collection[];
    try {
      return JSON.parse(storedCollections) as Collection[];
    } catch {
      return [] as Collection[];
    }
  }, []);

  const files = useMemo(() => {
    if (typeof window === "undefined") return [] as LibraryFile[];
    const storedFiles = localStorage.getItem(FILES_KEY);
    if (!storedFiles) return [] as LibraryFile[];
    try {
      return JSON.parse(storedFiles) as LibraryFile[];
    } catch {
      return [] as LibraryFile[];
    }
  }, []);

  const tasks = useMemo(() => {
    if (typeof window === "undefined") return [] as Task[];
    const storedTasks = localStorage.getItem(TASKS_KEY);
    if (!storedTasks) return [] as Task[];
    try {
      return JSON.parse(storedTasks) as Task[];
    } catch {
      return [] as Task[];
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

  const filteredCollections = useMemo(() => {
    if (!normalized) return collections;
    return collections.filter((collection) =>
      collection.name.toLowerCase().includes(normalized)
    );
  }, [collections, normalized]);

  const filteredFiles = useMemo(() => {
    if (!normalized) return files;
    return files.filter((file) => {
      return (
        file.name.toLowerCase().includes(normalized) ||
        file.text.toLowerCase().includes(normalized)
      );
    });
  }, [files, normalized]);

  const filteredTasks = useMemo(() => {
    if (!normalized) return tasks;
    return tasks.filter((task) => {
      return (
        task.name.toLowerCase().includes(normalized) ||
        task.prompt.toLowerCase().includes(normalized) ||
        (task.spaceName ?? "").toLowerCase().includes(normalized) ||
        task.mode.toLowerCase().includes(normalized) ||
        task.cadence.toLowerCase().includes(normalized)
      );
    });
  }, [tasks, normalized]);

  const topThreadResults = useMemo(
    () => filteredThreads.slice(0, 3),
    [filteredThreads]
  );

  const topSpaceResults = useMemo(
    () => filteredSpaces.slice(0, 3),
    [filteredSpaces]
  );
  const topCollectionResults = useMemo(
    () => filteredCollections.slice(0, 3),
    [filteredCollections]
  );
  const topFileResults = useMemo(
    () => filteredFiles.slice(0, 3),
    [filteredFiles]
  );
  const topTaskResults = useMemo(
    () => filteredTasks.slice(0, 3),
    [filteredTasks]
  );

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
      `Collections: ${filteredCollections.length}`,
      `Files: ${filteredFiles.length}`,
      `Tasks: ${filteredTasks.length}`,
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
      "",
      "## Collections",
      ...filteredCollections.map((collection, index) => {
        return [
          `${index + 1}. ${collection.name}`,
          `   - Created: ${new Date(collection.createdAt).toLocaleString()}`,
        ].join("\n");
      }),
      "",
      "## Files",
      ...filteredFiles.map((file, index) => {
        return [
          `${index + 1}. ${file.name}`,
          `   - Size: ${Math.round(file.size / 1024)} KB`,
          `   - Added: ${new Date(file.addedAt).toLocaleString()}`,
        ].join("\n");
      }),
      "",
      "## Tasks",
      ...filteredTasks.map((task, index) => {
        return [
          `${index + 1}. ${task.name}`,
          `   - Cadence: ${task.cadence} at ${task.time}`,
          `   - Mode: ${task.mode} · Sources: ${task.sources === "web" ? "Web" : "Offline"}`,
          `   - Space: ${task.spaceName ?? "None"}`,
          `   - Next run: ${new Date(task.nextRun).toLocaleString()}`,
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
      ...filteredCollections.map((collection) =>
        [
          "collection",
          `"${collection.name.replace(/\"/g, '""')}"`,
          "",
          "",
          collection.createdAt,
        ].join(",")
      ),
      ...filteredFiles.map((file) =>
        [
          "file",
          `"${file.name.replace(/\"/g, '""')}"`,
          "",
          "",
          file.addedAt,
        ].join(",")
      ),
      ...filteredTasks.map((task) =>
        [
          "task",
          `"${task.name.replace(/\"/g, '""')}"`,
          `"${(task.spaceName ?? "None").replace(/\"/g, '""')}"`,
          task.mode,
          task.nextRun,
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

  function clearRecentQueries() {
    setRecentQueries([]);
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
            placeholder="Search threads, spaces, collections, files, and tasks"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-signal-text outline-none placeholder:text-signal-muted"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                "all",
                "threads",
                "spaces",
                "collections",
                "files",
                "tasks",
              ] as const
            ).map((option) => (
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
                    : option === "spaces"
                      ? "Spaces only"
                      : option === "collections"
                        ? "Collections only"
                        : option === "files"
                          ? "Files only"
                          : "Tasks only"}
              </button>
            ))}
          </div>
          {recentQueries.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-signal-muted">
                <span>Recent searches</span>
                <button
                  onClick={clearRecentQueries}
                  className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                >
                  Clear recent
                </button>
              </div>
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
            </div>
          ) : null}
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-signal-muted">
              Top Results
            </p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs text-signal-muted">
                  Threads: {filteredThreads.length}
                </p>
                <div className="mt-2 space-y-1">
                  {topThreadResults.length ? (
                    topThreadResults.map((thread) => (
                      <Link
                        key={`top-thread-${thread.id}`}
                        href={`/?thread=${thread.id}`}
                        className="block truncate text-xs text-signal-text hover:text-signal-accent"
                      >
                        {thread.title ?? thread.question}
                      </Link>
                    ))
                  ) : (
                    <p className="text-xs text-signal-muted">No thread hits.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-signal-muted">
                  Spaces: {filteredSpaces.length}
                </p>
                <div className="mt-2 space-y-1">
                  {topSpaceResults.length ? (
                    topSpaceResults.map((space) => (
                      <Link
                        key={`top-space-${space.id}`}
                        href={`/?space=${space.id}`}
                        className="block truncate text-xs text-signal-text hover:text-signal-accent"
                      >
                        {space.name}
                      </Link>
                    ))
                  ) : (
                    <p className="text-xs text-signal-muted">No space hits.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-signal-muted">
                  Collections: {filteredCollections.length}
                </p>
                <div className="mt-2 space-y-1">
                  {topCollectionResults.length ? (
                    topCollectionResults.map((collection) => (
                      <Link
                        key={`top-collection-${collection.id}`}
                        href={`/?collection=${collection.id}`}
                        className="block truncate text-xs text-signal-text hover:text-signal-accent"
                      >
                        {collection.name}
                      </Link>
                    ))
                  ) : (
                    <p className="text-xs text-signal-muted">
                      No collection hits.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-signal-muted">
                  Files: {filteredFiles.length}
                </p>
                <div className="mt-2 space-y-1">
                  {topFileResults.length ? (
                    topFileResults.map((file) => (
                      <p
                        key={`top-file-${file.id}`}
                        className="truncate text-xs text-signal-text"
                      >
                        {file.name}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-signal-muted">No file hits.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-signal-muted">
                  Tasks: {filteredTasks.length}
                </p>
                <div className="mt-2 space-y-1">
                  {topTaskResults.length ? (
                    topTaskResults.map((task) => (
                      <p
                        key={`top-task-${task.id}`}
                        className="truncate text-xs text-signal-text"
                      >
                        {task.name}
                      </p>
                    ))
                  ) : (
                    <p className="text-xs text-signal-muted">No task hits.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {filter === "all" || filter === "threads" ? (
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

          {filter === "all" || filter === "spaces" ? (
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

          {filter === "all" || filter === "collections" ? (
            <section className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
              <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
                Collections
              </p>
              <div className="mt-4 space-y-2">
                {filteredCollections.length === 0 ? (
                  <p className="text-xs text-signal-muted">
                    No matching collections.
                  </p>
                ) : (
                  filteredCollections.slice(0, 20).map((collection) => (
                    <div
                      key={collection.id}
                      className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                    >
                      <p className="text-sm text-signal-text">
                        {collection.name}
                      </p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        {new Date(collection.createdAt).toLocaleString()}
                      </p>
                      <Link
                        href={`/?collection=${collection.id}`}
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

          {filter === "all" || filter === "files" ? (
            <section className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
              <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
                Files
              </p>
              <div className="mt-4 space-y-2">
                {filteredFiles.length === 0 ? (
                  <p className="text-xs text-signal-muted">No matching files.</p>
                ) : (
                  filteredFiles.slice(0, 20).map((file) => (
                    <div
                      key={file.id}
                      className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                    >
                      <p className="text-sm text-signal-text">{file.name}</p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        {Math.round(file.size / 1024)} KB
                      </p>
                      <p className="mt-2 line-clamp-2 text-[11px] text-signal-muted">
                        {file.text.slice(0, 180).replace(/\s+/g, " ").trim()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {filter === "all" || filter === "tasks" ? (
            <section className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
              <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
                Tasks
              </p>
              <div className="mt-4 space-y-2">
                {filteredTasks.length === 0 ? (
                  <p className="text-xs text-signal-muted">No matching tasks.</p>
                ) : (
                  filteredTasks.slice(0, 20).map((task) => (
                    <div
                      key={task.id}
                      className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                    >
                      <p className="text-sm text-signal-text">{task.name}</p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        {task.cadence} at {task.time} · {task.mode}
                      </p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        Next run: {new Date(task.nextRun).toLocaleString()}
                      </p>
                      <p className="mt-2 line-clamp-2 text-[11px] text-signal-muted">
                        {task.prompt}
                      </p>
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
