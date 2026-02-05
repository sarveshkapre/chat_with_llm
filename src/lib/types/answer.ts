export type AnswerMode = "quick" | "research" | "learn";
export type SourceMode = "web" | "none";

export type Citation = {
  title: string;
  url: string;
};

export type Answer = {
  id: string;
  question: string;
  answer: string;
  mode: AnswerMode;
  sources: SourceMode;
  createdAt: string;
  citations: Citation[];
};

export type AnswerRequest = {
  question: string;
  mode: AnswerMode;
  sources: SourceMode;
};

export type AnswerResponse = Answer & {
  provider: string;
  latencyMs: number;
};
