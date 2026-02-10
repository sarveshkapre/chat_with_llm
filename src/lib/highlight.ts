export type HighlightPart = {
  text: string;
  highlighted: boolean;
};

type Range = { start: number; end: number };

function normalizeNeedle(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}

function findRanges(haystackLower: string, needleLower: string): Range[] {
  if (!needleLower) return [];
  const ranges: Range[] = [];
  let index = 0;
  while (true) {
    const found = haystackLower.indexOf(needleLower, index);
    if (found === -1) break;
    ranges.push({ start: found, end: found + needleLower.length });
    index = found + needleLower.length;
  }
  return ranges;
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) =>
    a.start === b.start ? a.end - b.end : a.start - b.start
  );
  const merged: Range[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
      continue;
    }
    merged.push({ ...current });
  }
  return merged;
}

function buildPatterns(normalizedQuery: string, normalizedTokens: string[]): string[] {
  const patterns: string[] = [];
  if (normalizedQuery) patterns.push(normalizedQuery);
  // Avoid highlighting extremely short tokens (noise), except when the full query itself is short.
  if (normalizedQuery.length >= 2) {
    patterns.push(...normalizedTokens.filter((token) => token.length >= 2));
  }
  return uniqueStrings(patterns).sort((a, b) => b.length - a.length);
}

export function buildHighlightParts(
  text: string,
  query: string,
  tokens: string[]
): HighlightPart[] {
  if (!text) return [];
  const normalizedQuery = normalizeNeedle(query);
  if (!normalizedQuery) return [{ text, highlighted: false }];

  const normalizedTokens = tokens.map((token) => token.trim().toLowerCase()).filter(Boolean);
  const patterns = buildPatterns(normalizedQuery, normalizedTokens);
  if (!patterns.length) return [{ text, highlighted: false }];

  const haystackLower = text.toLowerCase();
  const ranges = mergeRanges(patterns.flatMap((pattern) => findRanges(haystackLower, pattern)));
  if (!ranges.length) return [{ text, highlighted: false }];

  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({ text: text.slice(cursor, range.start), highlighted: false });
    }
    parts.push({ text: text.slice(range.start, range.end), highlighted: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), highlighted: false });
  }
  return parts.filter((part) => part.text.length > 0);
}

