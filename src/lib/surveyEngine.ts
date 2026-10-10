import {
  NOT_APPLICABLE, OTHER_PREFIX, UNSURE, surveySchema,
  type AnswerStatus, type AnswerValue, type Question, type Screen, type Submission2, type Survey, type SurveyAnswers, type SurveyPatch, type SurveyRule,
} from "@/types/survey";

// ---------- Areas ----------
export const SIDED_AREAS = new Set(["Shoulder", "Arm", "Wrist / Hand", "Hip", "Knee", "Leg", "Ankle / Foot"]);
export const BODY_AREAS = ["Head", "Neck", "Upper back", "Low back", "Shoulder", "Arm", "Wrist / Hand", "Hip", "Knee", "Leg", "Ankle / Foot"];

/** Selected areas as stable keys (area name) with display labels including laterality. */
export function selectedAreas(answers: SurveyAnswers): { key: string; label: string }[] {
  const v = answers["areas"];
  if (!Array.isArray(v)) return [];
  return v.map((entry) => {
    const [name, side] = entry.split("|");
    return { key: name!, label: side ? `${name} (${side === "Both" ? "both sides" : side.toLowerCase()})` : name! };
  });
}

// ---------- Answers ----------
export const answerKey = (questionId: string, area?: string) => (area ? `${questionId}@${area}` : questionId);

export function getAnswer(answers: SurveyAnswers, questionId: string, area?: string): AnswerValue | undefined {
  return (area ? answers[answerKey(questionId, area)] : undefined) ?? answers[questionId];
}

export const isBlank = (v: AnswerValue | undefined) => v === undefined || (typeof v === "string" ? v.trim() === "" || v === OTHER_PREFIX : v.length === 0);

export function answerStatus(v: AnswerValue | undefined): AnswerStatus {
  if (isBlank(v)) return "blank";
  if (v === UNSURE) return "unsure";
  if (v === NOT_APPLICABLE) return "not_applicable";
  return "answered";
}

// ---------- Rules (explicit comparisons; "unsure" never matches "Yes") ----------
export function evaluateRule(rule: SurveyRule | undefined, answers: SurveyAnswers, area?: string): boolean {
  if (!rule) return true;
  const a = getAnswer(answers, rule.question, area);
  const blank = isBlank(a);
  const values = Array.isArray(a) ? a : a === undefined ? [] : [a];
  switch (rule.op) {
    case "answered": return !blank && a !== UNSURE && a !== NOT_APPLICABLE;
    case "not_answered": return blank;
    case "equals": return !blank && typeof a === "string" && a === rule.value;
    case "not_equals": return !blank && a !== rule.value;
    case "contains": return values.includes(String(rule.value));
    case "one_of": return Array.isArray(rule.value) && values.some((x) => (rule.value as string[]).includes(x));
  }
}

const opText: Record<SurveyRule["op"], string> = { equals: "=", not_equals: "≠", contains: "includes", one_of: "is one of", answered: "is answered", not_answered: "is blank" };

export function findQuestion(survey: Survey, id: string): Question | undefined {
  for (const m of survey.modules) for (const g of m.groups) for (const q of g.questions) if (q.id === id) return q;
  return undefined;
}

export function describeRule(survey: Survey, rule: SurveyRule): string {
  const label = findQuestion(survey, rule.question)?.label.replace(/\?$/, "") ?? rule.question;
  const value = Array.isArray(rule.value) ? rule.value.join(" / ") : rule.value;
  return rule.op === "answered" || rule.op === "not_answered" ? `${label} ${opText[rule.op]}` : `${label} ${opText[rule.op]} ${value}`;
}

// ---------- Screens ----------
export function visibleScreens(survey: Survey, answers: SurveyAnswers): Screen[] {
  const out: Screen[] = [];
  const areas = selectedAreas(answers);
  for (const module of survey.modules) {
    const contexts = module.scope === "per_area" ? areas.map((a) => a.key) : [undefined];
    for (const area of contexts) {
      for (const group of module.groups) {
        if (!evaluateRule(group.showIf, answers, area)) continue;
        const questions = group.questions.filter((q) => evaluateRule(q.showIf, answers, area));
        if (questions.length) out.push({ key: `${group.id}${area ? `@${area}` : ""}`, module, group, area, questions });
      }
    }
  }
  return out;
}

export function areaLabel(answers: SurveyAnswers, key?: string) {
  return key ? selectedAreas(answers).find((a) => a.key === key)?.label ?? key : undefined;
}

export function missingOnScreen(screen: Screen, answers: SurveyAnswers): string[] {
  return screen.questions.filter((q) => q.required && isBlank(answers[answerKey(q.id, screen.area)])).map((q) => q.id);
}

export function validateValue(q: Question, v: AnswerValue | undefined): string | null {
  if (isBlank(v) || v === UNSURE || v === NOT_APPLICABLE) return null;
  if (q.type === "date" && typeof v === "string") {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return "Enter the date as MM/DD/YYYY.";
    const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    if (d.getMonth() !== Number(m[1]) - 1 || d.getDate() !== Number(m[2])) return "That date doesn't exist.";
    if (d.getTime() > Date.now()) return "The date can't be in the future.";
  }
  if (q.type === "number" && typeof v === "string" && !/^\d+$/.test(v.trim())) return "Enter a whole number.";
  return null;
}

/** Only answers to currently visible questions — stale branch/area answers are excluded. */
export function activeAnswers(survey: Survey, answers: SurveyAnswers): SurveyAnswers {
  const out: SurveyAnswers = {};
  for (const s of visibleScreens(survey, answers)) for (const q of s.questions) {
    const k = answerKey(q.id, s.area);
    if (answers[k] !== undefined) out[k] = answers[k]!;
  }
  return out;
}

export function formatAnswer(v: AnswerValue | undefined): string {
  const status = answerStatus(v);
  if (status === "blank") return "— not provided —";
  if (status === "unsure") return "Patient not sure";
  if (status === "not_applicable") return "Not applicable";
  const list = Array.isArray(v) ? v : [v as string];
  return list.map((x) => (x.includes("|") ? x.replace("|", " — ").replace("Both", "both sides") : x)).join(", ");
}

// ---------- Survey validation & transactional edits ----------
export function validateSurvey(survey: Survey): string[] {
  const parsed = surveySchema.safeParse(survey);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
  const errors: string[] = [];
  const seen = new Map<string, Question>();
  const check = (rule: SurveyRule | undefined, where: string) => {
    if (!rule) return;
    const src = seen.get(rule.question);
    if (!src) { errors.push(`${where}: condition refers to "${rule.question}", which isn't asked earlier.`); return; }
    const vals = rule.value === undefined ? [] : Array.isArray(rule.value) ? rule.value : [rule.value];
    const allowed = src.type === "yes_no" ? ["Yes", "No"] : src.options;
    if (allowed && vals.some((v) => !allowed.includes(v))) errors.push(`${where}: condition value "${vals.join(", ")}" isn't a choice of "${src.label}".`);
  };
  for (const m of survey.modules) for (const g of m.groups) {
    check(g.showIf, g.title);
    for (const q of g.questions) {
      if (seen.has(q.id)) errors.push(`Duplicate question id "${q.id}".`);
      check(q.showIf, q.label);
      seen.set(q.id, q);
    }
  }
  return errors;
}

export type { SurveyPatch };

export interface PatchResult { ok: true; survey: Survey; diff: string[] }
export interface PatchError { ok: false; errors: string[] }

/** Apply patches atomically against a base revision. Any error → nothing changes. */
export function applyPatches(survey: Survey, patches: SurveyPatch[], baseRevision: number): PatchResult | PatchError {
  if (baseRevision !== survey.revision) return { ok: false, errors: ["The template changed since this edit was prepared. Please review again."] };
  const next: Survey = structuredClone(survey);
  const diff: string[] = [];
  const errors: string[] = [];
  const allGroups = () => next.modules.flatMap((m) => m.groups);
  const groupOf = (qid: string) => allGroups().find((x) => x.questions.some((q) => q.id === qid));
  const ruleText = (r: SurveyRule) => describeRule(next, r);
  for (const p of patches) {
    if (p.op === "set_group_condition_value") {
      const g = allGroups().find((x) => x.id === p.group);
      if (!g?.showIf) { errors.push(`Group "${p.group}" has no condition to change.`); continue; }
      if (g.showIf.value !== p.value) diff.push(`"${g.title}" shown when: ${g.showIf.value} → ${p.value}`);
      g.showIf = { ...g.showIf, value: p.value };
      continue;
    }
    if (p.op === "set_group_condition" || p.op === "remove_group_condition" || p.op === "rename_group" || p.op === "remove_group") {
      const m = next.modules.find((x) => x.groups.some((g) => g.id === p.group));
      const g = m?.groups.find((x) => x.id === p.group);
      if (!m || !g) { errors.push(`Unknown section "${p.group}".`); continue; }
      if (p.op === "set_group_condition") { g.showIf = p.rule; diff.push(`Section "${g.title}" now only asked if ${ruleText(p.rule)}`); }
      else if (p.op === "remove_group_condition") { if (g.showIf) { delete g.showIf; diff.push(`Section "${g.title}" is now always asked`); } }
      else if (p.op === "rename_group") { if (p.value.trim() !== g.title) { diff.push(`Section renamed: "${g.title}" → "${p.value.trim()}"`); g.title = p.value.trim(); } }
      else {
        if (m.groups.length === 1) { errors.push(`"${m.title}" needs at least one section.`); continue; }
        m.groups = m.groups.filter((x) => x.id !== g.id);
        diff.push(`Removed section "${g.title}" (${g.questions.length} ${g.questions.length === 1 ? "question" : "questions"})`);
      }
      continue;
    }
    if (p.op === "add_group") {
      const m = next.modules.find((x) => x.id === p.module);
      if (!m) { errors.push(`Unknown module "${p.module}".`); continue; }
      if (allGroups().some((g) => g.id === p.group.id)) { errors.push(`A section with id "${p.group.id}" already exists.`); continue; }
      if (findQuestion(next, p.question.id)) { errors.push(`A question with id "${p.question.id}" already exists.`); continue; }
      const needsOptions = p.question.type === "choice" || p.question.type === "multi";
      if (needsOptions && (p.question.options?.length ?? 0) < 2) { errors.push(`"${p.question.label}" needs at least two choices.`); continue; }
      const q: Question = { ...p.question };
      if (!needsOptions) delete q.options;
      m.groups.push({ id: p.group.id, title: p.group.title.trim(), phase: m.groups.at(-1)!.phase, questions: [q] });
      diff.push(`Added section "${p.group.title.trim()}" to ${m.title} with "${q.label}"`);
      continue;
    }
    if (p.op === "move_question") {
      const g = groupOf(p.question);
      if (!g) { errors.push(`Unknown question "${p.question}".`); continue; }
      const i = g.questions.findIndex((x) => x.id === p.question);
      const j = p.direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= g.questions.length) { errors.push(`"${g.questions[i]!.label}" is already at the ${p.direction === "up" ? "top" : "bottom"} of its section.`); continue; }
      [g.questions[i], g.questions[j]] = [g.questions[j]!, g.questions[i]!];
      diff.push(`Moved "${g.questions[j]!.label}" ${p.direction}`);
      continue;
    }
    if (p.op === "duplicate_question") {
      const g = groupOf(p.question);
      if (!g) { errors.push(`Unknown question "${p.question}".`); continue; }
      if (findQuestion(next, p.newId)) { errors.push(`A question with id "${p.newId}" already exists.`); continue; }
      const i = g.questions.findIndex((x) => x.id === p.question);
      const copy: Question = { ...structuredClone(g.questions[i]!), id: p.newId, label: `${g.questions[i]!.label} (copy)` };
      g.questions.splice(i + 1, 0, copy);
      diff.push(`Duplicated "${g.questions[i]!.label}"`);
      continue;
    }
    if (p.op === "add_question") {
      const g = next.modules.flatMap((m) => m.groups).find((x) => x.id === p.group);
      if (!g) { errors.push(`Unknown section "${p.group}".`); continue; }
      if (findQuestion(next, p.question.id)) { errors.push(`A question with id "${p.question.id}" already exists.`); continue; }
      const needsOptions = p.question.type === "choice" || p.question.type === "multi";
      if (needsOptions && (p.question.options?.length ?? 0) < 2) { errors.push(`"${p.question.label}" needs at least two choices.`); continue; }
      const q: Question = { ...p.question, ...(needsOptions ? {} : { options: undefined }) };
      if (!needsOptions) delete q.options;
      g.questions.push(q);
      diff.push(`Added to "${g.title}": "${q.label}" (${q.required ? "Required" : "Optional"}${q.options ? ` · ${q.options.join(", ")}` : ""})`);
      continue;
    }
    if (p.op === "remove_question") {
      const g = next.modules.flatMap((m) => m.groups).find((x) => x.questions.some((q) => q.id === p.question));
      if (!g) { errors.push(`Unknown question "${p.question}".`); continue; }
      if (g.questions.length === 1) { errors.push(`"${g.title}" would have no questions left.`); continue; }
      const q = g.questions.find((x) => x.id === p.question)!;
      g.questions = g.questions.filter((x) => x.id !== p.question);
      diff.push(`Removed from "${g.title}": "${q.label}"`);
      continue;
    }
    const q = findQuestion(next, p.question);
    if (!q) { errors.push(`Unknown question "${p.question}".`); continue; }
    if (p.op === "set_label" && p.value.trim() && p.value !== q.label) { diff.push(`Wording: "${q.label}" → "${p.value.trim()}"`); q.label = p.value.trim(); }
    if (p.op === "set_required" && p.value !== q.required) { diff.push(`${q.label}: ${q.required ? "Required" : "Optional"} → ${p.value ? "Required" : "Optional"}`); q.required = p.value; }
    if (p.op === "set_options") {
      if (!q.options) { errors.push(`"${q.label}" has no choices.`); continue; }
      const clean = [...new Set(p.value.map((s) => s.trim()).filter(Boolean))];
      if (clean.length < 2) { errors.push(`"${q.label}" needs at least two choices.`); continue; }
      if (clean.join("|") !== q.options.join("|")) { diff.push(`${q.label} choices: ${q.options.join(", ")} → ${clean.join(", ")}`); q.options = clean; q.exclusiveOptions = q.exclusiveOptions?.filter((o) => clean.includes(o)); }
    }
    if (p.op === "set_condition_value") {
      if (!q.showIf) { errors.push(`"${q.label}" has no condition to change.`); continue; }
      if (q.showIf.value !== p.value) diff.push(`${q.label} shown when: ${q.showIf.value} → ${p.value}`);
      q.showIf = { ...q.showIf, value: p.value };
    }
    if (p.op === "set_condition") { q.showIf = p.rule; diff.push(`"${q.label}" now only asked if ${ruleText(p.rule)}`); }
    if (p.op === "remove_condition" && q.showIf) { delete q.showIf; diff.push(`"${q.label}" is now always asked`); }
    if (p.op === "set_type" && p.value !== q.type) {
      if (q.type === "scale" || q.type === "body_areas") { errors.push(`"${q.label}" has a special answer type that can't be changed.`); continue; }
      const needsOptions = p.value === "choice" || p.value === "multi";
      const opts = needsOptions ? [...new Set((p.options ?? q.options ?? []).map((s) => s.trim()).filter(Boolean))] : undefined;
      if (needsOptions && (opts?.length ?? 0) < 2) { errors.push(`"${q.label}" needs at least two choices for that answer type.`); continue; }
      diff.push(`${q.label}: answer type ${q.type} → ${p.value}`);
      q.type = p.value;
      if (opts) q.options = opts; else { delete q.options; delete q.exclusiveOptions; delete q.allowOther; }
    }
  }
  errors.push(...validateSurvey(next));
  if (errors.length) return { ok: false, errors };
  if (!diff.length) return { ok: false, errors: ["No changes to apply."] };
  next.revision = survey.revision + 1;
  return { ok: true, survey: next, diff };
}

// ---------- Report from a submission ----------
export type ReportFindingKind = "missing" | "clarify";
export interface GeneratedFinding { kind: ReportFindingKind; title: string; detail: string; rowKey: string; sectionKey: string }
export interface GeneratedRow { key: string; label: string; value: string; status: AnswerStatus }
export interface GeneratedSection { key: string; title: string; rows: GeneratedRow[] }
export interface GeneratedReport { summary: string; narrative: string; areas: string[]; sections: GeneratedSection[]; findings: GeneratedFinding[] }

export function buildReport(sub: Submission2): GeneratedReport {
  const survey = sub.survey;
  const answers = activeAnswers(survey, sub.answers);
  const sections: GeneratedSection[] = [];
  const findings: GeneratedFinding[] = [];
  for (const s of visibleScreens(survey, answers)) {
    if (s.module.id === "narrative") continue;
    const key = `${s.module.id}${s.area ? `@${s.area}` : ""}`;
    let section = sections.find((x) => x.key === key);
    if (!section) { section = { key, title: s.area ? `${s.module.title} — ${areaLabel(answers, s.area)}` : s.module.title, rows: [] }; sections.push(section); }
    for (const q of s.questions) {
      const rowKey = answerKey(q.id, s.area);
      const v = answers[rowKey];
      const status = answerStatus(v);
      section.rows.push({ key: rowKey, label: q.label, value: formatAnswer(v), status });
      const where = s.area ? ` (${areaLabel(answers, s.area)})` : "";
      if (status === "blank" && q.reviewExpected) findings.push({ kind: "missing", title: `${q.label}${where} not entered`, detail: "Optional for the patient, but your practice flags it for review when blank.", rowKey, sectionKey: key });
      if (status === "unsure" && q.required) findings.push({ kind: "clarify", title: `${q.label}${where} — patient not sure`, detail: "The patient chose “I’m not sure”. Worth confirming at the visit.", rowKey, sectionKey: key });
    }
  }
  const g = (id: string) => formatAnswer(answers[id]);
  const areas = selectedAreas(answers).map((a) => a.label);
  const parts = [
    `Role: ${g("role")}. Accident date ${g("date")}.`,
    answers["impact"] ? `Impact: ${g("impact")}.` : "",
    `Immediate symptoms: ${g("symptoms_now")}.`,
    `ER / urgent care: ${g("er_visit")}.`,
    areas.length ? `Reported areas: ${areas.join(", ")}.` : "",
    answers["attorney"] ? `Attorney: ${g("attorney")}.` : "",
  ].filter(Boolean);
  const narrative = typeof answers["narrative"] === "string" ? (answers["narrative"] as string) : "";
  return { summary: `Patient-reported: ${parts.join(" ")}`, narrative, areas, sections, findings };
}
