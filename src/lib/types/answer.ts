export type AnswerMode = "quick" | "research" | "learn";

export type Citation = {
  title: string;
  url: string;
};

export type Answer = {
  id: string;
  question: string;
  answer: string;
  mode: AnswerMode;
  createdAt: string;
  citations: Citation[];
};

export type AnswerRequest = {
  question: string;
  mode: AnswerMode;
};

export type AnswerResponse = Answer & {
  provider: string;
  latencyMs: number;
};
