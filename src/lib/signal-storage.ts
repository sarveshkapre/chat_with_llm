export type StorageEntry = { key: string; value: string | null };

export type StorageUsage = {
  keys: number;
  bytes: number;
};

// LocalStorage quota differs by browser; ~5MB is a common baseline for planning warnings.
export const TYPICAL_LOCALSTORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

function canUseLocalStorage(): boolean {
  // Avoid touching the `localStorage` global in Node/SSR builds where Node's
  // internal WebStorage implementation can emit warnings when accessed.
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function getStorageEntriesByPrefix(prefix: string): StorageEntry[] {
  if (!canUseLocalStorage()) return [];
  const entries: StorageEntry[] = [];
  try {
    const length = localStorage.length;
    for (let i = 0; i < length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      let value: string | null = null;
      try {
        value = localStorage.getItem(key);
      } catch {
        value = null;
      }
      entries.push({ key, value });
    }
  } catch {
    return [];
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export function estimateStorageBytes(entries: StorageEntry[]): number {
  // Rough approximation: many browsers store localStorage as UTF-16 (2 bytes/char).
  let bytes = 0;
  for (const entry of entries) {
    bytes += (entry.key.length + (entry.value?.length ?? 0)) * 2;
  }
  return bytes;
}

export function getStorageUsageByPrefix(prefix: string): StorageUsage {
  const entries = getStorageEntriesByPrefix(prefix);
  return { keys: entries.length, bytes: estimateStorageBytes(entries) };
}

export function clearStorageByPrefix(prefix: string): number {
  if (!canUseLocalStorage()) return 0;
  const keys: string[] = [];
  try {
    const length = localStorage.length;
    for (let i = 0; i < length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
  } catch {
    return 0;
  }

  let cleared = 0;
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
      cleared += 1;
    } catch {
      // Best-effort: a partial clear is still useful.
    }
  }
  return cleared;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const fixed = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(fixed)} ${units[unitIndex]}`;
}
