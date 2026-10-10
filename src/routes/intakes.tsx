import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { submissions } from "@/data/report";
import { SubmissionList } from "@/components/intake/SubmissionList";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublishedSurvey, listSubmissions } from "@/lib/surveys.functions";
import { PracticeGate } from "@/components/intake/PracticeGate";
import { buildReport } from "@/lib/surveyEngine";

export const Route = createFileRoute("/intakes")({
  head: () => ({
    meta: [
      { title: "Intakes — ClearIntake" },
      { name: "description", content: "Submitted patient intakes, with what needs review surfaced first." },
      { property: "og:title", content: "Intakes — ClearIntake" },
      { property: "og:description", content: "Patient intake submissions and their review status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IntakesPage,
});

function IntakesPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-4xl text-foreground">Intakes</h1>
      <p className="mt-2 text-muted-foreground">Open an intake to see its summary and anything that needs attention.</p>
      <LiveIntake />
      <PracticeGate what="see submitted intakes"><SavedIntakes /></PracticeGate>
      <h2 className="mt-8 font-sans text-base font-semibold text-foreground">Synthetic examples</h2>
      <div className="mt-3">
        <SubmissionList items={submissions} />
      </div>
    </div>
  );
}

/** The intake patients get right now (latest published version). */
function LiveIntake() {
  const fetchLive = useServerFn(getPublishedSurvey);
  const { data } = useQuery({ queryKey: ["published-survey"], queryFn: () => fetchLive() });
  if (!data) return null;
  const qs = data.survey.modules.reduce((n, m) => n + m.groups.reduce((k, g) => k + g.questions.length, 0), 0);
  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-primary/40 bg-card p-5" aria-label="Published intake">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-primary">Live for patients · version {data.version}</p>
        <h2 className="mt-1 font-sans text-lg font-semibold text-foreground">{data.survey.name}</h2>
        <p className="text-sm text-muted-foreground">{data.survey.modules.length} sections · {qs} questions</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/templates/mva" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-secondary">Edit</Link>
        <Link to="/patient" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Open patient form <ChevronRight className="h-4 w-4" /></Link>
      </div>
    </section>
  );
}

function SavedIntakes() {
  const fetchList = useServerFn(listSubmissions);
  const { data: local, error } = useQuery({ queryKey: ["submissions"], queryFn: () => fetchList() });
  if (error) return <p role="alert" className="mt-8 text-foreground">Couldn't load submitted intakes. Please reload.</p>;
  if (!local) return <p className="mt-8 text-muted-foreground">Loading submitted intakes…</p>;
  if (!local.length) return <p className="mt-8 text-muted-foreground">No intakes submitted yet.</p>;
  return (
        <section className="mt-8">
          <h2 className="font-sans text-base font-semibold text-foreground">Your demo submissions <span className="font-normal text-muted-foreground">· saved for the demo practice</span></h2>
          <ul className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
            {local.map((s) => {
              const n = buildReport(s).findings.length;
              return (
                <li key={s.id} className="border-b border-border last:border-b-0">
                  <Link to="/reports/$id" params={{ id: s.id }} className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 hover:bg-muted/60">
                    <div className="min-w-0"><p className="font-medium text-foreground">Demo patient #{s.id.slice(0, 8)}{s.preview && " · draft preview"}</p><p className="truncate text-sm text-muted-foreground">{s.survey.name} · {s.version ? `version ${s.version}` : "unpublished draft"} · {new Date(s.submittedAt).toLocaleString()}</p></div>
                    <span className="flex items-center gap-3 text-sm text-muted-foreground">{n} to review <ChevronRight className="h-4 w-4" /></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
  );
}
