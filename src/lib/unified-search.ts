import type { AnswerResponse, Citation, SourceMode, AnswerMode } from "@/lib/types/answer";
import type { Space } from "@/lib/types/space";
import type { Task, TaskCadence } from "@/lib/types/task";
import type { Collection } from "@/lib/types/collection";
import type { LibraryFile } from "@/lib/types/file";
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

export type OperatorAutocompleteMatch = {
  token: string;
  start: number;
  end: number;
  suggestions: string[];
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

export type UnifiedSearchStoredThread = AnswerResponse & {
  title?: string | null;
  tags?: string[];
  pinned?: boolean;
  favorite?: boolean;
  archived?: boolean;
};

const MAX_RECENT_QUERY_LENGTH = 200;

const WINDOW_TO_MS: Record<Exclude<TimelineWindow, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export const UNIFIED_OPERATOR_SUGGESTIONS = [
  "type:",
  "space:",
  "spaceId:",
  "tag:",
  "-tag:",
  "is:",
  "-is:",
  "has:",
  "-has:",
  "verbatim:",
] as const;

export function parseStored<T>(key: string, fallback: T): T {
  return readStoredJson(key, fallback);
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === "string" ? value : null;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readNonEmptyString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim() ? value : fallback;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeAnswerMode(value: unknown): AnswerMode {
  if (value === "quick" || value === "research" || value === "learn") {
    return value;
  }
  return "quick";
}

function normalizeSourceMode(value: unknown): SourceMode {
  if (value === "web" || value === "none") return value;
  return "none";
}

function normalizeTaskCadence(value: unknown): TaskCadence {
  if (
    value === "once" ||
    value === "daily" ||
    value === "weekday" ||
    value === "weekly" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return value;
  }
  return "once";
}

function normalizeSpaceSourcePolicy(
  value: unknown
): Space["sourcePolicy"] {
  if (value === "flex" || value === "web" || value === "offline") return value;
  return undefined;
}

function readCitationArray(value: unknown): Citation[] {
  if (!Array.isArray(value)) return [];
  const citations: Citation[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const title = readString(item.title).trim();
    const url = readString(item.url).trim();
    if (!title || !url) continue;
    citations.push({ title, url });
  }
  return citations;
}

function readAttachmentArray(value: unknown): AnswerResponse["attachments"] {
  if (!Array.isArray(value)) return [];
  const attachments: AnswerResponse["attachments"] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = readString(item.id).trim();
    const name = readString(item.name).trim();
    const type = readString(item.type).trim();
    if (!id || !name || !type) continue;
    attachments.push({
      id,
      name,
      type,
      size: readNumber(item.size, 0),
      text: readOptionalString(item.text),
      error: readOptionalString(item.error),
    });
  }
  return attachments;
}

export function decodeUnifiedSearchThreadsStorage(
  value: unknown
): UnifiedSearchStoredThread[] {
  if (!Array.isArray(value)) return [];
  const fallbackTimestamp = new Date(0).toISOString();
  const threads: UnifiedSearchStoredThread[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = readString(item.id).trim();
    if (!id) continue;
    const question = readString(item.question);
    const answer = readString(item.answer);
    const title = readOptionalString(item.title);
    const createdAt = readNonEmptyString(item.createdAt, fallbackTimestamp);
    threads.push({
      id,
      title,
      question,
      answer,
      mode: normalizeAnswerMode(item.mode),
      sources: normalizeSourceMode(item.sources),
      model: readOptionalString(item.model) ?? undefined,
      provider: readString(item.provider, "unknown"),
      latencyMs: readNumber(item.latencyMs, 0),
      createdAt,
      citations: readCitationArray(item.citations),
      attachments: readAttachmentArray(item.attachments),
      spaceId: readOptionalString(item.spaceId),
      spaceName: readOptionalString(item.spaceName),
      tags: readStringArray(item.tags),
      pinned: readBoolean(item.pinned),
      favorite: readBoolean(item.favorite),
      archived: readBoolean(item.archived),
    });
  }
  return threads;
}

export function decodeUnifiedSearchSpacesStorage(value: unknown): Space[] {
  if (!Array.isArray(value)) return [];
  const fallbackTimestamp = new Date(0).toISOString();
  const spaces: Space[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = readString(item.id).trim();
    if (!id) continue;
    spaces.push({
      id,
      name: readString(item.name, "Untitled space"),
      instructions: readString(item.instructions),
      preferredModel: readOptionalString(item.preferredModel),
      sourcePolicy: normalizeSpaceSourcePolicy(item.sourcePolicy),
      createdAt: readNonEmptyString(item.createdAt, fallbackTimestamp),
    });
  }
  return spaces;
}

export function decodeUnifiedSearchTasksStorage(value: unknown): Task[] {
  if (!Array.isArray(value)) return [];
  const fallbackTimestamp = new Date(0).toISOString();
  const tasks: Task[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = readString(item.id).trim();
    if (!id) continue;
    const createdAt = readNonEmptyString(item.createdAt, fallbackTimestamp);
    tasks.push({
      id,
      name: readString(item.name, "Untitled task"),
      prompt: readString(item.prompt),
      cadence: normalizeTaskCadence(item.cadence),
      time: readString(item.time, "09:00"),
      mode: normalizeAnswerMode(item.mode),
      sources: normalizeSourceMode(item.sources),
      createdAt,
      nextRun: readNonEmptyString(item.nextRun, createdAt),
      lastRun: readOptionalString(item.lastRun),
      lastThreadId: readOptionalString(item.lastThreadId),
      dayOfWeek:
        typeof item.dayOfWeek === "number" && Number.isFinite(item.dayOfWeek)
          ? item.dayOfWeek
          : null,
      dayOfMonth:
        typeof item.dayOfMonth === "number" && Number.isFinite(item.dayOfMonth)
          ? item.dayOfMonth
          : null,
      monthOfYear:
        typeof item.monthOfYear === "number" && Number.isFinite(item.monthOfYear)
          ? item.monthOfYear
          : null,
      spaceId: readOptionalString(item.spaceId),
      spaceName: readOptionalString(item.spaceName),
    });
  }
  return tasks;
}

export function decodeUnifiedSearchCollectionsStorage(value: unknown): Collection[] {
  if (!Array.isArray(value)) return [];
  const fallbackTimestamp = new Date(0).toISOString();
  const collections: Collection[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = readString(item.id).trim();
    if (!id) continue;
    collections.push({
      id,
      name: readString(item.name, "Untitled collection"),
      createdAt: readNonEmptyString(item.createdAt, fallbackTimestamp),
    });
  }
  return collections;
}

export function decodeUnifiedSearchFilesStorage(value: unknown): LibraryFile[] {
  if (!Array.isArray(value)) return [];
  const fallbackTimestamp = new Date(0).toISOString();
  const files: LibraryFile[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const id = readString(item.id).trim();
    if (!id) continue;
    files.push({
      id,
      name: readString(item.name, "Untitled file"),
      size: Math.max(0, readNumber(item.size, 0)),
      type: readString(item.type, "text/plain"),
      text: readString(item.text),
      addedAt: readNonEmptyString(item.addedAt, fallbackTimestamp),
    });
  }
  return files;
}

export function normalizeUnifiedSearchRecentQuery(
  value: unknown
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compactWhitespace = trimmed.replace(/\s+/g, " ");
  if (!compactWhitespace) return null;
  return compactWhitespace.slice(0, MAX_RECENT_QUERY_LENGTH);
}

export function decodeUnifiedSearchRecentQueriesStorage(
  value: unknown,
  maxItems = 5
): string[] {
  if (!Array.isArray(value)) return [];
  const next: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = normalizeUnifiedSearchRecentQuery(item);
    if (!normalized) continue;
    const dedupeKey = normalized.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    next.push(normalized);
    if (next.length >= maxItems) break;
  }
  return next;
}

export function getOperatorAutocomplete(raw: string): OperatorAutocompleteMatch | null {
  if (!raw || /\s$/.test(raw)) return null;
  const end = raw.length;
  let start = end;
  while (start > 0 && !/\s/.test(raw[start - 1])) {
    start -= 1;
  }

  const token = raw.slice(start, end);
  const lowered = token.toLowerCase();
  if (!lowered || lowered.includes(":")) return null;

  const suggestions = UNIFIED_OPERATOR_SUGGESTIONS.filter((candidate) =>
    candidate.toLowerCase().startsWith(lowered)
  );
  if (!suggestions.length) return null;
  return { token, start, end, suggestions: [...suggestions] };
}

export function applyOperatorAutocomplete(
  raw: string,
  suggestion: string
): string {
  const trimmedSuggestion = suggestion.trim();
  if (!trimmedSuggestion) return raw;

  const match = getOperatorAutocomplete(raw);
  if (!match) {
    const prefix = raw.trimEnd();
    return prefix ? `${prefix} ${trimmedSuggestion}` : trimmedSuggestion;
  }

  return `${raw.slice(0, match.start)}${trimmedSuggestion}${raw.slice(match.end)}`;
}

export function stepCircularIndex(
  length: number,
  current: number,
  direction: 1 | -1
): number {
  if (length <= 0) return -1;
  if (current < 0 || current >= length) return direction > 0 ? 0 : length - 1;
  return (current + direction + length) % length;
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

export function parseTimestampMs(
  value: string | null | undefined,
  fallback = 0
): number {
  const parsed = Date.parse(value ?? "");
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

export function formatTimestampForDisplay(
  value: string | null | undefined,
  fallback = "Unknown"
): string {
  const parsed = parseTimestampMs(value, Number.NaN);
  if (Number.isNaN(parsed)) return fallback;
  return new Date(parsed).toLocaleString();
}

export function formatTimestampForExport(
  value: string | null | undefined,
  fallback = "Unknown"
): string {
  const parsed = parseTimestampMs(value, Number.NaN);
  if (Number.isNaN(parsed)) return fallback;
  const date = new Date(parsed);
  return `${date.toISOString()} (${date.toLocaleString()})`;
}

export function formatUtcOffset(totalMinutes: number): string {
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absoluteMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (absoluteMinutes % 60).toString().padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

export function getExportEnvironmentMeta(
  now = new Date(),
  localeInput?: string | null,
  timeZoneInput?: string | null
): { locale: string; timeZone: string; utcOffset: string } {
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  const locale = (localeInput ?? resolved.locale ?? "").trim() || "unknown";
  const timeZone = (timeZoneInput ?? resolved.timeZone ?? "").trim() || "unknown";
  // `getTimezoneOffset()` returns minutes west of UTC. We invert for UTC+/- format.
  const utcOffset = formatUtcOffset(-now.getTimezoneOffset());
  return { locale, timeZone, utcOffset };
}

export type UnifiedSearchExportEnvironment = {
  locale: string;
  timeZone: string;
  utcOffset: string;
};

export type UnifiedSearchExportSavedSearch = {
  name: string;
  pinned: boolean;
  query: string;
  filter: string;
  sortBy: string;
  timelineWindow: string;
  resultLimit: number;
  verbatim: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type UnifiedSearchMarkdownExportInput = {
  exportedAt: string;
  environment: UnifiedSearchExportEnvironment;
  query: string;
  filter: UnifiedSearchType;
  sortBy: SortBy;
  resultLimit: number;
  threads: {
    title: string;
    spaceName?: string | null;
    mode: string;
    createdAt?: string | null;
  }[];
  spaces: {
    name: string;
    instructions?: string | null;
    tags: string[];
    createdAt?: string | null;
  }[];
  collections: {
    name: string;
    createdAt?: string | null;
  }[];
  files: {
    name: string;
    size: number;
    addedAt?: string | null;
  }[];
  tasks: {
    name: string;
    cadence: string;
    time: string;
    mode: string;
    sources: string;
    spaceName?: string | null;
    nextRun?: string | null;
  }[];
  savedSearches: UnifiedSearchExportSavedSearch[];
};

export type UnifiedSearchSavedSearchesMarkdownExportInput = {
  exportedAt: string;
  environment: UnifiedSearchExportEnvironment;
  savedSearches: UnifiedSearchExportSavedSearch[];
};

function buildSavedSearchMarkdownLines(
  savedSearches: UnifiedSearchExportSavedSearch[],
  includeCreatedAt: boolean
): string[] {
  if (!savedSearches.length) return ["(none)"];
  return savedSearches.map((saved, index) => {
    return [
      `${index + 1}. ${saved.pinned ? "Pinned: " : ""}${saved.name}`,
      `   - Query: ${saved.query || "None"}`,
      `   - Filter: ${saved.filter} · Sort: ${saved.sortBy} · Time: ${saved.timelineWindow} · Limit: ${saved.resultLimit} · Verbatim: ${saved.verbatim ? "true" : "false"}`,
      ...(includeCreatedAt
        ? [`   - Created: ${formatTimestampForExport(saved.createdAt)}`]
        : []),
      `   - Updated: ${formatTimestampForExport(saved.updatedAt)}`,
    ].join("\n");
  });
}

export function buildUnifiedSearchMarkdownExport(
  input: UnifiedSearchMarkdownExportInput
): string {
  const lines: string[] = [
    "# Signal Search Unified Export",
    "",
    `Exported: ${formatTimestampForExport(input.exportedAt)}`,
    `Environment: locale=${input.environment.locale} timeZone=${input.environment.timeZone} utcOffset=${input.environment.utcOffset}`,
    "",
    `Query: ${input.query || "None"}`,
    `Filter: ${input.filter}`,
    `Sort: ${input.sortBy}`,
    `Result limit (UI display only): ${input.resultLimit}`,
    `Export: includes all matches (not limited by UI result limit)`,
    "",
    `Threads: ${input.threads.length}`,
    `Spaces: ${input.spaces.length}`,
    `Collections: ${input.collections.length}`,
    `Files: ${input.files.length}`,
    `Tasks: ${input.tasks.length}`,
    "",
    "## Threads",
    ...input.threads.map((thread, index) =>
      [
        `${index + 1}. ${thread.title}`,
        `   - Space: ${thread.spaceName ?? "None"} · Mode: ${thread.mode}`,
        `   - Created: ${formatTimestampForExport(thread.createdAt)}`,
      ].join("\n")
    ),
    "",
    "## Spaces",
    ...input.spaces.map((space, index) =>
      [
        `${index + 1}. ${space.name}`,
        `   - Instructions: ${space.instructions || "None"}`,
        `   - Tags: ${space.tags.length ? space.tags.join(", ") : "None"}`,
        `   - Created: ${formatTimestampForExport(space.createdAt)}`,
      ].join("\n")
    ),
    "",
    "## Collections",
    ...input.collections.map((collection, index) =>
      [
        `${index + 1}. ${collection.name}`,
        `   - Created: ${formatTimestampForExport(collection.createdAt)}`,
      ].join("\n")
    ),
    "",
    "## Files",
    ...input.files.map((file, index) =>
      [
        `${index + 1}. ${file.name}`,
        `   - Size: ${Math.round(file.size / 1024)} KB`,
        `   - Added: ${formatTimestampForExport(file.addedAt)}`,
      ].join("\n")
    ),
    "",
    "## Tasks",
    ...input.tasks.map((task, index) =>
      [
        `${index + 1}. ${task.name}`,
        `   - Cadence: ${task.cadence} at ${task.time}`,
        `   - Mode: ${task.mode} · Sources: ${task.sources === "web" ? "Web" : "Offline"}`,
        `   - Space: ${task.spaceName ?? "None"}`,
        `   - Next run: ${formatTimestampForExport(task.nextRun)}`,
      ].join("\n")
    ),
    "",
    "## Saved Searches",
    ...buildSavedSearchMarkdownLines(input.savedSearches, false),
  ];

  return lines.join("\n");
}

export function buildUnifiedSearchSavedSearchesMarkdownExport(
  input: UnifiedSearchSavedSearchesMarkdownExportInput
): string {
  const lines: string[] = [
    "# Signal Search Saved Searches",
    "",
    `Exported: ${formatTimestampForExport(input.exportedAt)}`,
    `Environment: locale=${input.environment.locale} timeZone=${input.environment.timeZone} utcOffset=${input.environment.utcOffset}`,
    "",
    ...buildSavedSearchMarkdownLines(input.savedSearches, true),
  ];
  return lines.join("\n");
}

export type UnifiedSearchCsvExportRow = {
  type: string;
  title: string;
  space?: string | null;
  mode?: string | null;
  createdAt?: string | null;
};

export function escapeCsvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export function buildUnifiedSearchCsvExport(
  rows: UnifiedSearchCsvExportRow[]
): string {
  const lines = [
    ["type", "title", "space", "mode", "created_at"]
      .map((cell) => escapeCsvCell(cell))
      .join(","),
    ...rows.map((row) =>
      [row.type, row.title, row.space ?? "", row.mode ?? "", row.createdAt ?? ""]
        .map((cell) => escapeCsvCell(cell))
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export function applyTimelineWindow(
  value: string | null | undefined,
  window: TimelineWindow,
  nowMs = Date.now()
): boolean {
  if (window === "all") return true;
  return nowMs - parseTimestampMs(value, Number.NaN) <= WINDOW_TO_MS[window];
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
