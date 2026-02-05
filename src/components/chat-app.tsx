"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AnswerMode,
  AnswerResponse,
  SourceMode,
  Attachment,
} from "@/lib/types/answer";
import type { Space } from "@/lib/types/space";
import type { Task, TaskCadence } from "@/lib/types/task";
import type { LibraryFile } from "@/lib/types/file";
import { cn } from "@/lib/utils";
import {
  canReadAsText,
  readFileAsText,
  stripAttachmentText,
} from "@/lib/attachments";
import { searchLibraryFiles } from "@/lib/file-search";
import { nanoid } from "nanoid";

type Feedback = "up" | "down" | null;

type Thread = AnswerResponse & {
  feedback?: Feedback;
};

type StreamMessage =
  | { type: "delta"; text: string }
  | { type: "done"; payload: AnswerResponse }
  | { type: "error"; message: string };

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

const TASK_CADENCES: { id: TaskCadence; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekday", label: "Weekdays" },
  { id: "weekly", label: "Weekly" },
];

const RESEARCH_STEPS = [
  "Scanning sources",
  "Reading and extracting",
  "Cross-checking",
  "Drafting report",
];

const STORAGE_KEY = "signal-history-v2";
const SPACES_KEY = "signal-spaces-v1";
const ACTIVE_SPACE_KEY = "signal-space-active";
const TASKS_KEY = "signal-tasks-v1";
const FILES_KEY = "signal-files-v1";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_SIZE = 1_000_000;
const MAX_LIBRARY_FILES = 20;
const MAX_LIBRARY_FILE_SIZE = 200_000;

export default function ChatApp() {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<AnswerMode>("quick");
  const [sources, setSources] = useState<SourceMode>("web");
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [incognito, setIncognito] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<Thread | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<AnswerMode | "all">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [notice, setNotice] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [bulkSpaceId, setBulkSpaceId] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [spaceInstructions, setSpaceInstructions] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskName, setTaskName] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [taskCadence, setTaskCadence] = useState<TaskCadence>("daily");
  const [taskTime, setTaskTime] = useState("09:00");
  const [taskMode, setTaskMode] = useState<AnswerMode>("quick");
  const [taskSources, setTaskSources] = useState<SourceMode>("web");
  const [taskRunningId, setTaskRunningId] = useState<string | null>(null);
  const [researchStepIndex, setResearchStepIndex] = useState(0);
  const [libraryFiles, setLibraryFiles] = useState<LibraryFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [fileSearchEnabled, setFileSearchEnabled] = useState(true);
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [liveAnswer, setLiveAnswer] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);

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

    const spaceStore = localStorage.getItem(SPACES_KEY);
    if (spaceStore) {
      try {
        const parsed = JSON.parse(spaceStore) as Space[];
        setSpaces(parsed);
      } catch {
        setSpaces([]);
      }
    }

    const taskStore = localStorage.getItem(TASKS_KEY);
    if (taskStore) {
      try {
        const parsed = JSON.parse(taskStore) as Task[];
        setTasks(parsed);
      } catch {
        setTasks([]);
      }
    }

    const fileStore = localStorage.getItem(FILES_KEY);
    if (fileStore) {
      try {
        const parsed = JSON.parse(fileStore) as LibraryFile[];
        setLibraryFiles(parsed);
      } catch {
        setLibraryFiles([]);
      }
    }

    const active = localStorage.getItem(ACTIVE_SPACE_KEY);
    if (active) {
      setActiveSpaceId(active);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    localStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
  }, [spaces]);

  useEffect(() => {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(FILES_KEY, JSON.stringify(libraryFiles));
  }, [libraryFiles]);

  useEffect(() => {
    if (activeSpaceId) {
      localStorage.setItem(ACTIVE_SPACE_KEY, activeSpaceId);
    } else {
      localStorage.removeItem(ACTIVE_SPACE_KEY);
    }
  }, [activeSpaceId]);

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

  useEffect(() => {
    if (!loading || mode !== "research") {
      setResearchStepIndex(0);
      return;
    }

    setResearchStepIndex(0);
    const interval = window.setInterval(() => {
      setResearchStepIndex((prev) =>
        Math.min(prev + 1, RESEARCH_STEPS.length - 1)
      );
    }, 1500);

    return () => window.clearInterval(interval);
  }, [loading, mode]);

  const activeMode = useMemo(
    () => MODES.find((item) => item.id === mode) ?? MODES[0],
    [mode]
  );

  const activeSpace = useMemo(
    () => spaces.find((space) => space.id === activeSpaceId) ?? null,
    [spaces, activeSpaceId]
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

  const filteredFiles = useMemo(() => {
    const normalized = fileSearchQuery.trim().toLowerCase();
    if (!normalized) return libraryFiles;
    return libraryFiles.filter((file) =>
      file.name.toLowerCase().includes(normalized)
    );
  }, [libraryFiles, fileSearchQuery]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files).slice(0, MAX_ATTACHMENTS);
    const next: Attachment[] = [];

    for (const file of incoming) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        next.push({
          id: nanoid(),
          name: file.name,
          size: file.size,
          type: file.type,
          text: null,
          error: "File too large for preview.",
        });
        continue;
      }

      if (!canReadAsText(file)) {
        next.push({
          id: nanoid(),
          name: file.name,
          size: file.size,
          type: file.type,
          text: null,
          error: "Binary files are not supported yet.",
        });
        continue;
      }

      try {
        const text = await readFileAsText(file);
        next.push({
          id: nanoid(),
          name: file.name,
          size: file.size,
          type: file.type,
          text,
          error: null,
        });
      } catch {
        next.push({
          id: nanoid(),
          name: file.name,
          size: file.size,
          type: file.type,
          text: null,
          error: "Failed to read file.",
        });
      }
    }

    setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS));
  }

  async function handleLibraryUpload(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files).slice(0, MAX_LIBRARY_FILES);
    const next: LibraryFile[] = [];

    for (const file of incoming) {
      if (file.size > MAX_LIBRARY_FILE_SIZE) {
        setNotice("File too large for library storage.");
        continue;
      }

      if (!canReadAsText(file)) {
        setNotice("Only text files are supported in the library.");
        continue;
      }

      try {
        const text = await readFileAsText(file);
        next.push({
          id: nanoid(),
          name: file.name,
          size: file.size,
          type: file.type,
          text: text.slice(0, 12000),
          addedAt: new Date().toISOString(),
        });
      } catch {
        setNotice("Failed to read a library file.");
      }
    }

    setLibraryFiles((prev) => [
      ...next,
      ...prev,
    ].slice(0, MAX_LIBRARY_FILES));
  }

  function toggleLibrarySelection(id: string) {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function removeLibraryFile(id: string) {
    setLibraryFiles((prev) => prev.filter((item) => item.id !== id));
    setSelectedFileIds((prev) => prev.filter((item) => item !== id));
  }

  function buildRequestAttachments() {
    const selectedFiles = libraryFiles.filter((file) =>
      selectedFileIds.includes(file.id)
    );

    const searchMatches = fileSearchEnabled
      ? searchLibraryFiles(libraryFiles, question, 3).map((match) => match.file)
      : [];

    const combinedLibrary = [...selectedFiles, ...searchMatches].filter(
      (file, index, array) => array.findIndex((item) => item.id === file.id) === index
    );

    const libraryAttachments: Attachment[] = combinedLibrary.map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      text: file.text,
      error: null,
    }));

    return [...attachments, ...libraryAttachments];
  }

  async function submitQuestion() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setLiveAnswer("");
    setCurrent(null);

    const requestAttachments = buildRequestAttachments();
    const requestBody = {
      question,
      mode,
      sources,
      attachments: requestAttachments,
      spaceInstructions: activeSpace?.instructions ?? "",
      spaceId: activeSpace?.id,
      spaceName: activeSpace?.name,
    };

    if (!streamingEnabled) {
      await submitNonStreaming(requestBody);
      return;
    }

    try {
      const response = await fetch("/api/answer/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok || !response.body) {
        await submitNonStreaming(requestBody);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneReceived = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const message = JSON.parse(line) as StreamMessage;
          if (message.type === "delta") {
            setLiveAnswer((prev) => prev + message.text);
          }
          if (message.type === "error") {
            throw new Error(message.message);
          }
          if (message.type === "done") {
            doneReceived = true;
            handleStreamDone(message.payload);
          }
        }
      }

      if (!doneReceived) {
        throw new Error("Stream ended unexpectedly.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function submitNonStreaming(requestBody: Record<string, unknown>) {
    try {
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = (await response.json()) as AnswerResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      handleStreamDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleStreamDone(data: AnswerResponse) {
    const thread: Thread = {
      ...data,
      feedback: null,
      attachments: data.attachments.map(stripAttachmentText),
    };
    setCurrent(thread);
    setShowDetails(false);
    if (!incognito) {
      setThreads((prev) => [thread, ...prev].slice(0, 30));
    }
    setQuestion("");
    setAttachments([]);
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
      current.spaceName ? `Space: ${current.spaceName}` : null,
      "",
      "## Sources",
      ...(current.citations.length
        ? current.citations.map((source, index) =>
            `${index + 1}. [${source.title}](${source.url})`
          )
        : ["No citations."]),
    ].filter(Boolean) as string[];

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
    setSelectedThreadIds((prev) => prev.filter((threadId) => threadId !== id));
  }

  function clearLibrary() {
    setThreads([]);
    setCurrent(null);
    setSelectedThreadIds([]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }

  function toggleThreadSelection(id: string) {
    setSelectedThreadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function selectAllThreads() {
    setSelectedThreadIds(filteredThreads.map((thread) => thread.id));
  }

  function clearThreadSelection() {
    setSelectedThreadIds([]);
  }

  function bulkDeleteThreads() {
    if (!selectedThreadIds.length) return;
    setThreads((prev) =>
      prev.filter((thread) => !selectedThreadIds.includes(thread.id))
    );
    if (current && selectedThreadIds.includes(current.id)) {
      setCurrent(null);
    }
    setSelectedThreadIds([]);
    setNotice("Selected threads deleted.");
  }

  function bulkAssignSpace() {
    if (!selectedThreadIds.length) return;
    const target = spaces.find((space) => space.id === bulkSpaceId) ?? null;
    if (!target) {
      setNotice("Select a space to assign.");
      return;
    }

    setThreads((prev) =>
      prev.map((thread) =>
        selectedThreadIds.includes(thread.id)
          ? { ...thread, spaceId: target.id, spaceName: target.name }
          : thread
      )
    );
    if (current && selectedThreadIds.includes(current.id)) {
      setCurrent((prev) =>
        prev ? { ...prev, spaceId: target.id, spaceName: target.name } : prev
      );
    }
    setSelectedThreadIds([]);
    setBulkSpaceId("");
    setNotice(`Added ${target.name} to selected threads.`);
  }

  function createSpace() {
    if (!spaceName.trim()) {
      setNotice("Space needs a name.");
      return;
    }

    const space: Space = {
      id: nanoid(),
      name: spaceName.trim(),
      instructions: spaceInstructions.trim(),
      createdAt: new Date().toISOString(),
    };
    setSpaces((prev) => [space, ...prev]);
    setActiveSpaceId(space.id);
    setSpaceName("");
    setSpaceInstructions("");
    setNotice("Space created.");
  }

  function deleteSpace(id: string) {
    setSpaces((prev) => prev.filter((space) => space.id !== id));
    if (activeSpaceId === id) setActiveSpaceId(null);
  }

  function parseTime(time: string) {
    const [hourRaw, minuteRaw] = time.split(":");
    const hour = Number.parseInt(hourRaw ?? "0", 10);
    const minute = Number.parseInt(minuteRaw ?? "0", 10);
    return {
      hour: Number.isNaN(hour) ? 9 : hour,
      minute: Number.isNaN(minute) ? 0 : minute,
    };
  }

  function setTime(base: Date, time: string) {
    const { hour, minute } = parseTime(time);
    const next = new Date(base);
    next.setHours(hour, minute, 0, 0);
    return next;
  }

  function nextDaily(time: string, from = new Date()) {
    const next = setTime(from, time);
    if (next <= from) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  function nextWeekday(time: string, from = new Date()) {
    const next = nextDaily(time, from);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  function nextWeekly(time: string, dayOfWeek: number, from = new Date()) {
    const base = setTime(from, time);
    const offset = (dayOfWeek - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + offset);
    if (base <= from) {
      base.setDate(base.getDate() + 7);
    }
    return base;
  }

  function computeNextRun(cadence: TaskCadence, time: string, day?: number) {
    if (cadence === "weekday") return nextWeekday(time);
    if (cadence === "weekly") return nextWeekly(time, day ?? new Date().getDay());
    return nextDaily(time);
  }

  function createTask() {
    if (!taskName.trim() || !taskPrompt.trim()) {
      setNotice("Task needs a name and prompt.");
      return;
    }

    const createdAt = new Date();
    const dayOfWeek = taskCadence === "weekly" ? createdAt.getDay() : null;
    const nextRun = computeNextRun(taskCadence, taskTime, dayOfWeek ?? undefined);

    const task: Task = {
      id: nanoid(),
      name: taskName.trim(),
      prompt: taskPrompt.trim(),
      cadence: taskCadence,
      time: taskTime,
      mode: taskMode,
      sources: taskSources,
      createdAt: createdAt.toISOString(),
      nextRun: nextRun.toISOString(),
      lastRun: null,
      dayOfWeek,
      spaceId: activeSpace?.id ?? null,
      spaceName: activeSpace?.name ?? null,
    };

    setTasks((prev) => [task, ...prev]);
    setTaskName("");
    setTaskPrompt("");
    setNotice("Task created.");
  }

  async function runTask(task: Task) {
    if (taskRunningId) return;
    setTaskRunningId(task.id);
    setNotice("Running task...");

    try {
      const space = spaces.find((item) => item.id === task.spaceId) ?? null;
      const response = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: task.prompt,
          mode: task.mode,
          sources: task.sources,
          attachments: [],
          spaceInstructions: space?.instructions ?? "",
          spaceId: space?.id,
          spaceName: space?.name,
        }),
      });
      const data = (await response.json()) as AnswerResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Task run failed");
      }

      handleStreamDone(data);

      const nextRun = computeNextRun(
        task.cadence,
        task.time,
        task.dayOfWeek ?? undefined
      );
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id
            ? {
                ...item,
                lastRun: new Date().toISOString(),
                nextRun: nextRun.toISOString(),
              }
            : item
        )
      );
      setNotice("Task completed.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Task failed.");
    } finally {
      setTaskRunningId(null);
    }
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  }

  const displayAnswer = loading && streamingEnabled ? liveAnswer : current?.answer;

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
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs text-signal-muted">
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
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs text-signal-muted">
                    <div>
                      <p className="text-sm font-semibold text-signal-text">
                        Streaming
                      </p>
                      <p className="text-xs text-signal-muted">
                        Live answer tokens as they arrive.
                      </p>
                    </div>
                    <button
                      onClick={() => setStreamingEnabled((prev) => !prev)}
                      className={cn(
                        "rounded-full border px-4 py-1 text-xs transition",
                        streamingEnabled
                          ? "border-signal-accent text-signal-text"
                          : "border-white/10 text-signal-muted"
                      )}
                    >
                      {streamingEnabled ? "On" : "Off"}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs text-signal-muted">
                  <div>
                    <p className="text-sm font-semibold text-signal-text">
                      File search
                    </p>
                    <p className="text-xs text-signal-muted">
                      Auto-attach top matching library files.
                    </p>
                  </div>
                  <button
                    onClick={() => setFileSearchEnabled((prev) => !prev)}
                    className={cn(
                      "rounded-full border px-4 py-1 text-xs transition",
                      fileSearchEnabled
                        ? "border-signal-accent text-signal-text"
                        : "border-white/10 text-signal-muted"
                    )}
                  >
                    {fileSearchEnabled ? "On" : "Off"}
                  </button>
                </div>
              </div>

              {activeSpace ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-signal-muted">
                  <p className="text-sm font-semibold text-signal-text">
                    Active Space: {activeSpace.name}
                  </p>
                  <p className="mt-1 text-xs text-signal-muted">
                    {activeSpace.instructions || "No instructions set."}
                  </p>
                </div>
              ) : null}

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
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs"
                      >
                        Attach files
                      </button>
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        Files {attachments.length}/{MAX_ATTACHMENTS}
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={(event) => handleFiles(event.target.files)}
                    className="hidden"
                  />
                  {attachments.length ? (
                    <div className="mt-4 space-y-2">
                      {attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                        >
                          <div>
                            <p className="text-sm text-signal-text">
                              {file.name}
                            </p>
                            <p className="text-[11px] text-signal-muted">
                              {file.error ??
                                `${Math.round(file.size / 1024)} KB`}
                            </p>
                          </div>
                          <button
                            onClick={() => removeAttachment(file.id)}
                            className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
                {current?.spaceName ? (
                  <span className="rounded-full border border-white/10 px-3 py-1">
                    {current.spaceName}
                  </span>
                ) : null}
              </div>
            </div>
            {loading && mode === "research" ? (
              <div className="mt-4 space-y-2 text-xs text-signal-muted">
                {RESEARCH_STEPS.map((step, index) => {
                  const state =
                    index < researchStepIndex
                      ? "done"
                      : index === researchStepIndex
                        ? "active"
                        : "pending";
                  return (
                    <div
                      key={step}
                      className={cn(
                        "flex items-center justify-between rounded-2xl border px-3 py-2",
                        state === "active"
                          ? "border-signal-accent text-signal-text"
                          : "border-white/10"
                      )}
                    >
                      <span>{step}</span>
                      <span className="text-[11px] uppercase">{state}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="mt-4 space-y-4 text-sm leading-7 text-signal-text/90">
              {displayAnswer ? (
                displayAnswer
                  .split("\n\n")
                  .map((paragraph, index) => <p key={index}>{paragraph}</p>)
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
                <a
                  href={`/report?id=${current.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                >
                  Open report
                </a>
                <button
                  onClick={shareThread}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                >
                  Share link
                </button>
                <button
                  onClick={() => setShowDetails((prev) => !prev)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                >
                  {showDetails ? "Hide details" : "Source details"}
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
            {current && showDetails ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-signal-muted">
                <p className="text-xs uppercase tracking-[0.2em] text-signal-muted">
                  Answer details
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Provider
                    </p>
                    <p className="text-sm text-signal-text">{current.provider}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Mode
                    </p>
                    <p className="text-sm text-signal-text">{current.mode}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Sources
                    </p>
                    <p className="text-sm text-signal-text">
                      {current.sources === "web" ? "Web" : "Offline"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Latency
                    </p>
                    <p className="text-sm text-signal-text">
                      {current.latencyMs}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Attachments
                    </p>
                    <p className="text-sm text-signal-text">
                      {current.attachments.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Citations
                    </p>
                    <p className="text-sm text-signal-text">
                      {current.citations.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Space
                    </p>
                    <p className="text-sm text-signal-text">
                      {current.spaceName ?? "None"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Created
                    </p>
                    <p className="text-sm text-signal-text">
                      {new Date(current.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
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
            {selectedThreadIds.length ? (
              <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-signal-muted">
                <div className="flex items-center justify-between">
                  <span>{selectedThreadIds.length} selected</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllThreads}
                      className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                    >
                      Select all
                    </button>
                    <button
                      onClick={clearThreadSelection}
                      className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={bulkDeleteThreads}
                    className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                  >
                    Delete selected
                  </button>
                  <div className="flex items-center gap-2">
                    <select
                      value={bulkSpaceId}
                      onChange={(event) => setBulkSpaceId(event.target.value)}
                      className="w-full rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-signal-text"
                      disabled={!spaces.length}
                    >
                      <option value="">
                        {spaces.length ? "Assign to space" : "No spaces yet"}
                      </option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={bulkAssignSpace}
                      className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                      disabled={!spaces.length}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
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
                        {thread.spaceName ? (
                          <span className="rounded-full border border-white/10 px-2 py-0.5">
                            {thread.spaceName}
                          </span>
                        ) : null}
                        <span>{new Date(thread.createdAt).toLocaleString()}</span>
                      </div>
                    </button>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => toggleThreadSelection(thread.id)}
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px] transition",
                          selectedThreadIds.includes(thread.id)
                            ? "border-signal-accent text-signal-text"
                            : "border-white/10 text-signal-muted"
                        )}
                      >
                        {selectedThreadIds.includes(thread.id)
                          ? "Selected"
                          : "Select"}
                      </button>
                      <a
                        href={`/report?id=${thread.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                      >
                        Report
                      </a>
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
              Files
            </p>
            <p className="mt-2 text-sm text-signal-muted">
              Upload text files and include them as internal sources.
            </p>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => libraryInputRef.current?.click()}
                className="w-full rounded-full border border-white/10 px-4 py-2 text-xs text-signal-muted"
              >
                Add to library
              </button>
              <input
                ref={libraryInputRef}
                type="file"
                multiple
                onChange={(event) => handleLibraryUpload(event.target.files)}
                className="hidden"
              />
              <input
                value={fileSearchQuery}
                onChange={(event) => setFileSearchQuery(event.target.value)}
                placeholder="Filter files"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
              />
            </div>
            <div className="mt-4 space-y-2">
              {filteredFiles.length === 0 ? (
                <p className="text-xs text-signal-muted">No files yet.</p>
              ) : (
                filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-signal-text">
                        {file.name}
                      </span>
                      <button
                        onClick={() => toggleLibrarySelection(file.id)}
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px]",
                          selectedFileIds.includes(file.id)
                            ? "border-signal-accent text-signal-text"
                            : "border-white/10"
                        )}
                      >
                        {selectedFileIds.includes(file.id) ? "Using" : "Use"}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span>{Math.round(file.size / 1024)} KB</span>
                      <button
                        onClick={() => removeLibraryFile(file.id)}
                        className="rounded-full border border-white/10 px-2 py-1"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-signal-muted">
                      {file.text.slice(0, 120).replace(/\s+/g, " ").trim()}…
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
              Spaces
            </p>
            <p className="mt-2 text-sm text-signal-muted">
              Create focused workspaces with custom instructions and sources.
            </p>
            <div className="mt-4 space-y-2">
              <input
                value={spaceName}
                onChange={(event) => setSpaceName(event.target.value)}
                placeholder="Space name"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
              />
              <textarea
                value={spaceInstructions}
                onChange={(event) => setSpaceInstructions(event.target.value)}
                placeholder="Space instructions"
                className="h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
              />
              <button
                onClick={createSpace}
                className="w-full rounded-full border border-white/10 px-4 py-2 text-xs text-signal-muted"
              >
                Create space
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {spaces.length === 0 ? (
                <p className="text-xs text-signal-muted">No spaces yet.</p>
              ) : (
                spaces.map((space) => (
                  <div
                    key={space.id}
                    className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                  >
                    <button
                      onClick={() =>
                        setActiveSpaceId(
                          activeSpaceId === space.id ? null : space.id
                        )
                      }
                      className="flex w-full items-center justify-between"
                    >
                      <span className="text-sm text-signal-text">
                        {space.name}
                      </span>
                      <span>
                        {activeSpaceId === space.id ? "Active" : "Use"}
                      </span>
                    </button>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px]">
                        {space.instructions || "No instructions"}
                      </span>
                      <button
                        onClick={() => deleteSpace(space.id)}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-signal-surface/70 p-5 shadow-xl">
            <p className="text-sm uppercase tracking-[0.2em] text-signal-muted">
              Tasks
            </p>
            <p className="mt-2 text-sm text-signal-muted">
              Schedule recurring briefs and alerts.
            </p>
            <div className="mt-4 space-y-2">
              <input
                value={taskName}
                onChange={(event) => setTaskName(event.target.value)}
                placeholder="Task name"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
              />
              <textarea
                value={taskPrompt}
                onChange={(event) => setTaskPrompt(event.target.value)}
                placeholder="Task prompt"
                className="h-20 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
              />
              <div className="flex gap-2">
                <select
                  value={taskCadence}
                  onChange={(event) =>
                    setTaskCadence(event.target.value as TaskCadence)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text"
                >
                  {TASK_CADENCES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={taskTime}
                  onChange={(event) => setTaskTime(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={taskMode}
                  onChange={(event) =>
                    setTaskMode(event.target.value as AnswerMode)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text"
                >
                  {MODES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={taskSources}
                  onChange={(event) =>
                    setTaskSources(event.target.value as SourceMode)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text"
                >
                  {SOURCES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={createTask}
                className="w-full rounded-full border border-white/10 px-4 py-2 text-xs text-signal-muted"
              >
                Create task
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {tasks.length === 0 ? (
                <p className="text-xs text-signal-muted">No tasks yet.</p>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-signal-text">
                        {task.name}
                      </span>
                      <span className="text-[11px] uppercase">
                        {task.cadence}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px]">
                      <p>Next: {new Date(task.nextRun).toLocaleString()}</p>
                      {task.lastRun ? (
                        <p>Last: {new Date(task.lastRun).toLocaleString()}</p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => runTask(task)}
                        disabled={taskRunningId === task.id}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                      >
                        {taskRunningId === task.id ? "Running" : "Run now"}
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
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
