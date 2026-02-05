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
const REQUEST_MODELS = ["auto", "gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"] as const;

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
  const [spaceTags, setSpaceTags] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {};
    const stored = localStorage.getItem(SPACE_TAGS_KEY);
    if (!stored) return {};
    try {
      return JSON.parse(stored) as Record<string, string[]>;
    } catch {
      return {};
    }
  });
  const [spaceTagDrafts, setSpaceTagDrafts] = useState<Record<string, string>>(
    {}
  );
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [preferredModel, setPreferredModel] = useState<
    (typeof REQUEST_MODELS)[number]
  >("auto");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "activity">("activity");
  const [tagFilter, setTagFilter] = useState("");
  const [tagQuery, setTagQuery] = useState("");
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
    localStorage.setItem(SPACE_TAGS_KEY, JSON.stringify(spaceTags));
  }, [spaceTags]);


  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const tagOptions = useMemo(() => {
    const counter = new Map<string, number>();
    spaces.forEach((space) => {
      (spaceTags[space.id] ?? []).forEach((tag) => {
        counter.set(tag, (counter.get(tag) ?? 0) + 1);
      });
    });
    return Array.from(counter.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [spaces, spaceTags]);

  const filteredTagOptions = useMemo(() => {
    if (!tagQuery.trim()) return tagOptions;
    const normalized = tagQuery.trim().toLowerCase();
    return tagOptions.filter((option) =>
      option.tag.toLowerCase().includes(normalized)
    );
  }, [tagOptions, tagQuery]);

  const summaries = useMemo(() => {
    const filtered = spaces.filter((space) => {
      const matchesSearch = space.name
        .toLowerCase()
        .includes(search.trim().toLowerCase());
      const tags = spaceTags[space.id] ?? [];
      const matchesTag = !tagFilter || tags.includes(tagFilter);
      return matchesSearch && matchesTag;
    });
    const mapped = filtered.map((space) => {
      const items = threads.filter((thread) => thread.spaceId === space.id);
      const lastUpdated =
        items.length > 0
          ? new Date(
              Math.max(...items.map((item) => new Date(item.createdAt).getTime()))
            ).toLocaleString()
          : "No activity yet";
      const lastUpdatedMs = items.length
        ? Math.max(...items.map((item) => new Date(item.createdAt).getTime()))
        : 0;
      const tags = spaceTags[space.id] ?? [];
      const preview = items
        .slice(0, 3)
        .map((thread) => thread.title ?? thread.question);
      return {
        ...space,
        count: items.length,
        lastUpdated,
        lastUpdatedMs,
        tags,
        archived: archivedSpaces.includes(space.id),
        preview,
      };
    });
    return mapped.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return b.lastUpdatedMs - a.lastUpdatedMs;
    });
  }, [spaces, threads, search, spaceTags, archivedSpaces, tagFilter, sortBy]);

  function createSpace() {
    if (!name.trim()) {
      setNotice("Space needs a name.");
      return;
    }
    const space: Space = {
      id: nanoid(),
      name: name.trim(),
      instructions: instructions.trim(),
      preferredModel: preferredModel === "auto" ? null : preferredModel,
      createdAt: new Date().toISOString(),
    };
    setSpaces((prev) => [space, ...prev]);
    setName("");
    setInstructions("");
    setPreferredModel("auto");
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

  function addSpaceTags(spaceId: string) {
    const draft = spaceTagDrafts[spaceId] ?? "";
    const nextTags = draft
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    if (!nextTags.length) {
      setNotice("Enter a space tag.");
      return;
    }
    setSpaceTags((prev) => {
      const existing = prev[spaceId] ?? [];
      const merged = [...existing];
      nextTags.forEach((tag) => {
        if (!merged.some((item) => item.toLowerCase() === tag.toLowerCase())) {
          merged.push(tag);
        }
      });
      return { ...prev, [spaceId]: merged };
    });
    setSpaceTagDrafts((prev) => ({ ...prev, [spaceId]: "" }));
  }

  function removeSpaceTag(spaceId: string, tag: string) {
    setSpaceTags((prev) => {
      const next = { ...prev };
      next[spaceId] = (next[spaceId] ?? []).filter((item) => item !== tag);
      return next;
    });
  }

  function exportSpace(space: Space) {
    const spaceThreads = threads.filter((thread) => thread.spaceId === space.id);
    const lines: string[] = [
      `# ${space.name}`,
      "",
      space.instructions ? `Instructions: ${space.instructions}` : "Instructions: none",
      `Preferred model: ${space.preferredModel ?? "Auto"}`,
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

  function exportAllSpaces() {
    return exportSpacesData(spaces, "signal-spaces");
  }

  function exportFilteredSpaces() {
    return exportSpacesData(summaries, "signal-spaces-filtered");
  }

  function exportSpacesData(
    list: {
      id: string;
      name: string;
      instructions: string;
      preferredModel?: string | null;
      createdAt: string;
    }[],
    filePrefix: string
  ) {
    const lines: string[] = [
      "# Signal Search Spaces Export",
      "",
      `Total spaces: ${list.length}`,
      "",
      "## Spaces",
      ...list.map((space, index) => {
        const spaceThreads = threads.filter(
          (thread) => thread.spaceId === space.id
        );
        const tags = (spaceTags[space.id] ?? []).length
          ? (spaceTags[space.id] ?? []).join(", ")
          : "none";
        return [
          `${index + 1}. ${space.name}`,
          `   - Threads: ${spaceThreads.length}`,
          `   - Preferred model: ${space.preferredModel ?? "Auto"}`,
          `   - Tags: ${tags}`,
          `   - Created: ${new Date(space.createdAt).toLocaleString()}`,
        ].join("\n");
      }),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filePrefix}-${Date.now()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-signal-bg text-signal-text">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-signal-muted">
            Spaces
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Signal Search</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Back to Library
          </Link>
          <button
            onClick={exportAllSpaces}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Export all spaces
          </button>
          <button
            onClick={exportFilteredSpaces}
            className="rounded-full border border-white/10 px-4 py-2 text-xs text-signal-text"
          >
            Export filtered
          </button>
        </div>
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
            <select
              value={preferredModel}
              onChange={(event) =>
                setPreferredModel(
                  event.target.value as (typeof REQUEST_MODELS)[number]
                )
              }
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text"
            >
              <option value="auto">Preferred model: Auto</option>
              {REQUEST_MODELS.filter((item) => item !== "auto").map((item) => (
                <option key={item} value={item}>
                  Preferred model: {item}
                </option>
              ))}
            </select>
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
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as "name" | "activity")
              }
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text"
            >
              <option value="activity">Sort by activity</option>
              <option value="name">Sort by name</option>
            </select>
            <input
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              placeholder="Filter tags"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {filteredTagOptions.length === 0 ? (
                <span className="text-xs text-signal-muted">
                  No matching tags.
                </span>
              ) : (
                filteredTagOptions.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setTagFilter((prev) => (prev === tag ? "" : tag))
                    }
                    className={`rounded-full border px-3 py-1 text-[11px] ${
                      tagFilter === tag
                        ? "border-signal-accent text-signal-text"
                        : "border-white/10 text-signal-muted"
                    }`}
                  >
                    #{tag} · {count}
                  </button>
                ))
              )}
            </div>
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
                  <p className="mt-2 text-[11px] text-signal-muted">
                    Preferred model: {space.preferredModel ?? "Auto"}
                  </p>
                  {space.preview.length ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-[11px] text-signal-muted">
                      <p className="text-xs uppercase tracking-[0.2em] text-signal-muted">
                        Recent threads
                      </p>
                      <ul className="mt-2 space-y-1 text-[11px] text-signal-text">
                        {space.preview.map((title) => (
                          <li key={`${space.id}-${title}`} className="truncate">
                            {title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-[11px] text-signal-muted">
                    <div className="flex flex-wrap gap-2">
                      {space.tags.length ? (
                        space.tags.map((tag) => (
                          <button
                            key={`${space.id}-${tag}`}
                            onClick={() => removeSpaceTag(space.id, tag)}
                            className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-signal-text"
                          >
                            #{tag} ×
                          </button>
                        ))
                      ) : (
                        <span>No tags yet.</span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        value={spaceTagDrafts[space.id] ?? ""}
                        onChange={(event) =>
                          setSpaceTagDrafts((prev) => ({
                            ...prev,
                            [space.id]: event.target.value,
                          }))
                        }
                        placeholder="Add tags (comma separated)"
                        className="w-full rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-signal-text outline-none"
                      />
                      <button
                        onClick={() => addSpaceTags(space.id)}
                        className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-signal-text"
                      >
                        Add
                      </button>
                    </div>
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
