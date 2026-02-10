import type { Space } from "@/lib/types/space";
import { readStoredJson } from "@/lib/storage";

export type TimelineWindow = "all" | "24h" | "7d" | "30d";

const WINDOW_TO_MS: Record<Exclude<TimelineWindow, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function parseStored<T>(key: string, fallback: T): T {
  return readStoredJson(key, fallback);
}

export function applyTimelineWindow(
  value: string | null | undefined,
  window: TimelineWindow,
  nowMs = Date.now()
): boolean {
  if (window === "all") return true;
  const parsed = Date.parse(value ?? "");
  if (Number.isNaN(parsed)) return false;
  return nowMs - parsed <= WINDOW_TO_MS[window];
}

export function applyBulkThreadUpdate<T extends { id: string }>(
  threads: T[],
  selectedIds: string[],
  updater: (thread: T) => T
): T[] {
  if (!selectedIds.length) return threads;
  const selectedSet = new Set(selectedIds);
  return threads.map((thread) =>
    selectedSet.has(thread.id) ? updater(thread) : thread
  );
}

export function resolveThreadSpaceMeta(
  nextSpaceId: string,
  spaces: Pick<Space, "id" | "name">[]
): { spaceId: string | null; spaceName: string | null } {
  const targetId = nextSpaceId.trim();
  if (!targetId) {
    return { spaceId: null, spaceName: null };
  }
  const match = spaces.find((space) => space.id === targetId);
  return {
    spaceId: match?.id ?? null,
    spaceName: match?.name ?? null,
  };
}
