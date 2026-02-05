import { nanoid } from "nanoid";
import type {
  AnswerMode,
  AnswerResponse,
  SourceMode,
  Attachment,
} from "@/lib/types/answer";

const PLACEHOLDER_SOURCES = [
  {
    title: "Example Source: Open Web Snapshot",
    url: "https://example.com/source",
  },
];

export async function answerWithMock(
  question: string,
  mode: AnswerMode,
  sources: SourceMode,
  attachments: Attachment[],
  spaceInstructions?: string,
  spaceMeta?: { id?: string; name?: string }
): Promise<AnswerResponse> {
  const createdAt = new Date().toISOString();
  const answer =
    mode === "learn"
      ? "Let's learn this step by step. First, restate the question in your own words. Next, identify key terms. Finally, verify with a source once connected."
      : mode === "research"
        ? "This is a research-style summary placeholder. Connect a model provider to generate a full report with citations."
        : "This is a quick answer placeholder. Connect a model provider to return a sourced response.";

  return {
    id: nanoid(),
    question,
    answer,
    mode,
    sources,
    createdAt,
    citations: sources === "web" ? PLACEHOLDER_SOURCES : [],
    attachments,
    spaceId: spaceMeta?.id ?? null,
    spaceName: spaceMeta?.name ?? null,
    provider: "mock",
    latencyMs: 1,
  };
}
