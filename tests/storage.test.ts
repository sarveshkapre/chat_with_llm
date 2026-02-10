import { beforeEach, describe, expect, it, vi } from "vitest";

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
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    localStorage.setItem("k", JSON.stringify({ value: 123 }));

    const { readStoredJson } = await import("@/lib/storage");
    expect(readStoredJson("k", { value: 0 })).toEqual({ value: 123 });

    const keys = Array.from(localStorage._dump().keys());
    expect(keys.some((key) => key.startsWith("signal-corrupt-backup-v1:"))).toBe(
      false
    );
  });

  it("backs up corrupt JSON blobs before falling back", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    localStorage.setItem("k", "{not-json");

    vi.spyOn(Date, "now").mockReturnValueOnce(123);

    const { readStoredJson } = await import("@/lib/storage");
    expect(readStoredJson("k", { value: 0 })).toEqual({ value: 0 });

    const latestKey = "signal-corrupt-latest-v1:k";
    const backupKey = localStorage.getItem(latestKey);
    expect(backupKey).toBe("signal-corrupt-backup-v1:k:123");
    expect(localStorage.getItem(backupKey!)).toBe("{not-json");
  });

  it("backs up at most once per key per page session", async () => {
    const g = globalThis as unknown as {
      window?: unknown;
      localStorage?: ReturnType<typeof makeLocalStorage>;
    };
    g.window = {};
    const localStorage = makeLocalStorage();
    g.localStorage = localStorage;
    localStorage.setItem("k", "{not-json");

    vi.spyOn(Date, "now").mockReturnValueOnce(1).mockReturnValueOnce(2);

    const { readStoredJson } = await import("@/lib/storage");
    readStoredJson("k", null);
    readStoredJson("k", null);

    const backupKeys = Array.from(localStorage._dump().keys()).filter((key) =>
      key.startsWith("signal-corrupt-backup-v1:k:")
    );
    expect(backupKeys).toEqual(["signal-corrupt-backup-v1:k:1"]);
  });
});
