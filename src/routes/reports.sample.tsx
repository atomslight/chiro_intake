import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, CircleDashed, Copy, FileText, FlaskConical, GitCompareArrows, HelpCircle, Quote, ShieldAlert } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { plural, sampleReport } from "@/data/report";
import type { Finding, FindingKind } from "@/types/intake";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reports/sample")({
  head: () => ({ meta: [
    { title: "Synthetic Sample Intake Report — ClearIntake" },
    { name: "description", content: "Example provider intake report: 30-second summary, what needs attention, the patient's own words and intake details." },
    { property: "og:title", content: "Sample Intake Report — ClearIntake" },
    { property: "og:description", content: "See what a review-ready PI intake summary looks like." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ReportPage,
});

const kindMeta: Record<FindingKind, { label: string; icon: typeof CircleDashed; question: string }> = {
  missing: { label: "Missing", icon: CircleDashed, question: "Which emergency facility did you visit?" },
  inconsistency: { label: "Potential inconsistency", icon: GitCompareArrows, question: "Did your headache begin at the scene or later?" },
  clarify: { label: "Needs clarification", icon: HelpCircle, question: "What treatment did you receive, and had the prior injury resolved?" },
};

function ReportPage() {
  const report = sampleReport;
  const [open, setOpen] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const viewAnswer = (finding: Finding) => {
    setOpen((current) => current.includes(finding.sectionId) ? current : [...current, finding.sectionId]);
    setTimeout(() => {
      document.getElementById(`row-${finding.rowId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlight(finding.rowId);
      setTimeout(() => setHighlight(null), 1600);
    }, 220);
  };
  const copySummary = async () => {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(report.summary);
      else throw new Error("Clipboard API unavailable");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = report.summary;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const metrics = [
    plural(report.findings.length, "item") + " to review",
    plural(report.facts.bodyAreas.length, "affected area"),
    report.facts.erVisit ? "ER visit" : "No ER visit",
    plural(report.facts.priorSameAreaInjuries, "prior same-area injury").replace("injurys", "injuries"),
  ];

  return (
    <div className="mx-auto max-w-[760px] px-5 py-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[13px] font-medium text-muted-foreground"><FlaskConical className="h-4 w-4" /> Synthetic Sample Report</div>
      <h1 className="mt-4 text-4xl text-foreground">Sample Intake Report</h1>
      <p className="mt-2 text-sm text-muted-foreground">{report.patient} · DOB {report.dob} · Accident {report.accidentDate} · {report.template} · Submitted {report.submitted}</p>
      <ul className="mt-5 flex flex-wrap gap-2">{metrics.map((metric, index) => <li key={metric} className={cn("rounded-full px-3 py-1 text-[13px] font-medium", index === 0 ? "bg-attention-soft text-attention-foreground" : "bg-muted text-foreground")}>{metric}</li>)}</ul>

      <section className="mt-8 rounded-lg border border-primary/25 bg-card p-6" aria-labelledby="summary-heading">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h2 id="summary-heading" className="flex min-w-0 items-center gap-2 font-sans text-sm font-semibold uppercase text-primary"><FileText className="h-4 w-4" /> 30-second summary</h2>
          <Button type="button" variant="outline" onClick={copySummary} className="h-11 shrink-0" aria-live="polite">{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy summary"}</Button>
        </div>
        <p className="mt-4 text-lg leading-relaxed text-foreground">{report.summary}</p>
      </section>

      <section className="mt-8" aria-labelledby="attention-heading">
        <h2 id="attention-heading" className="text-2xl text-foreground">Needs attention ({report.findings.length})</h2>
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {report.findings.map((finding) => {
            const meta = kindMeta[finding.kind];
            return (
              <li key={finding.title} className="p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-attention-soft px-2.5 py-1 text-[13px] font-medium text-attention-foreground"><meta.icon className="h-3.5 w-3.5" /> {meta.label}</span>
                    <p className="mt-2 font-medium text-foreground">{finding.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{finding.detail}</p>
                    <p className="mt-3 text-sm text-foreground"><span className="font-semibold">Ask the patient:</span> {meta.question}</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => viewAnswer(finding)} className="min-h-11 justify-self-start text-primary sm:justify-self-end">View answer <ArrowRight /></Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="words-heading">
        <h2 id="words-heading" className="flex items-center gap-2 font-sans text-sm font-semibold uppercase text-muted-foreground"><Quote className="h-4 w-4" /> Patient’s own words</h2>
        <blockquote className="mt-3 max-w-[70ch] border-l-4 border-primary/30 bg-muted/40 py-3 pl-5 pr-4 text-lg leading-relaxed text-foreground">“{report.narrative.text}”</blockquote>
        <p className="mt-2 pl-5 text-sm text-muted-foreground">Typed by the patient</p>
      </section>

      <section className="mt-10" aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-2xl text-foreground">Intake details</h2>
        <Accordion type="multiple" value={open} onValueChange={setOpen} className="mt-4 space-y-2">
          {report.sections.map((section) => {
            const flags = section.rows.filter((row) => row.flagged).length;
            return (
              <AccordionItem key={section.id} value={section.id} className="rounded-lg border border-border bg-card px-4">
                <AccordionTrigger className="py-3.5 hover:no-underline"><span className="flex flex-1 items-center gap-3 font-sans text-sm font-semibold text-foreground">{section.module}{flags > 0 && <span className="rounded-full bg-attention-soft px-2 py-1 text-[13px] font-medium text-attention-foreground">{plural(flags, "flag")}</span>}</span></AccordionTrigger>
                <AccordionContent><dl className="space-y-1 pb-2">{section.rows.map((row) => <div key={row.id} id={`row-${row.id}`} className={cn("grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 rounded-md px-2 py-2 text-sm transition-colors duration-500", highlight === row.id && "bg-attention/30")}><dt className="text-muted-foreground">{row.label}</dt><dd className={cn("text-right", row.flagged ? "font-medium text-attention-foreground" : "text-foreground")}>{row.value === "unsure" ? "Patient not sure" : row.value}</dd></div>)}</dl></AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </section>
      <div className="mt-8 flex gap-2 rounded-lg border border-border bg-muted/60 p-4 text-sm text-muted-foreground"><ShieldAlert className="h-5 w-5 shrink-0" /> Human review required — the system does not diagnose, recommend treatment or determine causation.</div>
    </div>
  );
}