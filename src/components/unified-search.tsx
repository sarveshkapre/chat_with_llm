"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { AnswerResponse } from "@/lib/types/answer";
import type { Space } from "@/lib/types/space";
import type { Collection } from "@/lib/types/collection";
import type { LibraryFile } from "@/lib/types/file";
import type { Task } from "@/lib/types/task";
import {
  applyBulkThreadUpdate,
  applyTimelineWindow,
  parseStored,
  resolveThreadSpaceMeta,
  type TimelineWindow,
} from "@/lib/unified-search";

type Thread = AnswerResponse & {
  title?: string | null;
  tags?: string[];
  spaceId?: string | null;
  spaceName?: string | null;
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
};

const THREADS_KEY = "signal-history-v2";
const SPACES_KEY = "signal-spaces-v1";
const COLLECTIONS_KEY = "signal-collections-v1";
const FILES_KEY = "signal-files-v1";
const TASKS_KEY = "signal-tasks-v1";
const NOTES_KEY = "signal-notes-v1";
const RECENT_SEARCH_KEY = "signal-unified-recent-v1";

export default function UnifiedSearch() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | "threads" | "spaces" | "collections" | "files" | "tasks"
  >("all");
  const [sortBy, setSortBy] = useState<"relevance" | "newest" | "oldest">(
    "relevance"
  );
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindow>("all");
  const [resultLimit, setResultLimit] = useState<10 | 20 | 50>(20);
  const [recentQueries, setRecentQueries] = useState<string[]>(() =>
    parseStored<string[]>(RECENT_SEARCH_KEY, [])
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    parseStored<Record<string, string>>(NOTES_KEY, {})
  );
  const [threads, setThreads] = useState<Thread[]>(() =>
    parseStored<Thread[]>(THREADS_KEY, [])
  );
  const [spaces, setSpaces] = useState<Space[]>(() =>
    parseStored<Space[]>(SPACES_KEY, [])
  );
  const [collections, setCollections] = useState<Collection[]>(() =>
    parseStored<Collection[]>(COLLECTIONS_KEY, [])
  );
  const [files, setFiles] = useState<LibraryFile[]>(() =>
    parseStored<LibraryFile[]>(FILES_KEY, [])
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    parseStored<Task[]>(TASKS_KEY, [])
  );
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [bulkSpaceId, setBulkSpaceId] = useState("");
  const [toast, setToast] = useState<
    | {
        message: string;
        undo?: {
          label: string;
          before: Record<string, Thread>;
        };
      }
    | null
  >(null);
  const threadsRef = useRef<Thread[]>(threads);

  const normalized = query.trim().toLowerCase();
  const normalizedTokens = useMemo(
    () => normalized.split(/\s+/).filter(Boolean),
    [normalized]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readAll = () => {
      setNotes(parseStored<Record<string, string>>(NOTES_KEY, {}));
      setThreads(parseStored<Thread[]>(THREADS_KEY, []));
      setSpaces(parseStored<Space[]>(SPACES_KEY, []));
      setCollections(parseStored<Collection[]>(COLLECTIONS_KEY, []));
      setFiles(parseStored<LibraryFile[]>(FILES_KEY, []));
      setTasks(parseStored<Task[]>(TASKS_KEY, []));
      setRecentQueries(parseStored<string[]>(RECENT_SEARCH_KEY, []));
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        ![
          NOTES_KEY,
          THREADS_KEY,
          SPACES_KEY,
          COLLECTIONS_KEY,
          FILES_KEY,
          TASKS_KEY,
          RECENT_SEARCH_KEY,
        ].includes(event.key)
      ) {
        return;
      }
      readAll();
    };

    readAll();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", readAll);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", readAll);
    };
  }, []);

  function toTime(value?: string) {
    const parsed = Date.parse(value ?? "");
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const relevanceScore = useCallback(
    (parts: string[]) => {
      if (!normalized) return 0;
      let score = 0;
      parts.forEach((part) => {
        const text = part.toLowerCase();
        if (!text) return;
        if (text.includes(normalized)) score += 8;
        if (text.startsWith(normalized)) score += 4;
        normalizedTokens.forEach((token) => {
          if (text.includes(token)) score += 1;
        });
      });
      return score;
    },
    [normalized, normalizedTokens]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentQueries));
  }, [recentQueries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    if (!toast) return;
    const timeoutMs = toast.undo ? 8000 : 2500;
    const timeout = window.setTimeout(() => setToast(null), timeoutMs);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredThreads = useMemo(() => {
    const textFiltered = normalized
      ? threads.filter((thread) => {
          const citationText = thread.citations
            .map((citation) => `${citation.title} ${citation.url}`)
            .join(" ");
          const fields = [
            thread.title ?? thread.question,
            thread.question,
            thread.answer,
            (thread.tags ?? []).join(" "),
            thread.spaceName ?? "",
            citationText,
            notes[thread.id] ?? "",
          ];
          return fields.some((field) => field.toLowerCase().includes(normalized));
        })
      : threads;
    return textFiltered.filter((thread) =>
      applyTimelineWindow(thread.createdAt, timelineWindow)
    );
  }, [threads, normalized, notes, timelineWindow]);

  const filteredSpaces = useMemo(() => {
    const textFiltered = normalized
      ? spaces.filter((space) => {
          return (
            space.name.toLowerCase().includes(normalized) ||
            (space.instructions ?? "").toLowerCase().includes(normalized)
          );
        })
      : spaces;
    return textFiltered.filter((space) =>
      applyTimelineWindow(space.createdAt, timelineWindow)
    );
  }, [spaces, normalized, timelineWindow]);

  const filteredCollections = useMemo(() => {
    const textFiltered = normalized
      ? collections.filter((collection) =>
          collection.name.toLowerCase().includes(normalized)
        )
      : collections;
    return textFiltered.filter((collection) =>
      applyTimelineWindow(collection.createdAt, timelineWindow)
    );
  }, [collections, normalized, timelineWindow]);

  const filteredFiles = useMemo(() => {
    const textFiltered = normalized
      ? files.filter((file) => {
          return (
            file.name.toLowerCase().includes(normalized) ||
            file.text.toLowerCase().includes(normalized)
          );
        })
      : files;
    return textFiltered.filter((file) =>
      applyTimelineWindow(file.addedAt, timelineWindow)
    );
  }, [files, normalized, timelineWindow]);

  const filteredTasks = useMemo(() => {
    const textFiltered = normalized
      ? tasks.filter((task) => {
          return (
            task.name.toLowerCase().includes(normalized) ||
            task.prompt.toLowerCase().includes(normalized) ||
            (task.spaceName ?? "").toLowerCase().includes(normalized) ||
            task.mode.toLowerCase().includes(normalized) ||
            task.cadence.toLowerCase().includes(normalized)
          );
        })
      : tasks;
    return textFiltered.filter((task) =>
      applyTimelineWindow(task.createdAt, timelineWindow)
    );
  }, [tasks, normalized, timelineWindow]);

  const toggleThreadField = useCallback(
    (threadId: string, field: "favorite" | "pinned" | "archived") => {
      setThreads((previous) =>
        previous.map((thread) => {
          if (thread.id !== threadId) return thread;
          const currentValue = Boolean(thread[field]);
          return { ...thread, [field]: !currentValue };
        })
      );
    },
    []
  );

  const assignThreadSpace = useCallback(
    (threadId: string, nextSpaceId: string) => {
      const meta = resolveThreadSpaceMeta(nextSpaceId, spaces);
      setThreads((previous) =>
        previous.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                spaceId: meta.spaceId,
                spaceName: meta.spaceName,
              }
            : thread
        )
      );
    },
    [spaces]
  );

  const activeSelectedThreadIds = useMemo(
    () => selectedThreadIds.filter((id) => threads.some((thread) => thread.id === id)),
    [selectedThreadIds, threads]
  );
  const selectedCount = activeSelectedThreadIds.length;

  const applyBulkAction = useCallback(
    (
      updater: (thread: Thread) => Thread,
      successMessage: string,
      clearSpaceSelection = false
    ) => {
      if (!activeSelectedThreadIds.length) return;
      const before: Record<string, Thread> = {};
      const selectedSet = new Set(activeSelectedThreadIds);
      threadsRef.current.forEach((thread) => {
        if (selectedSet.has(thread.id)) before[thread.id] = thread;
      });
      setThreads((previous) =>
        applyBulkThreadUpdate(previous, activeSelectedThreadIds, updater)
      );
      setToast({
        message: successMessage,
        undo: Object.keys(before).length
          ? {
              label: "Undo",
              before,
            }
          : undefined,
      });
      if (clearSpaceSelection) {
        setBulkSpaceId("");
      }
    },
    [activeSelectedThreadIds]
  );

  const applyBulkSpaceAssignment = useCallback(() => {
    if (!activeSelectedThreadIds.length) return;
    const meta = resolveThreadSpaceMeta(bulkSpaceId, spaces);
    applyBulkAction(
      (thread) => ({
        ...thread,
        spaceId: meta.spaceId,
        spaceName: meta.spaceName,
      }),
      meta.spaceName
        ? `Assigned ${activeSelectedThreadIds.length} thread(s) to ${meta.spaceName}.`
        : `Removed space assignment from ${activeSelectedThreadIds.length} thread(s).`,
      true
    );
  }, [activeSelectedThreadIds.length, applyBulkAction, bulkSpaceId, spaces]);

  const sortedThreads = useMemo(() => {
    const next = [...filteredThreads];
    next.sort((a, b) => {
      if (sortBy === "newest") return toTime(b.createdAt) - toTime(a.createdAt);
      if (sortBy === "oldest") return toTime(a.createdAt) - toTime(b.createdAt);
      const noteA = notes[a.id] ?? "";
      const noteB = notes[b.id] ?? "";
      const citationA = a.citations
        .map((citation) => `${citation.title} ${citation.url}`)
        .join(" ");
      const citationB = b.citations
        .map((citation) => `${citation.title} ${citation.url}`)
        .join(" ");
      const scoreA = relevanceScore([
        a.title ?? a.question,
        a.question,
        a.answer,
        (a.tags ?? []).join(" "),
        a.spaceName ?? "",
        citationA,
        noteA,
      ]);
      const scoreB = relevanceScore([
        b.title ?? b.question,
        b.question,
        b.answer,
        (b.tags ?? []).join(" "),
        b.spaceName ?? "",
        citationB,
        noteB,
      ]);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return toTime(b.createdAt) - toTime(a.createdAt);
    });
    return next;
  }, [filteredThreads, relevanceScore, sortBy, notes]);

  const sortedSpaces = useMemo(() => {
    const next = [...filteredSpaces];
    next.sort((a, b) => {
      if (sortBy === "newest") return toTime(b.createdAt) - toTime(a.createdAt);
      if (sortBy === "oldest") return toTime(a.createdAt) - toTime(b.createdAt);
      const scoreA = relevanceScore([a.name, a.instructions ?? ""]);
      const scoreB = relevanceScore([b.name, b.instructions ?? ""]);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return toTime(b.createdAt) - toTime(a.createdAt);
    });
    return next;
  }, [filteredSpaces, relevanceScore, sortBy]);

  const sortedCollections = useMemo(() => {
    const next = [...filteredCollections];
    next.sort((a, b) => {
      if (sortBy === "newest") return toTime(b.createdAt) - toTime(a.createdAt);
      if (sortBy === "oldest") return toTime(a.createdAt) - toTime(b.createdAt);
      const scoreA = relevanceScore([a.name]);
      const scoreB = relevanceScore([b.name]);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return toTime(b.createdAt) - toTime(a.createdAt);
    });
    return next;
  }, [filteredCollections, relevanceScore, sortBy]);

  const sortedFiles = useMemo(() => {
    const next = [...filteredFiles];
    next.sort((a, b) => {
      if (sortBy === "newest") return toTime(b.addedAt) - toTime(a.addedAt);
      if (sortBy === "oldest") return toTime(a.addedAt) - toTime(b.addedAt);
      const scoreA = relevanceScore([a.name, a.text]);
      const scoreB = relevanceScore([b.name, b.text]);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return toTime(b.addedAt) - toTime(a.addedAt);
    });
    return next;
  }, [filteredFiles, relevanceScore, sortBy]);

  const sortedTasks = useMemo(() => {
    const next = [...filteredTasks];
    next.sort((a, b) => {
      if (sortBy === "newest") return toTime(b.createdAt) - toTime(a.createdAt);
      if (sortBy === "oldest") return toTime(a.createdAt) - toTime(b.createdAt);
      const scoreA = relevanceScore([
        a.name,
        a.prompt,
        a.spaceName ?? "",
        a.mode,
        a.cadence,
      ]);
      const scoreB = relevanceScore([
        b.name,
        b.prompt,
        b.spaceName ?? "",
        b.mode,
        b.cadence,
      ]);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return toTime(b.createdAt) - toTime(a.createdAt);
    });
    return next;
  }, [filteredTasks, relevanceScore, sortBy]);

  const shownThreads = useMemo(
    () => sortedThreads.slice(0, resultLimit),
    [sortedThreads, resultLimit]
  );
  const shownSpaces = useMemo(
    () => sortedSpaces.slice(0, resultLimit),
    [sortedSpaces, resultLimit]
  );
  const shownCollections = useMemo(
    () => sortedCollections.slice(0, resultLimit),
    [sortedCollections, resultLimit]
  );
  const shownFiles = useMemo(
    () => sortedFiles.slice(0, resultLimit),
    [sortedFiles, resultLimit]
  );
  const shownTasks = useMemo(
    () => sortedTasks.slice(0, resultLimit),
    [sortedTasks, resultLimit]
  );

  const setAllShownThreadSelection = useCallback(
    (enabled: boolean) => {
      if (!enabled) {
        setSelectedThreadIds([]);
        return;
      }
      setSelectedThreadIds(shownThreads.map((thread) => thread.id));
    },
    [shownThreads]
  );
  const allShownSelected =
    shownThreads.length > 0 &&
    shownThreads.every((thread) => activeSelectedThreadIds.includes(thread.id));

  const topThreadResults = useMemo(() => sortedThreads.slice(0, 3), [sortedThreads]);
  const topSpaceResults = useMemo(() => sortedSpaces.slice(0, 3), [sortedSpaces]);
  const topCollectionResults = useMemo(
    () => sortedCollections.slice(0, 3),
    [sortedCollections]
  );
  const topFileResults = useMemo(() => sortedFiles.slice(0, 3), [sortedFiles]);
  const topTaskResults = useMemo(() => sortedTasks.slice(0, 3), [sortedTasks]);

  const snippetFromText = useCallback(
    (text: string) => {
      if (!text) return "";
      const compact = text.replace(/\s+/g, " ").trim();
      if (!compact) return "";
      if (!normalized) return compact.slice(0, 160);
      const lowered = compact.toLowerCase();
      let index = lowered.indexOf(normalized);
      if (index === -1 && normalizedTokens.length) {
        for (const token of normalizedTokens) {
          index = lowered.indexOf(token);
          if (index !== -1) break;
        }
      }
      if (index === -1) return compact.slice(0, 160);
      const start = Math.max(0, index - 60);
      const end = Math.min(compact.length, index + normalized.length + 80);
      return compact.slice(start, end).trim();
    },
    [normalized, normalizedTokens]
  );

  const buildThreadSnippet = useCallback(
    (thread: Thread) => {
      const citationText = thread.citations
        .map((citation) => `${citation.title} ${citation.url}`)
        .join(" ");
      const candidates = [
        thread.answer,
        notes[thread.id] ?? "",
        citationText,
        thread.question,
      ];
      for (const candidate of candidates) {
        const snippet = snippetFromText(candidate);
        if (snippet) return snippet;
      }
      return "";
    },
    [notes, snippetFromText]
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
      `Sort: ${sortBy}`,
      `Result limit (UI): ${resultLimit}`,
      "",
      `Threads: ${filteredThreads.length}`,
      `Spaces: ${filteredSpaces.length}`,
      `Collections: ${filteredCollections.length}`,
      `Files: ${filteredFiles.length}`,
      `Tasks: ${filteredTasks.length}`,
      "",
      "## Threads",
      ...sortedThreads.map((thread, index) => {
        const title = thread.title ?? thread.question;
        return [
          `${index + 1}. ${title}`,
          `   - Space: ${thread.spaceName ?? "None"} · Mode: ${thread.mode}`,
          `   - Created: ${new Date(thread.createdAt).toLocaleString()}`,
        ].join("\n");
      }),
      "",
      "## Spaces",
      ...sortedSpaces.map((space, index) => {
        return [
          `${index + 1}. ${space.name}`,
          `   - Instructions: ${space.instructions || "None"}`,
          `   - Created: ${new Date(space.createdAt).toLocaleString()}`,
        ].join("\n");
      }),
      "",
      "## Collections",
      ...sortedCollections.map((collection, index) => {
        return [
          `${index + 1}. ${collection.name}`,
          `   - Created: ${new Date(collection.createdAt).toLocaleString()}`,
        ].join("\n");
      }),
      "",
      "## Files",
      ...sortedFiles.map((file, index) => {
        return [
          `${index + 1}. ${file.name}`,
          `   - Size: ${Math.round(file.size / 1024)} KB`,
          `   - Added: ${new Date(file.addedAt).toLocaleString()}`,
        ].join("\n");
      }),
      "",
      "## Tasks",
      ...sortedTasks.map((task, index) => {
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
      ...sortedThreads.map((thread) =>
        [
          "thread",
          `"${(thread.title ?? thread.question).replace(/\"/g, '""')}"`,
          `"${(thread.spaceName ?? "None").replace(/\"/g, '""')}"`,
          thread.mode,
          thread.createdAt,
        ].join(",")
      ),
      ...sortedSpaces.map((space) =>
        [
          "space",
          `"${space.name.replace(/\"/g, '""')}"`,
          "",
          "",
          space.createdAt,
        ].join(",")
      ),
      ...sortedCollections.map((collection) =>
        [
          "collection",
          `"${collection.name.replace(/\"/g, '""')}"`,
          "",
          "",
          collection.createdAt,
        ].join(",")
      ),
      ...sortedFiles.map((file) =>
        [
          "file",
          `"${file.name.replace(/\"/g, '""')}"`,
          "",
          "",
          file.addedAt,
        ].join(",")
      ),
      ...sortedTasks.map((task) =>
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
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
            <label className="flex items-center gap-2 text-signal-muted">
              Sort
              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value as "relevance" | "newest" | "oldest"
                  )
                }
                className="rounded-full border border-white/10 bg-transparent px-3 py-1 text-xs text-signal-text"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-signal-muted">
              Time
              <select
                value={timelineWindow}
                onChange={(event) =>
                  setTimelineWindow(event.target.value as TimelineWindow)
                }
                className="rounded-full border border-white/10 bg-transparent px-3 py-1 text-xs text-signal-text"
              >
                <option value="all">All time</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-signal-muted">
              Show
              <select
                value={resultLimit}
                onChange={(event) =>
                  setResultLimit(Number(event.target.value) as 10 | 20 | 50)
                }
                className="rounded-full border border-white/10 bg-transparent px-3 py-1 text-xs text-signal-text"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          {toast ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <p>{toast.message}</p>
              {toast.undo ? (
                <button
                  onClick={() => {
                    const before = toast.undo?.before;
                    if (!before) return;
                    setThreads((previous) =>
                      previous.map((thread) => before[thread.id] ?? thread)
                    );
                    setToast({ message: "Undid last bulk action." });
                  }}
                  className="rounded-full border border-emerald-500/40 px-3 py-1 text-[11px] text-emerald-100 hover:bg-emerald-500/10"
                >
                  {toast.undo.label}
                </button>
              ) : null}
            </div>
          ) : null}
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
                    topThreadResults.map((thread) => {
                      const snippet = buildThreadSnippet(thread);
                      return (
                        <Link
                          key={`top-thread-${thread.id}`}
                          href={`/?thread=${thread.id}`}
                          className="block text-xs text-signal-text hover:text-signal-accent"
                        >
                          <p className="truncate font-medium">
                            {thread.title ?? thread.question}
                          </p>
                          {snippet ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-signal-muted">
                              {snippet}
                            </p>
                          ) : null}
                        </Link>
                      );
                    })
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
                  <>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-[11px] text-signal-muted">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={allShownSelected}
                            onChange={(event) =>
                              setAllShownThreadSelection(event.target.checked)
                            }
                          />
                          Select visible
                        </label>
                        <span>{selectedCount} selected</span>
                        <button
                          onClick={() =>
                            applyBulkAction(
                              (thread) => ({ ...thread, pinned: true }),
                              `Pinned ${selectedCount} thread(s).`
                            )
                          }
                          disabled={!selectedCount}
                          className="rounded-full border border-white/10 px-2 py-1 disabled:opacity-40"
                        >
                          Pin
                        </button>
                        <button
                          onClick={() =>
                            applyBulkAction(
                              (thread) => ({ ...thread, favorite: true }),
                              `Favorited ${selectedCount} thread(s).`
                            )
                          }
                          disabled={!selectedCount}
                          className="rounded-full border border-white/10 px-2 py-1 disabled:opacity-40"
                        >
                          Favorite
                        </button>
                        <button
                          onClick={() =>
                            applyBulkAction(
                              (thread) => ({ ...thread, pinned: false }),
                              `Unpinned ${selectedCount} thread(s).`
                            )
                          }
                          disabled={!selectedCount}
                          className="rounded-full border border-white/10 px-2 py-1 disabled:opacity-40"
                        >
                          Unpin
                        </button>
                        <button
                          onClick={() =>
                            applyBulkAction(
                              (thread) => ({ ...thread, favorite: false }),
                              `Unfavorited ${selectedCount} thread(s).`
                            )
                          }
                          disabled={!selectedCount}
                          className="rounded-full border border-white/10 px-2 py-1 disabled:opacity-40"
                        >
                          Unfavorite
                        </button>
                        <button
                          onClick={() =>
                            applyBulkAction(
                              (thread) => ({ ...thread, archived: true }),
                              `Archived ${selectedCount} thread(s).`
                            )
                          }
                          disabled={!selectedCount}
                          className="rounded-full border border-white/10 px-2 py-1 disabled:opacity-40"
                        >
                          Archive
                        </button>
                        <button
                          onClick={() =>
                            applyBulkAction(
                              (thread) => ({ ...thread, archived: false }),
                              `Unarchived ${selectedCount} thread(s).`
                            )
                          }
                          disabled={!selectedCount}
                          className="rounded-full border border-white/10 px-2 py-1 disabled:opacity-40"
                        >
                          Unarchive
                        </button>
                        <select
                          value={bulkSpaceId}
                          onChange={(event) => setBulkSpaceId(event.target.value)}
                          className="rounded-full border border-white/10 bg-transparent px-2 py-1 text-[11px] text-signal-text"
                        >
                          <option value="">No space</option>
                          {spaces.map((space) => (
                            <option key={`bulk-space-${space.id}`} value={space.id}>
                              {space.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={applyBulkSpaceAssignment}
                          disabled={!selectedCount}
                          className="rounded-full border border-white/10 px-2 py-1 disabled:opacity-40"
                        >
                          Apply space
                        </button>
                      </div>
                    </div>
                    {shownThreads.map((thread) => {
                      const snippet = buildThreadSnippet(thread);
                      const selected = activeSelectedThreadIds.includes(thread.id);
                      return (
                        <div
                          key={thread.id}
                          className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <label className="mt-1 flex items-center gap-2 text-[11px]">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) => {
                                  const checked = event.target.checked;
                                  setSelectedThreadIds((previous) =>
                                    checked
                                      ? [...new Set([...previous, thread.id])]
                                      : previous.filter((id) => id !== thread.id)
                                  );
                                }}
                              />
                              Select
                            </label>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => toggleThreadField(thread.id, "favorite")}
                                className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                              >
                                {thread.favorite ? "Unfavorite" : "Favorite"}
                              </button>
                              <button
                                onClick={() => toggleThreadField(thread.id, "pinned")}
                                className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                              >
                                {thread.pinned ? "Unpin" : "Pin"}
                              </button>
                              <button
                                onClick={() => toggleThreadField(thread.id, "archived")}
                                className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                              >
                                {thread.archived ? "Unarchive" : "Archive"}
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-signal-text">
                            {thread.title ?? thread.question}
                          </p>
                          <p className="mt-1 text-[11px] text-signal-muted">
                            {thread.spaceName ?? "No space"} · {thread.mode}
                            {thread.pinned ? " · pinned" : ""}
                            {thread.favorite ? " · favorite" : ""}
                            {thread.archived ? " · archived" : ""}
                          </p>
                          <div className="mt-2">
                            <label className="text-[11px] text-signal-muted">
                              Space
                              <select
                                value={thread.spaceId ?? ""}
                                onChange={(event) =>
                                  assignThreadSpace(thread.id, event.target.value)
                                }
                                className="ml-2 rounded-full border border-white/10 bg-transparent px-2 py-1 text-[11px] text-signal-text"
                              >
                                <option value="">No space</option>
                                {spaces.map((space) => (
                                  <option key={`thread-space-${thread.id}-${space.id}`} value={space.id}>
                                    {space.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          {snippet ? (
                            <p className="mt-2 line-clamp-3 text-[11px] text-signal-muted">
                              {snippet}
                            </p>
                          ) : null}
                          <Link
                            href={`/?thread=${thread.id}`}
                            className="mt-2 inline-block rounded-full border border-white/10 px-2 py-1 text-[11px]"
                          >
                            Open
                          </Link>
                        </div>
                      );
                    })}
                  </>
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
                  shownSpaces.map((space) => (
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
                  shownCollections.map((collection) => (
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
                  shownFiles.map((file) => (
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
                  shownTasks.map((task) => (
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
