import type { LibraryFile } from "@/lib/types/file";

type FileSearchResult = {
  file: LibraryFile;
  score: number;
  snippet: string;
};

type ParsedSearchTerms = {
  terms: string[];
  phrases: string[];
};

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function parseSearchTerms(query: string): ParsedSearchTerms {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return { terms: [], phrases: [] };

  const phrases: string[] = [];
  const phrasePattern = /"([^"]+)"/g;
  let match: RegExpExecArray | null = phrasePattern.exec(normalized);
  while (match) {
    const phrase = match[1]?.trim();
    if (phrase) phrases.push(phrase);
    match = phrasePattern.exec(normalized);
  }

  const queryWithoutPhrases = normalized.replace(/"([^"]+)"/g, " ");
  return { terms: tokenize(queryWithoutPhrases), phrases };
}

function scoreText(text: string, tokens: string[]) {
  let score = 0;
  const lowered = text.toLowerCase();
  for (const token of tokens) {
    let index = lowered.indexOf(token);
    while (index !== -1) {
      score += 1;
      index = lowered.indexOf(token, index + token.length);
    }
  }
  return score;
}

function snippetFor(text: string, terms: string[]) {
  if (!text) return "";
  const lowered = text.toLowerCase();
  for (const token of terms) {
    const index = lowered.indexOf(token);
    if (index !== -1) {
      const start = Math.max(0, index - 40);
      const end = Math.min(text.length, index + 120);
      return text.slice(start, end).replace(/\s+/g, " ").trim();
    }
  }
  return text.slice(0, 160).replace(/\s+/g, " ").trim();
}

export function searchLibraryFiles(
  files: LibraryFile[],
  query: string,
  limit = 3
): FileSearchResult[] {
  const parsedTerms = parseSearchTerms(query);
  const allTerms = [...parsedTerms.phrases, ...parsedTerms.terms];
  if (!allTerms.length) return [];

  const results = files
    .map((file) => {
      const nameScore = scoreText(file.name, parsedTerms.terms) * 2;
      const bodyScore = scoreText(file.text, parsedTerms.terms);
      const phraseNameScore = scoreText(file.name, parsedTerms.phrases) * 6;
      const phraseBodyScore = scoreText(file.text, parsedTerms.phrases) * 3;
      const score = nameScore + bodyScore;
      return {
        file,
        score: score + phraseNameScore + phraseBodyScore,
        snippet: snippetFor(file.text, allTerms),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = Date.parse(a.file.addedAt);
      const timeB = Date.parse(b.file.addedAt);
      if (Number.isFinite(timeA) || Number.isFinite(timeB)) {
        return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0);
      }
      return a.file.name.localeCompare(b.file.name, undefined, {
        sensitivity: "base",
      });
    })
    .slice(0, limit);

  return results;
}
