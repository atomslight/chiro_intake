import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { surveySchema, type Submission2, type Survey, type SurveyAnswers } from "@/types/survey";
import { checkPasscode, endAdminSession, isAdmin, passcodeConfigured, requireAdmin, startAdminSession } from "./admin.server";
import { countSurvey, loadDraft, loadLatestVersion, logEvent, saveTemplateCopy, TEMPLATE_ID } from "./surveys.server";
import { activeAnswers } from "./surveyEngine";
import type { AiFinding } from "@/types/ai";

export interface StoryResult { text: string; confirmed: { question: string; value: string | string[]; excerpt: string }[] }

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const answersSchema = z.record(z.string().max(200), z.union([z.string().max(5000), z.array(z.string().max(500)).max(50)]));

// ---------- Practice access ----------
export const getAdminStatus = createServerFn({ method: "GET" }).handler(async () => ({ signedIn: isAdmin(), configured: passcodeConfigured() }));

export const adminSignIn = createServerFn({ method: "POST" })
  .validator((d) => z.object({ passcode: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    if (!passcodeConfigured()) return { ok: false as const, error: "The practice passcode hasn't been set up yet." };
    if (!checkPasscode(data.passcode)) return { ok: false as const, error: "That passcode is not correct." };
    startAdminSession();
    await logEvent("sign_in", "Practice signed in");
    return { ok: true as const };
  });

export const adminSignOut = createServerFn({ method: "POST" }).handler(async () => { endAdminSession(); return { ok: true }; });

// ---------- Patient (public) ----------
export const getPublishedSurvey = createServerFn({ method: "GET" }).handler(async () => {
  const v = await loadLatestVersion();
  return { versionId: v.versionId, version: v.version, survey: v.survey };
});

/** Saved draft for practice preview — never shown to patients. */
export const getPreviewSurvey = createServerFn({ method: "GET" }).handler(async () => {
  requireAdmin();
  const d = await loadDraft();
  return { survey: d.survey, revision: d.revision };
});

export const submitIntake = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.string().uuid(), versionId: z.string().uuid().nullable(), preview: z.boolean(), answers: answersSchema, story: z.object({ text: z.string().max(6000), confirmed: z.array(z.object({ question: z.string().max(100), value: z.union([z.string().max(500), z.array(z.string().max(200)).max(20)]), excerpt: z.string().max(500) })).max(40) }).nullable().optional() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: existing } = await sb.from("submissions").select("id").eq("id", data.id).maybeSingle();
    if (existing) return { id: data.id, duplicate: true };
    let survey: Survey; let versionId: string | null = null;
    if (data.preview) {
      requireAdmin();
      survey = (await loadDraft()).survey;
    } else {
      if (!data.versionId) throw new Error("Missing survey version.");
      const { data: v, error } = await sb.from("survey_versions").select("id, survey").eq("id", data.versionId).single();
      if (error || !v) throw new Error("That survey version no longer exists.");
      survey = surveySchema.parse(v.survey); versionId = v.id;
    }
    const answers = activeAnswers(survey, data.answers as SurveyAnswers);
    const { error } = await sb.from("submissions").upsert({
      id: data.id, template_id: TEMPLATE_ID, version_id: versionId, is_preview: data.preview, survey: survey as never, answers: answers as never, report_status: "pending", story: (data.story ?? null) as never,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("Could not save the intake. Please try again.");
    return { id: data.id, duplicate: false };
  });

// ---------- Practice workspace ----------
export const getPracticeTemplate = createServerFn({ method: "GET" }).handler(async () => {
  requireAdmin();
  const sb = await db();
  // Independent reads run in parallel.
  const [draft, { data: versions }, { data: subs }] = await Promise.all([
    loadDraft(),
    sb.from("survey_versions").select("id, version, note, published_at").eq("template_id", TEMPLATE_ID).order("version", { ascending: false }),
    sb.from("submissions").select("version_id").eq("template_id", TEMPLATE_ID).eq("is_preview", false),
  ]);
  const counts = new Map<string, number>();
  for (const s of subs ?? []) if (s.version_id) counts.set(s.version_id, (counts.get(s.version_id) ?? 0) + 1);
  return {
    survey: draft.survey, revision: draft.revision, updatedAt: draft.updatedAt,
    versions: (versions ?? []).map((v) => ({ id: v.id, version: v.version, note: v.note, publishedAt: v.published_at, submissions: counts.get(v.id) ?? 0 })),
  };
});

const saveInput = z.object({ survey: z.unknown(), baseRevision: z.number().int().min(0) });

async function writeDraft(raw: unknown, baseRevision: number) {
  const survey = surveySchema.parse(raw);
  const sb = await db();
  const { data, error } = await sb.from("survey_drafts").update({ survey: survey as never, revision: baseRevision + 1, updated_at: new Date().toISOString() })
    .eq("template_id", TEMPLATE_ID).eq("revision", baseRevision).select("revision");
  if (error) throw new Error("Could not save the draft.");
  if (!data?.length) return { ok: false as const, error: "The draft was changed elsewhere since you loaded it. Reload to see the latest version — nothing was saved." };
  return { ok: true as const, survey, revision: baseRevision + 1 };
}

export const saveDraft = createServerFn({ method: "POST" })
  .validator((d) => saveInput.parse(d))
  .handler(async ({ data }) => {
    requireAdmin();
    const r = await writeDraft(data.survey, data.baseRevision);
    if (r.ok) await logEvent("save_draft", r.survey.name, countSurvey(r.survey));
    return r;
  });

export const publishDraft = createServerFn({ method: "POST" })
  .validator((d) => saveInput.extend({ note: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin();
    const saved = await writeDraft(data.survey, data.baseRevision);
    if (!saved.ok) return saved;
    const sb = await db();
    const latest = await loadLatestVersion();
    const { data: row, error } = await sb.from("survey_versions").insert({ template_id: TEMPLATE_ID, version: latest.version + 1, survey: saved.survey as never, note: data.note.trim() }).select("id, version").single();
    if (error || !row) return { ok: false as const, error: "Publishing failed — the draft was saved but no new version was created. Try again." };
    await Promise.all([saveTemplateCopy(saved.survey), logEvent("publish", `${saved.survey.name} — version ${row.version}`, { version: row.version, note: data.note.trim(), ...countSurvey(saved.survey) })]);
    return { ok: true as const, revision: saved.revision, version: row.version };
  });

export const listSubmissions = createServerFn({ method: "GET" }).handler(async () => {
  requireAdmin();
  const sb = await db();
  const { data } = await sb.from("submissions").select("id, survey, answers, submitted_at, is_preview, report_status, version_id, survey_versions(version)").order("submitted_at", { ascending: false }).limit(100);
  return (data ?? []).map(toSubmission);
});

export const getSubmission = createServerFn({ method: "GET" })
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin();
    const sb = await db();
    const { data: row } = await sb.from("submissions").select("id, survey, answers, submitted_at, is_preview, report_status, version_id, ai_findings, ai_error, story, survey_versions(version)").eq("id", data.id).maybeSingle();
    return row ? toSubmission(row) : null;
  });

export type SavedSubmission = Submission2 & { preview: boolean; version: number | null; reportStatus: string; aiFindings: AiFinding[] | null; aiError: string | null; story: StoryResult | null };

function toSubmission(r: { id: string; survey: unknown; answers: unknown; submitted_at: string; is_preview: boolean; report_status: string; survey_versions: { version: number } | null; ai_findings?: unknown; ai_error?: string | null; story?: unknown }): SavedSubmission {
  return { id: r.id, survey: r.survey as Survey, answers: r.answers as SurveyAnswers, submittedAt: r.submitted_at, preview: r.is_preview, version: r.survey_versions?.version ?? null, reportStatus: r.report_status,
    aiFindings: (r.ai_findings as AiFinding[] | null) ?? null, aiError: r.ai_error ?? null, story: (r.story as StoryResult | null) ?? null };
}

// ---------- Saved templates (reusable copies of published intakes) ----------
export const listSavedTemplates = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await db();
  const { data } = await sb.from("saved_templates").select("id, name, sections, questions, updated_at").order("updated_at", { ascending: false }).limit(50);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, sections: r.sections, questions: r.questions, updatedAt: r.updated_at }));
});

export const getSavedTemplate = createServerFn({ method: "GET" })
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin();
    const sb = await db();
    const { data: row } = await sb.from("saved_templates").select("name, survey").eq("id", data.id).maybeSingle();
    if (!row) return null;
    await logEvent("use_template", row.name);
    return surveySchema.parse(row.survey) as Survey;
  });

export const deleteSavedTemplate = createServerFn({ method: "POST" })
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    requireAdmin();
    const sb = await db();
    const { data: row } = await sb.from("saved_templates").delete().eq("id", data.id).select("name").maybeSingle();
    if (row) await logEvent("delete_template", row.name);
    return { ok: true };
  });

// ---------- Stats ----------
export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  requireAdmin();
  const sb = await db();
  const [ev, subs, vers, tpl] = await Promise.all([
    sb.from("admin_events").select("id, action, detail, created_at").order("created_at", { ascending: false }).limit(200),
    sb.from("submissions").select("id", { count: "exact", head: true }).eq("is_preview", false),
    sb.from("survey_versions").select("id", { count: "exact", head: true }).eq("template_id", TEMPLATE_ID),
    sb.from("saved_templates").select("id", { count: "exact", head: true }),
  ]);
  const events = (ev.data ?? []).map((e) => ({ id: e.id, action: e.action, detail: e.detail, at: e.created_at }));
  const byAction: Record<string, number> = {};
  for (const e of events) byAction[e.action] = (byAction[e.action] ?? 0) + 1;
  return { events, byAction, submissions: subs.count ?? 0, versions: vers.count ?? 0, savedTemplates: tpl.count ?? 0 };
});
