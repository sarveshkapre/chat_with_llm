import { describe, expect, it } from "vitest";
import { extractCitationsFromOutput, extractTextFromOutput } from "@/lib/citations";

const SAMPLE_OUTPUT = [
  { type: "web_search_call", id: "ws_123", status: "completed" },
  {
    type: "message",
    content: [
      {
        type: "output_text",
        text: "Hello world.",
        annotations: [
          {
            type: "url_citation",
            url: "https://example.com",
            title: "Example",
          },
        ],
      },
      {
        type: "output_text",
        text: "Second paragraph.",
        annotations: [
          {
            type: "url_citation",
            url: "https://example.com",
            title: "Example",
          },
          {
            type: "url_citation",
            url: "https://example.org",
            title: "Example Org",
          },
        ],
      },
    ],
  },
];

describe("citations", () => {
  it("extracts message text", () => {
    const text = extractTextFromOutput(SAMPLE_OUTPUT);
    expect(text).toBe("Hello world.\n\nSecond paragraph.");
  });

  it("deduplicates citations by url", () => {
    const citations = extractCitationsFromOutput(SAMPLE_OUTPUT);
    expect(citations).toHaveLength(2);
    expect(citations[0].url).toBe("https://example.com");
    expect(citations[1].url).toBe("https://example.org");
  });

  it("normalizes tracking params before dedupe", () => {
    const citations = extractCitationsFromOutput([
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "Tracked links",
            annotations: [
              {
                type: "url_citation",
                url: "https://example.com/news?utm_source=foo&id=7",
                title: "Primary source",
              },
              {
                type: "url_citation",
                url: "https://example.com/news?id=7&fbclid=123",
                title: "https://example.com/news?id=7&fbclid=123",
              },
            ],
          },
        ],
      },
    ]);

    expect(citations).toHaveLength(1);
    expect(citations[0]).toEqual({
      title: "Primary source",
      url: "https://example.com/news?id=7",
    });
  });

  it("keeps non-URL citation strings when normalization is not possible", () => {
    const citations = extractCitationsFromOutput([
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: "Non-url",
            annotations: [
              {
                type: "url_citation",
                url: "not-a-url",
                title: "Raw",
              },
            ],
          },
        ],
      },
    ]);
    expect(citations).toEqual([{ title: "Raw", url: "not-a-url" }]);
  });
});
