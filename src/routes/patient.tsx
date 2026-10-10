import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, MessageSquareQuote, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getPreviewSurvey, getPublishedSurvey, submitIntake } from "@/lib/surveys.functions";
import { PracticeGate } from "@/components/intake/PracticeGate";
import { Dictation } from "@/components/intake/Dictation";
import { StoryStep, type StoryResult } from "@/components/intake/StoryStep";
import type { Survey } from "@/types/survey";
import { BODY_AREAS, SIDED_AREAS, activeAnswers, answerKey, areaLabel, formatAnswer, missingOnScreen, validateValue, visibleScreens } from "@/lib/surveyEngine";
import { NOT_APPLICABLE, OTHER_PREFIX, UNSURE, type AnswerValue, type Question, type SurveyAnswers } from "@/types/survey";

export const Route = createFileRoute("/patient")({
  head: () => ({
    meta: [
      { title: "Personal Injury Intake — Example Chiropractic Center" },
      { name: "description", content: "A fast, adaptive accident intake that only asks what applies to you." },
      { property: "og:title", content: "Personal Injury Intake — Example Chiropractic Center" },
      { property: "og:description", content: "Answer only the questions that apply, and tell your story in your own words." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s) => z.object({ preview: z.boolean().optional() }).parse(s),
  component: PatientPage,
});

function PatientPage() {
  const { preview } = Route.useSearch();
  return preview ? <PracticeGate what="preview the saved draft"><PreviewLoader /></PracticeGate> : <PublishedLoader />;
}

function PublishedLoader() {
  const fetch = useServerFn(getPublishedSurvey);
  const { data, error, refetch } = useQuery({ queryKey: ["published-survey"], queryFn: () => fetch(), staleTime: Infinity, refetchOnWindowFocus: false });
  if (error) return <LoadError retry={() => refetch()} />;
  if (!data) return <div className="mx-auto max-w-2xl px-5 py-12 text-muted-foreground">Loading your intake…</div>;
  return <PatientExperience key={data.versionId} survey={data.survey} versionId={data.versionId} preview={false} />;
}

function PreviewLoader() {
  const fetch = useServerFn(getPreviewSurvey);
  const { data, error, refetch } = useQuery({ queryKey: ["preview-survey"], queryFn: () => fetch(), refetchOnWindowFocus: false });
  if (error) return <LoadError retry={() => refetch()} />;
  if (!data) return <div className="mx-auto max-w-2xl px-5 py-12 text-muted-foreground">Loading draft preview…</div>;
  return <><div role="note" className="bg-attention-soft px-5 py-2 text-center text-sm text-attention-foreground">Draft preview — not published. Patients don't see this version.</div><PatientExperience key={data.revision} survey={data.survey} versionId={null} preview /></>;
}

function LoadError({ retry }: { retry: () => void }) {
  return <div role="alert" className="mx-auto max-w-2xl px-5 py-12 text-foreground"><p>We couldn't load the questions. Check your connection and try again.</p><Button className="mt-4 min-h-11" onClick={retry}>Try again</Button></div>;
}

type OnChange = (v: AnswerValue) => void;

const findQuestionId = (survey: Survey, id: string) => survey.modules.some((m) => m.groups.some((g) => g.questions.some((q) => q.id === id)));

const optionCls = (on: boolean) =>
  cn(
    "flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-lg transition-colors",
    on ? "border-primary bg-secondary text-foreground" : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-secondary/40",
  );
const inputCls = "min-h-14 w-full rounded-lg border border-input bg-card px-4 py-3 text-lg text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/40";

function Opt({ on, label, onClick, role, muted }: { on: boolean; label: string; onClick: () => void; role: "radio" | "checkbox"; muted?: boolean }) {
  return (
    <Button type="button" variant="outline" role={role} aria-checked={on} onClick={onClick} className={cn(optionCls(on), muted && "text-muted-foreground")}>
      <span className="whitespace-normal">{label}</span>{on && <Check className="h-5 w-5 shrink-0 text-primary" aria-hidden />}
    </Button>
  );
}

/** Extra choices: "I'm not sure" / not-applicable. Stored as distinct values, never as Yes. */
function EscapeChoices({ q, value, onChange }: { q: Question; value: AnswerValue | undefined; onChange: OnChange }) {
  const items = [q.notApplicableLabel && { v: NOT_APPLICABLE, label: q.notApplicableLabel }, q.allowUnsure && { v: UNSURE, label: "I’m not sure" }].filter(Boolean) as { v: string; label: string }[];
  if (!items.length) return null;
  return <>{items.map((i) => <Opt key={i.v} role="radio" muted on={value === i.v} label={i.label} onClick={() => onChange(value === i.v ? "" : i.v)} />)}</>;
}

function Choice({ q, value, onChange }: { q: Question; value: AnswerValue | undefined; onChange: OnChange }) {
  const multi = q.type === "multi";
  const options = q.type === "yes_no" ? ["Yes", "No"] : q.options ?? [];
  const selected = Array.isArray(value) ? value : typeof value === "string" && value && value !== UNSURE && value !== NOT_APPLICABLE ? [value] : [];
  const exclusive = q.exclusiveOptions ?? [];
  const otherEntry = selected.find((s) => s.startsWith(OTHER_PREFIX));
  const toggle = (option: string) => {
    if (!multi) return onChange(option);
    if (selected.includes(option)) return onChange(selected.filter((o) => o !== option));
    if (exclusive.includes(option)) return onChange([option]);
    onChange([...selected.filter((o) => !exclusive.includes(o)), option]);
  };
  const toggleOther = () => {
    if (!multi) return onChange(otherEntry ? "" : OTHER_PREFIX);
    onChange(otherEntry ? selected.filter((o) => o !== otherEntry) : [...selected.filter((o) => !exclusive.includes(o)), OTHER_PREFIX]);
  };
  const setOther = (text: string) => {
    const v = OTHER_PREFIX + text;
    onChange(multi ? selected.map((o) => (o === otherEntry ? v : o)) : v);
  };
  return (
    <div className="space-y-2">
      <div role={multi ? "group" : "radiogroup"} aria-label={q.label} className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => <Opt key={o} role={multi ? "checkbox" : "radio"} on={selected.includes(o)} label={o} onClick={() => toggle(o)} />)}
        {q.allowOther && <Opt role={multi ? "checkbox" : "radio"} on={Boolean(otherEntry)} label="Other — please describe" onClick={toggleOther} />}
        {!multi && <EscapeChoices q={q} value={value} onChange={onChange} />}
        {multi && q.allowUnsure && <Opt role="checkbox" muted on={value === UNSURE} label="I’m not sure" onClick={() => onChange(value === UNSURE ? [] : UNSURE)} />}
      </div>
      {otherEntry !== undefined && (
        <input aria-label={`${q.label} — other`} autoFocus value={otherEntry.slice(OTHER_PREFIX.length)} onChange={(e) => setOther(e.target.value)} placeholder="Please describe" className={inputCls} />
      )}
    </div>
  );
}

function Scale({ q, value, onChange }: { q: Question; value: AnswerValue | undefined; onChange: OnChange }) {
  return (
    <div role="radiogroup" aria-label={q.label} className="grid grid-cols-6 gap-2 sm:grid-cols-11">
      {q.options?.map((o) => <Button key={o} type="button" variant={value === o ? "default" : "outline"} role="radio" aria-checked={value === o} onClick={() => onChange(o)} className="h-12 min-w-0 px-0 text-base">{o}</Button>)}
    </div>
  );
}

function BodyAreas({ value, onChange }: { value: AnswerValue | undefined; onChange: OnChange }) {
  const list = Array.isArray(value) ? value : [];
  const entry = (name: string) => list.find((i) => i === name || i.startsWith(`${name}|`));
  const toggle = (name: string) => { const c = entry(name); onChange(c ? list.filter((i) => i !== c) : [...list, SIDED_AREAS.has(name) ? `${name}|Both` : name]); };
  const setSide = (name: string, side: string) => onChange(list.map((i) => (i.startsWith(`${name}|`) ? `${name}|${side}` : i)));
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Injured areas" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BODY_AREAS.map((a) => <Opt key={a} role="checkbox" on={Boolean(entry(a))} label={a} onClick={() => toggle(a)} />)}
      </div>
      {BODY_AREAS.filter((a) => SIDED_AREAS.has(a) && entry(a)).map((a) => {
        const side = entry(a)?.split("|")[1] ?? "Both";
        return (
          <div key={a} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-muted px-4 py-3">
            <span className="min-w-0 text-base text-foreground">{a}</span>
            <div role="radiogroup" aria-label={`${a} side`} className="flex shrink-0 gap-1">
              {["Left", "Right", "Both"].map((c) => <Button key={c} type="button" variant={side === c ? "default" : "outline"} role="radio" aria-checked={side === c} onClick={() => setSide(a, c)} className="h-11 px-3 text-sm">{c}</Button>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const fmtDate = (d: Date) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;

function DateInput({ id, value, onChange }: { id: string; value: AnswerValue | undefined; onChange: OnChange }) {
  const rel = (back: number) => { const d = new Date(); d.setDate(d.getDate() - back); onChange(fmtDate(d)); };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button type="button" variant="outline" className="h-14 text-base" onClick={() => rel(0)}>Today</Button>
        <Button type="button" variant="outline" className="h-14 text-base" onClick={() => rel(1)}>Yesterday</Button>
        <Popover>
          <PopoverTrigger asChild><Button type="button" variant="outline" className="col-span-2 h-14 text-base sm:col-span-1"><CalendarDays /> Pick a date</Button></PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-0"><Calendar mode="single" disabled={{ after: new Date() }} onSelect={(d) => d && onChange(fmtDate(d))} /></PopoverContent>
        </Popover>
      </div>
      <label htmlFor={id} className="block text-base font-medium text-foreground">Or enter the date</label>
      <input id={id} inputMode="numeric" autoComplete="off" value={typeof value === "string" ? value : ""} placeholder="MM/DD/YYYY" maxLength={10} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}

function FieldInput({ q, id, value, onChange }: { q: Question; id: string; value: AnswerValue | undefined; onChange: OnChange }) {
  if (q.type === "choice" || q.type === "multi" || q.type === "yes_no") return <Choice q={q} value={value} onChange={onChange} />;
  if (q.type === "scale") return <Scale q={q} value={value} onChange={onChange} />;
  if (q.type === "body_areas") return <BodyAreas value={value} onChange={onChange} />;
  if (q.type === "date") return <DateInput id={id} value={value} onChange={onChange} />;
  const escaped = value === UNSURE || value === NOT_APPLICABLE;
  const text = typeof value === "string" && !escaped ? value : "";
  const input = q.type === "longtext"
    ? <textarea id={id} rows={5} value={text} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    : <input id={id} type="text" inputMode={q.type === "number" ? "numeric" : undefined} value={text} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
  if (!q.allowUnsure && !q.notApplicableLabel) return input;
  return <div className="space-y-2">{input}<div role="radiogroup" aria-label={`${q.label} — other answers`} className="grid gap-2 sm:grid-cols-2"><EscapeChoices q={q} value={value} onChange={onChange} /></div></div>;
}

function PatientExperience({ survey, versionId, preview }: { survey: Survey; versionId: string | null; preview: boolean }) {
  const send = useServerFn(submitIntake);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [index, setIndex] = useState(0);
  const [returnToReview, setReturnToReview] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const sessionId = useRef<string | null>(null);
  const [story, setStory] = useState<StoryResult | null>(null);
  const [prefilled, setPrefilled] = useState<Record<string, string>>({});
  const screens = useMemo(() => visibleScreens(survey, answers), [survey, answers]);
  const reviewing = index >= screens.length;
  const screen = reviewing ? undefined : screens[index];

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [index, submittedId]);

  const startQuestions = (r: StoryResult) => {
    const next: SurveyAnswers = {};
    const from: Record<string, string> = {};
    for (const c of r.confirmed) { next[c.question] = c.value; from[c.question] = c.excerpt; }
    if (r.text && findQuestionId(survey, "narrative")) next["narrative"] = r.text;
    setAnswers(next); setPrefilled(from); setStory(r);
  };

  const setAnswer = (key: string, v: AnswerValue) => { setPrefilled((c) => { if (!(key in c)) return c; const n = { ...c }; delete n[key]; return n; }); setAnswers((c) => ({ ...c, [key]: v })); setErrors((c) => { const n = { ...c }; delete n[key]; return n; }); };

  const next = () => {
    if (!screen) return;
    const errs: Record<string, string> = {};
    for (const id of missingOnScreen(screen, answers)) errs[answerKey(id, screen.area)] = "Please answer this to continue.";
    for (const q of screen.questions) { const k = answerKey(q.id, screen.area); const e = validateValue(q, answers[k]); if (e) errs[k] = e; }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (returnToReview) { setReturnToReview(false); setIndex(screens.length); return; }
    setIndex((c) => c + 1);
  };

  const submit = async () => {
    sessionId.current ??= crypto.randomUUID();
    setSubmitting(true); setSubmitError(null);
    try {
      await send({ data: { id: sessionId.current, versionId, preview, answers: activeAnswers(survey, answers), story: story?.text ? story : null } });
      setSubmittedId(sessionId.current);
    } catch { setSubmitError("Your answers weren't sent — they're still here. Please try again."); }
    finally { setSubmitting(false); }
  };

  const restart = () => { setStory(null); setPrefilled({}); setAnswers({}); setIndex(0); setErrors({}); setSubmittedId(null); setReturnToReview(false); sessionId.current = null; };

  if (submittedId) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden />
        <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-3xl text-foreground outline-none">Demo intake submitted</h1>
        <p className="mt-3 text-lg text-muted-foreground">Saved for the demo practice. The report is built from exactly these answers and this version of the questions.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild className="min-h-11"><Link to="/reports/$id" params={{ id: submittedId }}>Open this intake's report</Link></Button>
          <Button variant="outline" className="min-h-11" onClick={restart}>Start over</Button>
        </div>
        <p className="mt-10 text-[13px] text-muted-foreground">Powered by ClearIntake</p>
      </div>
    );
  }

  if (!story) return <StoryStep preview={preview} headingRef={headingRef} onDone={startQuestions} />;

  if (reviewing) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 sm:pb-12 sm:pt-8">
        <p className="text-sm font-semibold text-primary">Review · before you submit</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-[26px] leading-tight text-foreground outline-none sm:text-[32px]">Check your answers</h1>
        <ul className="mt-6 space-y-3">
          {screens.map((s, i) => (
            <li key={s.key} className="rounded-lg border border-border bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <p className="min-w-0 font-medium text-foreground">{s.group.title}{s.area && <span className="font-normal text-muted-foreground"> · {areaLabel(answers, s.area)}</span>}</p>
                <Button variant="ghost" className="h-11 shrink-0" onClick={() => { setReturnToReview(true); setIndex(i); }} aria-label={`Edit ${s.group.title}`}><Pencil /> Edit</Button>
              </div>
              <dl className="mt-1 space-y-1 text-[15px]">
                {s.questions.map((q) => <div key={q.id} className="grid grid-cols-1 gap-x-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><dt className="text-muted-foreground">{q.label}</dt><dd className="text-foreground">{formatAnswer(answers[answerKey(q.id, s.area)])}</dd></div>)}
              </dl>
            </li>
          ))}
        </ul>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mt-8 sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <Button variant="ghost" onClick={() => setIndex(screens.length - 1)} className="min-h-11 text-base text-muted-foreground"><ArrowLeft /> Back</Button>
            <Button onClick={submit} disabled={submitting} className="min-h-11 px-6 text-base">{submitting ? "Sending…" : "Submit intake"}</Button>
          </div>
          {submitError && <p role="alert" className="mx-auto mt-2 max-w-2xl text-sm text-destructive">{submitError}</p>}
        </div>
      </div>
    );
  }

  if (!screen) return null;
  const phase = screen.group.phase;
  const multiField = screen.questions.length > 1;
  const area = areaLabel(answers, screen.area);
  // Count real questions on the current path (several can share one screen).
  const totalQ = Math.max(1, screens.reduce((n, s) => n + s.questions.length, 0));
  const qStart = screens.slice(0, index).reduce((n, s) => n + s.questions.length, 0) + 1;
  const qEnd = qStart + screen.questions.length - 1;
  const qLabel = qEnd > qStart ? `Questions ${qStart}–${qEnd} of ${totalQ}` : `Question ${qStart} of ${totalQ}`;

  return (
    <div className="mx-auto max-w-2xl px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 sm:pb-12 sm:pt-8">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-semibold text-primary">{survey.phases[phase]}</p>
        <p className="text-base font-medium text-foreground">{qLabel}</p>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={totalQ} aria-valuenow={qEnd} aria-label={qLabel}>
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(qEnd / totalQ) * 100}%` }} />
      </div>

      <div key={screen.key} className={cn("mt-7 animate-in fade-in slide-in-from-bottom-1 duration-150", screen.group.highlight && "rounded-lg border border-primary/30 bg-secondary/50 p-5")}>
        {screen.group.highlight && <MessageSquareQuote className="mb-3 h-6 w-6 text-primary" aria-hidden />}
        {area && <p className="mb-2 inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">{area}</p>}
        <h1 ref={headingRef} tabIndex={-1} className="text-[26px] leading-tight text-foreground outline-none sm:text-[32px]">{screen.group.title}</h1>
        {screen.group.help && <p className="mt-3 text-lg text-muted-foreground">{screen.group.help}</p>}
        <div className="mt-6 space-y-7">
          {screen.questions.map((q) => {
            const key = answerKey(q.id, screen.area);
            const id = `f-${key.replace("@", "-").replace(/[^a-zA-Z0-9-_]/g, "")}`;
            return (
              <div key={key}>
                {(multiField || !q.required) && (
                  <label htmlFor={id} className="mb-2 flex items-center gap-2 text-base font-medium text-foreground">
                    {multiField ? q.label : <span className="sr-only">{q.label}</span>}
                    {!q.required && <span className="text-sm font-normal text-muted-foreground">Optional</span>}
                  </label>
                )}
                {prefilled[key] && <p className="mb-2 rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">Filled in from your story (“{prefilled[key]}”) — please check.</p>}
                <FieldInput q={q} id={id} value={answers[key]} onChange={(v) => setAnswer(key, v)} />
                {errors[key] && <p role="alert" className="mt-2 text-base font-medium text-attention-foreground">{errors[key]}</p>}
              </div>
            );
          })}
        </div>
        {screen.group.highlight && screen.questions[0] && <Dictation className="mt-4" onTranscript={(t) => { const k = answerKey(screen.questions[0]!.id, screen.area); const cur = answers[k]; setAnswer(k, typeof cur === "string" && cur.trim() ? `${cur.trim()}\n${t}` : t); }} />}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:mt-10 sm:border-0 sm:bg-transparent sm:p-0">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          {index > 0 ? <Button variant="ghost" onClick={() => { setErrors({}); setIndex((c) => c - 1); }} className="min-h-11 text-base text-muted-foreground"><ArrowLeft /> Back</Button> : <span />}
          <Button onClick={next} className="min-h-11 px-6 text-base">{returnToReview ? "Back to review" : index === screens.length - 1 ? "Review answers" : "Continue"} <ArrowRight /></Button>
        </div>
      </div>
      <p className="mt-10 hidden text-center text-[13px] text-muted-foreground sm:block">Powered by ClearIntake</p>
    </div>
  );
}
