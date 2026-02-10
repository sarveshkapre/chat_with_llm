export const SIGNAL_STORAGE_PREFIX = "signal-";

export type SignalStorageEntry = {
  key: string;
  bytes: number;
  value: string;
};

export type SignalStorageSnapshotV1 = {
  version: 1;
  exportedAt: string;
  entries: SignalStorageEntry[];
  totals: {
    keys: number;
    bytes: number;
  };
};

function estimateUtf8Bytes(value: string): number {
  try {
    return new TextEncoder().encode(value).length;
  } catch {
    // Worst-case-ish fallback for environments without TextEncoder.
    return value.length * 2;
  }
}

function listSignalKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (!key.startsWith(SIGNAL_STORAGE_PREFIX)) continue;
    keys.push(key);
  }
  keys.sort((a, b) => a.localeCompare(b));
  return keys;
}

export function computeSignalStorageUsage(): {
  totalBytes: number;
  entries: Array<{ key: string; bytes: number }>;
} | null {
  if (typeof window === "undefined") return null;
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return null;
  }

  const entries: Array<{ key: string; bytes: number }> = [];
  let totalBytes = 0;

  for (const key of listSignalKeys(storage)) {
    let value = "";
    try {
      value = storage.getItem(key) ?? "";
    } catch {
      value = "";
    }
    const bytes = estimateUtf8Bytes(key) + estimateUtf8Bytes(value);
    totalBytes += bytes;
    entries.push({ key, bytes });
  }

  return { totalBytes, entries };
}

export function snapshotSignalStorage(): SignalStorageSnapshotV1 | null {
  if (typeof window === "undefined") return null;
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return null;
  }

  const entries: SignalStorageEntry[] = [];
  let bytes = 0;

  for (const key of listSignalKeys(storage)) {
    let value = "";
    try {
      value = storage.getItem(key) ?? "";
    } catch {
      value = "";
    }
    const entryBytes = estimateUtf8Bytes(key) + estimateUtf8Bytes(value);
    bytes += entryBytes;
    entries.push({ key, bytes: entryBytes, value });
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
    totals: { keys: entries.length, bytes },
  };
}

export function clearSignalStorage(): boolean {
  if (typeof window === "undefined") return false;
  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return false;
  }
  const keys = listSignalKeys(storage);
  for (const key of keys) {
    try {
      storage.removeItem(key);
    } catch {
      // Best-effort.
    }
  }
  return true;
}

