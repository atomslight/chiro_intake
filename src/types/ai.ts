import type { SurveyPatch } from "./survey";

export type EditResult =
  | { kind: "proposal"; module: string; summary: string; patches: SurveyPatch[]; diff: string[]; baseRevision: number }
  | { kind: "configured"; module: string; message: string }
  | { kind: "clarify" | "unsupported" | "rejected"; message: string };

export interface StoryFact { question: string; label: string; value: string | string[]; excerpt: string }

export interface AiFinding { title: string; detail: string; rowKeys: string[]; excerpt: string | null; question: string }

export type GenerateResult =
  | { kind: "generated"; summary: string; survey: import("./survey").Survey; diff: string[] }
  | { kind: "clarify" | "unsupported" | "rejected"; message: string };
