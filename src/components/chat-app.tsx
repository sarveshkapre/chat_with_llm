"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type {
  AnswerMode,
  AnswerResponse,
  SourceMode,
  Attachment,
} from "@/lib/types/answer";
import type { Space } from "@/lib/types/space";
import type { Task, TaskCadence } from "@/lib/types/task";
import type { LibraryFile } from "@/lib/types/file";
import type { Collection } from "@/lib/types/collection";
import { cn } from "@/lib/utils";
import {
  canReadAsText,
  readFileAsText,
  stripAttachmentText,
} from "@/lib/attachments";
import { searchLibraryFiles } from "@/lib/file-search";
import { Document, HeadingLevel, Packer, Paragraph } from "docx";
import { nanoid } from "nanoid";

type Feedback = "up" | "down" | null;

type Thread = AnswerResponse & {
  feedback?: Feedback;
  title?: string | null;
  pinned?: boolean;
  favorite?: boolean;
  collectionId?: string | null;
  tags?: string[];
  archived?: boolean;
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
const COLLECTIONS_KEY = "signal-collections-v1";
const NOTES_KEY = "signal-notes-v1";
const SEARCHES_KEY = "signal-saved-searches-v1";
const PINNED_SEARCHES_KEY = "signal-saved-searches-pinned-v1";
const RECENT_FILTERS_KEY = "signal-recent-filters-v1";

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
  const [bulkDuplicateSpaceId, setBulkDuplicateSpaceId] = useState("");
  const [spaceName, setSpaceName] = useState("");
  const [spaceInstructions, setSpaceInstructions] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [libraryCompact, setLibraryCompact] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sortByTag, setSortByTag] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionName, setCollectionName] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [bulkTagDraft, setBulkTagDraft] = useState("");
  const [savedSearches, setSavedSearches] = useState<
    {
      id: string;
      name: string;
      query: string;
      filterMode: AnswerMode | "all";
      favoritesOnly: boolean;
      pinnedOnly: boolean;
      collectionFilter: string;
      tagFilter: string;
      sort: "newest" | "oldest";
      sortByTag: boolean;
      createdAt: string;
    }[]
  >([]);
  const [savedSearchName, setSavedSearchName] = useState("");
  const [pinnedSearchIds, setPinnedSearchIds] = useState<string[]>([]);
  const [recentFilters, setRecentFilters] = useState<
    {
      id: string;
      signature: string;
      label: string;
      query: string;
      filterMode: AnswerMode | "all";
      favoritesOnly: boolean;
      pinnedOnly: boolean;
      archivedOnly: boolean;
      collectionFilter: string;
      tagFilter: string;
      sort: "newest" | "oldest";
      sortByTag: boolean;
      createdAt: string;
      pinned?: boolean;
    }[]
  >([]);
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
        const normalized = parsed.map((thread) => ({
          ...thread,
          title: thread.title ?? thread.question,
          pinned: thread.pinned ?? false,
          favorite: thread.favorite ?? false,
          collectionId: thread.collectionId ?? null,
          tags: thread.tags ?? [],
          archived: thread.archived ?? false,
        }));
        setThreads(normalized);
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

    const collectionStore = localStorage.getItem(COLLECTIONS_KEY);
    if (collectionStore) {
      try {
        const parsed = JSON.parse(collectionStore) as Collection[];
        setCollections(parsed);
      } catch {
        setCollections([]);
      }
    }

    const notesStore = localStorage.getItem(NOTES_KEY);
    if (notesStore) {
      try {
        const parsed = JSON.parse(notesStore) as Record<string, string>;
        setNotes(parsed);
      } catch {
        setNotes({});
      }
    }

    const searchStore = localStorage.getItem(SEARCHES_KEY);
    if (searchStore) {
      try {
        const parsed = JSON.parse(searchStore) as typeof savedSearches;
        setSavedSearches(parsed);
      } catch {
        setSavedSearches([]);
      }
    }

    const pinnedSearchStore = localStorage.getItem(PINNED_SEARCHES_KEY);
    if (pinnedSearchStore) {
      try {
        const parsed = JSON.parse(pinnedSearchStore) as string[];
        setPinnedSearchIds(parsed);
      } catch {
        setPinnedSearchIds([]);
      }
    }

    const recentStore = localStorage.getItem(RECENT_FILTERS_KEY);
    if (recentStore) {
      try {
        const parsed = JSON.parse(recentStore) as typeof recentFilters;
        const normalized = parsed.map((item) => ({
          ...item,
          pinned: item.pinned ?? false,
        }));
        setRecentFilters(normalized);
      } catch {
        setRecentFilters([]);
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
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
  }, [collections]);

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(SEARCHES_KEY, JSON.stringify(savedSearches));
  }, [savedSearches]);

  useEffect(() => {
    localStorage.setItem(
      PINNED_SEARCHES_KEY,
      JSON.stringify(pinnedSearchIds)
    );
  }, [pinnedSearchIds]);

  useEffect(() => {
    localStorage.setItem(RECENT_FILTERS_KEY, JSON.stringify(recentFilters));
  }, [recentFilters]);

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
    const collectionId = params.get("collection");
    const tag = params.get("tag");
    if (threadId) {
      const match = threads.find((thread) => thread.id === threadId);
      if (match) {
        setCurrent(match);
      } else if (threads.length) {
        setNotice("Shared thread not found in this browser library.");
      }
    }
    if (collectionId) {
      setCollectionFilter(collectionId);
    }
    if (tag) {
      setTagFilter(tag);
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
        !normalized ||
        thread.question.toLowerCase().includes(normalized) ||
        (thread.title ?? "").toLowerCase().includes(normalized) ||
        (thread.tags ?? []).some((tagItem) =>
          tagItem.toLowerCase().includes(normalized)
        );
      const matchesFavorite = !favoritesOnly || thread.favorite;
      const matchesPinned = !pinnedOnly || thread.pinned;
      const matchesArchived = archivedOnly ? thread.archived : !thread.archived;
      const matchesCollection =
        !collectionFilter || thread.collectionId === collectionFilter;
      const matchesTag = !tagFilter || thread.tags?.includes(tagFilter);
      return (
        matchesMode &&
        matchesSearch &&
        matchesFavorite &&
        matchesPinned &&
        matchesArchived &&
        matchesCollection &&
        matchesTag
      );
    });

    return filtered.sort((a, b) => {
      if ((a.pinned ?? false) !== (b.pinned ?? false)) {
        return a.pinned ? -1 : 1;
      }
      if (sortByTag && tagFilter) {
        const hasTagA = (a.tags ?? []).includes(tagFilter);
        const hasTagB = (b.tags ?? []).includes(tagFilter);
        if (hasTagA !== hasTagB) {
          return hasTagA ? -1 : 1;
        }
      }
      const left = new Date(a.createdAt).getTime();
      const right = new Date(b.createdAt).getTime();
      return sort === "newest" ? right - left : left - right;
    });
  }, [
    threads,
    search,
    filterMode,
    sort,
    favoritesOnly,
    pinnedOnly,
    archivedOnly,
    collectionFilter,
    tagFilter,
    sortByTag,
  ]);

  const filteredFiles = useMemo(() => {
    const normalized = fileSearchQuery.trim().toLowerCase();
    if (!normalized) return libraryFiles;
    return libraryFiles.filter((file) =>
      file.name.toLowerCase().includes(normalized)
    );
  }, [libraryFiles, fileSearchQuery]);

  const tagOptions = useMemo(() => {
    const counter = new Map<string, number>();
    threads.forEach((thread) => {
      (thread.tags ?? []).forEach((tag) => {
        counter.set(tag, (counter.get(tag) ?? 0) + 1);
      });
    });
    return Array.from(counter.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [threads]);

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
      title: data.question,
      pinned: false,
      favorite: false,
      collectionId: null,
      tags: [],
      archived: false,
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

  function buildExportHtml(answer: Thread) {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${answer.title ?? answer.question}</title>
<style>
body { font-family: ui-sans-serif, system-ui; margin: 40px; color: #0f172a; }
header { margin-bottom: 24px; }
section { margin-bottom: 16px; }
small { color: #64748b; }
</style>
</head>
<body>
<header>
<h1>${answer.title ?? answer.question}</h1>
<small>Mode: ${answer.mode} · Sources: ${answer.sources === "web" ? "Web" : "Offline"}</small>
</header>
${answer.answer
  .split("\n\n")
  .map((paragraph) => `<section>${paragraph}</section>`)
  .join("\n")}
<h2>Sources</h2>
<ul>
${answer.citations
  .map((citation) => `<li><a href="${citation.url}">${citation.title}</a></li>`)
  .join("\n")}
</ul>
</body>
</html>`;
  }

  function exportMarkdown() {
    if (!current) return;
    const lines = [
      `# ${current.title ?? current.question}`,
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

  async function exportDocx() {
    if (!current) return;
    const paragraphs = current.answer
      .split("\n\n")
      .map((paragraph) => new Paragraph(paragraph));

    const citationParagraphs = current.citations.length
      ? current.citations.map(
          (citation, index) =>
            new Paragraph(`${index + 1}. ${citation.title} (${citation.url})`)
        )
      : [new Paragraph("No citations.")];

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: current.title ?? current.question,
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph(
              `Mode: ${current.mode} · Sources: ${
                current.sources === "web" ? "Web" : "Offline"
              }`
            ),
            ...paragraphs,
            new Paragraph({
              text: "Sources",
              heading: HeadingLevel.HEADING_2,
            }),
            ...citationParagraphs,
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signal-search-${current.id}.docx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    if (!current) return;
    const html = buildExportHtml(current);
    const popup = window.open("", "_blank");
    if (!popup) {
      setNotice("Pop-up blocked. Allow pop-ups to print PDF.");
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.print();
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

  function startRenameThread(thread: Thread) {
    setEditingThreadId(thread.id);
    setEditingTitle(thread.title ?? thread.question);
  }

  function saveRenameThread(id: string) {
    if (!editingTitle.trim()) {
      setNotice("Title cannot be empty.");
      return;
    }
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id ? { ...thread, title: editingTitle.trim() } : thread
      )
    );
    if (current?.id === id) {
      setCurrent((prev) =>
        prev ? { ...prev, title: editingTitle.trim() } : prev
      );
    }
    setEditingThreadId(null);
    setEditingTitle("");
  }

  function cancelRenameThread() {
    setEditingThreadId(null);
    setEditingTitle("");
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

  function toggleArchive(id: string, next?: boolean) {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id
          ? { ...thread, archived: next ?? !thread.archived }
          : thread
      )
    );
    if (current?.id === id) {
      setCurrent((prev) =>
        prev
          ? { ...prev, archived: next ?? !prev.archived }
          : prev
      );
    }
  }

  function bulkArchive(next: boolean) {
    if (!selectedThreadIds.length) return;
    setThreads((prev) =>
      prev.map((thread) =>
        selectedThreadIds.includes(thread.id)
          ? { ...thread, archived: next }
          : thread
      )
    );
    if (current && selectedThreadIds.includes(current.id)) {
      setCurrent((prev) => (prev ? { ...prev, archived: next } : prev));
    }
    setNotice(next ? "Threads archived." : "Threads unarchived.");
  }

  function togglePin(id: string) {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id ? { ...thread, pinned: !thread.pinned } : thread
      )
    );
    if (current?.id === id) {
      setCurrent((prev) =>
        prev ? { ...prev, pinned: !prev.pinned } : prev
      );
    }
  }

  function toggleFavorite(id: string) {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id ? { ...thread, favorite: !thread.favorite } : thread
      )
    );
    if (current?.id === id) {
      setCurrent((prev) =>
        prev ? { ...prev, favorite: !prev.favorite } : prev
      );
    }
  }

  function assignCollection(id: string, collectionId: string | null) {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id ? { ...thread, collectionId } : thread
      )
    );
    if (current?.id === id) {
      setCurrent((prev) => (prev ? { ...prev, collectionId } : prev));
    }
  }

  function startTagEdit(threadId: string) {
    setEditingTagsId(threadId);
    setTagDraft("");
  }

  function addTags(threadId: string) {
    const nextTags = tagDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    if (!nextTags.length) {
      setNotice("Enter a tag.");
      return;
    }

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        const existing = thread.tags ?? [];
        const merged = [...existing];
        nextTags.forEach((tag) => {
          if (!merged.some((item) => item.toLowerCase() === tag.toLowerCase())) {
            merged.push(tag);
          }
        });
        return { ...thread, tags: merged };
      })
    );

    if (current?.id === threadId) {
      setCurrent((prev) => {
        if (!prev) return prev;
        const existing = prev.tags ?? [];
        const merged = [...existing];
        nextTags.forEach((tag) => {
          if (!merged.some((item) => item.toLowerCase() === tag.toLowerCase())) {
            merged.push(tag);
          }
        });
        return { ...prev, tags: merged };
      });
    }

    setEditingTagsId(null);
    setTagDraft("");
  }

  function removeTag(threadId: string, tag: string) {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              tags: (thread.tags ?? []).filter((item) => item !== tag),
            }
          : thread
      )
    );
    if (current?.id === threadId) {
      setCurrent((prev) =>
        prev
          ? {
              ...prev,
              tags: (prev.tags ?? []).filter((item) => item !== tag),
            }
          : prev
      );
    }
  }

  function cancelTagEdit() {
    setEditingTagsId(null);
    setTagDraft("");
  }

  function bulkAddTags() {
    const nextTags = bulkTagDraft
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    if (!selectedThreadIds.length) return;
    if (!nextTags.length) {
      setNotice("Enter tags to add.");
      return;
    }

    setThreads((prev) =>
      prev.map((thread) => {
        if (!selectedThreadIds.includes(thread.id)) return thread;
        const existing = thread.tags ?? [];
        const merged = [...existing];
        nextTags.forEach((tag) => {
          if (!merged.some((item) => item.toLowerCase() === tag.toLowerCase())) {
            merged.push(tag);
          }
        });
        return { ...thread, tags: merged };
      })
    );

    if (current && selectedThreadIds.includes(current.id)) {
      setCurrent((prev) => {
        if (!prev) return prev;
        const existing = prev.tags ?? [];
        const merged = [...existing];
        nextTags.forEach((tag) => {
          if (!merged.some((item) => item.toLowerCase() === tag.toLowerCase())) {
            merged.push(tag);
          }
        });
        return { ...prev, tags: merged };
      });
    }

    setBulkTagDraft("");
    setNotice("Tags added to selected threads.");
  }

  function saveSearch() {
    const name = savedSearchName.trim();
    if (!name) {
      setNotice("Saved search needs a name.");
      return;
    }
    const entry = {
      id: nanoid(),
      name,
      query: search.trim(),
      filterMode,
      favoritesOnly,
      pinnedOnly,
      collectionFilter,
      tagFilter,
      sort,
      sortByTag,
      createdAt: new Date().toISOString(),
    };
    setSavedSearches((prev) => [entry, ...prev]);
    setSavedSearchName("");
    setNotice("Saved search created.");
  }

  function applySavedSearch(id: string) {
    const entry = savedSearches.find((item) => item.id === id);
    if (!entry) return;
    setSearch(entry.query);
    setFilterMode(entry.filterMode);
    setFavoritesOnly(entry.favoritesOnly);
    setPinnedOnly(entry.pinnedOnly);
    setCollectionFilter(entry.collectionFilter);
    setTagFilter(entry.tagFilter);
    setSort(entry.sort);
    setSortByTag(entry.sortByTag);
    setNotice(`Applied ${entry.name}.`);
  }

  function deleteSavedSearch(id: string) {
    setSavedSearches((prev) => prev.filter((item) => item.id !== id));
  }

  function togglePinnedSearch(id: string) {
    setPinnedSearchIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        search: search.trim(),
        filterMode,
        favoritesOnly,
        pinnedOnly,
        archivedOnly,
        collectionFilter,
        tagFilter,
        sort,
        sortByTag,
      }),
    [
      search,
      filterMode,
      favoritesOnly,
      pinnedOnly,
      archivedOnly,
      collectionFilter,
      tagFilter,
      sort,
      sortByTag,
    ]
  );

  useEffect(() => {
    const labelParts = [
      filterMode !== "all" ? filterMode : null,
      favoritesOnly ? "favorites" : null,
      pinnedOnly ? "pinned" : null,
      archivedOnly ? "archived" : null,
      collectionFilter ? "collection" : null,
      tagFilter ? `#${tagFilter}` : null,
      search.trim() ? `"${search.trim()}"` : null,
    ].filter(Boolean) as string[];

    const entry = {
      id: nanoid(),
      signature: filterSignature,
      label: labelParts.length ? labelParts.join(" · ") : "All threads",
      query: search.trim(),
      filterMode,
      favoritesOnly,
      pinnedOnly,
      archivedOnly,
      collectionFilter,
      tagFilter,
      sort,
      sortByTag,
      createdAt: new Date().toISOString(),
      pinned: false,
    };

    setRecentFilters((prev) => {
      if (prev[0]?.signature === entry.signature) return prev;
      const filtered = prev.filter((item) => item.signature !== entry.signature);
      const next = [entry, ...filtered].slice(0, 5);
      const pinned = next.filter((item) => item.pinned);
      const unpinned = next.filter((item) => !item.pinned);
      return [...pinned, ...unpinned].slice(0, 5);
    });
  }, [
    filterSignature,
    search,
    filterMode,
    favoritesOnly,
    pinnedOnly,
    archivedOnly,
    collectionFilter,
    tagFilter,
    sort,
    sortByTag,
  ]);

  function exportFilteredLibrary() {
    const lines: string[] = [
      "# Signal Search Library Export",
      "",
      `Query: ${search || "None"}`,
      `Mode: ${filterMode}`,
      `Favorites: ${favoritesOnly ? "Yes" : "No"}`,
      `Pinned: ${pinnedOnly ? "Yes" : "No"}`,
      `Archived: ${archivedOnly ? "Yes" : "No"}`,
      `Collection: ${collectionFilter || "All"}`,
      `Tag: ${tagFilter || "All"}`,
      `Sort: ${sort}${sortByTag ? " + tag" : ""}`,
      "",
      `Total threads: ${filteredThreads.length}`,
      "",
      "## Threads",
      ...filteredThreads.map((thread, index) => {
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
    anchor.download = `signal-library-export-${Date.now()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function archiveFilteredThreads(next = true) {
    if (!filteredThreads.length) return;
    setThreads((prev) =>
      prev.map((thread) =>
        filteredThreads.some((item) => item.id === thread.id)
          ? { ...thread, archived: next }
          : thread
      )
    );
    if (current && filteredThreads.some((item) => item.id === current.id)) {
      setCurrent((prev) => (prev ? { ...prev, archived: next } : prev));
    }
    setNotice(
      next
        ? `Archived ${filteredThreads.length} threads.`
        : `Unarchived ${filteredThreads.length} threads.`
    );
  }

  function bumpThread(id: string) {
    const now = new Date().toISOString();
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === id ? { ...thread, createdAt: now } : thread
      )
    );
    if (current?.id === id) {
      setCurrent((prev) => (prev ? { ...prev, createdAt: now } : prev));
    }
    setNotice("Thread bumped.");
  }

  function duplicateThread(thread: Thread) {
    const copy: Thread = {
      ...thread,
      id: nanoid(),
      createdAt: new Date().toISOString(),
      question: `${thread.question} (copy)`,
      title: `${thread.title ?? thread.question} (copy)`,
      feedback: null,
    };
    setThreads((prev) => [copy, ...prev]);
    setCurrent(copy);
    setNotice("Thread duplicated.");
  }

  function duplicateThreadToSpace(thread: Thread, spaceId: string | null) {
    const space = spaces.find((item) => item.id === spaceId) ?? null;
    const copy: Thread = {
      ...thread,
      id: nanoid(),
      createdAt: new Date().toISOString(),
      question: `${thread.question} (copy)`,
      title: `${thread.title ?? thread.question} (copy)`,
      feedback: null,
      spaceId: space?.id ?? null,
      spaceName: space?.name ?? null,
    };
    setThreads((prev) => [copy, ...prev]);
    setCurrent(copy);
    setNotice(
      space ? `Duplicated into ${space.name}.` : "Thread duplicated."
    );
  }

  function bulkDuplicate(spaceId: string | null) {
    if (!selectedThreadIds.length) return;
    const space = spaces.find((item) => item.id === spaceId) ?? null;
    const copies = threads
      .filter((thread) => selectedThreadIds.includes(thread.id))
      .map((thread) => ({
        ...thread,
        id: nanoid(),
        createdAt: new Date().toISOString(),
        question: `${thread.question} (copy)`,
        title: `${thread.title ?? thread.question} (copy)`,
        feedback: null,
        spaceId: space?.id ?? null,
        spaceName: space?.name ?? null,
      }));
    if (!copies.length) return;
    setThreads((prev) => [...copies, ...prev]);
    setNotice(
      space
        ? `Duplicated ${copies.length} threads into ${space.name}.`
        : `Duplicated ${copies.length} threads.`
    );
  }

  function applyRecentFilter(item: (typeof recentFilters)[number]) {
    setSearch(item.query);
    setFilterMode(item.filterMode);
    setFavoritesOnly(item.favoritesOnly);
    setPinnedOnly(item.pinnedOnly);
    setArchivedOnly(item.archivedOnly);
    setCollectionFilter(item.collectionFilter);
    setTagFilter(item.tagFilter);
    setSort(item.sort);
    setSortByTag(item.sortByTag);
    setNotice("Applied recent filter.");
  }

  function togglePinRecentFilter(id: string) {
    setRecentFilters((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, pinned: !item.pinned } : item
        )
        .sort((a, b) => Number(b.pinned) - Number(a.pinned))
    );
  }

  function deleteRecentFilter(id: string) {
    setRecentFilters((prev) => prev.filter((item) => item.id !== id));
  }

  function startNoteEdit(threadId: string) {
    setEditingNoteId(threadId);
    setNoteDraft(notes[threadId] ?? "");
  }

  function saveNote(threadId: string) {
    if (!noteDraft.trim()) {
      setNotice("Note cannot be empty.");
      return;
    }
    setNotes((prev) => ({ ...prev, [threadId]: noteDraft.trim() }));
    setEditingNoteId(null);
    setNoteDraft("");
  }

  function clearNote(threadId: string) {
    setNotes((prev) => {
      const next = { ...prev };
      delete next[threadId];
      return next;
    });
    setEditingNoteId(null);
    setNoteDraft("");
  }

  function cancelNoteEdit() {
    setEditingNoteId(null);
    setNoteDraft("");
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
    if (collectionFilter === id) {
      setCollectionFilter("");
    }
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
          {pinnedSearchIds.length ? (
            <div className="flex items-center gap-2">
              {pinnedSearchIds
                .map((id) => savedSearches.find((item) => item.id === id))
                .filter(Boolean)
                .slice(0, 3)
                .map((item) => (
                  <button
                    key={item?.id}
                    onClick={() => item && applySavedSearch(item.id)}
                    className="rounded-full border border-white/10 px-3 py-1 text-xs"
                  >
                    {item?.name}
                  </button>
                ))}
            </div>
          ) : null}
          <Link
            href="/collections"
            className="rounded-full border border-white/10 px-3 py-1"
          >
            Collections
          </Link>
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
                <button
                  onClick={exportDocx}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                >
                  Export DOCX
                </button>
                <button
                  onClick={exportPdf}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-signal-text transition hover:border-signal-accent"
                >
                  Export PDF
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
                <button
                  onClick={() => togglePin(current.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    current.pinned
                      ? "border-signal-accent text-signal-text"
                      : "border-white/10 text-signal-muted"
                  )}
                >
                  {current.pinned ? "Pinned" : "Pin"}
                </button>
                <button
                  onClick={() => toggleFavorite(current.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    current.favorite
                      ? "border-signal-accent text-signal-text"
                      : "border-white/10 text-signal-muted"
                  )}
                >
                  {current.favorite ? "Favorited" : "Favorite"}
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
                      Tags
                    </p>
                    <p className="text-sm text-signal-text">
                      {(current.tags ?? []).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Note
                    </p>
                    <p className="text-sm text-signal-text">
                      {notes[current.id] ? "Yes" : "No"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase text-signal-muted">
                      Archived
                    </p>
                    <p className="text-sm text-signal-text">
                      {current.archived ? "Yes" : "No"}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFavoritesOnly((prev) => !prev)}
                  className={cn(
                    "w-full rounded-full border px-3 py-2 text-xs transition",
                    favoritesOnly
                      ? "border-signal-accent text-signal-text"
                      : "border-white/10 text-signal-muted"
                  )}
                >
                  Favorites
                </button>
                <button
                  onClick={() => setPinnedOnly((prev) => !prev)}
                  className={cn(
                    "w-full rounded-full border px-3 py-2 text-xs transition",
                    pinnedOnly
                      ? "border-signal-accent text-signal-text"
                      : "border-white/10 text-signal-muted"
                  )}
                >
                  Pinned
                </button>
              </div>
              <button
                onClick={() => setArchivedOnly((prev) => !prev)}
                className={cn(
                  "w-full rounded-full border px-3 py-2 text-xs transition",
                  archivedOnly
                    ? "border-signal-accent text-signal-text"
                    : "border-white/10 text-signal-muted"
                )}
              >
                Archived
              </button>
              <button
                onClick={() => setSortByTag((prev) => !prev)}
                className={cn(
                  "w-full rounded-full border px-3 py-2 text-xs transition",
                  sortByTag
                    ? "border-signal-accent text-signal-text"
                    : "border-white/10 text-signal-muted"
                )}
              >
                Sort by tag
              </button>
              <select
                value={collectionFilter}
                onChange={(event) => setCollectionFilter(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text"
              >
                <option value="">All collections</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setLibraryCompact((prev) => !prev)}
                className="w-full rounded-full border border-white/10 px-3 py-2 text-xs text-signal-muted"
              >
                {libraryCompact ? "Expanded view" : "Compact view"}
              </button>
              <button
                onClick={exportFilteredLibrary}
                className="w-full rounded-full border border-white/10 px-3 py-2 text-xs text-signal-muted"
              >
                Export filtered view
              </button>
              <button
                onClick={() => archiveFilteredThreads(!archivedOnly)}
                className="w-full rounded-full border border-white/10 px-3 py-2 text-xs text-signal-muted"
              >
                {archivedOnly ? "Unarchive filtered" : "Archive filtered"}
              </button>
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
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      bulkArchive(
                        !selectedThreadIds.every(
                          (id) =>
                            threads.find((thread) => thread.id === id)
                              ?.archived
                        )
                      )
                    }
                    className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                  >
                    {selectedThreadIds.every(
                      (id) =>
                        threads.find((thread) => thread.id === id)?.archived
                    )
                      ? "Unarchive selected"
                      : "Archive selected"}
                  </button>
                  <button
                    onClick={bulkDeleteThreads}
                    className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                  >
                    Delete selected
                  </button>
                </div>
                <div className="flex flex-col gap-2">
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
                  <div className="flex items-center gap-2">
                    <select
                      value={bulkDuplicateSpaceId}
                      onChange={(event) =>
                        setBulkDuplicateSpaceId(event.target.value)
                      }
                      className="w-full rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-signal-text"
                      disabled={!spaces.length}
                    >
                      <option value="">
                        {spaces.length
                          ? "Duplicate to space"
                          : "No spaces yet"}
                      </option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        bulkDuplicate(bulkDuplicateSpaceId || null)
                      }
                      className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                      disabled={!spaces.length}
                    >
                      Duplicate
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={bulkTagDraft}
                      onChange={(event) => setBulkTagDraft(event.target.value)}
                      placeholder="Add tags (comma separated)"
                      className="w-full rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-signal-text outline-none"
                    />
                    <button
                      onClick={bulkAddTags}
                      className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {collections.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {collections.map((collection) => {
                  const count = threads.filter(
                    (thread) => thread.collectionId === collection.id
                  ).length;
                  return (
                    <button
                      key={collection.id}
                      onClick={() =>
                        setCollectionFilter((prev) =>
                          prev === collection.id ? "" : collection.id
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] transition",
                        collectionFilter === collection.id
                          ? "border-signal-accent text-signal-text"
                          : "border-white/10 text-signal-muted"
                      )}
                    >
                      {collection.name} · {count}
                    </button>
                  );
                })}
              </div>
            ) : null}
            {tagOptions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {tagOptions.map(({ tag, count }) => (
                  <button
                    key={tag}
                    onClick={() =>
                      setTagFilter((prev) => (prev === tag ? "" : tag))
                    }
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] transition",
                      tagFilter === tag
                        ? "border-signal-accent text-signal-text"
                        : "border-white/10 text-signal-muted"
                    )}
                  >
                    #{tag} · {count}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-signal-muted">
              <p className="text-xs uppercase tracking-[0.2em] text-signal-muted">
                Saved searches
              </p>
              <div className="mt-3 space-y-2">
                <input
                  value={savedSearchName}
                  onChange={(event) => setSavedSearchName(event.target.value)}
                  placeholder="Name this filter"
                  className="w-full rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-signal-text outline-none"
                />
                <button
                  onClick={saveSearch}
                  className="w-full rounded-full border border-white/10 px-3 py-2 text-[11px]"
                >
                  Save current filter
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {savedSearches.length === 0 ? (
                  <p className="text-[11px] text-signal-muted">
                    No saved searches yet.
                  </p>
                ) : (
                  savedSearches.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 px-3 py-2 text-[11px] text-signal-muted"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-signal-text">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => togglePinnedSearch(item.id)}
                            className={cn(
                              "rounded-full border px-2 py-1 text-[11px]",
                              pinnedSearchIds.includes(item.id)
                                ? "border-signal-accent text-signal-text"
                                : "border-white/10"
                            )}
                          >
                            {pinnedSearchIds.includes(item.id) ? "Pinned" : "Pin"}
                          </button>
                          <button
                            onClick={() => deleteSavedSearch(item.id)}
                            className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px]">
                        {item.query ? `Query: ${item.query}` : "No query"}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => applySavedSearch(item.id)}
                          className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                        >
                          Apply
                        </button>
                        <span>
                          {item.filterMode} · {item.sort}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-signal-muted">
                  Recent filters
                </p>
                <div className="mt-2 space-y-2">
                  {recentFilters.length === 0 ? (
                    <p className="text-[11px] text-signal-muted">
                      No recent filters.
                    </p>
                  ) : (
                    recentFilters.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 px-3 py-2 text-[11px] text-signal-muted"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-signal-text">
                            {item.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePinRecentFilter(item.id)}
                              className={cn(
                                "rounded-full border px-2 py-1 text-[11px]",
                                item.pinned
                                  ? "border-signal-accent text-signal-text"
                                  : "border-white/10"
                              )}
                            >
                              {item.pinned ? "Pinned" : "Pin"}
                            </button>
                            <button
                              onClick={() => deleteRecentFilter(item.id)}
                              className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px]">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                        <button
                          onClick={() => applyRecentFilter(item)}
                          className="mt-2 rounded-full border border-white/10 px-2 py-1 text-[11px]"
                        >
                          Apply
                        </button>
                      </div>
                    ))
                  )}
                </div>
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
                    className={cn(
                      "rounded-2xl border border-white/10 text-left text-xs text-signal-text",
                      libraryCompact ? "p-2" : "p-3"
                    )}
                  >
                    <button
                      onClick={() => setCurrent(thread)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                        {thread.title ?? thread.question}
                      </p>
                      {libraryCompact ? (
                        <p className="mt-1 text-[11px] text-signal-muted">
                          {new Date(thread.createdAt).toLocaleString()} ·{" "}
                          {thread.mode}
                        </p>
                      ) : (
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
                          <span>
                            {new Date(thread.createdAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </button>
                    {editingThreadId === thread.id ? (
                      <div className="mt-3 space-y-2">
                        <input
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          className="w-full rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => saveRenameThread(thread.id)}
                            className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelRenameThread}
                            className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
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
                      <button
                        onClick={() => togglePin(thread.id)}
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px] transition",
                          thread.pinned
                            ? "border-signal-accent text-signal-text"
                            : "border-white/10 text-signal-muted"
                        )}
                      >
                        {thread.pinned ? "Pinned" : "Pin"}
                      </button>
                      <button
                        onClick={() => toggleFavorite(thread.id)}
                        className={cn(
                          "rounded-full border px-2 py-1 text-[11px] transition",
                          thread.favorite
                            ? "border-signal-accent text-signal-text"
                            : "border-white/10 text-signal-muted"
                        )}
                      >
                        {thread.favorite ? "Favorited" : "Favorite"}
                      </button>
                      <button
                        onClick={() => startRenameThread(thread)}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                      >
                        Rename
                      </button>
                      <select
                        value={thread.collectionId ?? ""}
                        onChange={(event) =>
                          assignCollection(
                            thread.id,
                            event.target.value ? event.target.value : null
                          )
                        }
                        className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-signal-text"
                      >
                        <option value="">No collection</option>
                        {collections.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.name}
                          </option>
                        ))}
                      </select>
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
                      <button
                        onClick={() =>
                          toggleArchive(thread.id, !thread.archived)
                        }
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                      >
                        {thread.archived ? "Unarchive" : "Archive"}
                      </button>
                      <button
                        onClick={() => bumpThread(thread.id)}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                      >
                        Bump
                      </button>
                      <button
                        onClick={() => duplicateThread(thread)}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                      >
                        Duplicate
                      </button>
                      <select
                        onChange={(event) => {
                          const value = event.target.value;
                          if (!value) return;
                          duplicateThreadToSpace(thread, value);
                          event.currentTarget.selectedIndex = 0;
                        }}
                        className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-signal-text"
                      >
                        <option value="">Duplicate to space</option>
                        {spaces.map((space) => (
                          <option key={space.id} value={space.id}>
                            {space.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-signal-muted">
                      <div className="flex flex-wrap gap-2">
                        {(thread.tags ?? []).length ? (
                          (thread.tags ?? []).map((tag) => (
                            <button
                              key={`${thread.id}-${tag}`}
                              onClick={() => removeTag(thread.id, tag)}
                              className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                            >
                              #{tag} ×
                            </button>
                          ))
                        ) : (
                          <span>No tags</span>
                        )}
                      </div>
                      {editingTagsId === thread.id ? (
                        <div className="mt-2 space-y-2">
                          <input
                            value={tagDraft}
                            onChange={(event) => setTagDraft(event.target.value)}
                            placeholder="Add tags (comma separated)"
                            className="w-full rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-signal-text outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => addTags(thread.id)}
                              className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                            >
                              Add tags
                            </button>
                            <button
                              onClick={cancelTagEdit}
                              className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startTagEdit(thread.id)}
                          className="mt-2 rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                        >
                          Add tags
                        </button>
                      )}
                    </div>
                    <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-signal-muted">
                      {editingNoteId === thread.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={noteDraft}
                            onChange={(event) => setNoteDraft(event.target.value)}
                            className="h-20 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-signal-text outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => saveNote(thread.id)}
                              className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                            >
                              Save note
                            </button>
                            <button
                              onClick={() => clearNote(thread.id)}
                              className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                            >
                              Clear
                            </button>
                            <button
                              onClick={cancelNoteEdit}
                              className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-signal-muted"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startNoteEdit(thread.id)}
                          className="w-full text-left"
                        >
                          {notes[thread.id]
                            ? notes[thread.id]
                            : "Add a note"}
                        </button>
                      )}
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
              Collections
            </p>
            <p className="mt-2 text-sm text-signal-muted">
              Group threads into lightweight collections.
            </p>
            <div className="mt-4 space-y-2">
              <input
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                placeholder="Collection name"
                className="w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-signal-text outline-none placeholder:text-signal-muted"
              />
              <button
                onClick={createCollection}
                className="w-full rounded-full border border-white/10 px-4 py-2 text-xs text-signal-muted"
              >
                Create collection
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {collections.length === 0 ? (
                <p className="text-xs text-signal-muted">No collections yet.</p>
              ) : (
                collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-signal-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-signal-text">
                        {collection.name}
                      </span>
                      <button
                        onClick={() => deleteCollection(collection.id)}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px]"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-signal-muted">
                      {new Date(collection.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
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
