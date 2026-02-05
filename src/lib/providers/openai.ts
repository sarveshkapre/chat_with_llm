import OpenAI from "openai";
import { nanoid } from "nanoid";
import type { AnswerMode, AnswerResponse, SourceMode } from "@/lib/types/answer";
import {
  extractCitationsFromOutput,
  extractTextFromOutput,
} from "@/lib/citations";

const DEFAULT_MODEL = "gpt-4.1";

const MODE_INSTRUCTIONS: Record<AnswerMode, string> = {
  quick:
    "Answer directly in 3-6 short paragraphs. Include inline citations where possible.",
  research:
    "Write a structured report with headings, key takeaways, and citations. Be thorough.",
  learn:
    "Teach step-by-step with short checkpoints. Ask rhetorical questions and include citations.",
};

const SOURCE_INSTRUCTIONS: Record<SourceMode, string> = {
  web: "Use web sources when needed and provide citations.",
  none:
    "Do not browse the web or use external sources. Answer from general knowledge and say when uncertain.",
};

export async function answerWithOpenAI(
  question: string,
  mode: AnswerMode,
  sources: SourceMode
): Promise<AnswerResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const start = Date.now();

  const tools =
    sources === "web" ? [{ type: "web_search_preview" as const }] : [];

  const response = await client.responses.create({
    model,
    input: question,
    instructions: `${MODE_INSTRUCTIONS[mode]} ${SOURCE_INSTRUCTIONS[sources]}`,
    tools,
    tool_choice: tools.length ? "auto" : "none",
  });

  const output = Array.isArray(response.output) ? response.output : [];
  const answerText = extractTextFromOutput(output);
  const citations = sources === "web" ? extractCitationsFromOutput(output) : [];

  return {
    id: nanoid(),
    question,
    answer: answerText || "No answer returned.",
    mode,
    sources,
    createdAt: new Date().toISOString(),
    citations,
    provider: "openai",
    latencyMs: Date.now() - start,
  };
}
