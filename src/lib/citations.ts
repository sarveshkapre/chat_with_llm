import type { Citation } from "@/lib/types/answer";

type OutputItem = {
  type?: string;
  content?: OutputTextPart[];
};

type OutputTextPart = {
  type?: string;
  text?: string;
  annotations?: Array<{
    type?: string;
    url?: string;
    title?: string;
  }>;
};

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set(["gclid", "fbclid", "mc_cid", "mc_eid"]);

function normalizeCitationUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    const filteredParams = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      const normalizedKey = key.toLowerCase();
      if (TRACKING_PARAMS.has(normalizedKey)) continue;
      if (TRACKING_PARAM_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix)))
        continue;
      filteredParams.append(key, value);
    }
    const search = filteredParams.toString();
    const pathname = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.origin}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return trimmed;
  }
}

export function extractTextFromOutput(output: OutputItem[]): string {
  const message = output.find((item) => item.type === "message");
  if (!message?.content) return "";

  return message.content
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("\n\n")
    .trim();
}

export function extractCitationsFromOutput(output: OutputItem[]): Citation[] {
  const message = output.find((item) => item.type === "message");
  if (!message?.content) return [];

  const citations: Citation[] = [];
  for (const part of message.content) {
    if (part.type !== "output_text") continue;
    for (const annotation of part.annotations ?? []) {
      if (annotation.type !== "url_citation") continue;
      if (!annotation.url) continue;
      citations.push({
        title: annotation.title ?? annotation.url,
        url: annotation.url,
      });
    }
  }

  const unique = new Map<string, Citation>();
  for (const citation of citations) {
    const key = normalizeCitationUrl(citation.url);
    if (!key) continue;
    if (!unique.has(key)) {
      unique.set(key, { ...citation, url: key });
      continue;
    }

    const existing = unique.get(key);
    if (!existing) continue;
    if (existing.title === existing.url && citation.title !== citation.url) {
      unique.set(key, { title: citation.title, url: key });
    }
  }

  return Array.from(unique.values());
}
