"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnswerMode, AnswerResponse, SourceMode } from "@/lib/types/answer";
import { cn } from "@/lib/utils";

type Feedback = "up" | "down" | null;

type Thread = AnswerResponse & {
  feedback?: Feedback;
};

const MODES: { id: AnswerMode; label: string; blurb: string }[] = [
  {
    id: "quick",
    label: "Quick",
    blurb: "Fast, concise answers with citations.",
  },
  {
    id: "research",
    label: "Research",
    blurb: "Multi-step synthesis with a longer report.",
  },
  {
    id: "learn",
    label: "Learn",
    blurb: "Step-by-step explanations and checkpoints.",
  },
];

const SOURCES: { id: SourceMode; label: string; blurb: string }[] = [
  {
    id: "web",
    label: "Web",
    blurb: "Live web sources with citations.",
  },
  {
    id: "none",
    label: "Offline",
    blurb: "No external sources used.",
  },
];

const STORAGE_KEY = "signal-history-v1";

export default function ChatApp() {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<AnswerMode>("quick");
  const [sources, setSources] = useState<SourceMode>("web");
  const [incognito, setIncognito] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<Thread | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<AnswerMode | "all">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Thread[];
        setThreads(parsed);
      } catch {
        setThreads([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get("thread");
    if (!threadId) return;
    const match = threads.find((thread) => thread.id === threadId);
    if (match) {
      setCurrent(match);
    } else if (threads.length) {
      setNotice("Shared thread not found in this browser library.");
    }
  }, [threads]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const activeMode = useMemo(
    () => MODES.find((item) => item.id === mode) ?? MODES[0],
    [mode]
  );

  const filteredThreads = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const filtered = threads.filter((thread) => {
      const matchesMode = filterMode === "all" || thread.mode === filterMode;
      const matchesSearch =
        !normalized || thread.question.toLowerCase().includes(normalized);
      return matchesMode && matchesSearch;
    });

    return filtered.sort((a, b) => {
      const left = new Date(a.createdAt).getTime();
      const right = new Date(b.createdAt).getTime();
      return sort === "newest" ? right - left : left - right;
    });
  }, [threads, search, filterMode, sort]);

  async function submitQuestion() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, mode, sources }),
      });
      const data = (await response.json()) as AnswerResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      const thread: Thread = { ...data, feedback: null };
      setCurrent(thread);
      if (!incognito) {
        setThreads((prev) => [thread, ...prev].slice(0, 30));
      }
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      submitQuestion();
    }
  }

  function updateFeedback(value: Feedback) {
    if (!current) return;
    const updated = { ...current, feedback: value };
    setCurrent(updated);
    setThreads((prev) =>
      prev.map((thread) => (thread.id === updated.id ? updated : thread))
    );
  }

  function copyAnswer() {
    if (!current) return;
    navigator.clipboard.writeText(current.answer).catch(() => null);
    setNotice("Answer copied to clipboard.");
  }

  function exportMarkdown() {
    if (!current) return;
    const lines = [
      `# ${current.question}`,
      "",
      current.answer,
      "",
      `Mode: ${current.mode}`,
      `Sources: ${current.sources === "web" ? "Web" : "Offline"}`,
      "",
      "## Sources",
      ...(current.citations.length
        ? current.citations.map((source, index) =>
            `${index + 1}. [${source.title}](${source.url})`
          )
        : ["No citations."]),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signal-search-${current.id}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function shareThread() {
    if (!current) return;
    const url = `${window.location.origin}?thread=${current.id}`;
    navigator.clipboard.writeText(url).catch(() => null);
    setNotice("Share link copied.");
  }

  function editQuestion() {
    if (!current) return;
    setQuestion(current.question);
  }

  function deleteThread(id: string) {
    setThreads((prev) => prev.filter((thread) => thread.id !== id));
    if (current?.id === id) setCurrent(null);
  }

  function clearLibrary() {
    setThreads([]);
    setCurrent(null);
  }

  return (
    <div className="flex min-h-screen flex-col bg-signal-bg text-signal-text">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-signal-accent text-signal-bg shadow-glow">
            S
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
              Signal Search
            </p>
            <h1 className="text-xl font-semibold">Answer Engine</h1>
          </div>
        </div>
        <nav className="hidden items-center gap-4 text-sm text-signal-muted md:flex">
          <span className="rounded-full border border-white/10 px-3 py-1">
            Library
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            Spaces
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            Tasks
          </span>
        </nav>
      </header>

      <main className="flex flex-1 flex-col gap-10 px-6 pb-16 md:flex-row md:px-12">
        <section className="flex-1">
          <div className="rounded-3xl border border-white/10 bg-signal-surface/80 p-6 shadow-xl backdrop-blur">
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
                  Mode
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {MODES.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setMode(item.id)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition",
                        mode === item.id
                          ? "border-signal-accent bg-signal-accent/10 text-signal-text"
                          : "border-white/10 bg-transparent text-signal-muted hover:border-white/30"
                      )}
                    >
                      <p className="text-sm font-semibold text-signal-text">
                        {item.label}
                      </p>
                      <p className="text-xs text-signal-muted">{item.blurb}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
                  Sources
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {SOURCES.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSources(item.id)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition",
                        sources === item.id
                          ? "border-signal-accent bg-signal-accent/10 text-signal-text"
                          : "border-white/10 bg-transparent text-signal-muted hover:border-white/30"
                      )}
                    >
                      <p className="text-sm font-semibold text-signal-text">
                        {item.label}
                      </p>
                      <p className="text-xs text-signal-muted">{item.blurb}</p>
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs text-signal-muted">
                  <div>
                    <p className="text-sm font-semibold text-signal-text">
                      Incognito
                    </p>
                    <p className="text-xs text-signal-muted">
                      Do not save this thread to your library.
                    </p>
                  </div>
                  <button
                    onClick={() => setIncognito((prev) => !prev)}
                    className={cn(
                      "rounded-full border px-4 py-1 text-xs transition",
                      incognito
                        ? "border-signal-accent text-signal-text"
                        : "border-white/10 text-signal-muted"
                    )}
                  >
                    {incognito ? "On" : "Off"}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
                    Prompt
                  </p>
                  <span className="text-xs text-signal-muted">
                    {activeMode.label} mode
                  </span>
                </div>
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Ask anything. Add sources, upload files, or pick a mode."
                    className="h-32 w-full resize-none bg-transparent text-sm text-signal-text outline-none placeholder:text-signal-muted"
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-xs text-signal-muted">
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Web
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Files (soon)
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Spaces (soon)
                      </span>
                    </div>
                    <button
                      onClick={submitQuestion}
                      disabled={loading}
                      className="rounded-full bg-signal-accent px-6 py-2 text-sm font-semibold text-signal-bg transition hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Thinking…" : "Send"}
                    </button>
                  </div>
                </div>
                {error ? (
                  <p className="mt-3 text-sm text-rose-300">{error}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-white/10 bg-signal-surface/60 p-6 shadow-xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
                Answer
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-signal-muted">
                <span className="rounded-full border border-white/10 px-3 py-1">
                  {current?.provider ?? "mock"}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1">
                  {current?.latencyMs ?? 0}ms
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1">
                  {current?.sources === "web" ? "Web" : "Offline"}
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-4 text-sm leading-7 text-signal-text/90">
              {current ? (
                current.answer
                  .split("\n\n")
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))
              ) : (
                <p className="text-signal-muted">
                  Ask a question to generate a cited answer. Your results and
                  sources will appear here.
                </p>
              )}
            </div>
            {current ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={copyAnswer}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                >
                  Copy answer
                </button>
                <button
                  onClick={exportMarkdown}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                >
                  Export Markdown
                </button>
                <button
                  onClick={shareThread}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                >
                  Share link
                </button>
                <button
                  onClick={editQuestion}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                >
                  Edit question
                </button>
                <button
                  onClick={() => updateFeedback("up")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    current.feedback === "up"
                      ? "border-signal-accent text-signal-text"
                      : "border-white/10 text-signal-muted"
                  )}
                >
                  👍
                </button>
                <button
                  onClick={() => updateFeedback("down")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    current.feedback === "down"
                      ? "border-signal-accent text-signal-text"
                      : "border-white/10 text-signal-muted"
                  )}
                >
                  👎
                </button>
              </div>
            ) : null}
            {current?.citations?.length ? (
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.2em] text-signal-muted">
                  Sources
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {current.citations.map((citation, index) => (
                    <a
                      key={`${citation.url}-${index}`}
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                    >
                      {index + 1}. {citation.title}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="w-full space-y-6 md:w-80">
          <div className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
              Library
            </p>
            <div className="mt-3 space-y-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search threads"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
              />
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={filterMode}
                  onChange={(event) =>
                    setFilterMode(event.target.value as AnswerMode | "all")
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text"
                >
                  <option value="all">All modes</option>
                  {MODES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as "newest" | "oldest")
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {filteredThreads.length === 0 ? (
                <p className="text-xs text-signal-muted">
                  Your library is empty.
                </p>
              ) : (
                filteredThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className="rounded-2xl border border-white/10 p-3 text-left text-xs text-signal-text"
                  >
                    <button
                      onClick={() => setCurrent(thread)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                        {thread.question}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-signal-muted">
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {thread.mode}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-0.5">
                          {thread.sources === "web" ? "Web" : "Offline"}
                        </span>
                        <span>{new Date(thread.createdAt).toLocaleString()}</span>
                      </div>
                    </button>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => deleteThread(thread.id)}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {threads.length ? (
              <button
                onClick={clearLibrary}
                className="mt-4 w-full rounded-full border border-white/10 px-4 py-2 text-xs text-signal-muted"
              >
                Clear library
              </button>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
              Spaces
            </p>
            <p className="mt-2 text-sm text-signal-muted">
              Create focused workspaces with custom instructions and sources.
            </p>
            <button className="mt-4 w-full rounded-full border border-white/10 px-4 py-2 text-xs text-signal-muted">
              Create a space (soon)
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
              Tasks
            </p>
            <p className="mt-2 text-sm text-signal-muted">
              Schedule recurring reports once automation is enabled.
            </p>
            <button className="mt-4 w-full rounded-full border border-white/10 px-4 py-2 text-xs text-signal-muted">
              Add a task (soon)
            </button>
          </div>
        </aside>
      </main>

      <footer className="border-t border-white/10 px-6 py-6 text-xs text-signal-muted md:px-12">
        Signal Search is a free-tier answer engine with custom branding. Live
        search and advanced tools unlock when you add a provider key.
      </footer>

      {notice ? (
        <div className="fixed bottom-6 right-6 rounded-2xl border border-white/10 bg-signal-surface/90 px-4 py-2 text-xs text-signal-text shadow-xl">
          {notice}
        </div>
      ) : null}
    </div>
  );
}
