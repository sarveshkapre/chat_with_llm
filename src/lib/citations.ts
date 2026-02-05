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
    if (!unique.has(citation.url)) unique.set(citation.url, citation);
  }

  return Array.from(unique.values());
}
