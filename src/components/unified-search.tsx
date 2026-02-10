"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type { AnswerResponse } from "@/lib/types/answer";
import type { Space } from "@/lib/types/space";
import type { Collection } from "@/lib/types/collection";
import type { LibraryFile } from "@/lib/types/file";
import type { Task } from "@/lib/types/task";
import { buildHighlightParts } from "@/lib/highlight";
import {
  applyBulkThreadUpdate,
  applyTimelineWindow,
  computeRelevanceScore,
  computeThreadMatchBadges,
  matchesQuery,
  parseUnifiedSearchQuery,
  parseStored,
  pruneSelectedIds,
  resolveActiveSelectedIds,
  resolveThreadSpaceMeta,
  toggleVisibleSelection,
  type TimelineWindow,
  type UnifiedSearchType,
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

const THREAD_BADGE_LABELS: Record<string, string> = {
  title: "Title",
  question: "Question",
  tag: "Tag",
  space: "Space",
  note: "Note",
  citation: "Citation",
  answer: "Answer",
};

export default function UnifiedSearch() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
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
  const selectedThreadIdsRef = useRef<string[]>(selectedThreadIds);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const parsedQuery = useMemo(
    () => parseUnifiedSearchQuery(deferredQuery),
    [deferredQuery]
  );
  const queryInfo = parsedQuery.query;
  const normalized = queryInfo.normalized;
  const normalizedTokens = queryInfo.tokens;
  const operators = parsedQuery.operators;
  const effectiveFilter: UnifiedSearchType =
    operators.type ?? (filter as UnifiedSearchType);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readAll = () => {
      setNotes(parseStored<Record<string, string>>(NOTES_KEY, {}));
      const nextThreads = parseStored<Thread[]>(THREADS_KEY, []);
      threadsRef.current = nextThreads;
      setThreads(nextThreads);
      setSpaces(parseStored<Space[]>(SPACES_KEY, []));
      setCollections(parseStored<Collection[]>(COLLECTIONS_KEY, []));
      setFiles(parseStored<LibraryFile[]>(FILES_KEY, []));
      setTasks(parseStored<Task[]>(TASKS_KEY, []));
      setRecentQueries(parseStored<string[]>(RECENT_SEARCH_KEY, []));

      // Cross-tab or focus reloads can remove threads; keep selection consistent with reality.
      const validThreadIds = new Set(nextThreads.map((thread) => thread.id));
      setSelectedThreadIds((previous) =>
        pruneSelectedIds(previous, validThreadIds)
      );
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement) return;
      if (active instanceof HTMLTextAreaElement) return;
      if (active instanceof HTMLElement && active.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const operatorSummary = useMemo(() => {
    const parts: string[] = [];
    if (operators.type) parts.push(`type:${operators.type}`);
    if (operators.space) parts.push(`space:"${operators.space}"`);
    if (operators.tags?.length) {
      parts.push(...operators.tags.map((tag) => `tag:${tag}`));
    }
    if (operators.hasNote) parts.push("has:note");
    if (operators.hasCitation) parts.push("has:citation");
    return parts;
  }, [operators]);

  function toTime(value?: string) {
    const parsed = Date.parse(value ?? "");
    return Number.isNaN(parsed) ? 0 : parsed;
  }

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
    selectedThreadIdsRef.current = selectedThreadIds;
  }, [selectedThreadIds]);

  const threadIdSet = useMemo(
    () => new Set(threads.map((thread) => thread.id)),
    [threads]
  );

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
          return matchesQuery(fields, queryInfo);
        })
      : threads;
    const operatorFiltered = textFiltered.filter((thread) => {
      if (operators.space) {
        const needle = operators.space.toLowerCase();
        const spaceName = (thread.spaceName ?? "").toLowerCase();
        const spaceId = (thread.spaceId ?? "").toLowerCase();
        if (!spaceName.includes(needle) && spaceId !== needle) return false;
      }
      if (operators.tags?.length) {
        const tagSet = new Set((thread.tags ?? []).map((tag) => tag.toLowerCase()));
        for (const tag of operators.tags) {
          if (!tagSet.has(tag.toLowerCase())) return false;
        }
      }
      if (operators.hasNote) {
        const note = notes[thread.id] ?? "";
        if (!note.trim()) return false;
      }
      if (operators.hasCitation) {
        if (!thread.citations || thread.citations.length === 0) return false;
      }
      return true;
    });
    return operatorFiltered.filter((thread) =>
      applyTimelineWindow(thread.createdAt, timelineWindow)
    );
  }, [threads, normalized, notes, timelineWindow, queryInfo, operators]);

  const filteredSpaces = useMemo(() => {
    const textFiltered = normalized
      ? spaces.filter((space) => {
          return matchesQuery([space.name, space.instructions ?? ""], queryInfo);
        })
      : spaces;
    return textFiltered.filter((space) =>
      applyTimelineWindow(space.createdAt, timelineWindow)
    );
  }, [spaces, normalized, timelineWindow, queryInfo]);

  const filteredCollections = useMemo(() => {
    const textFiltered = normalized
      ? collections.filter((collection) =>
          matchesQuery([collection.name], queryInfo)
        )
      : collections;
    return textFiltered.filter((collection) =>
      applyTimelineWindow(collection.createdAt, timelineWindow)
    );
  }, [collections, normalized, timelineWindow, queryInfo]);

  const filteredFiles = useMemo(() => {
    const textFiltered = normalized
      ? files.filter((file) => {
          return matchesQuery([file.name, file.text], queryInfo);
        })
      : files;
    return textFiltered.filter((file) =>
      applyTimelineWindow(file.addedAt, timelineWindow)
    );
  }, [files, normalized, timelineWindow, queryInfo]);

  const filteredTasks = useMemo(() => {
    const textFiltered = normalized
      ? tasks.filter((task) => {
          return matchesQuery(
            [
              task.name,
              task.prompt,
              task.spaceName ?? "",
              task.mode,
              task.cadence,
            ],
            queryInfo
          );
        })
      : tasks;
    const operatorFiltered = textFiltered.filter((task) => {
      if (operators.space) {
        const needle = operators.space.toLowerCase();
        const spaceName = (task.spaceName ?? "").toLowerCase();
        const spaceId = (task.spaceId ?? "").toLowerCase();
        if (!spaceName.includes(needle) && spaceId !== needle) return false;
      }
      return true;
    });
    return operatorFiltered.filter((task) =>
      applyTimelineWindow(task.createdAt, timelineWindow)
    );
  }, [tasks, normalized, timelineWindow, queryInfo, operators]);

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
    () => selectedThreadIds.filter((id) => threadIdSet.has(id)),
    [selectedThreadIds, threadIdSet]
  );
  const selectedCount = activeSelectedThreadIds.length;

  const applyBulkAction = useCallback(
    (
      updater: (thread: Thread) => Thread,
      successMessage: (appliedCount: number, missingCount: number) => string,
      clearSpaceSelection = false
    ) => {
      const { activeIds, missingCount } = resolveActiveSelectedIds(
        selectedThreadIdsRef.current,
        threadsRef.current
      );
      if (!activeIds.length) return;

      if (missingCount) {
        const validThreadIds = new Set(threadsRef.current.map((thread) => thread.id));
        setSelectedThreadIds((previous) =>
          pruneSelectedIds(previous, validThreadIds)
        );
      }
      const before: Record<string, Thread> = {};
      const selectedSet = new Set(activeIds);
      threadsRef.current.forEach((thread) => {
        if (selectedSet.has(thread.id)) before[thread.id] = thread;
      });
      setThreads((previous) =>
        applyBulkThreadUpdate(previous, activeIds, updater)
      );
      setToast({
        message: successMessage(Object.keys(before).length, missingCount),
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
    []
  );

  const applyBulkSpaceAssignment = useCallback(() => {
    const meta = resolveThreadSpaceMeta(bulkSpaceId, spaces);
    applyBulkAction(
      (thread) => ({
        ...thread,
        spaceId: meta.spaceId,
        spaceName: meta.spaceName,
      }),
      (count) =>
        meta.spaceName
          ? `Assigned ${count} thread(s) to ${meta.spaceName}.`
          : `Removed space assignment from ${count} thread(s).`,
      true
    );
  }, [applyBulkAction, bulkSpaceId, spaces]);

  const sortedThreads = useMemo(() => {
    const scored = filteredThreads.map((thread) => {
      const note = notes[thread.id] ?? "";
      const citationText = thread.citations
        .map((citation) => `${citation.title} ${citation.url}`)
        .join(" ");
      const score = computeRelevanceScore(
        [
          { text: thread.title ?? thread.question, weight: 8 },
          { text: thread.question, weight: 6 },
          { text: (thread.tags ?? []).join(" "), weight: 4 },
          { text: thread.spaceName ?? "", weight: 3 },
          { text: note, weight: 3 },
          { text: citationText, weight: 2 },
          { text: thread.answer, weight: 1 },
        ],
        queryInfo
      );
      return { thread, score };
    });
    scored.sort((a, b) => {
      if (sortBy === "newest")
        return toTime(b.thread.createdAt) - toTime(a.thread.createdAt);
      if (sortBy === "oldest")
        return toTime(a.thread.createdAt) - toTime(b.thread.createdAt);
      if (b.score !== a.score) return b.score - a.score;
      return toTime(b.thread.createdAt) - toTime(a.thread.createdAt);
    });
    return scored.map((entry) => entry.thread);
  }, [filteredThreads, sortBy, notes, queryInfo]);

  const sortedSpaces = useMemo(() => {
    const scored = filteredSpaces.map((space) => ({
      space,
      score: computeRelevanceScore(
        [
          { text: space.name, weight: 8 },
          { text: space.instructions ?? "", weight: 2 },
        ],
        queryInfo
      ),
    }));
    scored.sort((a, b) => {
      if (sortBy === "newest")
        return toTime(b.space.createdAt) - toTime(a.space.createdAt);
      if (sortBy === "oldest")
        return toTime(a.space.createdAt) - toTime(b.space.createdAt);
      if (b.score !== a.score) return b.score - a.score;
      return toTime(b.space.createdAt) - toTime(a.space.createdAt);
    });
    return scored.map((entry) => entry.space);
  }, [filteredSpaces, sortBy, queryInfo]);

  const sortedCollections = useMemo(() => {
    const scored = filteredCollections.map((collection) => ({
      collection,
      score: computeRelevanceScore([{ text: collection.name, weight: 8 }], queryInfo),
    }));
    scored.sort((a, b) => {
      if (sortBy === "newest")
        return toTime(b.collection.createdAt) - toTime(a.collection.createdAt);
      if (sortBy === "oldest")
        return toTime(a.collection.createdAt) - toTime(b.collection.createdAt);
      if (b.score !== a.score) return b.score - a.score;
      return toTime(b.collection.createdAt) - toTime(a.collection.createdAt);
    });
    return scored.map((entry) => entry.collection);
  }, [filteredCollections, sortBy, queryInfo]);

  const sortedFiles = useMemo(() => {
    const scored = filteredFiles.map((file) => ({
      file,
      score: computeRelevanceScore(
        [
          { text: file.name, weight: 8 },
          { text: file.text, weight: 1 },
        ],
        queryInfo
      ),
    }));
    scored.sort((a, b) => {
      if (sortBy === "newest")
        return toTime(b.file.addedAt) - toTime(a.file.addedAt);
      if (sortBy === "oldest")
        return toTime(a.file.addedAt) - toTime(b.file.addedAt);
      if (b.score !== a.score) return b.score - a.score;
      return toTime(b.file.addedAt) - toTime(a.file.addedAt);
    });
    return scored.map((entry) => entry.file);
  }, [filteredFiles, sortBy, queryInfo]);

  const sortedTasks = useMemo(() => {
    const scored = filteredTasks.map((task) => ({
      task,
      score: computeRelevanceScore(
        [
          { text: task.name, weight: 8 },
          { text: task.prompt, weight: 2 },
          { text: task.spaceName ?? "", weight: 3 },
          { text: task.mode, weight: 1 },
          { text: task.cadence, weight: 1 },
        ],
        queryInfo
      ),
    }));
    scored.sort((a, b) => {
      if (sortBy === "newest")
        return toTime(b.task.createdAt) - toTime(a.task.createdAt);
      if (sortBy === "oldest")
        return toTime(a.task.createdAt) - toTime(b.task.createdAt);
      if (b.score !== a.score) return b.score - a.score;
      return toTime(b.task.createdAt) - toTime(a.task.createdAt);
    });
    return scored.map((entry) => entry.task);
  }, [filteredTasks, sortBy, queryInfo]);

  const shownThreads = useMemo(
    () => sortedThreads.slice(0, resultLimit),
    [sortedThreads, resultLimit]
  );
  const shownThreadIdSet = useMemo(
    () => new Set(shownThreads.map((thread) => thread.id)),
    [shownThreads]
  );
  const hiddenSelectedCount = useMemo(() => {
    if (!activeSelectedThreadIds.length) return 0;
    return activeSelectedThreadIds.filter((id) => !shownThreadIdSet.has(id))
      .length;
  }, [activeSelectedThreadIds, shownThreadIdSet]);
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
      const visibleIds = shownThreads.map((thread) => thread.id);
      setSelectedThreadIds((previous) =>
        toggleVisibleSelection(previous, visibleIds, enabled)
      );
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

  const renderHighlighted = useCallback(
    (text: string) => {
      const parts = buildHighlightParts(text, normalized, normalizedTokens);
      if (parts.length === 0) return null;
      if (parts.length === 1 && !parts[0].highlighted) return text;
      return parts.map((part, index) => (
        <span
          key={`${index}-${part.highlighted ? "h" : "n"}`}
          className={
            part.highlighted
              ? "rounded bg-signal-accent/20 px-1 text-signal-text"
              : undefined
          }
        >
          {part.text}
        </span>
      ));
    },
    [normalized, normalizedTokens]
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
      `Filter: ${effectiveFilter}`,
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
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              if (!value.endsWith(" ")) return;
              pushRecentQuery(value);
            }}
            onBlur={() => pushRecentQuery(query)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                pushRecentQuery(query);
              }
              if (event.key === "Escape") {
                if (!query) return;
                event.preventDefault();
                setQuery("");
              }
            }}
            placeholder='Search threads, spaces, collections, files, and tasks (try: type:threads has:note tag:foo space:"Research")'
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-signal-text outline-none placeholder:text-signal-muted"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-signal-muted">
            <span>
              Operators:{" "}
              <span className="text-signal-text">
                type:threads|spaces|collections|files|tasks
              </span>
              , <span className="text-signal-text">space:&quot;Name&quot;</span>,{" "}
              <span className="text-signal-text">tag:foo</span>,{" "}
              <span className="text-signal-text">has:note</span>,{" "}
              <span className="text-signal-text">has:citation</span>
            </span>
            {operatorSummary.length ? (
              <button
                onClick={() => {
                  const parsed = parseUnifiedSearchQuery(query);
                  setQuery(parsed.text);
                }}
                className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
              >
                Clear operators
              </button>
            ) : null}
          </div>
          {operatorSummary.length ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {operatorSummary.map((item) => (
                <span
                  key={`op-${item}`}
                  className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-signal-text"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
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
                  effectiveFilter === option
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
                      const citationText = thread.citations
                        .map((citation) => `${citation.title} ${citation.url}`)
                        .join(" ");
                      const badges = computeThreadMatchBadges(
                        {
                          title: thread.title,
                          question: thread.question,
                          answer: thread.answer,
                          tags: thread.tags,
                          spaceName: thread.spaceName,
                          note: notes[thread.id] ?? "",
                          citationsText: citationText,
                        },
                        queryInfo
                      );
                      return (
                        <Link
                          key={`top-thread-${thread.id}`}
                          href={`/?thread=${thread.id}`}
                          className="block text-xs text-signal-text hover:text-signal-accent"
                        >
                          <p className="truncate font-medium">
                            {renderHighlighted(thread.title ?? thread.question)}
                          </p>
                          {snippet ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-signal-muted">
                              {renderHighlighted(snippet)}
                            </p>
                          ) : null}
                          {badges.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {badges.slice(0, 3).map((badge) => (
                                <span
                                  key={`top-thread-${thread.id}-badge-${badge}`}
                                  className="rounded-full border border-white/10 bg-black/20 px-2 py-[2px] text-[10px] text-signal-muted"
                                >
                                  {THREAD_BADGE_LABELS[badge] ?? badge}
                                </span>
                              ))}
                              {badges.length > 3 ? (
                                <span className="text-[10px] text-signal-muted">
                                  +{badges.length - 3}
                                </span>
                              ) : null}
                            </div>
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
                        {renderHighlighted(space.name)}
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
                        {renderHighlighted(collection.name)}
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
                        {renderHighlighted(file.name)}
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
                        {renderHighlighted(task.name)}
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
          {effectiveFilter === "all" || effectiveFilter === "threads" ? (
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
                        <span>
                          {selectedCount} selected
                          {hiddenSelectedCount
                            ? ` (${hiddenSelectedCount} hidden)`
                            : ""}
                        </span>
                        <button
                          onClick={() =>
                            applyBulkAction(
                              (thread) => ({ ...thread, pinned: true }),
                              (count, missingCount) =>
                                `Pinned ${count} thread(s).${
                                  missingCount ? ` (${missingCount} no longer available)` : ""
                                }`
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
                              (count, missingCount) =>
                                `Favorited ${count} thread(s).${
                                  missingCount ? ` (${missingCount} no longer available)` : ""
                                }`
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
                              (count, missingCount) =>
                                `Unpinned ${count} thread(s).${
                                  missingCount ? ` (${missingCount} no longer available)` : ""
                                }`
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
                              (count, missingCount) =>
                                `Unfavorited ${count} thread(s).${
                                  missingCount ? ` (${missingCount} no longer available)` : ""
                                }`
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
                              (count, missingCount) =>
                                `Archived ${count} thread(s).${
                                  missingCount ? ` (${missingCount} no longer available)` : ""
                                }`
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
                              (count, missingCount) =>
                                `Unarchived ${count} thread(s).${
                                  missingCount ? ` (${missingCount} no longer available)` : ""
                                }`
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
                      const citationText = thread.citations
                        .map((citation) => `${citation.title} ${citation.url}`)
                        .join(" ");
                      const badges = computeThreadMatchBadges(
                        {
                          title: thread.title,
                          question: thread.question,
                          answer: thread.answer,
                          tags: thread.tags,
                          spaceName: thread.spaceName,
                          note: notes[thread.id] ?? "",
                          citationsText: citationText,
                        },
                        queryInfo
                      );
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
                            {renderHighlighted(thread.title ?? thread.question)}
                          </p>
                          <p className="mt-1 text-[11px] text-signal-muted">
                            {thread.spaceName ?? "No space"} · {thread.mode}
                            {thread.pinned ? " · pinned" : ""}
                            {thread.favorite ? " · favorite" : ""}
                            {thread.archived ? " · archived" : ""}
                          </p>
                          {badges.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {badges.slice(0, 4).map((badge) => (
                                <span
                                  key={`thread-${thread.id}-badge-${badge}`}
                                  className="rounded-full border border-white/10 bg-black/20 px-2 py-[2px] text-[10px] text-signal-muted"
                                >
                                  {THREAD_BADGE_LABELS[badge] ?? badge}
                                </span>
                              ))}
                              {badges.length > 4 ? (
                                <span className="text-[10px] text-signal-muted">
                                  +{badges.length - 4}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
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
                              {renderHighlighted(snippet)}
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

          {effectiveFilter === "all" || effectiveFilter === "spaces" ? (
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
                      <p className="text-sm text-signal-text">
                        {renderHighlighted(space.name)}
                      </p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        {space.instructions
                          ? renderHighlighted(space.instructions)
                          : "No instructions"}
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

          {effectiveFilter === "all" || effectiveFilter === "collections" ? (
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
                        {renderHighlighted(collection.name)}
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

          {effectiveFilter === "all" || effectiveFilter === "files" ? (
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
                      <p className="text-sm text-signal-text">
                        {renderHighlighted(file.name)}
                      </p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        {Math.round(file.size / 1024)} KB
                      </p>
                      <p className="mt-2 line-clamp-2 text-[11px] text-signal-muted">
                        {renderHighlighted(
                          file.text.slice(0, 180).replace(/\s+/g, " ").trim()
                        )}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {effectiveFilter === "all" || effectiveFilter === "tasks" ? (
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
                      <p className="text-sm text-signal-text">
                        {renderHighlighted(task.name)}
                      </p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        {task.cadence} at {task.time} · {task.mode}
                      </p>
                      <p className="mt-1 text-[11px] text-signal-muted">
                        Next run: {new Date(task.nextRun).toLocaleString()}
                      </p>
                      <p className="mt-2 line-clamp-2 text-[11px] text-signal-muted">
                        {renderHighlighted(task.prompt)}
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
