import { describe, expect, it } from "vitest";
import { searchLibraryFiles } from "@/lib/file-search";
import type { LibraryFile } from "@/lib/types/file";

const files: LibraryFile[] = [
  {
    id: "1",
    name: "alpha-notes.txt",
    size: 12,
    type: "text/plain",
    text: "Alpha beta gamma delta.",
    addedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "project-plan.md",
    size: 12,
    type: "text/markdown",
    text: "We plan to ship the beta release next week.",
    addedAt: new Date().toISOString(),
  },
];

describe("searchLibraryFiles", () => {
  it("finds matching files and scores them", () => {
    const results = searchLibraryFiles(files, "beta release");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].file.id).toBe("2");
  });

  it("returns empty for empty query", () => {
    const results = searchLibraryFiles(files, "");
    expect(results).toHaveLength(0);
  });
});
