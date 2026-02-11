export type UnifiedSearchBootstrapFilter =
  | "all"
  | "threads"
  | "spaces"
  | "collections"
  | "files"
  | "tasks";

export type UnifiedSearchBootstrapSortBy = "relevance" | "newest" | "oldest";
export type UnifiedSearchBootstrapTimelineWindow = "all" | "24h" | "7d" | "30d";
export type UnifiedSearchBootstrapResultLimit = 10 | 20 | 50;

export type UnifiedSearchBootstrap = {
  query?: string;
  filter?: UnifiedSearchBootstrapFilter;
  sortBy?: UnifiedSearchBootstrapSortBy;
  timelineWindow?: UnifiedSearchBootstrapTimelineWindow;
  resultLimit?: UnifiedSearchBootstrapResultLimit;
  debugMode?: boolean;
  selectedThreadIds?: unknown;
  activeSavedSearchId?: string;
  disableStorageSync?: boolean;
  notes?: Record<string, string>;
  threads?: unknown;
  spaces?: unknown;
  spaceTags?: unknown;
  collections?: unknown;
  files?: unknown;
  tasks?: unknown;
  recentQueries?: unknown;
  savedSearches?: unknown;
  verbatim?: boolean;
};
