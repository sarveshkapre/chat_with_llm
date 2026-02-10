const CORRUPT_BACKUP_PREFIX = "signal-corrupt-backup-v1:";
const CORRUPT_LATEST_PREFIX = "signal-corrupt-latest-v1:";

const backedUpKeys = new Set<string>();

function tryBackupCorruptBlob(key: string, raw: string) {
  if (backedUpKeys.has(key)) return;
  backedUpKeys.add(key);

  const backupKey = `${CORRUPT_BACKUP_PREFIX}${key}:${Date.now()}`;
  const latestKey = `${CORRUPT_LATEST_PREFIX}${key}`;

  try {
    localStorage.setItem(backupKey, raw);
    localStorage.setItem(latestKey, backupKey);
  } catch {
    // Best-effort only. localStorage quota / disabled storage should not break the app.
  }
}

export function readStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
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
