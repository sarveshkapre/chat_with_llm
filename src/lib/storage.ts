import {
  SIGNAL_CORRUPT_BACKUP_PREFIX,
  SIGNAL_CORRUPT_LATEST_PREFIX,
  SIGNAL_STORAGE_WRITE_FAILURES_KEY,
} from "@/lib/storage-keys";

const backedUpKeys = new Set<string>();
const MAX_STORED_WRITE_FAILURES = 25;

export type StoredWriteStatus = "ok" | "quota" | "failed" | "unavailable";
type StoredWriteFailureStatus = Exclude<StoredWriteStatus, "ok" | "unavailable">;

export type StoredWriteFailure = {
  key: string;
  status: StoredWriteFailureStatus;
  timestamp: string;
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function decodeStoredWriteFailure(raw: unknown): StoredWriteFailure | null {
  if (!raw || typeof raw !== "object") return null;
  const maybeEntry = raw as {
    key?: unknown;
    status?: unknown;
    timestamp?: unknown;
  };
  if (typeof maybeEntry.key !== "string" || !maybeEntry.key.trim()) return null;
  if (maybeEntry.status !== "quota" && maybeEntry.status !== "failed") return null;
  if (typeof maybeEntry.timestamp !== "string" || !maybeEntry.timestamp.trim()) {
    return null;
  }
  return {
    key: maybeEntry.key,
    status: maybeEntry.status,
    timestamp: maybeEntry.timestamp,
  };
}

export function readStorageWriteFailures(): StoredWriteFailure[] {
  if (!canUseLocalStorage()) return [];
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SIGNAL_STORAGE_WRITE_FAILURES_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => decodeStoredWriteFailure(entry))
      .filter((entry): entry is StoredWriteFailure => entry !== null)
      .slice(0, MAX_STORED_WRITE_FAILURES);
  } catch {
    return [];
  }
}

function recordStorageWriteFailure(
  key: string,
  status: StoredWriteFailureStatus
) {
  if (!canUseLocalStorage()) return;
  if (key === SIGNAL_STORAGE_WRITE_FAILURES_KEY) return;
  const entry: StoredWriteFailure = {
    key,
    status,
    timestamp: new Date().toISOString(),
  };
  const existing = readStorageWriteFailures();
  const next = [entry, ...existing].slice(0, MAX_STORED_WRITE_FAILURES);
  try {
    localStorage.setItem(SIGNAL_STORAGE_WRITE_FAILURES_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only. Logging a failed write should not throw.
  }
}

export function clearStorageWriteFailures(): StoredWriteStatus {
  if (!canUseLocalStorage()) return "unavailable";
  try {
    localStorage.removeItem(SIGNAL_STORAGE_WRITE_FAILURES_KEY);
    return "ok";
  } catch (error) {
    if (isQuotaExceededError(error)) return "quota";
    return "failed";
  }
}

function tryBackupCorruptBlob(key: string, raw: string) {
  if (typeof document === "undefined") return;
  if (backedUpKeys.has(key)) return;
  backedUpKeys.add(key);

  const backupKey = `${SIGNAL_CORRUPT_BACKUP_PREFIX}${key}:${Date.now()}`;
  const latestKey = `${SIGNAL_CORRUPT_LATEST_PREFIX}${key}`;

  try {
    localStorage.setItem(backupKey, raw);
    localStorage.setItem(latestKey, backupKey);
  } catch {
    // Best-effort only. localStorage quota / disabled storage should not break the app.
  }
}

export function readStoredJson<T>(key: string, fallback: T): T {
  if (!canUseLocalStorage()) return fallback;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    tryBackupCorruptBlob(key, raw);
    return fallback;
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { name?: unknown; code?: unknown };
  if (maybeError.name === "QuotaExceededError") return true;
  if (maybeError.name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  if (maybeError.code === 22 || maybeError.code === 1014) return true;
  return false;
}

export function writeStoredJson(key: string, value: unknown): StoredWriteStatus {
  if (!canUseLocalStorage()) return "unavailable";
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return "ok";
  } catch (error) {
    if (isQuotaExceededError(error)) {
      recordStorageWriteFailure(key, "quota");
      return "quota";
    }
    recordStorageWriteFailure(key, "failed");
    return "failed";
  }
}
