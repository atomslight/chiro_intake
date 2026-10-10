import { z } from "zod";

/** Shared survey schema — single source for patient flow, template view, edits, validation, progress and report. */

export const ruleOpSchema = z.enum(["equals", "not_equals", "contains", "one_of", "answered", "not_answered"]);
export const ruleSchema = z.object({
  question: z.string().min(1),
  op: ruleOpSchema,
  value: z.union([z.string(), z.array(z.string())]).optional(),
});

export const questionTypeSchema = z.enum(["choice", "multi", "yes_no", "text", "longtext", "number", "scale", "date", "body_areas"]);

export const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  type: questionTypeSchema,
  required: z.boolean(),
  /** Optional, but the practice wants it flagged for review when blank. */
  reviewExpected: z.boolean().optional(),
  options: z.array(z.string().min(1)).optional(),
  exclusiveOptions: z.array(z.string()).optional(),
  allowUnsure: z.boolean().optional(),
  /** Label of a "not applicable" choice, stored as the value "not_applicable". */
  notApplicableLabel: z.string().optional(),
  allowOther: z.boolean().optional(),
  placeholder: z.string().optional(),
  showIf: ruleSchema.optional(),
});

export const groupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  help: z.string().optional(),
  phase: z.number().int().min(0).max(4),
  showIf: ruleSchema.optional(),
  highlight: z.boolean().optional(),
  questions: z.array(questionSchema).min(1),
});

export const moduleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  scope: z.enum(["once", "per_area"]),
  groups: z.array(groupSchema).min(1),
});

export const surveySchema = z.object({
  id: z.string(),
  name: z.string(),
  revision: z.number().int().nonnegative(),
  phases: z.array(z.string()).min(1).max(5),
  modules: z.array(moduleSchema).min(1),
});

/** Allowlisted edit operations — the only way chat, AI and direct edits change a survey. */
export const newQuestionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/).max(60),
  label: z.string().min(1).max(300),
  type: z.enum(["choice", "multi", "yes_no", "text", "longtext", "number", "date"]),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(120)).max(20).optional(),
});
export const editableTypeSchema = z.enum(["choice", "multi", "yes_no", "text", "longtext", "number", "date"]);
export const surveyPatchSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_label"), question: z.string(), value: z.string().max(300) }),
  z.object({ op: z.literal("set_required"), question: z.string(), value: z.boolean() }),
  z.object({ op: z.literal("set_options"), question: z.string(), value: z.array(z.string().max(120)).max(20) }),
  z.object({ op: z.literal("set_type"), question: z.string(), value: editableTypeSchema, options: z.array(z.string().max(120)).max(20).optional() }),
  z.object({ op: z.literal("set_condition_value"), question: z.string(), value: z.string().max(120) }),
  z.object({ op: z.literal("set_group_condition_value"), group: z.string(), value: z.string().max(120) }),
  z.object({ op: z.literal("set_condition"), question: z.string(), rule: ruleSchema }),
  z.object({ op: z.literal("remove_condition"), question: z.string() }),
  z.object({ op: z.literal("set_group_condition"), group: z.string(), rule: ruleSchema }),
  z.object({ op: z.literal("remove_group_condition"), group: z.string() }),
  z.object({ op: z.literal("add_question"), group: z.string(), question: newQuestionSchema }),
  z.object({ op: z.literal("remove_question"), question: z.string() }),
  z.object({ op: z.literal("move_question"), question: z.string(), direction: z.enum(["up", "down"]) }),
  z.object({ op: z.literal("duplicate_question"), question: z.string(), newId: z.string().regex(/^[a-z0-9_]+$/).max(60) }),
  z.object({ op: z.literal("add_group"), module: z.string(), group: z.object({ id: z.string().regex(/^[a-z0-9_]+$/).max(60), title: z.string().min(1).max(200) }), question: newQuestionSchema }),
  z.object({ op: z.literal("rename_group"), group: z.string(), value: z.string().min(1).max(200) }),
  z.object({ op: z.literal("remove_group"), group: z.string() }),
]);
export type SurveyPatch = z.infer<typeof surveyPatchSchema>;

export type RuleOp = z.infer<typeof ruleOpSchema>;
export type SurveyRule = z.infer<typeof ruleSchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Group = z.infer<typeof groupSchema>;
export type SurveyModule = z.infer<typeof moduleSchema>;
export type Survey = z.infer<typeof surveySchema>;

export type AnswerValue = string | string[];
/** Keys: question id, or `${questionId}@${area}` for per-area modules. */
export type SurveyAnswers = Record<string, AnswerValue>;
export type AnswerStatus = "blank" | "answered" | "unsure" | "not_applicable";

export const UNSURE = "unsure";
export const NOT_APPLICABLE = "not_applicable";
export const OTHER_PREFIX = "Other: ";

/** A screen the patient sees: one group, optionally bound to a body area. */
export interface Screen {
  key: string;
  module: SurveyModule;
  group: Group;
  area?: string | undefined;
  questions: Question[];
}

export interface Submission2 {
  id: string;
  /** Snapshot of the survey version the patient answered — later edits never alter this intake. */
  survey: Survey;
  submittedAt: string;
  answers: SurveyAnswers;
}
