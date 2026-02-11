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
import { useRouter } from "next/navigation";
import type { AnswerResponse } from "@/lib/types/answer";
import type { Space } from "@/lib/types/space";
import type { Collection } from "@/lib/types/collection";
import type { LibraryFile } from "@/lib/types/file";
import type { Task } from "@/lib/types/task";
import { buildHighlightParts } from "@/lib/highlight";
import {
  applyBulkThreadUpdate,
  applyOperatorAutocomplete,
  buildUnifiedSearchDiagnosticsRows,
  buildUnifiedSearchCsvExport,
  buildUnifiedSearchMarkdownExport,
  buildUnifiedSearchOperatorSummary,
  buildUnifiedSearchSavedSearchesMarkdownExport,
  buildUnifiedSearchUrlParams,
  computeRelevanceScoreFromLowered,
  computeThreadMatchBadges,
  decodeUnifiedSearchSpaceTagsStorage,
  decodeUnifiedSearchRecentQueriesStorage,
  decodeUnifiedSearchCollectionsStorage,
  decodeUnifiedSearchFilesStorage,
  decodeUnifiedSearchNotesStorage,
  decodeUnifiedSearchSpacesStorage,
  decodeUnifiedSearchTasksStorage,
  decodeUnifiedSearchThreadsStorage,
  filterCollectionEntries,
  filterFileEntries,
  filterSpaceEntries,
  filterTaskEntries,
  formatTimestampForDisplay,
  getExportEnvironmentMeta,
  filterThreadEntries,
  getOperatorAutocomplete,
  parseTimestampMs,
  parseUnifiedSearchQuery,
  parseUnifiedSearchUrlState,
  parseStored,
  normalizeUnifiedSearchRecentQuery,
  pruneSelectedIds,
  resolveActiveSelectedIds,
  resolveThreadSpaceMeta,
  sortSearchResults,
  stripUnifiedSearchOperators,
  topKSearchResults,
  toggleVisibleSelection,
  type UnifiedSearchResultLimit,
  type TimelineWindow,
  type SortBy,
  type UnifiedSearchType,
  type WeightedLoweredField,
} from "@/lib/unified-search";
import {
  decodeBootstrapSelectedThreadIds,
  type UnifiedSearchBootstrap,
} from "@/lib/unified-search-bootstrap";
import {
  decodeSavedSearchStorage,
  encodeSavedSearchStorage,
  defaultSavedSearchName,
  deleteSavedSearch,
  findDuplicateSavedSearch,
  renameSavedSearch,
  resolveSavedSearchStorageCandidates,
  sortSavedSearches,
  togglePinSavedSearch,
  type UnifiedSavedSearch,
} from "@/lib/saved-searches";
import {
  SIGNAL_COLLECTIONS_KEY as COLLECTIONS_KEY,
  SIGNAL_FILES_KEY as FILES_KEY,
  SIGNAL_HISTORY_KEY as THREADS_KEY,
  SIGNAL_NOTES_KEY as NOTES_KEY,
  SIGNAL_SPACE_TAGS_KEY as SPACE_TAGS_KEY,
  SIGNAL_SPACES_KEY as SPACES_KEY,
  SIGNAL_TASKS_KEY as TASKS_KEY,
  SIGNAL_UNIFIED_RECENT_SEARCH_KEY as RECENT_SEARCH_KEY,
  SIGNAL_UNIFIED_SAVED_SEARCH_LEGACY_KEYS as SAVED_SEARCH_LEGACY_KEYS,
  SIGNAL_UNIFIED_SAVED_SEARCH_KEY as SAVED_SEARCH_KEY,
  SIGNAL_UNIFIED_VERBATIM_KEY as VERBATIM_KEY,
  UNIFIED_SEARCH_STORAGE_EVENT_KEYS,
} from "@/lib/storage-keys";
import { readStoredJsonWithExistence, writeStoredJson } from "@/lib/storage";
import { useUnifiedSearchKeyboard } from "@/lib/unified-search-keyboard";

type Thread = AnswerResponse & {
  title?: string | null;
  tags?: string[];
  spaceId?: string | null;
  spaceName?: string | null;
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
};

type PreparedThread = {
  thread: Thread;
  createdMs: number;
  combinedLower: string;
  spaceNameLower: string;
  spaceIdLower: string;
  tagSetLower: Set<string>;
  tagsText: string;
  note: string;
  noteTrimmed: string;
  citationsText: string;
  hasCitation: boolean;
  relevanceFields: WeightedLoweredField[];
};

type PreparedSpace = {
  space: Space;
  createdMs: number;
  combinedLower: string;
  spaceNameLower: string;
  spaceIdLower: string;
  tagSetLower: Set<string>;
  tags: string[];
  tagsText: string;
  relevanceFields: WeightedLoweredField[];
};

type PreparedCollection = {
  collection: Collection;
  createdMs: number;
  combinedLower: string;
  relevanceFields: WeightedLoweredField[];
};

type PreparedFile = {
  file: LibraryFile;
  createdMs: number;
  combinedLower: string;
  relevanceFields: WeightedLoweredField[];
};

type PreparedTask = {
  task: Task;
  createdMs: number;
  combinedLower: string;
  spaceNameLower: string;
  spaceIdLower: string;
  relevanceFields: WeightedLoweredField[];
};

const OPERATOR_HELP_ID = "unified-search-operator-help";
const UNIFIED_SEARCH_STORAGE_EVENT_KEY_SET = new Set<string>(
  UNIFIED_SEARCH_STORAGE_EVENT_KEYS
);
const UNIFIED_SEARCH_URL_STATE_KEYS = [
  "q",
  "type",
  "sort",
  "time",
  "limit",
  "verbatim",
] as const;

type SearchFilter = "all" | "threads" | "spaces" | "collections" | "files" | "tasks";

function normalizeBootstrapFilter(value: unknown): SearchFilter {
  if (
    value === "all" ||
    value === "threads" ||
    value === "spaces" ||
    value === "collections" ||
    value === "files" ||
    value === "tasks"
  ) {
    return value;
  }
  return "all";
}

function normalizeBootstrapSortBy(value: unknown): SortBy {
  if (value === "newest" || value === "oldest" || value === "relevance") {
    return value;
  }
  return "relevance";
}

function normalizeBootstrapTimelineWindow(value: unknown): TimelineWindow {
  if (value === "24h" || value === "7d" || value === "30d" || value === "all") {
    return value;
  }
  return "all";
}

function normalizeBootstrapResultLimit(value: unknown): UnifiedSearchResultLimit {
  if (value === 10 || value === 20 || value === 50) return value;
  return 20;
}

const THREAD_BADGE_LABELS: Record<string, string> = {
  title: "Title",
  question: "Question",
  tag: "Tag",
  space: "Space",
  note: "Note",
  citation: "Citation",
  answer: "Answer",
};

type NavigableResult = {
  key: string;
  href: string;
  domId: string;
};

type UnifiedSearchProps = {
  initialBootstrap?: UnifiedSearchBootstrap;
};

function toNavigableDomId(key: string): string {
  return `search-nav-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export default function UnifiedSearch({
  initialBootstrap,
}: UnifiedSearchProps = {}) {
  const router = useRouter();
  const disableStorageSync = initialBootstrap?.disableStorageSync === true;
  const readSavedSearchStorageState = useCallback(() => {
    const nowIso = new Date().toISOString();
    const candidates = [
      {
        key: SAVED_SEARCH_KEY,
        ...readStoredJsonWithExistence<unknown>(SAVED_SEARCH_KEY, []),
      },
      ...SAVED_SEARCH_LEGACY_KEYS.map((legacyKey) => ({
        key: legacyKey,
        ...readStoredJsonWithExistence<unknown>(legacyKey, []),
      })),
    ];
    return resolveSavedSearchStorageCandidates(candidates, nowIso);
  }, []);
  const bootstrapSavedSearchState = useMemo(() => {
    const resolvedSavedSearches =
      typeof initialBootstrap?.savedSearches !== "undefined"
        ? {
            searches: decodeSavedSearchStorage(initialBootstrap.savedSearches),
            sourceKey: null,
            migratedFromLegacy: false,
          }
        : readSavedSearchStorageState();
    const decodedSavedSearches = resolvedSavedSearches.searches;
    if (typeof initialBootstrap?.activeSavedSearchId !== "string") {
      return {
        decodedSavedSearches,
        activeSavedSearch: null as UnifiedSavedSearch | null,
        migratedFromLegacy: resolvedSavedSearches.migratedFromLegacy,
      };
    }
    const activeSavedSearch =
      decodedSavedSearches.find(
        (saved) => saved.id === initialBootstrap.activeSavedSearchId
      ) ?? null;
    return {
      decodedSavedSearches,
      activeSavedSearch,
      migratedFromLegacy: resolvedSavedSearches.migratedFromLegacy,
    };
  }, [initialBootstrap, readSavedSearchStorageState]);
  const [query, setQuery] = useState(
    bootstrapSavedSearchState.activeSavedSearch?.query ?? initialBootstrap?.query ?? ""
  );
  const [debugMode, setDebugMode] = useState(initialBootstrap?.debugMode === true);
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<SearchFilter>(
    normalizeBootstrapFilter(
      bootstrapSavedSearchState.activeSavedSearch?.filter ??
        initialBootstrap?.filter
    )
  );
  const [sortBy, setSortBy] = useState<SortBy>(
    normalizeBootstrapSortBy(
      bootstrapSavedSearchState.activeSavedSearch?.sortBy ??
        initialBootstrap?.sortBy
    )
  );
  const [timelineWindow, setTimelineWindow] = useState<TimelineWindow>(
    normalizeBootstrapTimelineWindow(
      bootstrapSavedSearchState.activeSavedSearch?.timelineWindow ??
        initialBootstrap?.timelineWindow
    )
  );
  const [timelineNowMs, setTimelineNowMs] = useState(0);
  const [resultLimit, setResultLimit] = useState<UnifiedSearchResultLimit>(
    normalizeBootstrapResultLimit(
      bootstrapSavedSearchState.activeSavedSearch?.resultLimit ??
        initialBootstrap?.resultLimit
    )
  );
  const [verbatim, setVerbatim] = useState<boolean>(() =>
    typeof bootstrapSavedSearchState.activeSavedSearch?.verbatim === "boolean"
      ? bootstrapSavedSearchState.activeSavedSearch.verbatim
      : typeof initialBootstrap?.verbatim === "boolean"
        ? initialBootstrap.verbatim
      : parseStored<boolean>(VERBATIM_KEY, false)
  );
  const [recentQueries, setRecentQueries] = useState<string[]>(() =>
    decodeUnifiedSearchRecentQueriesStorage(
      initialBootstrap?.recentQueries ??
        parseStored<unknown>(RECENT_SEARCH_KEY, [])
    )
  );
  const [savedSearches, setSavedSearches] = useState<UnifiedSavedSearch[]>(() =>
    bootstrapSavedSearchState.decodedSavedSearches
  );
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null);
  const [editingSavedName, setEditingSavedName] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    decodeUnifiedSearchNotesStorage(
      initialBootstrap?.notes ?? parseStored<unknown>(NOTES_KEY, {})
    )
  );
  const [threads, setThreads] = useState<Thread[]>(() =>
    decodeUnifiedSearchThreadsStorage(
      initialBootstrap?.threads ?? parseStored<unknown>(THREADS_KEY, [])
    )
  );
  const [spaces, setSpaces] = useState<Space[]>(() =>
    decodeUnifiedSearchSpacesStorage(
      initialBootstrap?.spaces ?? parseStored<unknown>(SPACES_KEY, [])
    )
  );
  const [spaceTags, setSpaceTags] = useState<Record<string, string[]>>(() =>
    decodeUnifiedSearchSpaceTagsStorage(
      initialBootstrap?.spaceTags ??
        parseStored<unknown>(SPACE_TAGS_KEY, {})
    )
  );
  const [collections, setCollections] = useState<Collection[]>(() =>
    decodeUnifiedSearchCollectionsStorage(
      initialBootstrap?.collections ??
        parseStored<unknown>(COLLECTIONS_KEY, [])
    )
  );
  const [files, setFiles] = useState<LibraryFile[]>(() =>
    decodeUnifiedSearchFilesStorage(
      initialBootstrap?.files ?? parseStored<unknown>(FILES_KEY, [])
    )
  );
  const [tasks, setTasks] = useState<Task[]>(() =>
    decodeUnifiedSearchTasksStorage(
      initialBootstrap?.tasks ?? parseStored<unknown>(TASKS_KEY, [])
    )
  );
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>(() =>
    decodeBootstrapSelectedThreadIds(initialBootstrap?.selectedThreadIds)
  );
  const [bulkSpaceId, setBulkSpaceId] = useState("");
  const [activeResultKey, setActiveResultKey] = useState<string | null>(null);
  const [activeOperatorSuggestionIndex, setActiveOperatorSuggestionIndex] =
    useState(0);
  const [hideOperatorAutocomplete, setHideOperatorAutocomplete] = useState(false);
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
  const storageWriteToastGuardRef = useRef(new Set<string>());

  const parsedQuery = useMemo(
    () => parseUnifiedSearchQuery(deferredQuery),
    [deferredQuery]
  );
  const queryInfo = parsedQuery.query;
  const operators = parsedQuery.operators;
  const effectiveFilter: UnifiedSearchType =
    operators.type ?? (filter as UnifiedSearchType);
  const effectiveVerbatim = operators.verbatim ?? verbatim;
  const matchQueryInfo = useMemo(
    () =>
      effectiveVerbatim
        ? { normalized: queryInfo.normalized, tokens: [] }
        : queryInfo,
    [effectiveVerbatim, queryInfo]
  );
  const operatorAutocomplete = useMemo(
    () => getOperatorAutocomplete(query),
    [query]
  );
  const operatorSuggestions = useMemo(() => {
    if (hideOperatorAutocomplete) return [];
    return operatorAutocomplete?.suggestions ?? [];
  }, [hideOperatorAutocomplete, operatorAutocomplete]);
  const resolvedActiveOperatorSuggestionIndex = useMemo(() => {
    if (!operatorSuggestions.length) return -1;
    if (
      activeOperatorSuggestionIndex < 0 ||
      activeOperatorSuggestionIndex >= operatorSuggestions.length
    ) {
      return 0;
    }
    return activeOperatorSuggestionIndex;
  }, [activeOperatorSuggestionIndex, operatorSuggestions]);

  useEffect(() => {
    if (disableStorageSync) return;
    if (typeof window === "undefined") return;

    const readAll = () => {
      setNotes(
        decodeUnifiedSearchNotesStorage(parseStored<unknown>(NOTES_KEY, {}))
      );
      const nextThreads = decodeUnifiedSearchThreadsStorage(
        parseStored<unknown>(THREADS_KEY, [])
      );
      threadsRef.current = nextThreads;
      setThreads(nextThreads);
      setSpaces(
        decodeUnifiedSearchSpacesStorage(parseStored<unknown>(SPACES_KEY, []))
      );
      setSpaceTags(
        decodeUnifiedSearchSpaceTagsStorage(
          parseStored<unknown>(SPACE_TAGS_KEY, {})
        )
      );
      setCollections(
        decodeUnifiedSearchCollectionsStorage(
          parseStored<unknown>(COLLECTIONS_KEY, [])
        )
      );
      setFiles(
        decodeUnifiedSearchFilesStorage(parseStored<unknown>(FILES_KEY, []))
      );
      setTasks(
        decodeUnifiedSearchTasksStorage(parseStored<unknown>(TASKS_KEY, []))
      );
      setRecentQueries(
        decodeUnifiedSearchRecentQueriesStorage(
          parseStored<unknown>(RECENT_SEARCH_KEY, [])
        )
      );
      setSavedSearches(readSavedSearchStorageState().searches);
      setVerbatim(parseStored<boolean>(VERBATIM_KEY, false));

      // Cross-tab or focus reloads can remove threads; keep selection consistent with reality.
      const validThreadIds = new Set(nextThreads.map((thread) => thread.id));
      setSelectedThreadIds((previous) =>
        pruneSelectedIds(previous, validThreadIds)
      );
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && !UNIFIED_SEARCH_STORAGE_EVENT_KEY_SET.has(event.key)) {
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
  }, [disableStorageSync, readSavedSearchStorageState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncDebugMode = () => {
      setDebugMode(new URLSearchParams(window.location.search).get("debug") === "1");
    };
    syncDebugMode();
    window.addEventListener("popstate", syncDebugMode);
    return () => window.removeEventListener("popstate", syncDebugMode);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncUrlState = () => {
      const patch = parseUnifiedSearchUrlState(
        new URLSearchParams(window.location.search)
      );
      if (Object.prototype.hasOwnProperty.call(patch, "query")) {
        setQuery(patch.query ?? "");
      }
      if (patch.filter) setFilter(patch.filter as SearchFilter);
      if (patch.sortBy) setSortBy(patch.sortBy);
      if (patch.timelineWindow) setTimelineWindow(patch.timelineWindow);
      if (patch.resultLimit) setResultLimit(patch.resultLimit);
      if (typeof patch.verbatim === "boolean") setVerbatim(patch.verbatim);
    };
    syncUrlState();
    window.addEventListener("popstate", syncUrlState);
    return () => window.removeEventListener("popstate", syncUrlState);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentUrl = new URL(window.location.href);
    const mergedParams = new URLSearchParams(currentUrl.search);
    UNIFIED_SEARCH_URL_STATE_KEYS.forEach((key) => mergedParams.delete(key));
    const nextStateParams = buildUnifiedSearchUrlParams({
      query,
      filter,
      sortBy,
      timelineWindow,
      resultLimit,
      verbatim,
    });
    nextStateParams.forEach((value, key) => mergedParams.set(key, value));

    const nextSearch = mergedParams.toString();
    const nextPath = `${currentUrl.pathname}${
      nextSearch ? `?${nextSearch}` : ""
    }${currentUrl.hash}`;
    const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    if (nextPath === currentPath) return;
    window.history.replaceState(window.history.state, "", nextPath);
  }, [query, filter, sortBy, timelineWindow, resultLimit, verbatim]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tick = () => setTimelineNowMs(Date.now());
    tick();
    const interval = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  const operatorSummary = useMemo(() => {
    return buildUnifiedSearchOperatorSummary(operators);
  }, [operators]);

  const persistStorageValue = useCallback(
    (key: string, value: unknown, label: string) => {
      if (disableStorageSync) return;
      const status = writeStoredJson(key, value);
      if (status === "ok" || status === "unavailable") {
        storageWriteToastGuardRef.current.delete(`${key}:quota`);
        storageWriteToastGuardRef.current.delete(`${key}:failed`);
        return;
      }

      const dedupeKey = `${key}:${status}`;
      if (storageWriteToastGuardRef.current.has(dedupeKey)) return;
      storageWriteToastGuardRef.current.add(dedupeKey);
      window.setTimeout(() => {
        setToast({
          message:
            status === "quota"
              ? `Local storage is full. Could not save ${label}.`
              : `Could not persist ${label} to local storage.`,
        });
      }, 0);
    },
    [disableStorageSync]
  );

  useEffect(() => {
    persistStorageValue(RECENT_SEARCH_KEY, recentQueries, "recent queries");
  }, [recentQueries, persistStorageValue]);

  useEffect(() => {
    persistStorageValue(
      SAVED_SEARCH_KEY,
      encodeSavedSearchStorage(savedSearches),
      "saved searches"
    );
  }, [savedSearches, persistStorageValue]);

  useEffect(() => {
    persistStorageValue(VERBATIM_KEY, verbatim, "verbatim preference");
  }, [verbatim, persistStorageValue]);

  useEffect(() => {
    persistStorageValue(THREADS_KEY, threads, "thread updates");
  }, [threads, persistStorageValue]);

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

  const preparedThreads = useMemo<PreparedThread[]>(() => {
    return threads.map((thread) => {
      const citationsText = thread.citations
        .map((citation) => `${citation.title} ${citation.url}`)
        .join(" ");
      const tagsText = (thread.tags ?? []).join(" ");
      const note = notes[thread.id] ?? "";
      const noteTrimmed = note.trim();
      const combinedLower = [
        thread.title ?? thread.question,
        thread.question,
        thread.answer,
        tagsText,
        thread.spaceName ?? "",
        citationsText,
        note,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();

      return {
        thread,
        createdMs: parseTimestampMs(thread.createdAt),
        combinedLower,
        spaceNameLower: (thread.spaceName ?? "").toLowerCase(),
        spaceIdLower: (thread.spaceId ?? "").toLowerCase(),
        tagSetLower: new Set((thread.tags ?? []).map((tag) => tag.toLowerCase())),
        tagsText,
        note,
        noteTrimmed,
        citationsText,
        hasCitation: Boolean(thread.citations && thread.citations.length > 0),
        relevanceFields: [
          {
            loweredText: (thread.title ?? thread.question ?? "").toLowerCase(),
            weight: 8,
          },
          { loweredText: (thread.question ?? "").toLowerCase(), weight: 6 },
          { loweredText: tagsText.toLowerCase(), weight: 4 },
          { loweredText: (thread.spaceName ?? "").toLowerCase(), weight: 3 },
          { loweredText: note.toLowerCase(), weight: 3 },
          { loweredText: citationsText.toLowerCase(), weight: 2 },
          { loweredText: (thread.answer ?? "").toLowerCase(), weight: 1 },
        ],
      };
    });
  }, [threads, notes]);

  const preparedSpaces = useMemo<PreparedSpace[]>(() => {
    return spaces.map((space) => {
      const tags = spaceTags[space.id] ?? [];
      const tagsText = tags.join(" ");
      const combinedLower = [space.name, space.instructions ?? "", tagsText]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      return {
        space,
        createdMs: parseTimestampMs(space.createdAt),
        combinedLower,
        spaceNameLower: space.name.toLowerCase(),
        spaceIdLower: space.id.toLowerCase(),
        tagSetLower: new Set(tags.map((tag) => tag.toLowerCase())),
        tags,
        tagsText,
        relevanceFields: [
          { loweredText: space.name.toLowerCase(), weight: 8 },
          { loweredText: tagsText.toLowerCase(), weight: 4 },
          { loweredText: (space.instructions ?? "").toLowerCase(), weight: 2 },
        ],
      };
    });
  }, [spaces, spaceTags]);

  const preparedCollections = useMemo<PreparedCollection[]>(() => {
    return collections.map((collection) => ({
      collection,
      createdMs: parseTimestampMs(collection.createdAt),
      combinedLower: collection.name.trim().toLowerCase(),
      relevanceFields: [{ loweredText: collection.name.toLowerCase(), weight: 8 }],
    }));
  }, [collections]);

  const preparedFiles = useMemo<PreparedFile[]>(() => {
    return files.map((file) => ({
      file,
      createdMs: parseTimestampMs(file.addedAt),
      combinedLower: [file.name, file.text].filter(Boolean).join("\n").toLowerCase(),
      relevanceFields: [
        { loweredText: file.name.toLowerCase(), weight: 8 },
        { loweredText: (file.text ?? "").toLowerCase(), weight: 1 },
      ],
    }));
  }, [files]);

  const preparedTasks = useMemo<PreparedTask[]>(() => {
    return tasks.map((task) => ({
      task,
      createdMs: parseTimestampMs(task.createdAt),
      combinedLower: [
        task.name,
        task.prompt,
        task.spaceName ?? "",
        task.mode,
        task.cadence,
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase(),
      spaceNameLower: (task.spaceName ?? "").toLowerCase(),
      spaceIdLower: (task.spaceId ?? "").toLowerCase(),
      relevanceFields: [
        { loweredText: task.name.toLowerCase(), weight: 8 },
        { loweredText: task.prompt.toLowerCase(), weight: 2 },
        { loweredText: (task.spaceName ?? "").toLowerCase(), weight: 3 },
        { loweredText: task.mode.toLowerCase(), weight: 1 },
        { loweredText: task.cadence.toLowerCase(), weight: 1 },
      ],
    }));
  }, [tasks]);

  const filteredThreads = useMemo<PreparedThread[]>(() => {
    return filterThreadEntries(preparedThreads, {
      query: matchQueryInfo,
      operators,
      timelineWindow,
      nowMs: timelineNowMs,
    });
  }, [
    preparedThreads,
    timelineWindow,
    timelineNowMs,
    matchQueryInfo,
    operators,
  ]);

  const filteredSpaces = useMemo(() => {
    return filterSpaceEntries(preparedSpaces, {
      query: matchQueryInfo,
      operators,
      timelineWindow,
      nowMs: timelineNowMs,
    });
  }, [
    preparedSpaces,
    timelineWindow,
    timelineNowMs,
    matchQueryInfo,
    operators,
  ]);

  const filteredCollections = useMemo(() => {
    return filterCollectionEntries(preparedCollections, {
      query: matchQueryInfo,
      operators,
      timelineWindow,
      nowMs: timelineNowMs,
    });
  }, [
    preparedCollections,
    timelineWindow,
    timelineNowMs,
    matchQueryInfo,
    operators,
  ]);

  const filteredFiles = useMemo(() => {
    return filterFileEntries(preparedFiles, {
      query: matchQueryInfo,
      operators,
      timelineWindow,
      nowMs: timelineNowMs,
    });
  }, [preparedFiles, timelineWindow, timelineNowMs, matchQueryInfo, operators]);

  const filteredTasks = useMemo(() => {
    return filterTaskEntries(preparedTasks, {
      query: matchQueryInfo,
      operators,
      timelineWindow,
      nowMs: timelineNowMs,
    });
  }, [
    preparedTasks,
    timelineWindow,
    timelineNowMs,
    matchQueryInfo,
    operators,
  ]);

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
  const staleSelectedCount = useMemo(
    () => selectedThreadIds.length - selectedCount,
    [selectedThreadIds, selectedCount]
  );

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

  const uiLimit = useMemo(() => Math.max(resultLimit, 3), [resultLimit]);

  const scoreThreadEntry = useCallback(
    (entry: PreparedThread) =>
      computeRelevanceScoreFromLowered(entry.relevanceFields, matchQueryInfo),
    [matchQueryInfo]
  );

  const scoreSpaceEntry = useCallback(
    (entry: PreparedSpace) =>
      computeRelevanceScoreFromLowered(entry.relevanceFields, matchQueryInfo),
    [matchQueryInfo]
  );

  const scoreCollectionEntry = useCallback(
    (entry: PreparedCollection) =>
      computeRelevanceScoreFromLowered(entry.relevanceFields, matchQueryInfo),
    [matchQueryInfo]
  );

  const scoreFileEntry = useCallback(
    (entry: PreparedFile) =>
      computeRelevanceScoreFromLowered(entry.relevanceFields, matchQueryInfo),
    [matchQueryInfo]
  );

  const scoreTaskEntry = useCallback(
    (entry: PreparedTask) =>
      computeRelevanceScoreFromLowered(entry.relevanceFields, matchQueryInfo),
    [matchQueryInfo]
  );

  const visibleThreads = useMemo<PreparedThread[]>(() => {
    return topKSearchResults(filteredThreads, sortBy, matchQueryInfo, uiLimit, scoreThreadEntry);
  }, [filteredThreads, sortBy, matchQueryInfo, uiLimit, scoreThreadEntry]);

  const visibleSpaces = useMemo<PreparedSpace[]>(() => {
    return topKSearchResults(filteredSpaces, sortBy, matchQueryInfo, uiLimit, scoreSpaceEntry);
  }, [filteredSpaces, sortBy, matchQueryInfo, uiLimit, scoreSpaceEntry]);

  const visibleCollections = useMemo<PreparedCollection[]>(() => {
    return topKSearchResults(
      filteredCollections,
      sortBy,
      matchQueryInfo,
      uiLimit,
      scoreCollectionEntry
    );
  }, [filteredCollections, sortBy, matchQueryInfo, uiLimit, scoreCollectionEntry]);

  const visibleFiles = useMemo<PreparedFile[]>(() => {
    return topKSearchResults(filteredFiles, sortBy, matchQueryInfo, uiLimit, scoreFileEntry);
  }, [filteredFiles, sortBy, matchQueryInfo, uiLimit, scoreFileEntry]);

  const visibleTasks = useMemo<PreparedTask[]>(() => {
    return topKSearchResults(filteredTasks, sortBy, matchQueryInfo, uiLimit, scoreTaskEntry);
  }, [filteredTasks, sortBy, matchQueryInfo, uiLimit, scoreTaskEntry]);

  const shownThreads = useMemo(
    () => visibleThreads.slice(0, resultLimit),
    [visibleThreads, resultLimit]
  );
  const shownThreadIdSet = useMemo(
    () => new Set(shownThreads.map((entry) => entry.thread.id)),
    [shownThreads]
  );
  const hiddenSelectedCount = useMemo(() => {
    if (!activeSelectedThreadIds.length) return 0;
    return activeSelectedThreadIds.filter((id) => !shownThreadIdSet.has(id))
      .length;
  }, [activeSelectedThreadIds, shownThreadIdSet]);
  const shownSpaces = useMemo(
    () => visibleSpaces.slice(0, resultLimit),
    [visibleSpaces, resultLimit]
  );
  const shownCollections = useMemo(
    () => visibleCollections.slice(0, resultLimit),
    [visibleCollections, resultLimit]
  );
  const shownFiles = useMemo(
    () => visibleFiles.slice(0, resultLimit),
    [visibleFiles, resultLimit]
  );
  const shownTasks = useMemo(
    () => visibleTasks.slice(0, resultLimit),
    [visibleTasks, resultLimit]
  );
  const diagnosticsRows = useMemo(
    () =>
      buildUnifiedSearchDiagnosticsRows(
        {
          threads: {
            loaded: preparedThreads.length,
            matched: filteredThreads.length,
            visible: shownThreads.length,
          },
          spaces: {
            loaded: preparedSpaces.length,
            matched: filteredSpaces.length,
            visible: shownSpaces.length,
          },
          collections: {
            loaded: preparedCollections.length,
            matched: filteredCollections.length,
            visible: shownCollections.length,
          },
          files: {
            loaded: preparedFiles.length,
            matched: filteredFiles.length,
            visible: shownFiles.length,
          },
          tasks: {
            loaded: preparedTasks.length,
            matched: filteredTasks.length,
            visible: shownTasks.length,
          },
        },
        effectiveFilter
      ),
    [
      effectiveFilter,
      filteredCollections.length,
      filteredFiles.length,
      filteredSpaces.length,
      filteredTasks.length,
      filteredThreads.length,
      preparedCollections.length,
      preparedFiles.length,
      preparedSpaces.length,
      preparedTasks.length,
      preparedThreads.length,
      shownCollections.length,
      shownFiles.length,
      shownSpaces.length,
      shownTasks.length,
      shownThreads.length,
    ]
  );
  const diagnosticsTotals = useMemo(
    () =>
      diagnosticsRows.reduce(
        (totals, row) => ({
          loaded: totals.loaded + row.loaded,
          matched: totals.matched + row.matched,
          visible: totals.visible + row.visible,
          filteredByTypeScope:
            totals.filteredByTypeScope + row.filteredByTypeScope,
          filteredByQueryOperatorTime:
            totals.filteredByQueryOperatorTime +
            row.filteredByQueryOperatorTime,
          filteredByResultLimit:
            totals.filteredByResultLimit + row.filteredByResultLimit,
        }),
        {
          loaded: 0,
          matched: 0,
          visible: 0,
          filteredByTypeScope: 0,
          filteredByQueryOperatorTime: 0,
          filteredByResultLimit: 0,
        }
      ),
    [diagnosticsRows]
  );
  const navigableResults = useMemo<NavigableResult[]>(() => {
    const items: NavigableResult[] = [];
    if (effectiveFilter === "all" || effectiveFilter === "threads") {
      shownThreads.forEach((entry) => {
        const key = `thread:${entry.thread.id}`;
        items.push({
          key,
          href: `/?thread=${entry.thread.id}`,
          domId: toNavigableDomId(key),
        });
      });
    }
    if (effectiveFilter === "all" || effectiveFilter === "spaces") {
      shownSpaces.forEach((entry) => {
        const key = `space:${entry.space.id}`;
        items.push({
          key,
          href: `/?space=${entry.space.id}`,
          domId: toNavigableDomId(key),
        });
      });
    }
    if (effectiveFilter === "all" || effectiveFilter === "collections") {
      shownCollections.forEach((entry) => {
        const key = `collection:${entry.collection.id}`;
        items.push({
          key,
          href: `/?collection=${entry.collection.id}`,
          domId: toNavigableDomId(key),
        });
      });
    }
    return items;
  }, [effectiveFilter, shownThreads, shownSpaces, shownCollections]);
  const activeResultIndex = useMemo(
    () =>
      activeResultKey
        ? navigableResults.findIndex((item) => item.key === activeResultKey)
        : -1,
    [activeResultKey, navigableResults]
  );

  const setAllShownThreadSelection = useCallback(
    (enabled: boolean) => {
      const visibleIds = shownThreads.map((entry) => entry.thread.id);
      setSelectedThreadIds((previous) =>
        toggleVisibleSelection(previous, visibleIds, enabled)
      );
    },
    [shownThreads]
  );
  const allShownSelected =
    shownThreads.length > 0 &&
    shownThreads.every((entry) => activeSelectedThreadIds.includes(entry.thread.id));

  useEffect(() => {
    if (activeResultIndex < 0) return;
    const current = navigableResults[activeResultIndex];
    if (!current) return;
    document
      .getElementById(current.domId)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeResultIndex, navigableResults]);

  const topThreadResults = useMemo(() => visibleThreads.slice(0, 3), [visibleThreads]);
  const topSpaceResults = useMemo(() => visibleSpaces.slice(0, 3), [visibleSpaces]);
  const topCollectionResults = useMemo(
    () => visibleCollections.slice(0, 3),
    [visibleCollections]
  );
  const topFileResults = useMemo(() => visibleFiles.slice(0, 3), [visibleFiles]);
  const topTaskResults = useMemo(() => visibleTasks.slice(0, 3), [visibleTasks]);

  const snippetFromText = useCallback(
    (text: string) => {
      if (!text) return "";
      const compact = text.replace(/\s+/g, " ").trim();
      if (!compact) return "";
      if (!matchQueryInfo.normalized) return compact.slice(0, 160);
      const lowered = compact.toLowerCase();
      let index = lowered.indexOf(matchQueryInfo.normalized);
      if (index === -1 && matchQueryInfo.tokens.length) {
        for (const token of matchQueryInfo.tokens) {
          index = lowered.indexOf(token);
          if (index !== -1) break;
        }
      }
      if (index === -1) return compact.slice(0, 160);
      const start = Math.max(0, index - 60);
      const end = Math.min(
        compact.length,
        index + matchQueryInfo.normalized.length + 80
      );
      return compact.slice(start, end).trim();
    },
    [matchQueryInfo]
  );

  const buildThreadSnippet = useCallback(
    (entry: PreparedThread) => {
      const thread = entry.thread;
      const candidates = [
        thread.answer,
        entry.note,
        entry.citationsText,
        thread.question,
      ];
      for (const candidate of candidates) {
        const snippet = snippetFromText(candidate);
        if (snippet) return snippet;
      }
      return "";
    },
    [snippetFromText]
  );

  const renderHighlighted = useCallback(
    (text: string) => {
      const parts = buildHighlightParts(
        text,
        matchQueryInfo.normalized,
        matchQueryInfo.tokens
      );
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
    [matchQueryInfo]
  );

  function pushRecentQuery(value: string) {
    const normalized = normalizeUnifiedSearchRecentQuery(value);
    if (!normalized) return;
    setRecentQueries((prev) => {
      const dedupeKey = normalized.toLowerCase();
      const next = [
        normalized,
        ...prev.filter((item) => item.toLowerCase() !== dedupeKey),
      ];
      return next.slice(0, 5);
    });
  }

  function applyCurrentOperatorSuggestion(): boolean {
    if (!operatorSuggestions.length) return false;
    const suggestion =
      operatorSuggestions[resolvedActiveOperatorSuggestionIndex] ??
      operatorSuggestions[0];
    if (!suggestion) return false;
    setQuery((previous) => applyOperatorAutocomplete(previous, suggestion));
    setHideOperatorAutocomplete(false);
    return true;
  }

  const onInputKeyDown = useUnifiedSearchKeyboard({
    operatorSuggestions,
    setActiveOperatorSuggestionIndex,
    setHideOperatorAutocomplete,
    applyCurrentOperatorSuggestion,
    navigableResults,
    activeResultIndex,
    activeResultKey,
    setActiveResultKey,
    query,
    setQuery,
    pushRecentQuery,
    openResult: (href) => router.push(href),
  });

  const clearOperatorsFromQuery = useCallback(() => {
    const nextQuery = stripUnifiedSearchOperators(query);
    if (nextQuery === query.trim()) return;
    setQuery(nextQuery);
  }, [query]);

  const resetTypeFilter = useCallback(() => {
    setFilter("all");
    const nextQuery = stripUnifiedSearchOperators(query, { drop: ["type"] });
    if (nextQuery !== query.trim()) {
      setQuery(nextQuery);
    }
  }, [query]);

  const resetVerbatimFilter = useCallback(() => {
    setVerbatim(false);
    const nextQuery = stripUnifiedSearchOperators(query, {
      drop: ["verbatim"],
    });
    if (nextQuery !== query.trim()) {
      setQuery(nextQuery);
    }
  }, [query]);

  function exportResults() {
    const exportEnvironment = getExportEnvironmentMeta();
    const exportedSavedSearches = sortSavedSearches(savedSearches);
    const exportedThreads = sortSearchResults(
      filteredThreads,
      sortBy,
      matchQueryInfo,
      scoreThreadEntry
    );
    const exportedSpaces = sortSearchResults(filteredSpaces, sortBy, matchQueryInfo, scoreSpaceEntry);
    const exportedCollections = sortSearchResults(
      filteredCollections,
      sortBy,
      matchQueryInfo,
      scoreCollectionEntry
    );
    const exportedFiles = sortSearchResults(filteredFiles, sortBy, matchQueryInfo, scoreFileEntry);
    const exportedTasks = sortSearchResults(filteredTasks, sortBy, matchQueryInfo, scoreTaskEntry);
    const markdown = buildUnifiedSearchMarkdownExport({
      exportedAt: new Date().toISOString(),
      environment: exportEnvironment,
      query,
      filter: effectiveFilter,
      sortBy,
      resultLimit,
      threads: exportedThreads.map((entry) => ({
        title: entry.thread.title ?? entry.thread.question,
        spaceName: entry.thread.spaceName,
        mode: entry.thread.mode,
        createdAt: entry.thread.createdAt,
      })),
      spaces: exportedSpaces.map((entry) => ({
        name: entry.space.name,
        instructions: entry.space.instructions,
        tags: entry.tags,
        createdAt: entry.space.createdAt,
      })),
      collections: exportedCollections.map((entry) => ({
        name: entry.collection.name,
        createdAt: entry.collection.createdAt,
      })),
      files: exportedFiles.map((entry) => ({
        name: entry.file.name,
        size: entry.file.size,
        addedAt: entry.file.addedAt,
      })),
      tasks: exportedTasks.map((entry) => ({
        name: entry.task.name,
        cadence: entry.task.cadence,
        time: entry.task.time,
        mode: entry.task.mode,
        sources: entry.task.sources,
        spaceName: entry.task.spaceName,
        nextRun: entry.task.nextRun,
      })),
      savedSearches: exportedSavedSearches,
    });

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signal-search-export-${Date.now()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportSavedSearches() {
    const exportEnvironment = getExportEnvironmentMeta();
    const exportedSavedSearches = sortSavedSearches(savedSearches);
    const markdown = buildUnifiedSearchSavedSearchesMarkdownExport({
      exportedAt: new Date().toISOString(),
      environment: exportEnvironment,
      savedSearches: exportedSavedSearches,
    });
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signal-search-saved-searches-${Date.now()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const exportedThreads = sortSearchResults(
      filteredThreads,
      sortBy,
      matchQueryInfo,
      scoreThreadEntry
    );
    const exportedSpaces = sortSearchResults(filteredSpaces, sortBy, matchQueryInfo, scoreSpaceEntry);
    const exportedCollections = sortSearchResults(
      filteredCollections,
      sortBy,
      matchQueryInfo,
      scoreCollectionEntry
    );
    const exportedFiles = sortSearchResults(filteredFiles, sortBy, matchQueryInfo, scoreFileEntry);
    const exportedTasks = sortSearchResults(filteredTasks, sortBy, matchQueryInfo, scoreTaskEntry);
    const csv = buildUnifiedSearchCsvExport([
      ...exportedThreads.map((entry) => ({
        type: "thread",
        title: entry.thread.title ?? entry.thread.question,
        space: entry.thread.spaceName ?? "None",
        mode: entry.thread.mode,
        createdAt: entry.thread.createdAt,
      })),
      ...exportedSpaces.map((entry) => ({
        type: "space",
        title: entry.space.name,
        createdAt: entry.space.createdAt,
      })),
      ...exportedCollections.map((entry) => ({
        type: "collection",
        title: entry.collection.name,
        createdAt: entry.collection.createdAt,
      })),
      ...exportedFiles.map((entry) => ({
        type: "file",
        title: entry.file.name,
        createdAt: entry.file.addedAt,
      })),
      ...exportedTasks.map((entry) => ({
        type: "task",
        title: entry.task.name,
        space: entry.task.spaceName ?? "None",
        mode: entry.task.mode,
        createdAt: entry.task.nextRun,
      })),
    ]);

    const blob = new Blob([csv], { type: "text/csv" });
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

  const sortedSavedSearches = useMemo(
    () => sortSavedSearches(savedSearches),
    [savedSearches]
  );

  const activeMatchCount = useMemo(() => {
    if (effectiveFilter === "threads") return filteredThreads.length;
    if (effectiveFilter === "spaces") return filteredSpaces.length;
    if (effectiveFilter === "collections") return filteredCollections.length;
    if (effectiveFilter === "files") return filteredFiles.length;
    if (effectiveFilter === "tasks") return filteredTasks.length;
    return (
      filteredThreads.length +
      filteredSpaces.length +
      filteredCollections.length +
      filteredFiles.length +
      filteredTasks.length
    );
  }, [
    effectiveFilter,
    filteredCollections.length,
    filteredFiles.length,
    filteredSpaces.length,
    filteredTasks.length,
    filteredThreads.length,
  ]);

  const showZeroResultsGuidance =
    activeMatchCount === 0 &&
    (Boolean(queryInfo.normalized) ||
      operatorSummary.length > 0 ||
      filter !== "all" ||
      timelineWindow !== "all" ||
      effectiveVerbatim);

  function createSavedSearchId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      return crypto.randomUUID();
    return `saved-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function saveCurrentSearch() {
    const spec = {
      query,
      filter: effectiveFilter,
      sortBy,
      timelineWindow,
      resultLimit,
      verbatim: effectiveVerbatim,
    } as const;
    const meaningful =
      spec.query.trim() ||
      spec.filter !== "all" ||
      spec.sortBy !== "relevance" ||
      spec.timelineWindow !== "all" ||
      spec.resultLimit !== 20 ||
      spec.verbatim;
    if (!meaningful) {
      setToast({ message: "Nothing to save yet." });
      return;
    }

    const now = new Date().toISOString();
    const duplicate = findDuplicateSavedSearch(savedSearches, spec);
    if (duplicate) {
      setSavedSearches((prev) =>
        prev.map((item) =>
          item.id === duplicate.id ? { ...item, updatedAt: now } : item
        )
      );
      setToast({ message: `Updated saved search: ${duplicate.name}` });
      return;
    }

    const saved: UnifiedSavedSearch = {
      id: createSavedSearchId(),
      name: defaultSavedSearchName(spec),
      query: query.trim(),
      filter: effectiveFilter,
      sortBy,
      timelineWindow,
      resultLimit,
      verbatim: effectiveVerbatim,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    setSavedSearches((prev) => [saved, ...prev]);
    setToast({ message: `Saved search: ${saved.name}` });
    setEditingSavedId(saved.id);
    setEditingSavedName(saved.name);
  }

  function runSavedSearch(saved: UnifiedSavedSearch) {
    setQuery(saved.query);
    setFilter(saved.filter as typeof filter);
    setSortBy(saved.sortBy);
    setTimelineWindow(saved.timelineWindow);
    setResultLimit(saved.resultLimit);
    setVerbatim(Boolean(saved.verbatim));
    pushRecentQuery(saved.query);
    inputRef.current?.focus();
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
            aria-label="Export unified search results to Markdown"
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Export results
          </button>
          <button
            onClick={exportCsv}
            aria-label="Export unified search results to CSV"
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
              setHideOperatorAutocomplete(false);
              if (!value.endsWith(" ")) return;
              pushRecentQuery(value);
            }}
            onBlur={() => pushRecentQuery(query)}
            onKeyDown={onInputKeyDown}
            aria-describedby={OPERATOR_HELP_ID}
            placeholder='Search threads, spaces, collections, files, and tasks (try: type:threads is:pinned has:note tag:foo space:"Research" verbatim:true)'
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-signal-text outline-none placeholder:text-signal-muted"
          />
          {operatorSuggestions.length ? (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs">
              <div className="mb-2 flex items-center justify-between text-[11px] text-signal-muted">
                <span>Operator suggestions</span>
                <span>Enter/Tab to apply, Esc to dismiss</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {operatorSuggestions.map((suggestion, index) => {
                  const selected = index === resolvedActiveOperatorSuggestionIndex;
                  return (
                    <button
                      key={`operator-suggestion-${suggestion}`}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setQuery((previous) =>
                          applyOperatorAutocomplete(previous, suggestion)
                        );
                        setHideOperatorAutocomplete(false);
                        inputRef.current?.focus();
                      }}
                      className={`rounded-full border px-3 py-1 text-[11px] ${
                        selected
                          ? "border-signal-accent text-signal-text"
                          : "border-white/10 text-signal-muted"
                      }`}
                    >
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div
            id={OPERATOR_HELP_ID}
            className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-signal-muted"
          >
            <div className="space-y-1">
              <div>
                Operators:{" "}
                <span className="text-signal-text">
                  type:threads|spaces|collections|files|tasks
                </span>
                ,{" "}
                <span className="text-signal-text">
                  space:&quot;Name contains&quot;
                </span>{" "}
                <span>(or exact space id)</span>,{" "}
                <span className="text-signal-text">spaceId:abc</span>,{" "}
                <span className="text-signal-text">tag:foo</span>,{" "}
                <span className="text-signal-text">-tag:foo</span>,{" "}
                <span className="text-signal-text">
                  is:favorite|pinned|archived
                </span>
                , <span className="text-signal-text">-is:pinned</span>,{" "}
                <span className="text-signal-text">has:note</span>,{" "}
                <span className="text-signal-text">-has:note</span>,{" "}
                <span className="text-signal-text">has:citation</span>,{" "}
                <span className="text-signal-text">-has:citation</span>,{" "}
                <span className="text-signal-text">verbatim:true|false</span>
              </div>
              <div>
                Operator scope: <span className="text-signal-text">tag:</span> applies to threads/spaces;{" "}
                <span className="text-signal-text">has:</span> and{" "}
                <span className="text-signal-text">is:</span> apply to threads;{" "}
                <span className="text-signal-text">space:</span> applies to threads/tasks/spaces.
              </div>
              <div>
                Examples:{" "}
                <span className="text-signal-text">
                  type:threads is:pinned has:citation incident postmortem
                </span>
                ,{" "}
                <span className="text-signal-text">
                  type:spaces tag:customer -tag:archive roadmap
                </span>
                ,{" "}
                <span className="text-signal-text">
                  type:threads space:&quot;Research&quot; tag:alpha -is:archived -has:note
                </span>
              </div>
              <div>
                Keyboard: <span className="text-signal-text">/</span> focus,{" "}
                <span className="text-signal-text">ArrowUp/ArrowDown</span>{" "}
                move suggestions/results,{" "}
                <span className="text-signal-text">Enter</span> applies
                suggestion or opens highlighted result.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveCurrentSearch}
                aria-label="Save current unified search"
                className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
              >
                Save search
              </button>
              {operatorSummary.length ? (
                <button
                  onClick={clearOperatorsFromQuery}
                  aria-label="Clear search operators from query"
                  className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                >
                  Clear operators
                </button>
              ) : null}
            </div>
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
              Verbatim
              <input
                type="checkbox"
                checked={effectiveVerbatim}
                disabled={operators.verbatim !== undefined}
                title={
                  operators.verbatim !== undefined
                    ? "Remove verbatim: operator to control this toggle."
                    : undefined
                }
                onChange={(event) => setVerbatim(event.target.checked)}
                className="h-4 w-4 accent-signal-accent disabled:opacity-60"
              />
            </label>
            <label className="flex items-center gap-2 text-signal-muted">
              Show
              <select
                value={resultLimit}
                onChange={(event) =>
                  setResultLimit(
                    Number(event.target.value) as UnifiedSearchResultLimit
                  )
                }
                className="rounded-full border border-white/10 bg-transparent px-3 py-1 text-xs text-signal-text"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          {showZeroResultsGuidance ? (
            <div className="space-y-2 rounded-2xl border border-amber-400/40 bg-amber-500/5 px-4 py-3 text-xs">
              <p className="font-medium text-amber-100">No results found.</p>
              <p className="text-[11px] text-amber-200/90">
                Reset strict operators or filters to widen this search.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {operatorSummary.length ? (
                  <button
                    onClick={clearOperatorsFromQuery}
                    className="rounded-full border border-amber-300/50 px-3 py-1 text-amber-100 hover:bg-amber-500/10"
                  >
                    Clear operators
                  </button>
                ) : null}
                {filter !== "all" || operators.type ? (
                  <button
                    onClick={resetTypeFilter}
                    className="rounded-full border border-amber-300/50 px-3 py-1 text-amber-100 hover:bg-amber-500/10"
                  >
                    Reset type
                  </button>
                ) : null}
                {timelineWindow !== "all" ? (
                  <button
                    onClick={() => setTimelineWindow("all")}
                    className="rounded-full border border-amber-300/50 px-3 py-1 text-amber-100 hover:bg-amber-500/10"
                  >
                    Reset timeline
                  </button>
                ) : null}
                {effectiveVerbatim ? (
                  <button
                    onClick={resetVerbatimFilter}
                    className="rounded-full border border-amber-300/50 px-3 py-1 text-amber-100 hover:bg-amber-500/10"
                  >
                    Reset verbatim
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {debugMode ? (
            <div className="space-y-3 rounded-2xl border border-amber-400/30 bg-amber-500/5 px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-amber-100">Diagnostics (?debug=1)</p>
                <p
                  data-diagnostics-totals="true"
                  data-total-loaded={diagnosticsTotals.loaded}
                  data-total-matched={diagnosticsTotals.matched}
                  data-total-visible={diagnosticsTotals.visible}
                  className="text-[11px] text-amber-200/90"
                >
                  loaded {diagnosticsTotals.loaded} · matched {diagnosticsTotals.matched} · visible{" "}
                  {diagnosticsTotals.visible}
                </p>
              </div>
              <p className="text-[11px] text-amber-200/90">
                Filtered out: type scope {diagnosticsTotals.filteredByTypeScope} ·
                query/operator/time {diagnosticsTotals.filteredByQueryOperatorTime} · result
                limit {diagnosticsTotals.filteredByResultLimit}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {diagnosticsRows.map((row) => (
                  <div
                    key={`diag-${row.type}`}
                    data-diagnostics-row={row.type}
                    data-row-loaded={row.loaded}
                    data-row-matched={row.matched}
                    data-row-visible={row.visible}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-amber-100">
                      {row.type}
                    </p>
                    <p className="mt-1 text-[11px] text-signal-muted">
                      loaded {row.loaded} · matched {row.matched} · visible {row.visible}
                    </p>
                    <p className="mt-1 text-[11px] text-signal-muted">
                      out: type {row.filteredByTypeScope} · query/operator/time{" "}
                      {row.filteredByQueryOperatorTime} · limit {row.filteredByResultLimit}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {toast ? (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
            >
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
                  aria-label="Clear recent unified search queries"
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
          {sortedSavedSearches.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-signal-muted">
                <span>Saved searches</span>
                <button
                  onClick={exportSavedSearches}
                  aria-label="Export saved searches to Markdown"
                  className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                >
                  Export
                </button>
              </div>
              <div className="space-y-2">
                {sortedSavedSearches.map((saved) => {
                  const isEditing = editingSavedId === saved.id;
                  return (
                    <div
                      key={saved.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs"
                    >
                      <div className="min-w-[220px] flex-1">
                        {isEditing ? (
                          <input
                            value={editingSavedName}
                            onChange={(event) =>
                              setEditingSavedName(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                setEditingSavedId(null);
                                setEditingSavedName("");
                              }
                              if (event.key === "Enter") {
                                const now = new Date().toISOString();
                                setSavedSearches((prev) =>
                                  renameSavedSearch(
                                    prev,
                                    saved.id,
                                    editingSavedName,
                                    now
                                  )
                                );
                                setEditingSavedId(null);
                                setEditingSavedName("");
                                setToast({ message: "Renamed saved search." });
                              }
                            }}
                            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
                            autoFocus
                          />
                        ) : (
                          <>
                            <p className="truncate font-medium text-signal-text">
                              {saved.pinned ? "Pinned: " : ""}
                              {saved.name}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-signal-muted">
                              {saved.query || "No query"} · {saved.filter} ·{" "}
                              {saved.sortBy} · {saved.timelineWindow} ·{" "}
                              {saved.resultLimit} · verbatim:{saved.verbatim ? "true" : "false"}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => runSavedSearch(saved)}
                          aria-label={`Run saved search ${saved.name}`}
                          className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-signal-text"
                        >
                          Run
                        </button>
                        <button
                          onClick={() => {
                            const now = new Date().toISOString();
                            setSavedSearches((prev) =>
                              togglePinSavedSearch(prev, saved.id, now)
                            );
                          }}
                          aria-label={`${saved.pinned ? "Unpin" : "Pin"} saved search ${saved.name}`}
                          className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                        >
                          {saved.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingSavedId(saved.id);
                            setEditingSavedName(saved.name);
                          }}
                          aria-label={`Rename saved search ${saved.name}`}
                          className="rounded-full border border-white/10 px-3 py-1 text-[11px]"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            setSavedSearches((prev) =>
                              deleteSavedSearch(prev, saved.id)
                            );
                            if (editingSavedId === saved.id) {
                              setEditingSavedId(null);
                              setEditingSavedName("");
                            }
                            setToast({ message: "Deleted saved search." });
                          }}
                          aria-label={`Delete saved search ${saved.name}`}
                          className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-rose-200 hover:bg-rose-500/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                    topThreadResults.map((entry) => {
                      const thread = entry.thread;
                      const snippet = buildThreadSnippet(entry);
                      const badges = computeThreadMatchBadges(
                        {
                          title: thread.title,
                          question: thread.question,
                          answer: thread.answer,
                          tags: thread.tags,
                          spaceName: thread.spaceName,
                          note: entry.note,
                          citationsText: entry.citationsText,
                        },
                        matchQueryInfo
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
                    topSpaceResults.map((entry) => {
                      const space = entry.space;
                      return (
                        <Link
                          key={`top-space-${space.id}`}
                          href={`/?space=${space.id}`}
                          className="block truncate text-xs text-signal-text hover:text-signal-accent"
                        >
                          {renderHighlighted(space.name)}
                        </Link>
                      );
                    })
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
                    topCollectionResults.map((entry) => {
                      const collection = entry.collection;
                      return (
                        <Link
                          key={`top-collection-${collection.id}`}
                          href={`/?collection=${collection.id}`}
                          className="block truncate text-xs text-signal-text hover:text-signal-accent"
                        >
                          {renderHighlighted(collection.name)}
                        </Link>
                      );
                    })
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
                    topFileResults.map((entry) => {
                      const file = entry.file;
                      return (
                        <p
                          key={`top-file-${file.id}`}
                          className="truncate text-xs text-signal-text"
                        >
                          {renderHighlighted(file.name)}
                        </p>
                      );
                    })
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
                    topTaskResults.map((entry) => {
                      const task = entry.task;
                      return (
                        <p
                          key={`top-task-${task.id}`}
                          className="truncate text-xs text-signal-text"
                        >
                          {renderHighlighted(task.name)}
                        </p>
                      );
                    })
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
                            aria-label="Select all visible thread results"
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
                        {staleSelectedCount ? (
                          <button
                            onClick={() => {
                              setSelectedThreadIds((previous) =>
                                pruneSelectedIds(previous, threadIdSet)
                              );
                              setToast({
                                message: `Pruned ${staleSelectedCount} stale selection(s).`,
                              });
                            }}
                            aria-label={`Prune ${staleSelectedCount} stale thread selections`}
                            className="rounded-full border border-amber-400/50 px-2 py-1 text-amber-100 hover:bg-amber-500/10"
                          >
                            Prune stale ({staleSelectedCount})
                          </button>
                        ) : null}
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
                          aria-label="Pin selected threads"
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
                          aria-label="Favorite selected threads"
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
                          aria-label="Unpin selected threads"
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
                          aria-label="Unfavorite selected threads"
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
                          aria-label="Archive selected threads"
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
                          aria-label="Unarchive selected threads"
                          disabled={!selectedCount}
                          className="rounded-full border border-white/10 px-2 py-1 disabled:opacity-40"
                        >
                          Unarchive
                        </button>
                        <select
                          value={bulkSpaceId}
                          onChange={(event) => setBulkSpaceId(event.target.value)}
                          aria-label="Bulk space target for selected threads"
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
                          aria-label="Apply selected space to selected threads"
                          disabled={!selectedCount}
                          className="rounded-full border border-white/10 px-2 py-1 disabled:opacity-40"
                        >
                          Apply space
                        </button>
                      </div>
                    </div>
                    {shownThreads.map((entry) => {
                      const thread = entry.thread;
                      const snippet = buildThreadSnippet(entry);
                      const selected = activeSelectedThreadIds.includes(thread.id);
                      const navKey = `thread:${thread.id}`;
                      const isActive = activeResultKey === navKey;
                      const badges = computeThreadMatchBadges(
                        {
                          title: thread.title,
                          question: thread.question,
                          answer: thread.answer,
                          tags: thread.tags,
                          spaceName: thread.spaceName,
                          note: entry.note,
                          citationsText: entry.citationsText,
                        },
                        matchQueryInfo
                      );
                      return (
                        <div
                          key={thread.id}
                          id={toNavigableDomId(navKey)}
                          className={`rounded-2xl border px-3 py-2 text-xs text-signal-muted ${
                            isActive
                              ? "border-signal-accent bg-signal-accent/10"
                              : "border-white/10"
                          }`}
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
                  shownSpaces.map((entry) => {
                    const space = entry.space;
                    const tags = entry.tags;
                    const navKey = `space:${space.id}`;
                    const isActive = activeResultKey === navKey;
                    return (
                      <div
                        key={space.id}
                        id={toNavigableDomId(navKey)}
                        className={`rounded-2xl border px-3 py-2 text-xs text-signal-muted ${
                          isActive
                            ? "border-signal-accent bg-signal-accent/10"
                            : "border-white/10"
                        }`}
                      >
                        <p className="text-sm text-signal-text">
                          {renderHighlighted(space.name)}
                        </p>
                        <p className="mt-1 text-[11px] text-signal-muted">
                          {space.instructions
                            ? renderHighlighted(space.instructions)
                            : "No instructions"}
                        </p>
                        {tags.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {tags.slice(0, 6).map((tag) => (
                              <span
                                key={`space-${space.id}-tag-${tag}`}
                                className="rounded-full border border-white/10 bg-black/20 px-2 py-[2px] text-[10px] text-signal-muted"
                              >
                                {renderHighlighted(tag)}
                              </span>
                            ))}
                            {tags.length > 6 ? (
                              <span className="text-[10px] text-signal-muted">
                                +{tags.length - 6}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        <Link
                          href={`/?space=${space.id}`}
                          className="mt-2 inline-block rounded-full border border-white/10 px-2 py-1 text-[11px]"
                        >
                          Open
                        </Link>
                      </div>
                    );
                  })
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
                  shownCollections.map((entry) => {
                    const collection = entry.collection;
                    const navKey = `collection:${collection.id}`;
                    const isActive = activeResultKey === navKey;
                    return (
                      <div
                        key={collection.id}
                        id={toNavigableDomId(navKey)}
                        className={`rounded-2xl border px-3 py-2 text-xs text-signal-muted ${
                          isActive
                            ? "border-signal-accent bg-signal-accent/10"
                            : "border-white/10"
                        }`}
                      >
                        <p className="text-sm text-signal-text">
                          {renderHighlighted(collection.name)}
                        </p>
                        <p className="mt-1 text-[11px] text-signal-muted">
                          {formatTimestampForDisplay(collection.createdAt)}
                        </p>
                        <Link
                          href={`/?collection=${collection.id}`}
                          className="mt-2 inline-block rounded-full border border-white/10 px-2 py-1 text-[11px]"
                        >
                          Open
                        </Link>
                      </div>
                    );
                  })
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
                  shownFiles.map((entry) => {
                    const file = entry.file;
                    return (
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
                    );
                  })
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
                  shownTasks.map((entry) => {
                    const task = entry.task;
                    return (
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
                          Next run: {formatTimestampForDisplay(task.nextRun)}
                        </p>
                        <p className="mt-2 line-clamp-2 text-[11px] text-signal-muted">
                          {renderHighlighted(task.prompt)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
