import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Hammer, MessageSquareText, ClipboardCheck } from "lucide-react";
import { submissions } from "@/data/report";
import { SubmissionList } from "@/components/intake/SubmissionList";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ClearIntake PI Intake" },
      { name: "description", content: "Build PI intakes faster, capture better patient stories and review submissions in seconds." },
      { property: "og:title", content: "Dashboard — ClearIntake PI Intake" },
      { property: "og:description", content: "Build faster, capture better, review faster — Personal Injury intake for chiropractors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const outcomes = [
  { icon: Hammer, title: "Build faster", body: "Describe the intake you want instead of configuring dozens of questions and rules by hand." },
  { icon: MessageSquareText, title: "Capture better", body: "Patients see only the questions that apply, and can explain what happened in their own words." },
  { icon: ClipboardCheck, title: "Review faster", body: "Get a 30-second summary with missing info and items to confirm — before the visit." },
];

function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <section className="max-w-3xl">
        <p className="text-sm font-medium text-primary">Personal Injury intake, simplified</p>
        <h1 className="mt-3 text-4xl leading-tight text-foreground md:text-5xl">
          Describe the intake you want.
          <br />
          <span className="text-primary">Skip the hours of configuration.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Let patients explain complex accidents naturally, then see the gaps, inconsistencies and a concise review-ready summary.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/templates/mva" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90">
            Open MVA — Concise PI <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/patient" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-5 text-sm font-medium text-foreground transition hover:bg-muted">
            Try the patient experience
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        {outcomes.map((o, i) => (
          <div key={o.title} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <o.icon className="h-5 w-5 text-primary" aria-hidden />
              <span className="font-display text-sm text-muted-foreground">0{i + 1}</span>
            </div>
            <h2 className="mt-6 text-xl text-foreground">{o.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl text-foreground">Recent intakes</h2>
          <Link to="/intakes" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        <SubmissionList items={submissions.slice(0, 4)} />
      </section>
    </div>
  );
}
