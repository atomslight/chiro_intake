import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mvaSurvey } from "@/data/mvaSurvey";
import { surveySchema, type Survey } from "@/types/survey";

export const TEMPLATE_ID = "mva";

/** Record a practice action for the Stats page. Never blocks or fails the action itself. */
export async function logEvent(action: string, detail = "", meta: Record<string, unknown> = {}) {
  try { await supabaseAdmin.from("admin_events").insert({ action, detail: detail.slice(0, 300), meta: meta as never }); } catch { /* logging is best-effort */ }
}

export const countSurvey = (s: Survey) => ({ sections: s.modules.length, questions: s.modules.reduce((n, m) => n + m.groups.reduce((k, g) => k + g.questions.length, 0), 0) });

/** Keep a reusable copy of a published intake, keyed by its name. */
export async function saveTemplateCopy(survey: Survey) {
  const c = countSurvey(survey);
  await supabaseAdmin.from("saved_templates").upsert({ name: survey.name.slice(0, 120), survey: survey as never, sections: c.sections, questions: c.questions, updated_at: new Date().toISOString() }, { onConflict: "name" });
}

// Per-worker memo: the template setup check only needs to run once per running instance.
let ensured: Promise<void> | null = null;

/** Creates the starting draft and published v1 the first time the template is used (idempotent). */
export function ensureTemplate(templateId = TEMPLATE_ID) {
  if (!ensured) ensured = ensureTemplateOnce(templateId).catch((e) => { ensured = null; throw e; });
  return ensured;
}

async function ensureTemplateOnce(templateId: string) {
  if (templateId !== TEMPLATE_ID) throw new Error("Unknown template.");
  const { data: draft } = await supabaseAdmin.from("survey_drafts").select("template_id").eq("template_id", templateId).maybeSingle();
  if (!draft) {
    await supabaseAdmin.from("survey_drafts").upsert({ template_id: templateId, survey: mvaSurvey as never, revision: 0 }, { onConflict: "template_id", ignoreDuplicates: true });
  }
  const { count } = await supabaseAdmin.from("survey_versions").select("id", { count: "exact", head: true }).eq("template_id", templateId);
  if (!count) {
    await supabaseAdmin.from("survey_versions").upsert({ template_id: templateId, version: 1, survey: mvaSurvey as never, note: "Starting template" }, { onConflict: "template_id,version", ignoreDuplicates: true });
    return;
  }
  // One-time upgrade: older demo templates used five phases; publish the shorter three-phase demo as a new version.
  const { data: latest } = await supabaseAdmin.from("survey_versions").select("version, survey").eq("template_id", templateId).order("version", { ascending: false }).limit(1).single();
  const name = (latest?.survey as { name?: string } | null)?.name;
  if (latest && name !== mvaSurvey.name && name?.startsWith("Motor Vehicle Accident")) {
    await supabaseAdmin.from("survey_versions").upsert({ template_id: templateId, version: latest.version + 1, survey: mvaSurvey as never, note: "Concise intake (7 modules)" }, { onConflict: "template_id,version", ignoreDuplicates: true });
    const { data: d } = await supabaseAdmin.from("survey_drafts").select("revision").eq("template_id", templateId).single();
    await supabaseAdmin.from("survey_drafts").update({ survey: { ...mvaSurvey, revision: (d?.revision ?? 0) + 1 } as never, revision: (d?.revision ?? 0) + 1 }).eq("template_id", templateId);
  }
}

export async function loadDraft(templateId = TEMPLATE_ID) {
  await ensureTemplate(templateId);
  const { data, error } = await supabaseAdmin.from("survey_drafts").select("survey, revision, updated_at").eq("template_id", templateId).single();
  if (error || !data) throw new Error("Could not load the draft.");
  return { survey: surveySchema.parse(data.survey) as Survey, revision: data.revision, updatedAt: data.updated_at };
}

export async function loadLatestVersion(templateId = TEMPLATE_ID) {
  await ensureTemplate(templateId);
  const { data, error } = await supabaseAdmin.from("survey_versions").select("id, version, survey, published_at").eq("template_id", templateId).order("version", { ascending: false }).limit(1).single();
  if (error || !data) throw new Error("No published version.");
  return { versionId: data.id, version: data.version, survey: surveySchema.parse(data.survey) as Survey, publishedAt: data.published_at };
}
