import type { AnswerResponse, SourceMode, AnswerMode } from "@/lib/types/answer";
import type { Collection } from "@/lib/types/collection";
import type { LibraryFile } from "@/lib/types/file";
import type { Space } from "@/lib/types/space";
import type { Task, TaskCadence } from "@/lib/types/task";

export type DeterministicUnifiedSearchThread = AnswerResponse & {
  title?: string | null;
  tags?: string[];
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
};

export type DeterministicUnifiedSearchDataset = {
  threads: DeterministicUnifiedSearchThread[];
  spaces: Space[];
  spaceTags: Record<string, string[]>;
  collections: Collection[];
  files: LibraryFile[];
  tasks: Task[];
  notes: Record<string, string>;
  nowMs: number;
  nowIso: string;
};

export type DeterministicUnifiedSearchDatasetOptions = {
  totalItems: number;
  nowMs?: number;
  idPrefix?: string;
};

type DeterministicUnifiedSearchCounts = {
  threadCount: number;
  spaceCount: number;
  collectionCount: number;
  fileCount: number;
  taskCount: number;
};

const SPACE_POLICIES: Array<Space["sourcePolicy"]> = ["web", "flex", "offline"];
const TASK_CADENCES: TaskCadence[] = [
  "daily",
  "weekday",
  "weekly",
  "monthly",
  "yearly",
];
const BASELINE_QUERY_PHRASE = "incident research workflow citation keyboard";

function toPositiveInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  if (rounded <= 0) return fallback;
  return rounded;
}

function deterministicOffsetMs(index: number, totalItems: number): number {
  const windowMs = 45 * 24 * 60 * 60 * 1000;
  return (((index + 1) * 104_729 + totalItems * 8_191) % windowMs) + 1;
}

function buildTimestamp(index: number, totalItems: number, nowMs: number): {
  createdAt: string;
  createdMs: number;
} {
  const createdMs = nowMs - deterministicOffsetMs(index, totalItems);
  return { createdAt: new Date(createdMs).toISOString(), createdMs };
}

export function splitDeterministicUnifiedSearchCounts(
  totalItemsRaw: number
): DeterministicUnifiedSearchCounts {
  const totalItems = Math.max(5, toPositiveInteger(totalItemsRaw, 5));
  const threadCount = Math.max(1, Math.floor(totalItems * 0.48));
  const spaceCount = Math.max(1, Math.floor(totalItems * 0.16));
  const collectionCount = Math.max(1, Math.floor(totalItems * 0.12));
  const fileCount = Math.max(1, Math.floor(totalItems * 0.12));
  const taskCount = Math.max(
    1,
    totalItems - threadCount - spaceCount - collectionCount - fileCount
  );

  return {
    threadCount,
    spaceCount,
    collectionCount,
    fileCount,
    taskCount,
  };
}

export function createDeterministicUnifiedSearchDataset(
  options: DeterministicUnifiedSearchDatasetOptions
): DeterministicUnifiedSearchDataset {
  const totalItems = Math.max(5, toPositiveInteger(options.totalItems, 5));
  const counts = splitDeterministicUnifiedSearchCounts(totalItems);
  const nowMs = Number.isFinite(options.nowMs ?? Number.NaN)
    ? Number(options.nowMs)
    : Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const idPrefix = (options.idPrefix ?? "fixture").trim() || "fixture";

  const spaces: Space[] = [];
  const spaceTags: Record<string, string[]> = {};
  for (let i = 0; i < counts.spaceCount; i += 1) {
    const { createdAt } = buildTimestamp(i, totalItems, nowMs);
    const id = `${idPrefix}-space-${i}`;
    const name = i % 2 === 0 ? `Incident Ops ${i}` : `Research ${i}`;
    const instructions =
      i % 2 === 0
        ? `Track incidents, mitigations, and postmortems. ${BASELINE_QUERY_PHRASE}`
        : `Collect research findings and evidence. ${BASELINE_QUERY_PHRASE}`;
    spaces.push({
      id,
      name,
      instructions,
      preferredModel: "gpt-4.1",
      sourcePolicy: SPACE_POLICIES[i % SPACE_POLICIES.length],
      createdAt,
    });
    spaceTags[id] = i % 2 === 0 ? ["incident", "ops"] : ["research", "briefing"];
  }

  const threads: DeterministicUnifiedSearchThread[] = [];
  const notes: Record<string, string> = {};
  for (let i = 0; i < counts.threadCount; i += 1) {
    const { createdAt } = buildTimestamp(i + counts.spaceCount, totalItems, nowMs);
    const incidentHeavy = i % 4 === 0;
    const id = `${idPrefix}-thread-${i}`;
    const space = spaces[i % spaces.length];
    const tagPrimary = incidentHeavy ? "incident" : "research";
    const tags = [tagPrimary, i % 2 === 0 ? "workflow" : "notes"];
    const mode: AnswerMode = i % 3 === 0 ? "research" : i % 3 === 1 ? "quick" : "learn";
    const sources: SourceMode = i % 2 === 0 ? "web" : "none";

    threads.push({
      id,
      title: incidentHeavy ? `Incident analysis ${i}` : `Research summary ${i}`,
      question: incidentHeavy
        ? `What caused incident ${i}?`
        : `What changed in keyboard workflow ${i}?`,
      answer: incidentHeavy
        ? `Incident timeline ${i} with mitigation and owner follow-up. ${BASELINE_QUERY_PHRASE}`
        : `Research workflow update ${i} with notes and action items. ${BASELINE_QUERY_PHRASE}`,
      mode,
      sources,
      provider: "mock",
      model: "gpt-4.1",
      latencyMs: 120 + (i % 9) * 35,
      createdAt,
      citations:
        i % 2 === 0
          ? [
              {
                title: incidentHeavy
                  ? `Incident report ${i}`
                  : `Research note ${i}`,
                url: `https://example.com/${idPrefix}/source-${i}`,
              },
            ]
          : [],
      attachments: [],
      spaceId: space?.id ?? null,
      spaceName: space?.name ?? null,
      tags,
      pinned: i % 3 === 0,
      favorite: i % 2 === 0,
      archived: i % 11 === 0,
    });

    if (i % 5 === 0) {
      notes[id] = incidentHeavy
        ? `Escalate ${id} after retro completion.`
        : `Review ${id} during weekly planning.`;
    }
  }

  const collections: Collection[] = [];
  for (let i = 0; i < counts.collectionCount; i += 1) {
    const { createdAt } = buildTimestamp(
      i + counts.spaceCount + counts.threadCount,
      totalItems,
      nowMs
    );
    collections.push({
      id: `${idPrefix}-collection-${i}`,
      name: i % 2 === 0 ? `Incident collection ${i}` : `Research archive ${i}`,
      createdAt,
    });
  }

  const files: LibraryFile[] = [];
  for (let i = 0; i < counts.fileCount; i += 1) {
    const { createdAt } = buildTimestamp(
      i + counts.spaceCount + counts.threadCount + counts.collectionCount,
      totalItems,
      nowMs
    );
    const incidentHeavy = i % 2 === 0;
    files.push({
      id: `${idPrefix}-file-${i}`,
      name: incidentHeavy ? `incident-${i}.md` : `research-${i}.txt`,
      size: 1024 + i * 17,
      type: incidentHeavy ? "text/markdown" : "text/plain",
      text: incidentHeavy
        ? `Incident postmortem with timeline and citations. ${BASELINE_QUERY_PHRASE}`
        : `Research brief with evidence and keyboard follow-up questions. ${BASELINE_QUERY_PHRASE}`,
      addedAt: createdAt,
    });
  }

  const tasks: Task[] = [];
  for (let i = 0; i < counts.taskCount; i += 1) {
    const { createdAt, createdMs } = buildTimestamp(
      i +
        counts.spaceCount +
        counts.threadCount +
        counts.collectionCount +
        counts.fileCount,
      totalItems,
      nowMs
    );
    const space = spaces[i % spaces.length];
    const cadence = TASK_CADENCES[i % TASK_CADENCES.length];
    const nextRun = new Date(createdMs + (i + 1) * 60 * 60 * 1000).toISOString();
    tasks.push({
      id: `${idPrefix}-task-${i}`,
      name: i % 2 === 0 ? `Incident digest ${i}` : `Research digest ${i}`,
      prompt:
        i % 2 === 0
          ? `Summarize this week's incidents with citations. ${BASELINE_QUERY_PHRASE}`
          : `Summarize new research findings with keyboard references. ${BASELINE_QUERY_PHRASE}`,
      cadence,
      time: `${String((8 + (i % 8)) % 24).padStart(2, "0")}:00`,
      mode: i % 2 === 0 ? "research" : "quick",
      sources: i % 2 === 0 ? "web" : "none",
      createdAt,
      nextRun,
      lastRun: null,
      lastThreadId: null,
      dayOfWeek: cadence === "weekly" ? (i % 7) + 1 : null,
      dayOfMonth: cadence === "monthly" ? (i % 28) + 1 : null,
      monthOfYear: cadence === "yearly" ? (i % 12) + 1 : null,
      spaceId: space?.id ?? null,
      spaceName: space?.name ?? null,
    });
  }

  return {
    threads,
    spaces,
    spaceTags,
    collections,
    files,
    tasks,
    notes,
    nowMs,
    nowIso,
  };
}
