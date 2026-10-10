import { z } from "zod";
import { newQuestionSchema, surveyPatchSchema, type Survey, type SurveyAnswers, type SurveyPatch } from "@/types/survey";
import { applyPatches, buildReport, validateSurvey, validateValue, type GeneratedReport } from "@/lib/surveyEngine";
import { jsonWithFallback } from "./providers.server";
import type { AiFinding, EditResult, GenerateResult, StoryFact } from "@/types/ai";
export type { AiFinding, EditResult, GenerateResult, StoryFact };

// ---------- Survey outline for prompts ----------
function outline(survey: Survey): string {
  const lines: string[] = [];
  for (const m of survey.modules) {
    lines.push(`MODULE ${m.id} "${m.title}"${m.scope === "per_area" ? " (repeats per body area)" : ""}`);
    for (const g of m.groups) {
      lines.push(`  SECTION ${g.id} "${g.title}"${g.showIf ? ` showIf ${JSON.stringify(g.showIf)}` : ""}`);
      for (const q of g.questions) {
        const opts = q.type === "yes_no" ? ["Yes", "No"] : q.options;
        lines.push(`    Q ${q.id} [${q.type}${q.required ? ", required" : ", optional"}] "${q.label}"${opts ? ` options=${JSON.stringify(opts)}` : ""}${q.showIf ? ` showIf ${JSON.stringify(q.showIf)}` : ""}`);
      }
    }
  }
  return lines.join("\n");
}

// ---------- editSurvey ----------
const editReply = z.object({
  kind: z.enum(["proposal", "clarify", "unsupported", "configured"]),
  message: z.string().max(600),
  summary: z.string().max(200).optional().nullable(),
  module: z.string().optional().nullable(),
  patches: z.array(z.unknown()).max(30).optional().nullable(),
});


const PATCH_OPS = `Allowed patch ops (exact shapes):
{"op":"set_label","question":id,"value":text}
{"op":"set_required","question":id,"value":boolean}
{"op":"set_options","question":id,"value":[choices]}   (only for choice/multi questions)
{"op":"set_type","question":id,"value":"choice"|"multi"|"yes_no"|"text"|"longtext"|"number"|"date","options":[choices] (when choice/multi)}
{"op":"set_condition","question":id,"rule":{"question":earlierQuestionId,"op":"equals"|"not_equals"|"one_of"|"contains"|"answered"|"not_answered","value":text or [texts]}}
{"op":"remove_condition","question":id}
{"op":"set_group_condition","group":sectionId,"rule":{...same rule shape}}
{"op":"remove_group_condition","group":sectionId}
{"op":"add_question","group":sectionId,"question":{"id":snake_case_new_id,"label":text,"type":"choice"|"multi"|"yes_no"|"text"|"longtext"|"number"|"date","required":boolean,"options":[...] (choice/multi only)}}
{"op":"remove_question","question":id}
{"op":"move_question","question":id,"direction":"up"|"down"}
{"op":"add_group","module":moduleId,"group":{"id":snake_case_new_id,"title":text},"question":{...new question}}
{"op":"rename_group","group":sectionId,"value":text}
{"op":"remove_group","group":sectionId}
Condition rules may only refer to questions asked EARLIER in the outline, and values must be exact listed options (yes_no uses "Yes"/"No").
To say "only ask a whole section if X", prefer set_group_condition on that section.`;

const EDIT_SYSTEM = `You edit a chiropractic personal-injury intake questionnaire for a practice.
You never write code. You reply ONLY with a JSON object:
{"kind":"proposal"|"clarify"|"unsupported"|"configured","message":string,"summary":string,"module":string,"patches":[...]}
${PATCH_OPS}
Rules:
- A single request may contain several changes; include patches for all of them in one proposal.
- Use only ids that appear in the outline (new ids only for added items).
- If every part of the request is already satisfied, kind="configured" and explain.
- If the request is ambiguous, kind="clarify" with ONE short focused question.
- If it can't be done with these ops (e.g. styling, consent wording, diagnosis/legal judgement), kind="unsupported" and say honestly what can't be done.
- "module" is the module id most affected. "summary" is a short plain-English title of the change.
- Never add questions that ask the patient for a diagnosis or ask who was at fault.`;

/** Fix harmless differences in AI patches (labels instead of ids, "yes"/"true" strings, arrays as strings) before strict checking. */
export function normalizePatch(survey: Survey, p: unknown): unknown {
  if (!p || typeof p !== "object") return p;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o: any = { ...(p as object) };
  const qs = survey.modules.flatMap((m) => m.groups.flatMap((g) => g.questions));
  const gs = survey.modules.flatMap((m) => m.groups);
  const low = (s: string) => s.toLowerCase().replace(/[?.:]/g, "").trim();
  const qId = (v: unknown) => typeof v === "string" && !qs.some((q) => q.id === v) ? qs.find((q) => low(q.label) === low(v))?.id ?? v : v;
  const gId = (v: unknown) => typeof v === "string" && !gs.some((g) => g.id === v) ? gs.find((g) => low(g.title) === low(v))?.id ?? v : v;
  const bool = (v: unknown) => typeof v === "string" ? (/^(true|yes|required)$/i.test(v) ? true : /^(false|no|optional)$/i.test(v) ? false : v) : v;
  if (typeof o.op === "string") o.op = o.op.trim().toLowerCase();
  if (o.question && typeof o.question === "string") o.question = qId(o.question);
  if (o.question_id && !o.question) { o.question = qId(o.question_id); delete o.question_id; }
  if (o.group && typeof o.group === "string") o.group = gId(o.group);
  if (o.op === "set_required") o.value = bool(o.value);
  if (o.op === "set_options" && typeof o.value === "string") o.value = o.value.split(/\s*[,;|]\s*/).filter(Boolean);
  for (const k of ["rule"] as const) {
    const r = o[k];
    if (r && typeof r === "object") { const rr: any = { ...(r as object) }; rr.question = qId(rr.question); o[k] = rr; }
  }
  for (const k of ["question"] as const) {
    const nq = o[k];
    if (nq && typeof nq === "object") { const q: any = { ...(nq as object) }; q.required = bool(q.required) ?? false; o[k] = q; }
  }
  return o;
}

function checkPatches(survey: Survey, raw: unknown[]): { patches: SurveyPatch[]; errors: string[] } {
  const patches: SurveyPatch[] = []; const errors: string[] = [];
  raw.forEach((p, i) => {
    const ok = surveyPatchSchema.safeParse(normalizePatch(survey, p));
    if (ok.success) patches.push(ok.data);
    else errors.push(`patch ${i + 1} ${JSON.stringify(p).slice(0, 200)}: ${ok.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ")}`);
  });
  return { patches, errors };
}

const EDIT_FAIL = "I couldn't turn that into a safe edit, so nothing was changed. Try one change at a time, e.g. \"Make the attorney name question optional\" or \"Add an optional yes/no question: Did your airbag deploy?\"";

export async function editSurvey(survey: Survey, request: string): Promise<EditResult> {
  const user = `QUESTIONNAIRE OUTLINE:\n${outline(survey)}\n\nPRACTICE REQUEST:\n${request}`;
  let raw = await jsonWithFallback("groq", EDIT_SYSTEM, user);
  let parsed = editReply.safeParse(raw);
  let checked = parsed.success && parsed.data.kind === "proposal" ? checkPatches(survey, parsed.data.patches ?? []) : { patches: [], errors: [] as string[] };
  if (!parsed.success || checked.errors.length) {
    const problems = parsed.success ? checked.errors.join("\n") : parsed.error.issues.map((x) => `${x.path.join(".")} ${x.message}`).join("; ");
    console.warn("[editSurvey] invalid AI reply, repairing:", problems);
    raw = await jsonWithFallback("groq", EDIT_SYSTEM, `${user}\n\nYOUR PREVIOUS REPLY WAS INVALID:\n${JSON.stringify(raw).slice(0, 3000)}\nPROBLEMS:\n${problems}\nReply again with corrected JSON using only the exact op shapes and ids from the outline.`);
    parsed = editReply.safeParse(raw);
    if (!parsed.success) { console.warn("[editSurvey] repair failed:", parsed.error.issues); return { kind: "rejected", message: EDIT_FAIL }; }
    checked = parsed.data.kind === "proposal" ? checkPatches(survey, parsed.data.patches ?? []) : { patches: [], errors: [] };
    if (checked.errors.length) { console.warn("[editSurvey] repair still invalid:", checked.errors); return { kind: "rejected", message: EDIT_FAIL }; }
  }
  const r = parsed.data;
  const moduleId = survey.modules.some((m) => m.id === r.module) ? r.module! : survey.modules[0]!.id;
  if (r.kind === "configured") return { kind: "configured", module: moduleId, message: r.message };
  if (r.kind !== "proposal") return { kind: r.kind, message: r.message };
  const patches = checked.patches;
  if (!patches.length) return { kind: "unsupported", message: r.message || "No change was proposed." };
  const dry = applyPatches(survey, patches, survey.revision);
  if (!dry.ok) return { kind: "rejected", message: `Can't apply this as a whole — ${dry.errors.join(" ")} Nothing was changed.` };
  return { kind: "proposal", module: moduleId, summary: r.summary || "Proposed change", patches, diff: dry.diff, baseRevision: survey.revision };
}

// ---------- extractNarrative ----------

const factsReply = z.object({ facts: z.array(z.object({ question: z.string(), value: z.union([z.string(), z.array(z.string())]), excerpt: z.string() })).max(40) });

const EXTRACT_SYSTEM = `You read a patient's own account of a vehicle accident and suggest answers to intake questions.
Reply ONLY with JSON: {"facts":[{"question":id,"value":string or [strings],"excerpt":exact quote from the story}]}
Rules:
- Only include a fact when the story states it clearly. Never guess or infer. Never diagnose or judge fault.
- "excerpt" must be copied word-for-word from the story (a short phrase).
- For choice/yes_no questions, the value must be exactly one of the listed options. For multi, an array of listed options.
- Dates as MM/DD/YYYY, only if a full date is stated.
- Skip questions that the story doesn't address.`;

const norm = (s: string) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim();

export async function extractNarrative(survey: Survey, story: string): Promise<StoryFact[]> {
  const eligible = survey.modules.filter((m) => m.scope === "once" && m.id !== "narrative").flatMap((m) => m.groups.flatMap((g) => g.questions))
    .filter((q) => ["choice", "multi", "yes_no", "date", "number", "text"].includes(q.type));
  const list = eligible.map((q) => `${q.id} [${q.type}] "${q.label}"${q.type === "yes_no" ? ' options=["Yes","No"]' : q.options ? ` options=${JSON.stringify(q.options)}` : ""}`).join("\n");
  const raw = await jsonWithFallback("gemini", EXTRACT_SYSTEM, `QUESTIONS:\n${list}\n\nSTORY:\n${story}`);
  const parsed = factsReply.safeParse(raw);
  if (!parsed.success) throw new Error("unreadable");
  const story_n = norm(story);
  const out: StoryFact[] = [];
  for (const f of parsed.data.facts) {
    const q = eligible.find((x) => x.id === f.question);
    if (!q || !f.excerpt.trim() || !story_n.includes(norm(f.excerpt))) continue;
    const allowed = q.type === "yes_no" ? ["Yes", "No"] : q.options;
    let value: string | string[] = f.value;
    if (q.type === "multi") {
      const arr = (Array.isArray(value) ? value : [value]).filter((v) => allowed?.includes(v));
      if (!arr.length) continue; value = arr;
    } else {
      if (Array.isArray(value)) continue;
      if (allowed && !allowed.includes(value)) continue;
      if (validateValue(q, value)) continue;
      if (!value.trim()) continue;
    }
    out.push({ question: q.id, label: q.label, value, excerpt: f.excerpt.trim() });
  }
  return out;
}

// ---------- analyzeIntake ----------

const findingsReply = z.object({ findings: z.array(z.object({
  title: z.string(), detail: z.string(), rowKeys: z.array(z.string()).max(4), excerpt: z.string().nullable().optional(), question: z.string(),
})).max(12) });

const ANALYZE_SYSTEM = `You help a chiropractic front desk review a patient-reported personal-injury intake.
Find only POSSIBLE INCONSISTENCIES: places where the patient's own story conflicts with a structured answer, or two answers conflict.
Reply ONLY with JSON: {"findings":[{"title":short neutral title,"detail":one neutral sentence,"rowKeys":[row keys involved],"excerpt":exact quote from the story or null,"question":a neutral follow-up question staff could ask}]}
Rules:
- Neutral, cautious wording ("may", "possible"). Never diagnose, never judge causation, fault, credibility or claim value.
- Every finding must cite at least one rowKey from the list. Excerpts must be copied word-for-word from the story.
- Don't report blanks, "not sure" answers or missing info — those are handled separately.
- Returning zero findings is correct when nothing conflicts.`;

export async function analyzeIntake(survey: Survey, answers: SurveyAnswers, submittedAt: string): Promise<AiFinding[]> {
  const report: GeneratedReport = buildReport({ id: "x", survey, answers, submittedAt });
  const rows = report.sections.flatMap((s) => s.rows.filter((r) => r.status === "answered").map((r) => ({ ...r, section: s.title })));
  if (!rows.length) return [];
  const rowText = rows.map((r) => `${r.key} | ${r.section} | ${r.label} = ${r.value}`).join("\n");
  const raw = await jsonWithFallback("gemini", ANALYZE_SYSTEM, `ROWS (key | section | question = answer):\n${rowText}\n\nPATIENT STORY:\n${report.narrative || "(none)"}`);
  const parsed = findingsReply.safeParse(raw);
  if (!parsed.success) throw new Error("unreadable");
  const keys = new Set(rows.map((r) => r.key));
  const banned = /\b(diagnos|whiplash|fracture|herniat|malinger|lying|fraud|at fault|caused by the accident)\w*/i;
  const story = norm(report.narrative);
  const seen = new Set<string>();
  const out: AiFinding[] = [];
  for (const f of parsed.data.findings) {
    const rk = [...new Set(f.rowKeys.filter((k) => keys.has(k)))];
    if (!rk.length) continue;
    if (banned.test(f.title) || banned.test(f.detail) || banned.test(f.question)) continue;
    const excerpt = f.excerpt && story.includes(norm(f.excerpt)) ? f.excerpt.trim() : null;
    const sig = rk.slice().sort().join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ title: f.title.slice(0, 160), detail: f.detail.slice(0, 400), rowKeys: rk, excerpt, question: f.question.slice(0, 240) });
    if (out.length >= 6) break;
  }
  return out;
}

// ---------- generateSurvey (fresh, from a blank intake) ----------
const genSection = z.object({
  title: z.string().min(1).max(200),
  part: z.number().int().min(0).max(2).optional().nullable(),
  perArea: z.boolean().optional().nullable(),
  condition: z.unknown().optional().nullable(),
  questions: z.array(z.unknown()).max(12),
});
const genReply = z.object({
  kind: z.enum(["generated", "clarify", "unsupported"]),
  message: z.string().max(600).optional().nullable(),
  summary: z.string().max(200).optional().nullable(),
  name: z.string().max(120).optional().nullable(),
  sections: z.array(genSection).max(16).optional().nullable(),
  conditions: z.array(z.unknown()).max(30).optional().nullable(),
});

const GEN_SYSTEM = `You design a NEW chiropractic personal-injury intake questionnaire from scratch, from a plain-language description.
Do not copy any existing template; write only the sections and questions the description needs. Keep it short for patients (about 6-12 sections, 2-5 questions each).
Reply ONLY with JSON:
{"kind":"generated"|"clarify"|"unsupported","message":string,"summary":short plain title,"name":intake name,
 "sections":[{"title":question-style heading,"part":0|1|2,"perArea":boolean,"questions":[{"id":snake_case_unique,"label":text,"type":"choice"|"multi"|"yes_no"|"text"|"longtext"|"number"|"date","required":boolean,"options":[...] (choice/multi only, 2+)}]}],
 "conditions":[{"question":id,"rule":{"question":earlierQuestionId,"op":"equals"|"not_equals"|"one_of"|"contains"|"answered"|"not_answered","value":text or [texts]}}]}
Rules:
- part 0 = about the accident, 1 = symptoms, 2 = care/claim details. Order sections in that order.
- perArea=true means the section is asked again for each injured body area the patient picks (the app adds the body-area picker). Use it when the description asks for symptoms per body area.
- Ask about the accident once. Follow-up rules ("only ask X if Y") go in "conditions" and may refer only to questions asked earlier; yes_no values are "Yes"/"No"; choice values must be listed options.
- Do NOT include consent or the patient's free-text story — the app adds those separately.
- Never ask for a diagnosis or who was at fault. If not about a PI intake: kind="unsupported". If too vague: kind="clarify" with ONE question.`;

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "section";

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
/** Read size limits like "not exceeding 2 modules", "max 3 sections", "under 10 questions", "minimal". */
export function parseLimits(text: string): { maxSections?: number; maxQuestions?: number } {
  const t = text.toLowerCase();
  const n = (v: string) => NUM[v] ?? parseInt(v, 10);
  const num = "(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)";
  const lim = "(?:not exceeding|not more than|no more than|max(?:imum)?(?: of)?|at most|up to|under|less than|within|only|exactly)?\\s*";
  const out: { maxSections?: number; maxQuestions?: number } = {};
  const sec = t.match(new RegExp(`${lim}${num}\\s*(?:modules?|sections?|parts?|phases?|pages?|steps?)`)) ?? t.match(/(?:phase|part|module)s?\s*(\d)\b/);
  if (sec) { const v = n(sec[1]!); if (v >= 1 && v <= 10) out.maxSections = v; }
  const q = t.match(new RegExp(`${lim}${num}\\s*questions?`));
  if (q) { const v = n(q[1]!); if (v >= 1 && v <= 60) out.maxQuestions = /under|less than/.test(q[0]) ? v - 1 : v; }
  if (!out.maxSections && /\b(minimal|short|brief|quick)\b/.test(t)) out.maxSections = 3;
  return out;
}

export async function generateSurvey(library: Survey, current: Survey, description: string): Promise<GenerateResult> {
  const limits = parseLimits(description);
  const hard = [limits.maxSections && `HARD LIMIT: at most ${limits.maxSections} sections in total${limits.maxSections <= 2 ? ", and do not use perArea" : ""}.`, limits.maxQuestions && `HARD LIMIT: at most ${limits.maxQuestions} questions in total.`].filter(Boolean).join("\n");
  let raw = await jsonWithFallback("gemini", GEN_SYSTEM, `DESCRIPTION:\n${description}${hard ? `\n\n${hard}` : ""}`);
  {
    const first = genReply.safeParse(raw);
    const secs = first.success ? first.data.sections?.length ?? 0 : 0;
    if (first.success && limits.maxSections && secs > limits.maxSections) {
      raw = await jsonWithFallback("gemini", GEN_SYSTEM, `DESCRIPTION:\n${description}\n\n${hard}\nYour previous answer had ${secs} sections. Merge them into at most ${limits.maxSections} and reply with the full JSON again.`).catch(() => raw);
    }
  }
  const parsed = genReply.safeParse(raw);
  if (!parsed.success) return { kind: "rejected", message: "The AI's answer didn't match the allowed format, so nothing was changed. Try rephrasing." };
  const r = parsed.data;
  if (r.kind !== "generated") return { kind: r.kind, message: r.message || "Please describe the intake in a bit more detail." };

  const reserved = new Set(["areas", "narrative"]);
  const usedQ = new Set<string>(reserved);
  const usedG = new Set<string>(["areas", "narrative"]);
  type G = Survey["modules"][number]["groups"][number];
  const once0: G[] = [], area: G[] = [], onceRest: G[] = [];
  let dropped = 0;
  for (const s of r.sections ?? []) {
    const qs: G["questions"] = [];
    for (const rq of s.questions) {
      const ok = newQuestionSchema.safeParse(rq);
      if (!ok.success) { dropped++; continue; }
      const nq = ok.data;
      if (usedQ.has(nq.id)) { dropped++; continue; }
      if ((nq.type === "choice" || nq.type === "multi") && (nq.options?.length ?? 0) < 2) { dropped++; continue; }
      if (nq.type !== "choice" && nq.type !== "multi") delete nq.options;
      usedQ.add(nq.id);
      qs.push({ ...nq, label: nq.label.trim() });
    }
    if (!qs.length) continue;
    let gid = slug(s.title); while (usedG.has(gid)) gid += "_2"; usedG.add(gid);
    const part = s.perArea ? 1 : (s.part ?? 0);
    const g: G = { id: gid, title: s.title.trim(), phase: part, questions: qs };
    (s.perArea ? area : part === 0 ? once0 : onceRest).push(g);
  }
  if (!once0.length && !area.length && !onceRest.length) return { kind: "rejected", message: "The AI didn't produce any usable questions. Nothing was changed — try describing the intake again." };

  if (limits.maxSections || limits.maxQuestions) return finishLimited(current, r, limits, [...once0, ...area.map((g) => ({ ...g, perArea: true }))], onceRest, dropped, library);

  const lib = (id: string) => structuredClone(library.modules.find((m) => m.id === id)!);
  const modules: Survey["modules"] = [];
  if (once0.length) modules.push({ id: "accident", title: "About the accident", summary: "Asked once.", scope: "once", groups: once0 });
  if (area.length) {
    const ba = lib("body_areas"); ba.groups.forEach((g) => (g.phase = 1)); modules.push(ba);
    modules.push({ id: "symptoms_by_area", title: "Symptoms for each body area", summary: "Asked for each injured area.", scope: "per_area", groups: area });
  }
  if (onceRest.filter((g) => g.phase === 1).length) modules.push({ id: "symptoms", title: "Symptoms", summary: "Asked once.", scope: "once", groups: onceRest.filter((g) => g.phase === 1) });
  if (onceRest.filter((g) => g.phase === 2).length) modules.push({ id: "details", title: "Care and claim", summary: "Asked once.", scope: "once", groups: onceRest.filter((g) => g.phase === 2) });
  const nar = lib("narrative"); nar.groups.forEach((g) => (g.phase = 2)); modules.push(nar);

  const base: Survey = { id: current.id, name: r.name?.trim() || "New intake", revision: current.revision, phases: ["About the accident", "Your symptoms", "Care and claim"], modules };
  let survey = base;
  const diff = [`New intake built from scratch: ${modules.length} parts, ${modules.reduce((n, m) => n + m.groups.reduce((k, g) => k + g.questions.length, 0), 0)} questions.`];
  for (const c of r.conditions ?? []) {
    const p = surveyPatchSchema.safeParse({ op: "set_condition", ...(c as object) });
    if (!p.success) { dropped++; continue; }
    const res = applyPatches(survey, [p.data], survey.revision);
    if (res.ok) { survey = { ...res.survey, revision: survey.revision }; diff.push(...res.diff); } else dropped++;
  }
  if (dropped) diff.push(`${dropped} suggested item(s) weren't valid and were left out.`);
  const errs = validateSurvey(survey);
  if (errs.length) return { kind: "rejected", message: `The generated intake didn't pass checks (${errs[0]}). Nothing was changed.` };
  survey = { ...survey, revision: current.revision + 1 };
  return { kind: "generated", summary: r.summary || "New intake", survey, diff };
}

type Grp = Survey["modules"][number]["groups"][number];
const PHASE_NAMES = ["About the accident", "Your symptoms", "Care and claim"];

/** Build an intake that always respects the requested section/question limits. */
function finishLimited(current: Survey, r: z.infer<typeof genReply>, limits: { maxSections?: number; maxQuestions?: number }, first: (Grp & { perArea?: boolean })[], rest: Grp[], dropped: number, library: Survey): GenerateResult {
  const max = limits.maxSections ?? 99;
  let list: (Grp & { perArea?: boolean })[] = [...first, ...rest].map((g) => (max <= 2 ? { ...g, perArea: false } : g));
  list.sort((a, b) => a.phase - b.phase);
  const usePicker = list.some((g) => g.perArea);
  const budget = usePicker ? max - 1 : max;
  while (list.length > Math.max(1, budget)) {
    const b = list.pop()!; const a = list[list.length - 1]!;
    list[list.length - 1] = { ...a, perArea: !!(a.perArea && b.perArea), questions: [...a.questions, ...b.questions] };
  }
  if (limits.maxQuestions) {
    let left = limits.maxQuestions;
    list = list.map((g) => { const qs = g.questions.slice(0, Math.max(0, left)); left -= qs.length; return { ...g, questions: qs }; }).filter((g) => g.questions.length);
  }
  const used = [...new Set(list.map((g) => g.phase))].sort();
  const modules: Survey["modules"] = [];
  if (list.some((g) => g.perArea)) { const ba = structuredClone(library.modules.find((m) => m.id === "body_areas")!); modules.push(ba); }
  for (const g of list) {
    const { perArea, ...grp } = g;
    modules.push({ id: `m_${grp.id}`, title: grp.title, summary: perArea ? "Asked for each injured area." : "Asked once.", scope: perArea ? "per_area" : "once", groups: [grp] });
  }
  const phaseOf = (p: number) => Math.max(0, used.indexOf(p));
  for (const m of modules) for (const g of m.groups) g.phase = m.id === "body_areas" ? phaseOf(list.find((x) => x.perArea)?.phase ?? 1) : phaseOf(g.phase);
  let survey: Survey = { id: current.id, name: r.name?.trim() || "New intake", revision: current.revision, phases: used.length ? used.map((p) => PHASE_NAMES[p] ?? "Questions") : ["Questions"], modules };
  const total = modules.reduce((n, m) => n + m.groups.reduce((k, g) => k + g.questions.length, 0), 0);
  const asked = [limits.maxSections && `${modules.length} section${modules.length === 1 ? "" : "s"}`, limits.maxQuestions && `${total} questions`].filter(Boolean).join(", ");
  const diff = [`New intake built from scratch: ${modules.length} sections, ${total} questions — kept within your limit (${asked}).`];
  for (const c of r.conditions ?? []) {
    const p = surveyPatchSchema.safeParse({ op: "set_condition", ...(c as object) });
    if (!p.success) { dropped++; continue; }
    const res = applyPatches(survey, [p.data], survey.revision);
    if (res.ok) { survey = { ...res.survey, revision: survey.revision }; diff.push(...res.diff); } else dropped++;
  }
  if (dropped) diff.push(`${dropped} suggested item(s) weren't valid and were left out.`);
  const errs = validateSurvey(survey);
  if (errs.length) return { kind: "rejected", message: `The generated intake didn't pass checks (${errs[0]}). Nothing was changed.` };
  return { kind: "generated", summary: r.summary || "New intake", survey: { ...survey, revision: current.revision + 1 }, diff };
}

// ---------- suggestCompletion ----------
const COMPLETE_SYSTEM = `You autocomplete a chiropractic practice's request for their personal-injury intake builder.
Reply ONLY with JSON: {"completion":string}. The completion continues the text exactly where it stops (start with a space if needed), at most 15 words, plain words only.
Keep it about intake questions (adding, removing, rewording, making optional/required, follow-up conditions, creating an intake). Never diagnose. If unsure, return "".`;

export async function suggestCompletion(text: string): Promise<string> {
  const raw = await jsonWithFallback("groq", COMPLETE_SYSTEM, `TEXT SO FAR:\n${text}`);
  const p = z.object({ completion: z.string() }).safeParse(raw);
  if (!p.success) return "";
  let c = p.data.completion.replace(/[\r\n]+/g, " ").replace(/[<>{}]/g, "").slice(0, 120);
  if (c.trim() && !/^\s/.test(c) && !/\s$/.test(text) && !/^[.,;:!?]/.test(c)) c = ` ${c}`;
  return c.trimEnd();
}
