import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SIGNAL_CORRUPT_BACKUP_PREFIX,
  SIGNAL_CORRUPT_LATEST_PREFIX,
  SIGNAL_STORAGE_WRITE_FAILURES_KEY,
} from "@/lib/storage-keys";

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    get length() {
      return store.size;
    },
    _dump() {
      return store;
    },
  };
}

describe("readStoredJson", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns fallback on the server (no window)", async () => {
    const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
    delete g.window;
    delete g.localStorage;

    const { readStoredJson } = await import("@/lib/storage");
    expect(readStoredJson("k", { ok: true })).toEqual({ ok: true });
  });

  it("returns parsed JSON when valid", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    localStorage.setItem("k", JSON.stringify({ value: 123 }));

    const { readStoredJson } = await import("@/lib/storage");
    expect(readStoredJson("k", { value: 0 })).toEqual({ value: 123 });

    const keys = Array.from(localStorage._dump().keys());
    expect(
      keys.some((key) => key.startsWith(SIGNAL_CORRUPT_BACKUP_PREFIX))
    ).toBe(false);
  });

  it("reports key existence metadata", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    localStorage.setItem("present", JSON.stringify({ value: 123 }));

    const { readStoredJsonWithExistence } = await import("@/lib/storage");
    expect(readStoredJsonWithExistence("present", { value: 0 })).toEqual({
      value: { value: 123 },
      exists: true,
    });
    expect(readStoredJsonWithExistence("missing", { value: 0 })).toEqual({
      value: { value: 0 },
      exists: false,
    });
  });

  it("backs up corrupt JSON blobs before falling back", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    localStorage.setItem("k", "{not-json");

    vi.spyOn(Date, "now").mockReturnValueOnce(123);

    const { readStoredJson } = await import("@/lib/storage");
    expect(readStoredJson("k", { value: 0 })).toEqual({ value: 0 });

    const latestKey = `${SIGNAL_CORRUPT_LATEST_PREFIX}k`;
    const backupKey = localStorage.getItem(latestKey);
    expect(backupKey).toBe(`${SIGNAL_CORRUPT_BACKUP_PREFIX}k:123`);
    expect(localStorage.getItem(backupKey!)).toBe("{not-json");
  });

  it("backs up at most once per key per page session", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    localStorage.setItem("k", "{not-json");

    vi.spyOn(Date, "now").mockReturnValueOnce(1).mockReturnValueOnce(2);

    const { readStoredJson } = await import("@/lib/storage");
    readStoredJson("k", null);
    readStoredJson("k", null);

    const backupKeys = Array.from(localStorage._dump().keys()).filter((key) =>
      key.startsWith(`${SIGNAL_CORRUPT_BACKUP_PREFIX}k:`)
    );
    expect(backupKeys).toEqual([`${SIGNAL_CORRUPT_BACKUP_PREFIX}k:1`]);
  });
});

describe("writeStoredJson", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns unavailable on the server (no window)", async () => {
    const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
    delete g.window;
    delete g.localStorage;

    const { writeStoredJson } = await import("@/lib/storage");
    expect(writeStoredJson("k", { ok: true })).toBe("unavailable");
  });

  it("writes JSON and returns ok", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;

    const { writeStoredJson } = await import("@/lib/storage");
    expect(writeStoredJson("k", { value: 7 })).toBe("ok");
    expect(localStorage.getItem("k")).toBe(JSON.stringify({ value: 7 }));
  });

  it("returns quota when storage throws quota-style errors", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key: string, value: string) => {
      if (key === SIGNAL_STORAGE_WRITE_FAILURES_KEY) {
        originalSetItem(key, value);
        return;
      }
      const error = new Error("quota");
      (error as Error & { name: string }).name = "QuotaExceededError";
      throw error;
    };
    g.localStorage = localStorage;

    const { writeStoredJson, readStorageWriteFailures } = await import(
      "@/lib/storage"
    );
    expect(writeStoredJson("k", { value: 7 })).toBe("quota");
    const failures = readStorageWriteFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0]?.key).toBe("k");
    expect(failures[0]?.status).toBe("quota");
    expect(typeof failures[0]?.timestamp).toBe("string");
  });

  it("returns failed for non-quota write errors", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key: string, value: string) => {
      if (key === SIGNAL_STORAGE_WRITE_FAILURES_KEY) {
        originalSetItem(key, value);
        return;
      }
      throw new Error("permission denied");
    };
    g.localStorage = localStorage;

    const { writeStoredJson, readStorageWriteFailures } = await import(
      "@/lib/storage"
    );
    expect(writeStoredJson("k", { value: 7 })).toBe("failed");
    const failures = readStorageWriteFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0]?.key).toBe("k");
    expect(failures[0]?.status).toBe("failed");
  });

  it("caps stored write failure diagnostics", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    const prefilled = Array.from({ length: 30 }, (_, index) => ({
      key: `signal-k-${index}`,
      status: index % 2 ? "quota" : "failed",
      timestamp: new Date(1_700_000_000_000 + index).toISOString(),
    }));
    localStorage.setItem(SIGNAL_STORAGE_WRITE_FAILURES_KEY, JSON.stringify(prefilled));

    const { readStorageWriteFailures } = await import("@/lib/storage");
    const failures = readStorageWriteFailures();
    expect(failures).toHaveLength(25);
    expect(failures[0]?.key).toBe("signal-k-0");
    expect(failures.at(-1)?.key).toBe("signal-k-24");
  });
});

describe("clearStorageWriteFailures", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("removes stored write-failure diagnostics", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    localStorage.setItem(
      SIGNAL_STORAGE_WRITE_FAILURES_KEY,
      JSON.stringify([{ key: "signal-history-v2", status: "quota", timestamp: "t" }])
    );

    const { clearStorageWriteFailures, readStorageWriteFailures } = await import(
      "@/lib/storage"
    );
    expect(readStorageWriteFailures()).toHaveLength(1);
    expect(clearStorageWriteFailures()).toBe("ok");
    expect(readStorageWriteFailures()).toEqual([]);
  });
});

describe("removeStoredValue", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns unavailable on the server (no window)", async () => {
    const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
    delete g.window;
    delete g.localStorage;

    const { removeStoredValue } = await import("@/lib/storage");
    expect(removeStoredValue("k")).toBe("unavailable");
  });

  it("removes a key and returns ok", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    localStorage.setItem("k", JSON.stringify({ value: 1 }));

    const { removeStoredValue } = await import("@/lib/storage");
    expect(removeStoredValue("k")).toBe("ok");
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("records failed removals", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      document?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    g.document = {};
    const localStorage = makeLocalStorage();
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.removeItem = () => {
      throw new Error("blocked");
    };
    localStorage.setItem = (key: string, value: string) => {
      if (key === SIGNAL_STORAGE_WRITE_FAILURES_KEY) {
        originalSetItem(key, value);
        return;
      }
      originalSetItem(key, value);
    };
    g.localStorage = localStorage;

    const { removeStoredValue, readStorageWriteFailures } = await import(
      "@/lib/storage"
    );
    expect(removeStoredValue("signal-history-v2")).toBe("failed");
    const failures = readStorageWriteFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0]?.key).toBe("signal-history-v2");
    expect(failures[0]?.status).toBe("failed");
  });
});
