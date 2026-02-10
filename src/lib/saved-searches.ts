import type { TimelineWindow, UnifiedSearchType } from "@/lib/unified-search";

export type UnifiedSearchSortBy = "relevance" | "newest" | "oldest";
export type UnifiedSearchResultLimit = 10 | 20 | 50;

export type UnifiedSavedSearch = {
  id: string;
  name: string;
  query: string;
  filter: UnifiedSearchType;
  sortBy: UnifiedSearchSortBy;
  timelineWindow: TimelineWindow;
  resultLimit: UnifiedSearchResultLimit;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SavedSearchSpec = Pick<
  UnifiedSavedSearch,
  "query" | "filter" | "sortBy" | "timelineWindow" | "resultLimit"
>;

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
  return parts.length ? parts.join(" · ") : "Saved search";
}

export function fingerprintSavedSearch(spec: SavedSearchSpec): string {
  return JSON.stringify({
    query: spec.query.trim(),
    filter: spec.filter,
    sortBy: spec.sortBy,
    timelineWindow: spec.timelineWindow,
    resultLimit: spec.resultLimit,
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

