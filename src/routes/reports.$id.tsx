import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, CircleDashed, Copy, HelpCircle, Quote } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { buildReport, type GeneratedFinding } from "@/lib/surveyEngine";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSubmission } from "@/lib/surveys.functions";
import { analyzeSubmission } from "@/lib/ai.functions";
import type { AiFinding } from "@/types/ai";
import { Sparkles } from "lucide-react";
import { PracticeGate } from "@/components/intake/PracticeGate";
import { plural } from "@/data/report";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports/$id")({
  head: () => ({ meta: [
    { title: "Intake Report — ClearIntake" },
    { name: "description", content: "Report generated from a demo patient's actual intake answers." },
    { property: "og:title", content: "Intake Report — ClearIntake" },
    { property: "og:description", content: "Summary, items to review and intake details built from submitted answers." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => <PracticeGate what="open intake reports"><GeneratedReportPage /></PracticeGate>,
});

const kindMeta = { missing: { label: "Missing", icon: CircleDashed }, clarify: { label: "Needs clarification", icon: HelpCircle } };

function copyText(text: string) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text).catch(() => fallback(text));
  fallback(text);
  return Promise.resolve();
}
function fallback(text: string) {
  const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
  document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
}

function GeneratedReportPage() {
  const { id } = Route.useParams();
  const fetchSub = useServerFn(getSubmission);
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const { data: sub, isLoading } = useQuery({ queryKey: ["submission", id], queryFn: () => fetchSub({ data: { id } }), enabled: valid });
  const report = useMemo(() => (sub ? buildReport(sub) : null), [sub]);
  const [open, setOpen] = useState<string[]>([]);
  const [hl, setHl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const analyze = useServerFn(analyzeSubmission);
  const [retryTick, setRetryTick] = useState(0);
  const ai = useQuery({
    queryKey: ["ai-review", id, retryTick], enabled: Boolean(sub), staleTime: Infinity, refetchOnWindowFocus: false, retry: false,
    queryFn: () => (sub!.reportStatus === "ready" && sub!.aiFindings && retryTick === 0 ? Promise.resolve({ status: "ready" as const, findings: sub!.aiFindings }) : analyze({ data: { id, force: retryTick > 0 } })),
  });

  if (valid && isLoading) return <div className="mx-auto max-w-3xl px-5 py-12 text-muted-foreground">Loading…</div>;
  if (!sub || !report) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl text-foreground">Intake not found</h1>
        <p className="mt-2 text-muted-foreground">This intake doesn't exist or is no longer available.</p>
        <Button asChild className="mt-6 min-h-11"><Link to="/intakes">Back to intakes</Link></Button>
      </div>
    );
  }
  const sectionOf = (rowKey: string) => report.sections.find((s) => s.rows.some((r) => r.key === rowKey))?.key;
  const showRows = (rowKeys: string[]) => {
    const keys = rowKeys.map(sectionOf).filter(Boolean) as string[];
    setOpen((c) => [...new Set([...c, ...keys])]);
    setTimeout(() => {
      const el = document.getElementById(`row-${rowKeys[0]}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus();
      setHl(rowKeys.join(",")); setTimeout(() => setHl(null), 1800);
    }, 220);
  };
  const view = (f: GeneratedFinding) => showRows([f.rowKey]);
  const rowLabel = (k: string) => report.sections.flatMap((s) => s.rows).find((r) => r.key === k);
  const copy = async () => {
    await copyText(`${report.summary}\n\nItems to review: ${report.findings.length}. Patient-reported information; not a diagnosis.`);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const metrics = [plural(report.findings.length, "item") + " to review", plural(report.areas.length, "affected area"), `Survey revision ${sub.survey.revision}`];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-sm text-muted-foreground">Demo submission · {new Date(sub.submittedAt).toLocaleString()} · saved for the demo practice</p>
      <h1 className="mt-2 text-4xl text-foreground">Intake report</h1>
      <ul className="mt-4 flex flex-wrap gap-2">{metrics.map((m) => <li key={m} className="rounded-full bg-muted px-3 py-1 text-sm text-foreground">{m}</li>)}</ul>

      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 className="font-sans text-base font-semibold text-foreground">Intake summary</h2>
          <Button variant="outline" onClick={copy} className="min-h-11">{copied ? <><Check /> Copied</> : <><Copy /> Copy summary</>}</Button>
        </div>
        <p className="mt-3 text-base text-foreground">{report.summary}</p>
        <p className="mt-2 text-sm text-muted-foreground">Built directly from the patient's answers. AI review appears below.</p>
      </section>

      <section className="mt-6">
        <h2 className="font-sans text-base font-semibold text-foreground">Needs attention</h2>
        {report.findings.length === 0 ? <p className="mt-2 text-muted-foreground">Nothing flagged by the configured checks.</p> : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {report.findings.map((f) => {
              const M = kindMeta[f.kind];
              return (
                <li key={f.rowKey + f.kind} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                  <div className="min-w-0"><p className="flex items-center gap-2 text-sm font-medium text-foreground"><M.icon className="h-4 w-4 text-attention-foreground" aria-hidden />{f.title}</p><p className="text-sm text-muted-foreground">{M.label} · {f.detail}</p></div>
                  <Button variant="ghost" onClick={() => view(f)} className="min-h-11 shrink-0">View answer</Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 font-sans text-base font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" aria-hidden />Possible inconsistencies <span className="font-normal text-muted-foreground">· AI-assisted, please verify</span></h2>
        {ai.isLoading || ai.isFetching ? <p role="status" className="mt-2 text-muted-foreground">Reviewing the story against the answers…</p>
          : ai.data?.status === "ready" ? (ai.data.findings.length === 0 ? <p className="mt-2 text-muted-foreground">No possible inconsistencies found between the story and the answers.</p> : (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
              {ai.data.findings.map((f: AiFinding) => (
                <li key={f.rowKeys.join(",")} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-foreground">{f.title}</p>
                    <p className="text-muted-foreground">Potential inconsistency · {f.detail}</p>
                    {f.excerpt && <p className="mt-1 text-foreground">Story: “{f.excerpt}”</p>}
                    {f.rowKeys.map((k) => { const r = rowLabel(k); return r ? <p key={k} className="text-foreground">Answer: {r.label} — {r.value}</p> : null; })}
                    <p className="mt-1 text-muted-foreground">Suggested question: {f.question}</p>
                  </div>
                  <Button variant="ghost" onClick={() => showRows(f.rowKeys)} className="min-h-11 shrink-0">View answer</Button>
                </li>
              ))}
            </ul>))
          : <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-foreground">AI review couldn't finish{ai.data?.status === "failed" ? ` — ${ai.data.error}` : ""}. The answers and checks above are still complete. <Button variant="outline" className="min-h-11" onClick={() => setRetryTick((t) => t + 1)}>Retry analysis</Button></div>}
        <p className="mt-2 text-sm text-muted-foreground">Patient-reported information. Not a diagnosis or a judgement about the claim.</p>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-sans text-base font-semibold text-foreground"><Quote className="h-4 w-4 text-primary" aria-hidden />Patient's own words</h2>
        {(sub.story?.confirmed.length ?? 0) > 0 && <p className="mt-2 text-sm text-muted-foreground">{sub.story!.confirmed.length} answers were suggested from this story and confirmed by the patient.</p>}
        <p className="mt-3 whitespace-pre-wrap text-base text-foreground">{report.narrative || <span className="text-muted-foreground">The patient didn't add a narrative.</span>}</p>
      </section>

      <section className="mt-6">
        <h2 className="font-sans text-base font-semibold text-foreground">Intake details</h2>
        <Accordion type="multiple" value={open} onValueChange={setOpen} className="mt-3 space-y-2">
          {report.sections.map((s) => (
            <AccordionItem key={s.key} value={s.key} className="rounded-lg border border-border bg-card px-4">
              <AccordionTrigger className="font-sans hover:no-underline">{s.title}</AccordionTrigger>
              <AccordionContent>
                <dl className="space-y-1 pb-2">
                  {s.rows.map((r) => (
                    <div key={r.key} id={`row-${r.key}`} tabIndex={-1} className={cn("grid grid-cols-1 gap-x-4 rounded-md px-2 py-1.5 outline-none transition-colors sm:grid-cols-2", hl?.split(",").includes(r.key) && "bg-attention/25")}>
                      <dt className="text-sm text-muted-foreground">{r.label}</dt>
                      <dd className={cn("text-sm", r.status === "answered" ? "text-foreground" : "text-muted-foreground")}>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
