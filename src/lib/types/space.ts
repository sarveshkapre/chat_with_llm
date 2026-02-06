export type SpaceSourcePolicy = "flex" | "web" | "offline";

export type Space = {
  id: string;
  name: string;
  instructions: string;
  preferredModel?: string | null;
  sourcePolicy?: SpaceSourcePolicy;
  createdAt: string;
};
