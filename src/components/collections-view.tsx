"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import type { Collection } from "@/lib/types/collection";
import type { AnswerResponse } from "@/lib/types/answer";
import { nanoid } from "nanoid";

type Thread = AnswerResponse & {
  title?: string | null;
  pinned?: boolean;
  favorite?: boolean;
  collectionId?: string | null;
  tags?: string[];
};

const COLLECTIONS_KEY = "signal-collections-v1";
const THREADS_KEY = "signal-history-v2";

export default function CollectionsView() {
  const [collections, setCollections] = useState<Collection[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(COLLECTIONS_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as Collection[];
    } catch {
      return [];
    }
  });

  const [threads, setThreads] = useState<Thread[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(THREADS_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as Thread[];
    } catch {
      return [];
    }
  });

  const [collectionName, setCollectionName] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  }, [collections]);

  useEffect(() => {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const summaries = useMemo(() => {
    const filtered = collections.filter((collection) =>
      collection.name.toLowerCase().includes(search.trim().toLowerCase())
    );
    return filtered.map((collection) => {
      const items = threads.filter(
        (thread) => thread.collectionId === collection.id
      );
      const favoriteCount = items.filter((item) => item.favorite).length;
      const pinnedCount = items.filter((item) => item.pinned).length;
      const tagCounts = new Map<string, number>();
      items.forEach((item) => {
        (item.tags ?? []).forEach((tag) => {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        });
      });
      const topTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
        .slice(0, 4);
      const lastUpdated =
        items.length > 0
          ? new Date(
              Math.max(
                ...items.map((item) => new Date(item.createdAt).getTime())
              )
            ).toLocaleString()
          : "No threads yet";
      return {
        ...collection,
        count: items.length,
        favoriteCount,
        pinnedCount,
        topTags,
        lastUpdated,
      };
    });
  }, [collections, threads, search]);

  function createCollection() {
    if (!collectionName.trim()) {
      setNotice("Collection needs a name.");
      return;
    }
    const collection: Collection = {
      id: nanoid(),
      name: collectionName.trim(),
      createdAt: new Date().toISOString(),
    };
    setCollections((prev) => [collection, ...prev]);
    setCollectionName("");
    setNotice("Collection created.");
  }

  function deleteCollection(id: string) {
    setCollections((prev) => prev.filter((collection) => collection.id !== id));
    setThreads((prev) =>
      prev.map((thread) =>
        thread.collectionId === id ? { ...thread, collectionId: null } : thread
      )
    );
    setNotice("Collection deleted.");
  }

  function exportMarkdown(collectionId: string) {
    const collection = collections.find((item) => item.id === collectionId);
    if (!collection) return;
    setExportingId(collectionId);
    const items = threads.filter((thread) => thread.collectionId === collectionId);
    const lines: string[] = [
      `# ${collection.name}`,
      "",
      `Total threads: ${items.length}`,
      "",
      "## Threads",
      ...items.map((thread, index) => {
        const title = thread.title ?? thread.question;
        const tags = (thread.tags ?? []).length
          ? `Tags: ${(thread.tags ?? []).join(", ")}`
          : "Tags: none";
        const pinned = thread.pinned ? "Pinned: yes" : "Pinned: no";
        const favorite = thread.favorite ? "Favorite: yes" : "Favorite: no";
        return [
          `${index + 1}. ${title}`,
          `   - ${pinned} · ${favorite}`,
          `   - ${tags}`,
          `   - Created: ${new Date(thread.createdAt).toLocaleString()}`,
        ].join("\n");
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signal-collection-${collection.id}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportingId(null);
  }

  return (
    <div className="min-h-screen bg-signal-bg text-signal-text">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-signal-muted">
            Collections
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Signal Search</h1>
        </div>
        <Link
          href="/"
          className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
        >
          Back to Library
        </Link>
      </header>

      <main className="px-6 py-10">
        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
              Create
            </p>
            <input
              value={collectionName}
              onChange={(event) => setCollectionName(event.target.value)}
              placeholder="Collection name"
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
            />
            <button
              onClick={createCollection}
              className="mt-3 w-full rounded-full border border-white/10 px-4 py-2 text-xs text-signal-muted"
            >
              Create collection
            </button>

            <p className="mt-8 text-sm uppercase tracking-[0.2em] text-signal-muted">
              Filter
            </p>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search collections"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
            />
          </section>

          <section className="space-y-4">
            {summaries.length === 0 ? (
              <p className="text-sm text-signal-muted">
                No collections yet. Create one to start grouping threads.
              </p>
            ) : (
              summaries.map((collection) => (
                <div
                  key={collection.id}
                  className="rounded-3xl border border-white/10 bg-signal-surface/70 p-6 shadow-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {collection.name}
                      </h2>
                      <p className="mt-1 text-xs text-signal-muted">
                        {collection.count} threads · {collection.favoriteCount}{" "}
                        favorites · {collection.pinnedCount} pinned
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Link
                        href={`/?collection=${collection.id}`}
                        className="rounded-full border border-white/10 px-3 py-1 text-signal-text"
                      >
                        Open in Library
                      </Link>
                      <button
                        onClick={() => exportMarkdown(collection.id)}
                        className="rounded-full border border-white/10 px-3 py-1 text-signal-text"
                        disabled={exportingId === collection.id}
                      >
                        {exportingId === collection.id ? "Exporting" : "Export"}
                      </button>
                      <button
                        onClick={() => deleteCollection(collection.id)}
                        className="rounded-full border border-white/10 px-3 py-1 text-signal-text"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-signal-muted">
                    Last updated: {collection.lastUpdated}
                  </p>
                  {collection.topTags.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {collection.topTags.map((tag) => (
                        <Link
                          key={`${collection.id}-${tag.tag}`}
                          href={`/?collection=${collection.id}&tag=${tag.tag}`}
                          className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-signal-text"
                        >
                          #{tag.tag} · {tag.count}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-signal-muted">
                      No tags in this collection yet.
                    </p>
                  )}
                </div>
              ))
            )}
          </section>
        </div>
      </main>

      {notice ? (
        <div className="fixed bottom-6 right-6 rounded-2xl border border-white/10 bg-signal-surface/90 px-4 py-2 text-xs text-signal-text shadow-xl">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
