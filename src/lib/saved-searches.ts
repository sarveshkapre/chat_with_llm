import type { TimelineWindow, UnifiedSearchType } from "@/lib/unified-search";

export type UnifiedSearchSortBy = "relevance" | "newest" | "oldest";
export type UnifiedSearchResultLimit = 10 | 20 | 50;
export const SAVED_SEARCH_STORAGE_VERSION = 2 as const;

export type UnifiedSavedSearch = {
  id: string;
  name: string;
  query: string;
  filter: UnifiedSearchType;
  sortBy: UnifiedSearchSortBy;
  timelineWindow: TimelineWindow;
  resultLimit: UnifiedSearchResultLimit;
  verbatim: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchSpec = Pick<
  UnifiedSavedSearch,
  "query" | "filter" | "sortBy" | "timelineWindow" | "resultLimit" | "verbatim"
>;

type SavedSearchStorageEnvelope = {
  version: typeof SAVED_SEARCH_STORAGE_VERSION;
  searches: UnifiedSavedSearch[];
};

const VALID_FILTERS: UnifiedSearchType[] = [
  "all",
  "threads",
  "spaces",
  "collections",
  "files",
  "tasks",
];
const VALID_SORTS: UnifiedSearchSortBy[] = ["relevance", "newest", "oldest"];
const VALID_WINDOWS: TimelineWindow[] = ["all", "24h", "7d", "30d"];
const VALID_LIMITS: UnifiedSearchResultLimit[] = [10, 20, 50];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeFilter(value: unknown): UnifiedSearchType {
  if (typeof value !== "string") return "all";
  return VALID_FILTERS.includes(value as UnifiedSearchType)
    ? (value as UnifiedSearchType)
    : "all";
}

function normalizeSort(value: unknown): UnifiedSearchSortBy {
  if (typeof value !== "string") return "relevance";
  return VALID_SORTS.includes(value as UnifiedSearchSortBy)
    ? (value as UnifiedSearchSortBy)
    : "relevance";
}

function normalizeTimeline(value: unknown): TimelineWindow {
  if (typeof value !== "string") return "all";
  return VALID_WINDOWS.includes(value as TimelineWindow)
    ? (value as TimelineWindow)
    : "all";
}

function normalizeResultLimit(value: unknown): UnifiedSearchResultLimit {
  if (typeof value !== "number") return 20;
  return VALID_LIMITS.includes(value as UnifiedSearchResultLimit)
    ? (value as UnifiedSearchResultLimit)
    : 20;
}

function normalizeIso(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return fallback;
  return new Date(parsed).toISOString();
}

function normalizeSavedSearch(raw: unknown, nowIso: string): UnifiedSavedSearch | null {
  const record = asRecord(raw);
  if (!record) return null;

  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) return null;

  const query = typeof record.query === "string" ? record.query.trim() : "";
  const filter = normalizeFilter(record.filter);
  const sortBy = normalizeSort(record.sortBy);
  const timelineWindow = normalizeTimeline(record.timelineWindow);
  const resultLimit = normalizeResultLimit(record.resultLimit);
  const verbatim = Boolean(record.verbatim);

  const saved: UnifiedSavedSearch = {
    id,
    name:
      typeof record.name === "string" && record.name.trim()
        ? normalizeSavedSearchName(record.name)
        : defaultSavedSearchName({
            query,
            filter,
            sortBy,
            timelineWindow,
            resultLimit,
            verbatim,
          }),
    query,
    filter,
    sortBy,
    timelineWindow,
    resultLimit,
    verbatim,
    pinned: Boolean(record.pinned),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  saved.createdAt = normalizeIso(
    record.createdAt,
    normalizeIso(record.updatedAt, nowIso)
  );
  saved.updatedAt = normalizeIso(record.updatedAt, saved.createdAt);
  return saved;
}

export function decodeSavedSearchStorage(
  raw: unknown,
  nowIso = new Date().toISOString()
): UnifiedSavedSearch[] {
  const legacyOrUnknown = Array.isArray(raw)
    ? raw
    : (() => {
        const envelope = asRecord(raw);
        if (!envelope) return [];
        if (envelope.version !== SAVED_SEARCH_STORAGE_VERSION) return [];
        return Array.isArray(envelope.searches) ? envelope.searches : [];
      })();

  const seenIds = new Set<string>();
  const normalized: UnifiedSavedSearch[] = [];
  for (const candidate of legacyOrUnknown) {
    const parsed = normalizeSavedSearch(candidate, nowIso);
    if (!parsed) continue;
    if (seenIds.has(parsed.id)) continue;
    seenIds.add(parsed.id);
    normalized.push(parsed);
  }

  return normalized;
}

export function encodeSavedSearchStorage(
  searches: UnifiedSavedSearch[]
): SavedSearchStorageEnvelope {
  return {
    version: SAVED_SEARCH_STORAGE_VERSION,
    searches,
  };
}

export function normalizeSavedSearchName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function defaultSavedSearchName(spec: SavedSearchSpec): string {
  const query = spec.query.trim();
  if (query) return query.length > 60 ? `${query.slice(0, 57)}...` : query;

  const parts: string[] = [];
  if (spec.filter !== "all") parts.push(spec.filter);
  if (spec.timelineWindow !== "all") parts.push(spec.timelineWindow);
  if (spec.sortBy !== "relevance") parts.push(spec.sortBy);
  if (spec.verbatim) parts.push("verbatim");
  return parts.length ? parts.join(" · ") : "Saved search";
}

export function fingerprintSavedSearch(spec: SavedSearchSpec): string {
  const verbatim = Boolean((spec as SavedSearchSpec & { verbatim?: boolean }).verbatim);
  return JSON.stringify({
    query: spec.query.trim(),
    filter: spec.filter,
    sortBy: spec.sortBy,
    timelineWindow: spec.timelineWindow,
    resultLimit: spec.resultLimit,
    verbatim,
  });
}

export function findDuplicateSavedSearch(
  searches: UnifiedSavedSearch[],
  spec: SavedSearchSpec
): UnifiedSavedSearch | null {
  const needle = fingerprintSavedSearch(spec);
  for (const search of searches) {
    if (fingerprintSavedSearch(search) === needle) return search;
  }
  return null;
}

export function sortSavedSearches(
  searches: UnifiedSavedSearch[]
): UnifiedSavedSearch[] {
  const next = [...searches];
  next.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aTime = Date.parse(a.updatedAt);
    const bTime = Date.parse(b.updatedAt);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    return a.name.localeCompare(b.name);
  });
  return next;
}

export function upsertSavedSearch(
  searches: UnifiedSavedSearch[],
  saved: UnifiedSavedSearch
): UnifiedSavedSearch[] {
  const index = searches.findIndex((item) => item.id === saved.id);
  if (index === -1) return [saved, ...searches];
  const next = [...searches];
  next[index] = saved;
  return next;
}

export function renameSavedSearch(
  searches: UnifiedSavedSearch[],
  id: string,
  nextName: string,
  nowIso: string
): UnifiedSavedSearch[] {
  const normalized = normalizeSavedSearchName(nextName);
  if (!normalized) return searches;
  const index = searches.findIndex((item) => item.id === id);
  if (index === -1) return searches;
  const current = searches[index];
  if (current.name === normalized) return searches;
  const next = [...searches];
  next[index] = { ...current, name: normalized, updatedAt: nowIso };
  return next;
}

export function togglePinSavedSearch(
  searches: UnifiedSavedSearch[],
  id: string,
  nowIso: string
): UnifiedSavedSearch[] {
  const index = searches.findIndex((item) => item.id === id);
  if (index === -1) return searches;
  const current = searches[index];
  const next = [...searches];
  next[index] = { ...current, pinned: !current.pinned, updatedAt: nowIso };
  return next;
}

export function deleteSavedSearch(
  searches: UnifiedSavedSearch[],
  id: string
): UnifiedSavedSearch[] {
  const next = searches.filter((item) => item.id !== id);
  return next.length === searches.length ? searches : next;
}
