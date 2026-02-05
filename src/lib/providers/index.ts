import type { AnswerMode, AnswerResponse } from "@/lib/types/answer";
import { answerWithMock } from "@/lib/providers/mock";
import { answerWithOpenAI } from "@/lib/providers/openai";

export async function answerWithProvider(
  question: string,
  mode: AnswerMode
): Promise<AnswerResponse> {
  const provider = process.env.PROVIDER ?? "auto";
  if (provider === "mock") {
    return answerWithMock(question, mode);
  }

  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return answerWithOpenAI(question, mode);
  }

  if (process.env.OPENAI_API_KEY) {
    return answerWithOpenAI(question, mode);
  }

  return answerWithMock(question, mode);
}
