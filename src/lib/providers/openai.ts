import OpenAI from "openai";
import { nanoid } from "nanoid";
import type {
  AnswerMode,
  AnswerResponse,
  SourceMode,
  Attachment,
} from "@/lib/types/answer";
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

function formatAttachments(attachments: Attachment[]): string {
  if (!attachments.length) return "";

  const usable = attachments
    .filter((attachment) => attachment.text && !attachment.error)
    .slice(0, 5);

  if (!usable.length) return "";

  const blocks = usable.map((attachment) => {
    const content = attachment.text?.slice(0, 4000) ?? "";
    return `Attachment: ${attachment.name}\n${content}`;
  });

  return `\n\nContext from attached files:\n${blocks.join("\n\n")}`;
}

function formatConversationContext(context?: string) {
  const trimmed = context?.trim();
  if (!trimmed) return "";
  return `\n\nConversation context:\n${trimmed.slice(0, 6000)}`;
}

export async function answerWithOpenAI(
  question: string,
  mode: AnswerMode,
  sources: SourceMode,
  context: string | undefined,
  attachments: Attachment[],
  spaceInstructions?: string,
  spaceMeta?: { id?: string; name?: string }
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

  const spaceBlock = spaceInstructions
    ? `Space instructions: ${spaceInstructions}`
    : "";

  const response = await client.responses.create({
    model,
    input: `${question}${formatConversationContext(context)}${formatAttachments(attachments)}`,
    instructions: [
      MODE_INSTRUCTIONS[mode],
      SOURCE_INSTRUCTIONS[sources],
      spaceBlock,
    ]
      .filter(Boolean)
      .join(" "),
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
    attachments,
    spaceId: spaceMeta?.id ?? null,
    spaceName: spaceMeta?.name ?? null,
    provider: "openai",
    latencyMs: Date.now() - start,
  };
}
