import type { AnswerMode, AnswerResponse, SourceMode } from "@/lib/types/answer";
import { answerWithMock } from "@/lib/providers/mock";
import { answerWithOpenAI } from "@/lib/providers/openai";

export async function answerWithProvider(
  question: string,
  mode: AnswerMode,
  sources: SourceMode
): Promise<AnswerResponse> {
  const provider = process.env.PROVIDER ?? "auto";
  if (provider === "mock") {
    return answerWithMock(question, mode, sources);
  }

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return answerWithOpenAI(question, mode, sources);
  }

  if (process.env.OPENAI_API_KEY) {
    return answerWithOpenAI(question, mode, sources);
  }

  return answerWithMock(question, mode, sources);
}
