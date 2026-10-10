import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { surveySchema, type Survey, type SurveyAnswers } from "@/types/survey";
import { requireAdmin } from "./admin.server";
import { loadLatestVersion, logEvent } from "./surveys.server";
import { analyzeIntake, editSurvey, extractNarrative, generateSurvey, suggestCompletion, type AiFinding, type EditResult, type GenerateResult, type StoryFact } from "./ai/tasks.server";
import { mvaSurvey } from "@/data/mvaSurvey";
import { AiError } from "./ai/providers.server";

const friendly = (e: unknown) => (e instanceof AiError ? e.message : "The AI service couldn't complete this request.");

/** Practice: turn a plain-language request into allowlisted patches (validated, dry-run, never applied here). */
export const proposeEdit = createServerFn({ method: "POST" })
  .validator((d) => z.object({ request: z.string().min(1).max(1500), survey: z.unknown() }).parse(d))
  .handler(async ({ data }): Promise<EditResult> => {
    requireAdmin();
    const survey = surveySchema.parse(data.survey);
    try { const r = await editSurvey(survey, data.request); await logEvent(r.kind === "proposal" ? "ai_edit" : "ai_edit_failed", data.request, { result: r.kind }); return r; }
    catch (e) { return { kind: "rejected", message: `${friendly(e)} Nothing was changed — try again.` }; }
  });

/** Practice: build a whole intake from a description, starting from the PI module library. Never saved here. */
export const generateIntake = createServerFn({ method: "POST" })
  .validator((d) => z.object({ description: z.string().min(1).max(1500), survey: z.unknown() }).parse(d))
  .handler(async ({ data }): Promise<GenerateResult> => {
    requireAdmin();
    const current = surveySchema.parse(data.survey);
    try { const r = await generateSurvey(mvaSurvey, current, data.description); await logEvent(r.kind === "generated" ? "ai_generate" : "ai_generate_failed", data.description, { result: r.kind }); return r; }
    catch (e) { return { kind: "rejected", message: `${friendly(e)} Nothing was changed — try again.` }; }
  });

/** Patient: suggest answers from their own story. Suggestions only — the patient confirms each one. */
export const extractStory = createServerFn({ method: "POST" })
  .validator((d) => z.object({ story: z.string().min(20).max(6000), preview: z.boolean() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true; facts: StoryFact[] } | { ok: false; error: string }> => {
    let survey: Survey;
    if (data.preview) { requireAdmin(); survey = (await (await import("./surveys.server")).loadDraft()).survey; }
    else survey = (await loadLatestVersion()).survey;
    try { return { ok: true, facts: await extractNarrative(survey, data.story) }; }
    catch (e) { return { ok: false, error: `${friendly(e)} You can keep going and answer the questions instead.` }; }
  });

/** Practice: AI review of a saved submission. Result stored on the submission; failure keeps rule findings usable. */
export const analyzeSubmission = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.string().uuid(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data }): Promise<{ status: "ready"; findings: AiFinding[] } | { status: "failed"; error: string }> => {
    requireAdmin();
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const { data: row } = await sb.from("submissions").select("survey, answers, submitted_at, report_status, ai_findings").eq("id", data.id).maybeSingle();
    if (!row) return { status: "failed", error: "Intake not found." };
    if (row.report_status === "ready" && row.ai_findings && !data.force) return { status: "ready", findings: row.ai_findings as unknown as AiFinding[] };
    try {
      const findings = await analyzeIntake(row.survey as Survey, row.answers as SurveyAnswers, row.submitted_at);
      await sb.from("submissions").update({ report_status: "ready", ai_findings: findings as never, ai_error: null }).eq("id", data.id);
      return { status: "ready", findings };
    } catch (e) {
      const error = friendly(e);
      await sb.from("submissions").update({ report_status: "failed", ai_error: error }).eq("id", data.id);
      return { status: "failed", error };
    }
  });

/** Practice: short inline continuation for the AI Generate box. Never sends or applies anything. */
export const suggestCompletionFn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ text: z.string().min(1).max(1500) }).parse(d))
  .handler(async ({ data }): Promise<{ completion: string }> => {
    requireAdmin();
    try { return { completion: await suggestCompletion(data.text) }; } catch { return { completion: "" }; }
  });
