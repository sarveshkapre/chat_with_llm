import type {
  AnswerMode,
  AnswerResponse,
  SourceMode,
  Attachment,
} from "@/lib/types/answer";
import { answerWithMock } from "@/lib/providers/mock";
import { answerWithOpenAI } from "@/lib/providers/openai";

export async function answerWithProvider(
  question: string,
  mode: AnswerMode,
  sources: SourceMode,
  attachments: Attachment[],
  spaceInstructions?: string,
  spaceMeta?: { id?: string; name?: string }
): Promise<AnswerResponse> {
  const provider = process.env.PROVIDER ?? "auto";
  if (provider === "mock") {
    return answerWithMock(
      question,
      mode,
      sources,
      attachments,
      spaceInstructions,
      spaceMeta
    );
  }

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return answerWithOpenAI(
      question,
      mode,
      sources,
      attachments,
      spaceInstructions,
      spaceMeta
    );
  }

  if (process.env.OPENAI_API_KEY) {
    return answerWithOpenAI(
      question,
      mode,
      sources,
      attachments,
      spaceInstructions,
      spaceMeta
    );
  }

  return answerWithMock(
    question,
    mode,
    sources,
    attachments,
    spaceInstructions,
    spaceMeta
  );
}
