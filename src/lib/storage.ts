import {
  SIGNAL_CORRUPT_BACKUP_PREFIX,
  SIGNAL_CORRUPT_LATEST_PREFIX,
} from "@/lib/storage-keys";

const backedUpKeys = new Set<string>();

export type StoredWriteStatus = "ok" | "quota" | "failed" | "unavailable";

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
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallback;
  }
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
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "unavailable";
  }
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return "ok";
  } catch (error) {
    if (isQuotaExceededError(error)) return "quota";
    return "failed";
  }
}
