"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import type { Space } from "@/lib/types/space";
import type { AnswerResponse } from "@/lib/types/answer";

type Thread = AnswerResponse & {
  title?: string | null;
  spaceId?: string | null;
  spaceName?: string | null;
};

const SPACES_KEY = "signal-spaces-v1";
const THREADS_KEY = "signal-history-v2";
const ACTIVE_SPACE_KEY = "signal-space-active";
const ARCHIVED_SPACES_KEY = "signal-spaces-archived-v1";
const SPACE_TAGS_KEY = "signal-space-tags-v1";

export default function SpacesView() {
  const [spaces, setSpaces] = useState<Space[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(SPACES_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as Space[];
    } catch {
      return [];
    }
  });
  const [threads] = useState<Thread[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(THREADS_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as Thread[];
    } catch {
      return [];
    }
  });
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_SPACE_KEY);
  });
  const [archivedSpaces, setArchivedSpaces] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(ARCHIVED_SPACES_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as string[];
    } catch {
      return [];
    }
  });
  const [spaceTags] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {};
    const stored = localStorage.getItem(SPACE_TAGS_KEY);
    if (!stored) return {};
    try {
      return JSON.parse(stored) as Record<string, string[]>;
    } catch {
      return {};
    }
  });
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
  }, [spaces]);

  useEffect(() => {
    if (activeSpaceId) {
      localStorage.setItem(ACTIVE_SPACE_KEY, activeSpaceId);
    } else {
      localStorage.removeItem(ACTIVE_SPACE_KEY);
    }
  }, [activeSpaceId]);

  useEffect(() => {
    localStorage.setItem(
      ARCHIVED_SPACES_KEY,
      JSON.stringify(archivedSpaces)
    );
  }, [archivedSpaces]);


  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const summaries = useMemo(() => {
    const filtered = spaces.filter((space) =>
      space.name.toLowerCase().includes(search.trim().toLowerCase())
    );
    return filtered.map((space) => {
      const items = threads.filter((thread) => thread.spaceId === space.id);
      const lastUpdated =
        items.length > 0
          ? new Date(
              Math.max(...items.map((item) => new Date(item.createdAt).getTime()))
            ).toLocaleString()
          : "No activity yet";
      const tags = spaceTags[space.id] ?? [];
      return {
        ...space,
        count: items.length,
        lastUpdated,
        tags,
        archived: archivedSpaces.includes(space.id),
      };
    });
  }, [spaces, threads, search, spaceTags, archivedSpaces]);

  function createSpace() {
    if (!name.trim()) {
      setNotice("Space needs a name.");
      return;
    }
    const space: Space = {
      id: nanoid(),
      name: name.trim(),
      instructions: instructions.trim(),
      createdAt: new Date().toISOString(),
    };
    setSpaces((prev) => [space, ...prev]);
    setName("");
    setInstructions("");
    setNotice("Space created.");
  }

  function deleteSpace(id: string) {
    setSpaces((prev) => prev.filter((space) => space.id !== id));
    setArchivedSpaces((prev) => prev.filter((item) => item !== id));
    if (activeSpaceId === id) {
      setActiveSpaceId(null);
    }
  }

  function toggleArchive(spaceId: string) {
    setArchivedSpaces((prev) =>
      prev.includes(spaceId)
        ? prev.filter((item) => item !== spaceId)
        : [...prev, spaceId]
    );
    if (activeSpaceId === spaceId) {
      setActiveSpaceId(null);
    }
  }

  function exportSpace(space: Space) {
    const spaceThreads = threads.filter((thread) => thread.spaceId === space.id);
    const lines: string[] = [
      `# ${space.name}`,
      "",
      space.instructions ? `Instructions: ${space.instructions}` : "Instructions: none",
      "",
      `Total threads: ${spaceThreads.length}`,
      "",
      "## Threads",
      ...spaceThreads.map((thread, index) => {
        const title = thread.title ?? thread.question;
        return [
          `${index + 1}. ${title}`,
          `   - Mode: ${thread.mode} · Sources: ${thread.sources === "web" ? "Web" : "Offline"}`,
          `   - Created: ${new Date(thread.createdAt).toLocaleString()}`,
        ].join("\n");
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signal-space-${space.id}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-signal-bg text-signal-text">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-signal-muted">
            Spaces
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
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Space name"
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
            />
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Space instructions"
              className="mt-3 h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
            />
            <button
              onClick={createSpace}
              className="mt-3 w-full rounded-full border border-white/10 px-4 py-2 text-xs text-signal-muted"
            >
              Create space
            </button>

            <p className="mt-8 text-sm uppercase tracking-[0.2em] text-signal-muted">
              Filter
            </p>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search spaces"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
            />
          </section>

          <section className="space-y-4">
            {summaries.length === 0 ? (
              <p className="text-sm text-signal-muted">
                No spaces yet. Create one to start organizing research.
              </p>
            ) : (
              summaries.map((space) => (
                <div
                  key={space.id}
                  className="rounded-3xl border border-white/10 bg-signal-surface/70 p-6 shadow-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">
                        {space.name}
                      </h2>
                      <p className="mt-1 text-xs text-signal-muted">
                        {space.count} threads · Last updated: {space.lastUpdated}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Link
                        href={`/?space=${space.id}`}
                        className="rounded-full border border-white/10 px-3 py-1 text-signal-text"
                      >
                        Open in Library
                      </Link>
                      <button
                        onClick={() =>
                          setActiveSpaceId(
                            activeSpaceId === space.id ? null : space.id
                          )
                        }
                        className="rounded-full border border-white/10 px-3 py-1 text-signal-text"
                      >
                        {activeSpaceId === space.id ? "Active" : "Set active"}
                      </button>
                      <button
                        onClick={() => exportSpace(space)}
                        className="rounded-full border border-white/10 px-3 py-1 text-signal-text"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => toggleArchive(space.id)}
                        className="rounded-full border border-white/10 px-3 py-1 text-signal-text"
                      >
                        {space.archived ? "Restore" : "Archive"}
                      </button>
                      <button
                        onClick={() => deleteSpace(space.id)}
                        className="rounded-full border border-white/10 px-3 py-1 text-signal-text"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-signal-muted">
                    {space.instructions || "No instructions."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {space.tags.length ? (
                      space.tags.map((tag) => (
                        <span
                          key={`${space.id}-${tag}`}
                          className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-signal-text"
                        >
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-signal-muted">
                        No tags yet.
                      </span>
                    )}
                  </div>
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
