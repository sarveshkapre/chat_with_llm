export const SIGNAL_STORAGE_PREFIX = "signal-";

export const SIGNAL_HISTORY_KEY = "signal-history-v2";
export const SIGNAL_SPACES_KEY = "signal-spaces-v1";
export const SIGNAL_ACTIVE_SPACE_KEY = "signal-space-active";
export const SIGNAL_ARCHIVED_SPACES_KEY = "signal-spaces-archived-v1";
export const SIGNAL_SPACE_TAGS_KEY = "signal-space-tags-v1";
export const SIGNAL_TASKS_KEY = "signal-tasks-v1";
export const SIGNAL_FILES_KEY = "signal-files-v1";
export const SIGNAL_COLLECTIONS_KEY = "signal-collections-v1";
export const SIGNAL_NOTES_KEY = "signal-notes-v1";

export const SIGNAL_SAVED_SEARCHES_KEY = "signal-saved-searches-v1";
export const SIGNAL_PINNED_SEARCHES_KEY = "signal-saved-searches-pinned-v1";
export const SIGNAL_RECENT_FILTERS_KEY = "signal-recent-filters-v1";

export const SIGNAL_UNIFIED_RECENT_SEARCH_KEY = "signal-unified-recent-v1";
export const SIGNAL_UNIFIED_SAVED_SEARCH_KEY = "signal-unified-saved-searches-v1";
export const SIGNAL_UNIFIED_SAVED_SEARCH_LEGACY_KEYS = [
  "signal-unified-saved-v1",
] as const;
export const SIGNAL_UNIFIED_VERBATIM_KEY = "signal-unified-verbatim-v1";

export const SIGNAL_CORRUPT_BACKUP_PREFIX = "signal-corrupt-backup-v1:";
export const SIGNAL_CORRUPT_LATEST_PREFIX = "signal-corrupt-latest-v1:";
export const SIGNAL_STORAGE_WRITE_FAILURES_KEY =
  "signal-storage-write-failures-v1";

export const UNIFIED_SEARCH_STORAGE_EVENT_KEYS = [
  SIGNAL_NOTES_KEY,
  SIGNAL_HISTORY_KEY,
  SIGNAL_SPACES_KEY,
  SIGNAL_SPACE_TAGS_KEY,
  SIGNAL_COLLECTIONS_KEY,
  SIGNAL_FILES_KEY,
  SIGNAL_TASKS_KEY,
  SIGNAL_UNIFIED_RECENT_SEARCH_KEY,
  SIGNAL_UNIFIED_SAVED_SEARCH_KEY,
  ...SIGNAL_UNIFIED_SAVED_SEARCH_LEGACY_KEYS,
  SIGNAL_UNIFIED_VERBATIM_KEY,
] as const;

export const ALL_SIGNAL_STORAGE_KEYS = [
  SIGNAL_HISTORY_KEY,
  SIGNAL_SPACES_KEY,
  SIGNAL_ACTIVE_SPACE_KEY,
  SIGNAL_ARCHIVED_SPACES_KEY,
  SIGNAL_SPACE_TAGS_KEY,
  SIGNAL_TASKS_KEY,
  SIGNAL_FILES_KEY,
  SIGNAL_COLLECTIONS_KEY,
  SIGNAL_NOTES_KEY,
  SIGNAL_SAVED_SEARCHES_KEY,
  SIGNAL_PINNED_SEARCHES_KEY,
  SIGNAL_RECENT_FILTERS_KEY,
  SIGNAL_UNIFIED_RECENT_SEARCH_KEY,
  SIGNAL_UNIFIED_SAVED_SEARCH_KEY,
  ...SIGNAL_UNIFIED_SAVED_SEARCH_LEGACY_KEYS,
  SIGNAL_UNIFIED_VERBATIM_KEY,
  SIGNAL_STORAGE_WRITE_FAILURES_KEY,
] as const;
