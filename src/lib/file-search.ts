import type { LibraryFile } from "@/lib/types/file";

type FileSearchResult = {
  file: LibraryFile;
  score: number;
  snippet: string;
};

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
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

function snippetFor(text: string, tokens: string[]) {
  if (!text) return "";
  const lowered = text.toLowerCase();
  for (const token of tokens) {
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
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const results = files
    .map((file) => {
      const nameScore = scoreText(file.name, tokens) * 2;
      const bodyScore = scoreText(file.text, tokens);
      const score = nameScore + bodyScore;
      return {
        file,
        score,
        snippet: snippetFor(file.text, tokens),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}
