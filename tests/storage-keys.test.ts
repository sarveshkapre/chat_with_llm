import { describe, expect, it } from "vitest";
import {
  ALL_SIGNAL_STORAGE_KEYS,
  SIGNAL_COLLECTIONS_KEY,
  SIGNAL_FILES_KEY,
  SIGNAL_HISTORY_KEY,
  SIGNAL_NOTES_KEY,
  SIGNAL_SPACE_TAGS_KEY,
  SIGNAL_SPACES_KEY,
  SIGNAL_STORAGE_PREFIX,
  SIGNAL_TASKS_KEY,
  SIGNAL_UNIFIED_RECENT_SEARCH_KEY,
  SIGNAL_UNIFIED_SAVED_SEARCH_LEGACY_KEYS,
  SIGNAL_UNIFIED_SAVED_SEARCH_KEY,
  SIGNAL_UNIFIED_VERBATIM_KEY,
  UNIFIED_SEARCH_STORAGE_EVENT_KEYS,
} from "@/lib/storage-keys";

describe("storage key constants", () => {
  it("keeps all signal keys unique and prefixed", () => {
    const unique = new Set(ALL_SIGNAL_STORAGE_KEYS);
    expect(unique.size).toBe(ALL_SIGNAL_STORAGE_KEYS.length);
    for (const key of ALL_SIGNAL_STORAGE_KEYS) {
      expect(key.startsWith(SIGNAL_STORAGE_PREFIX)).toBe(true);
    }
  });

  it("keeps unified-search storage sync keys aligned with searched datasets", () => {
    expect(UNIFIED_SEARCH_STORAGE_EVENT_KEYS).toEqual([
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
    ]);
  });
});
