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
    addedAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "2",
    name: "project-plan.md",
    size: 12,
    type: "text/markdown",
    text: "We plan to ship the beta release next week.",
    addedAt: "2026-02-02T00:00:00.000Z",
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

  it("boosts exact quoted phrase matches", () => {
    const results = searchLibraryFiles(files, '"beta release"');
    expect(results).toHaveLength(1);
    expect(results[0]?.file.id).toBe("2");
  });

  it("uses addedAt recency as deterministic tie-break for equal scores", () => {
    const tieFiles: LibraryFile[] = [
      {
        id: "a",
        name: "daily-summary-a.txt",
        size: 12,
        type: "text/plain",
        text: "Incident digest.",
        addedAt: "2026-02-01T00:00:00.000Z",
      },
      {
        id: "b",
        name: "daily-summary-b.txt",
        size: 12,
        type: "text/plain",
        text: "Incident digest.",
        addedAt: "2026-02-03T00:00:00.000Z",
      },
    ];
    const results = searchLibraryFiles(tieFiles, "incident digest", 2);
    expect(results.map((result) => result.file.id)).toEqual(["b", "a"]);
  });
});
