import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStats } from "@/lib/surveys.functions";
import { PracticeGate } from "@/components/intake/PracticeGate";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Practice Stats — ClearIntake" },
      { name: "description", content: "Activity report of practice actions: intakes generated, edits, drafts saved and versions published." },
      { property: "og:title", content: "Practice Stats — ClearIntake" },
      { property: "og:description", content: "What the practice did in ClearIntake, at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatsPage,
});

const LABELS: Record<string, string> = {
  sign_in: "Signed in",
  ai_generate: "Intake generated with AI",
  ai_generate_failed: "AI generation not completed",
  ai_edit: "AI edit suggested",
  ai_edit_failed: "AI edit not completed",
  save_draft: "Draft saved",
  publish: "Version published",
  use_template: "Saved intake opened",
  delete_template: "Saved intake removed",
};

function StatsPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-4xl text-foreground">Stats</h1>
      <p className="mt-2 text-muted-foreground">A report of what the practice has done: generating, editing, saving and publishing intakes.</p>
      <PracticeGate what="see practice stats"><StatsBody /></PracticeGate>
    </div>
  );
}

function StatsBody() {
  const fetchStats = useServerFn(getStats);
  const { data, isLoading } = useQuery({ queryKey: ["stats"], queryFn: () => fetchStats(), staleTime: 0 });
  if (isLoading || !data) return <p className="mt-8 text-muted-foreground">Loading…</p>;
  const n = (k: string) => data.byAction[k] ?? 0;
  const cards = [
    { label: "Patient submissions", value: data.submissions },
    { label: "Versions published", value: data.versions },
    { label: "Saved intakes", value: data.savedTemplates },
    { label: "AI intakes generated", value: n("ai_generate") },
    { label: "AI edits suggested", value: n("ai_edit") },
    { label: "Drafts saved", value: n("save_draft") },
  ];
  return (
    <div className="mt-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-10 font-sans text-lg font-semibold text-foreground">Recent activity</h2>
      {data.events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No activity recorded yet. Actions are recorded from now on.</p>
      ) : (
        <ol className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {data.events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{LABELS[e.action] ?? e.action}</p>
                {e.detail && <p className="truncate text-sm text-muted-foreground">{e.detail}</p>}
              </div>
              <time className="text-xs text-muted-foreground" dateTime={e.at}>{new Date(e.at).toLocaleString()}</time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
