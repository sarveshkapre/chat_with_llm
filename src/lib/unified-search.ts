import type { Space } from "@/lib/types/space";
import { readStoredJson } from "@/lib/storage";

export type TimelineWindow = "all" | "24h" | "7d" | "30d";
export type SortBy = "relevance" | "newest" | "oldest";

export type NormalizedQuery = {
  normalized: string;
  tokens: string[];
};

export type UnifiedSearchType =
  | "all"
  | "threads"
  | "spaces"
  | "collections"
  | "files"
  | "tasks";

export type ThreadStateOperator = "favorite" | "pinned" | "archived";

export type UnifiedSearchOperators = {
  type?: Exclude<UnifiedSearchType, "all">;
  space?: string;
  spaceId?: string;
  tags?: string[];
  notTags?: string[];
  states?: ThreadStateOperator[];
  notStates?: ThreadStateOperator[];
  hasNote?: boolean;
  notHasNote?: boolean;
  hasCitation?: boolean;
  notHasCitation?: boolean;
  verbatim?: boolean;
};

export type ParsedUnifiedSearchQuery = {
  text: string;
  query: NormalizedQuery;
  operators: UnifiedSearchOperators;
};

export type ThreadMatchBadge =
  | "title"
  | "question"
  | "tag"
  | "space"
  | "note"
  | "citation"
  | "answer";

export type ThreadMatchInputs = {
  title?: string | null;
  question?: string | null;
  answer?: string | null;
  tags?: string[] | null;
  spaceName?: string | null;
  note?: string | null;
  citationsText?: string | null;
};

const WINDOW_TO_MS: Record<Exclude<TimelineWindow, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function parseStored<T>(key: string, fallback: T): T {
  return readStoredJson(key, fallback);
}

export function normalizeQuery(raw: string): NormalizedQuery {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return { normalized: "", tokens: [] };
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const token of normalized.split(" ")) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    tokens.push(trimmed);
  }
  return { normalized, tokens };
}

function tokenizeOperatorQuery(raw: string): string[] {
  const trimmedRaw = raw.trim();
  if (!trimmedRaw) return [];

  // If quotes are unbalanced, don't apply "quoted token" semantics.
  // This avoids swallowing trailing operators into a single token.
  let quoteCount = 0;
  for (let i = 0; i < trimmedRaw.length; i += 1) {
    const ch = trimmedRaw[i];
    if (ch !== '"') continue;
    const prev = trimmedRaw[i - 1];
    if (prev === "\\") continue;
    quoteCount += 1;
  }
  if (quoteCount % 2 === 1) {
    return trimmedRaw.split(/\s+/).filter(Boolean);
  }

  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < trimmedRaw.length; i += 1) {
    const ch = trimmedRaw[i];
    if (ch === "\\" && trimmedRaw[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(ch)) {
      const trimmed = current.trim();
      if (trimmed) tokens.push(trimmed);
      current = "";
      continue;
    }
    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) tokens.push(trimmed);
  return tokens;
}

function normalizeTypeToken(raw: string): Exclude<UnifiedSearchType, "all"> | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === "thread" || value === "threads") return "threads";
  if (value === "space" || value === "spaces") return "spaces";
  if (value === "collection" || value === "collections") return "collections";
  if (value === "file" || value === "files") return "files";
  if (value === "task" || value === "tasks") return "tasks";
  return null;
}

function normalizeHasToken(raw: string): "note" | "citation" | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === "note" || value === "notes") return "note";
  if (
    value === "citation" ||
    value === "citations" ||
    value === "cite" ||
    value === "source" ||
    value === "sources"
  ) {
    return "citation";
  }
  return null;
}

function normalizeBooleanToken(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === "1" || value === "true" || value === "yes" || value === "on")
    return true;
  if (value === "0" || value === "false" || value === "no" || value === "off")
    return false;
  return null;
}

function normalizeStateToken(raw: string): ThreadStateOperator | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === "favorite" || value === "favorites" || value === "fav")
    return "favorite";
  if (value === "pinned" || value === "pin" || value === "pins") return "pinned";
  if (value === "archived" || value === "archive" || value === "archives")
    return "archived";
  return null;
}

export function parseUnifiedSearchQuery(raw: string): ParsedUnifiedSearchQuery {
  const tokens = tokenizeOperatorQuery(raw.trim());
  const textTokens: string[] = [];
  const operators: UnifiedSearchOperators = {};
  const tags: string[] = [];
  const notTags: string[] = [];
  const states: ThreadStateOperator[] = [];
  const notStates: ThreadStateOperator[] = [];

  for (const token of tokens) {
    const sep = token.indexOf(":");
    if (sep <= 0) {
      textTokens.push(token);
      continue;
    }

    let key = token.slice(0, sep).trim().toLowerCase();
    let value = token.slice(sep + 1).trim();
    const negated = key.startsWith("-");
    if (negated) key = key.slice(1).trim();
    // Tokenizer removes balanced quotes already; this is only to clean up
    // values when we fall back to whitespace tokenization (unbalanced quotes).
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      const inner = value.slice(1, -1);
      if (!inner.includes('"')) value = inner;
    } else {
      if (value.startsWith('"') && !value.slice(1).includes('"')) value = value.slice(1);
      if (value.endsWith('"') && !value.slice(0, -1).includes('"')) value = value.slice(0, -1);
    }

    if (!key || !value) {
      textTokens.push(token);
      continue;
    }

    if (!negated && (key === "type" || key === "in")) {
      const normalizedType = normalizeTypeToken(value);
      if (normalizedType) {
        operators.type = normalizedType;
        continue;
      }
    }

    if (!negated && key === "space") {
      operators.space = value;
      continue;
    }

    if (!negated && (key === "spaceid" || key === "space_id")) {
      operators.spaceId = value;
      continue;
    }

    if (key === "tag") {
      if (negated) notTags.push(value);
      else tags.push(value);
      continue;
    }

    if (key === "is") {
      const normalizedState = normalizeStateToken(value);
      if (normalizedState) {
        if (negated) notStates.push(normalizedState);
        else states.push(normalizedState);
        continue;
      }
    }

    if (key === "has") {
      const normalizedHas = normalizeHasToken(value);
      if (normalizedHas === "note") {
        if (negated) operators.notHasNote = true;
        else operators.hasNote = true;
        continue;
      }
      if (normalizedHas === "citation") {
        if (negated) operators.notHasCitation = true;
        else operators.hasCitation = true;
        continue;
      }
    }

    if (key === "verbatim" || key === "exact") {
      const normalized = normalizeBooleanToken(value);
      if (normalized !== null) {
        operators.verbatim = negated ? !normalized : normalized;
        continue;
      }
    }

    textTokens.push(token);
  }

  const text = textTokens.join(" ").trim();
  if (tags.length) {
    operators.tags = tags;
  }
  if (notTags.length) {
    operators.notTags = notTags;
  }
  if (states.length) {
    operators.states = states;
  }
  if (notStates.length) {
    operators.notStates = notStates;
  }

  return { text, query: normalizeQuery(text), operators };
}

export function matchesQuery(parts: string[], query: NormalizedQuery): boolean {
  if (!query.normalized) return true;
  const combined = parts
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  if (!combined) return false;
  if (combined.includes(query.normalized)) return true;
  if (query.tokens.length === 0) return false;
  if (query.tokens.length === 1) return combined.includes(query.tokens[0]);
  // Multi-word query: treat as phrase OR all-tokens (across all fields).
  return query.tokens.every((token) => combined.includes(token));
}

export function matchesLoweredText(loweredText: string, query: NormalizedQuery): boolean {
  if (!query.normalized) return true;
  const combined = loweredText ?? "";
  if (!combined) return false;
  if (combined.includes(query.normalized)) return true;
  if (query.tokens.length === 0) return false;
  if (query.tokens.length === 1) return combined.includes(query.tokens[0]);
  return query.tokens.every((token) => combined.includes(token));
}

export function computeThreadMatchBadges(
  input: ThreadMatchInputs,
  query: NormalizedQuery
): ThreadMatchBadge[] {
  if (!query.normalized && query.tokens.length === 0) return [];

  const matchesField = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed) return false;
    const lowered = trimmed.toLowerCase();
    if (query.normalized && lowered.includes(query.normalized)) return true;
    return query.tokens.some((token) => token && lowered.includes(token));
  };

  const badges: ThreadMatchBadge[] = [];

  const title = input.title?.trim();
  const question = input.question?.trim();
  if (title && matchesField(title)) badges.push("title");
  else if (question && matchesField(question)) badges.push("question");

  if ((input.tags ?? []).some((tag) => matchesField(tag))) badges.push("tag");
  if (matchesField(input.spaceName)) badges.push("space");
  if (matchesField(input.note)) badges.push("note");
  if (matchesField(input.citationsText)) badges.push("citation");
  if (matchesField(input.answer)) badges.push("answer");

  return badges;
}

export type WeightedField = {
  text: string;
  weight: number;
};

export type WeightedLoweredField = {
  loweredText: string;
  weight: number;
};

function scoreLoweredText(
  loweredText: string,
  weight: number,
  query: NormalizedQuery
): number {
  if (!loweredText || weight <= 0 || !query.normalized) return 0;

  let score = 0;
  if (loweredText === query.normalized) score += 20 * weight;
  else if (loweredText.startsWith(query.normalized)) score += 12 * weight;
  else if (loweredText.includes(query.normalized)) score += 8 * weight;

  for (const token of query.tokens) {
    if (loweredText.includes(token)) score += 1 * weight;
  }

  return score;
}

export function computeRelevanceScoreFromLowered(
  fields: WeightedLoweredField[],
  query: NormalizedQuery
): number {
  if (!query.normalized) return 0;
  let score = 0;

  for (const field of fields) {
    score += scoreLoweredText(
      field.loweredText,
      Math.max(0, field.weight),
      query
    );
  }

  return score;
}

export function computeRelevanceScore(
  fields: WeightedField[],
  query: NormalizedQuery
): number {
  if (!query.normalized) return 0;
  let score = 0;

  for (const field of fields) {
    if (!field.text) continue;
    score += scoreLoweredText(field.text.toLowerCase(), Math.max(0, field.weight), query);
  }

  return score;
}

export function applyTimelineWindow(
  value: string | null | undefined,
  window: TimelineWindow,
  nowMs = Date.now()
): boolean {
  if (window === "all") return true;
  const parsed = Date.parse(value ?? "");
  if (Number.isNaN(parsed)) return false;
  return nowMs - parsed <= WINDOW_TO_MS[window];
}

export function applyBulkThreadUpdate<T extends { id: string }>(
  threads: T[],
  selectedIds: string[],
  updater: (thread: T) => T
): T[] {
  if (!selectedIds.length) return threads;
  const selectedSet = new Set(selectedIds);
  return threads.map((thread) =>
    selectedSet.has(thread.id) ? updater(thread) : thread
  );
}

export function resolveThreadSpaceMeta(
  nextSpaceId: string,
  spaces: Pick<Space, "id" | "name">[]
): { spaceId: string | null; spaceName: string | null } {
  const targetId = nextSpaceId.trim();
  if (!targetId) {
    return { spaceId: null, spaceName: null };
  }
  const match = spaces.find((space) => space.id === targetId);
  return {
    spaceId: match?.id ?? null,
    spaceName: match?.name ?? null,
  };
}

export function pruneSelectedIds(
  selectedIds: string[],
  validIds: ReadonlySet<string>
): string[] {
  if (!selectedIds.length) return selectedIds;
  const next = selectedIds.filter((id) => validIds.has(id));
  return next.length === selectedIds.length ? selectedIds : next;
}

export function toggleVisibleSelection(
  selectedIds: string[],
  visibleIds: string[],
  enabled: boolean
): string[] {
  if (!visibleIds.length) return selectedIds;
  const visibleSet = new Set(visibleIds);

  if (!enabled) {
    const next = selectedIds.filter((id) => !visibleSet.has(id));
    return next.length === selectedIds.length ? selectedIds : next;
  }

  const selectedSet = new Set(selectedIds);
  const next = [...selectedIds];
  for (const id of visibleIds) {
    if (selectedSet.has(id)) continue;
    next.push(id);
    selectedSet.add(id);
  }
  return next;
}

export function resolveActiveSelectedIds<T extends { id: string }>(
  selectedIds: string[],
  items: T[]
): { activeIds: string[]; missingCount: number } {
  if (!selectedIds.length) return { activeIds: selectedIds, missingCount: 0 };
  const validIds = new Set(items.map((item) => item.id));
  const activeIds = pruneSelectedIds(selectedIds, validIds);
  return { activeIds, missingCount: selectedIds.length - activeIds.length };
}

export function sortSearchResults<T extends { createdMs: number }>(
  items: T[],
  sortBy: SortBy,
  query: NormalizedQuery,
  scoreOf: (item: T) => number
): T[] {
  const next = [...items];

  if (sortBy === "newest") {
    next.sort((a, b) => b.createdMs - a.createdMs);
    return next;
  }
  if (sortBy === "oldest") {
    next.sort((a, b) => a.createdMs - b.createdMs);
    return next;
  }

  // "Relevance" behaves like newest when there is no query.
  if (!query.normalized) {
    next.sort((a, b) => b.createdMs - a.createdMs);
    return next;
  }

  const scored = next.map((item) => ({ item, score: scoreOf(item) }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.item.createdMs - a.item.createdMs;
  });
  return scored.map((entry) => entry.item);
}

type Compare<T> = (a: T, b: T) => number;

class BinaryHeap<T> {
  private readonly data: T[] = [];
  private readonly compare: Compare<T>;

  constructor(compare: Compare<T>) {
    this.compare = compare;
  }

  size(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  values(): T[] {
    return [...this.data];
  }

  push(value: T) {
    this.data.push(value);
    this.bubbleUp(this.data.length - 1);
  }

  replaceTop(value: T) {
    if (this.data.length === 0) {
      this.data.push(value);
      return;
    }
    this.data[0] = value;
    this.bubbleDown(0);
  }

  private bubbleUp(index: number) {
    let i = index;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[parent]) >= 0) break;
      const tmp = this.data[i];
      this.data[i] = this.data[parent];
      this.data[parent] = tmp;
      i = parent;
    }
  }

  private bubbleDown(index: number) {
    let i = index;
    const length = this.data.length;
    while (true) {
      const left = i * 2 + 1;
      if (left >= length) return;
      const right = left + 1;
      let best = left;
      if (right < length && this.compare(this.data[right], this.data[left]) < 0) {
        best = right;
      }
      if (this.compare(this.data[best], this.data[i]) >= 0) return;
      const tmp = this.data[i];
      this.data[i] = this.data[best];
      this.data[best] = tmp;
      i = best;
    }
  }
}

function topKSorted<T>(items: readonly T[], limit: number, compareBest: Compare<T>): T[] {
  if (limit <= 0) return [];
  if (items.length <= limit) return [...items].sort(compareBest);

  // Keep a heap of the current top-k, with the *worst* item at the root so
  // we can cheaply decide whether a new candidate should be included.
  const heap = new BinaryHeap<T>((a, b) => -compareBest(a, b));

  for (const item of items) {
    if (heap.size() < limit) {
      heap.push(item);
      continue;
    }
    const worst = heap.peek();
    if (!worst) continue;
    if (compareBest(item, worst) < 0) {
      heap.replaceTop(item);
    }
  }

  const result = heap.values();
  result.sort(compareBest);
  return result;
}

export function topKSearchResults<T extends { createdMs: number }>(
  items: T[],
  sortBy: SortBy,
  query: NormalizedQuery,
  limit: number,
  scoreOf: (item: T) => number
): T[] {
  if (limit <= 0) return [];
  if (items.length <= limit) {
    return sortSearchResults(items, sortBy, query, scoreOf);
  }

  if (sortBy === "newest") {
    return topKSorted(items, limit, (a, b) => b.createdMs - a.createdMs);
  }
  if (sortBy === "oldest") {
    return topKSorted(items, limit, (a, b) => a.createdMs - b.createdMs);
  }

  // "Relevance" behaves like newest when there is no query.
  if (!query.normalized) {
    return topKSorted(items, limit, (a, b) => b.createdMs - a.createdMs);
  }

  type Scored = { item: T; score: number };
  const compareBest: Compare<Scored> = (a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.item.createdMs - a.item.createdMs;
  };
  const heap = new BinaryHeap<Scored>((a, b) => -compareBest(a, b));

  for (const item of items) {
    const entry = { item, score: scoreOf(item) };
    if (heap.size() < limit) {
      heap.push(entry);
      continue;
    }
    const worst = heap.peek();
    if (!worst) continue;
    if (compareBest(entry, worst) < 0) {
      heap.replaceTop(entry);
    }
  }

  const result = heap.values();
  result.sort(compareBest);
  return result.map((entry) => entry.item);
}

export function filterThreadEntries<
  T extends {
    thread: {
      createdAt?: string | null | undefined;
      favorite?: boolean | null | undefined;
      pinned?: boolean | null | undefined;
      archived?: boolean | null | undefined;
    };
    combinedLower: string;
    spaceNameLower: string;
    spaceIdLower: string;
    tagSetLower: ReadonlySet<string>;
    noteTrimmed: string;
    hasCitation: boolean;
  },
>(
  entries: T[],
  options: {
    query: NormalizedQuery;
    operators: UnifiedSearchOperators;
    timelineWindow: TimelineWindow;
    nowMs: number;
  }
): T[] {
  const { query, operators, timelineWindow, nowMs } = options;
  const textFiltered = query.normalized
    ? entries.filter((entry) => matchesLoweredText(entry.combinedLower, query))
    : entries;

  return textFiltered.filter((entry) => {
    if (!applyTimelineWindow(entry.thread.createdAt, timelineWindow, nowMs))
      return false;

    if (operators.space) {
      const needle = operators.space.toLowerCase();
      if (!entry.spaceNameLower.includes(needle) && entry.spaceIdLower !== needle)
        return false;
    }
    if (operators.spaceId) {
      const needle = operators.spaceId.toLowerCase();
      if (entry.spaceIdLower !== needle) return false;
    }
    if (operators.tags?.length) {
      for (const tag of operators.tags) {
        if (!entry.tagSetLower.has(tag.toLowerCase())) return false;
      }
    }
    if (operators.notTags?.length) {
      for (const tag of operators.notTags) {
        if (entry.tagSetLower.has(tag.toLowerCase())) return false;
      }
    }
    if (operators.hasNote) {
      if (!entry.noteTrimmed) return false;
    }
    if (operators.notHasNote) {
      if (entry.noteTrimmed) return false;
    }
    if (operators.hasCitation) {
      if (!entry.hasCitation) return false;
    }
    if (operators.notHasCitation) {
      if (entry.hasCitation) return false;
    }
    if (operators.states?.length) {
      for (const state of operators.states) {
        if (!entry.thread[state]) return false;
      }
    }
    if (operators.notStates?.length) {
      for (const state of operators.notStates) {
        if (entry.thread[state]) return false;
      }
    }
    return true;
  });
}

function hasHasOperators(operators: UnifiedSearchOperators): boolean {
  return Boolean(
    operators.hasNote ||
      operators.notHasNote ||
      operators.hasCitation ||
      operators.notHasCitation
  );
}

function hasTagOperators(operators: UnifiedSearchOperators): boolean {
  return Boolean(operators.tags?.length || operators.notTags?.length);
}

function hasSpaceOperators(operators: UnifiedSearchOperators): boolean {
  return Boolean(operators.space || operators.spaceId);
}

function hasStateOperators(operators: UnifiedSearchOperators): boolean {
  return Boolean(operators.states?.length || operators.notStates?.length);
}

export function filterSpaceEntries<
  T extends {
    space: { createdAt?: string | null | undefined };
    combinedLower: string;
    spaceNameLower: string;
    spaceIdLower: string;
    tagSetLower: ReadonlySet<string>;
  },
>(
  entries: T[],
  options: {
    query: NormalizedQuery;
    operators: UnifiedSearchOperators;
    timelineWindow: TimelineWindow;
    nowMs: number;
  }
): T[] {
  const { query, operators, timelineWindow, nowMs } = options;
  const textFiltered = query.normalized
    ? entries.filter((entry) => matchesLoweredText(entry.combinedLower, query))
    : entries;

  return textFiltered.filter((entry) => {
    if (!applyTimelineWindow(entry.space.createdAt, timelineWindow, nowMs))
      return false;
    if (hasHasOperators(operators)) return false;
    if (hasStateOperators(operators)) return false;
    if (operators.space) {
      const needle = operators.space.toLowerCase();
      if (!entry.spaceNameLower.includes(needle) && entry.spaceIdLower !== needle)
        return false;
    }
    if (operators.spaceId) {
      const needle = operators.spaceId.toLowerCase();
      if (entry.spaceIdLower !== needle) return false;
    }
    if (operators.tags?.length) {
      for (const tag of operators.tags) {
        if (!entry.tagSetLower.has(tag.toLowerCase())) return false;
      }
    }
    if (operators.notTags?.length) {
      for (const tag of operators.notTags) {
        if (entry.tagSetLower.has(tag.toLowerCase())) return false;
      }
    }
    return true;
  });
}

export function filterTaskEntries<
  T extends {
    task: { createdAt?: string | null | undefined };
    combinedLower: string;
    spaceNameLower: string;
    spaceIdLower: string;
  },
>(
  entries: T[],
  options: {
    query: NormalizedQuery;
    operators: UnifiedSearchOperators;
    timelineWindow: TimelineWindow;
    nowMs: number;
  }
): T[] {
  const { query, operators, timelineWindow, nowMs } = options;
  const textFiltered = query.normalized
    ? entries.filter((entry) => matchesLoweredText(entry.combinedLower, query))
    : entries;

  return textFiltered.filter((entry) => {
    if (!applyTimelineWindow(entry.task.createdAt, timelineWindow, nowMs))
      return false;
    if (hasHasOperators(operators)) return false;
    if (hasTagOperators(operators)) return false;
    if (hasStateOperators(operators)) return false;
    if (operators.space) {
      const needle = operators.space.toLowerCase();
      if (!entry.spaceNameLower.includes(needle) && entry.spaceIdLower !== needle)
        return false;
    }
    if (operators.spaceId) {
      const needle = operators.spaceId.toLowerCase();
      if (entry.spaceIdLower !== needle) return false;
    }
    return true;
  });
}

export function filterCollectionEntries<
  T extends {
    collection: { createdAt?: string | null | undefined };
    combinedLower: string;
  },
>(
  entries: T[],
  options: {
    query: NormalizedQuery;
    operators: UnifiedSearchOperators;
    timelineWindow: TimelineWindow;
    nowMs: number;
  }
): T[] {
  const { query, operators, timelineWindow, nowMs } = options;
  const textFiltered = query.normalized
    ? entries.filter((entry) => matchesLoweredText(entry.combinedLower, query))
    : entries;

  return textFiltered.filter((entry) => {
    if (!applyTimelineWindow(entry.collection.createdAt, timelineWindow, nowMs))
      return false;
    if (hasSpaceOperators(operators)) return false;
    if (hasTagOperators(operators)) return false;
    if (hasHasOperators(operators)) return false;
    if (hasStateOperators(operators)) return false;
    return true;
  });
}

export function filterFileEntries<
  T extends {
    file: { addedAt?: string | null | undefined };
    combinedLower: string;
  },
>(
  entries: T[],
  options: {
    query: NormalizedQuery;
    operators: UnifiedSearchOperators;
    timelineWindow: TimelineWindow;
    nowMs: number;
  }
): T[] {
  const { query, operators, timelineWindow, nowMs } = options;
  const textFiltered = query.normalized
    ? entries.filter((entry) => matchesLoweredText(entry.combinedLower, query))
    : entries;

  return textFiltered.filter((entry) => {
    if (!applyTimelineWindow(entry.file.addedAt, timelineWindow, nowMs))
      return false;
    if (hasSpaceOperators(operators)) return false;
    if (hasTagOperators(operators)) return false;
    if (hasHasOperators(operators)) return false;
    if (hasStateOperators(operators)) return false;
    return true;
  });
}
