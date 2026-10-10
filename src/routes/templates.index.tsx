import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { deleteSavedTemplate, getAdminStatus, listSavedTemplates } from "@/lib/surveys.functions";
import { ArrowRight, Clock, Layers } from "lucide-react";
import { ChangeComposer } from "@/components/intake/ChangeComposer";
import { customizeExamples, isCreateRequest } from "@/data/changeRequests";
import { templates } from "@/data/templates";
import type { TemplateSummary } from "@/types/intake";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/templates/")({
  head: () => ({
    meta: [
      { title: "PI Template Library — ClearIntake" },
      { name: "description", content: "Starting templates for motor vehicle, slip and fall, road user and general personal injury intakes." },
      { property: "og:title", content: "PI Template Library — ClearIntake" },
      { property: "og:description", content: "US general Personal Injury starting templates for chiropractic intake." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TemplatesPage,
});

function TemplateCard({ t }: { t: TemplateSummary }) {
  const interactive = t.status === "interactive";
  return (
    <div className={cn("flex h-full flex-col rounded-2xl border bg-card p-6", interactive ? "border-primary/40 shadow-sm" : "border-border")}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold uppercase text-muted-foreground">{t.category}</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", interactive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {interactive ? "Interactive demo" : "Preview"}
        </span>
      </div>
      <h2 className="mt-4 text-xl leading-snug text-foreground">{t.name}</h2>
      <p className="mt-2 flex-1 text-base leading-relaxed text-muted-foreground">{t.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" aria-hidden />{t.modules} modules</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />Typical path · ~{t.estMinutes} min</span>
      </div>
      {interactive ? (
        <Link to="/templates/mva" className="mt-5 inline-flex min-h-11 items-center justify-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Open template <ArrowRight className="h-4 w-4" />
        </Link>
      ) : (
        <button disabled className="mt-5 min-h-11 cursor-not-allowed rounded-lg border border-border bg-muted px-4 text-sm text-muted-foreground">
          Preview only
        </button>
      )}
    </div>
  );
}

const CUSTOM_EXAMPLE = "A short intake for a sudden back injury at work: when it started, how it happened, pain level, prior treatment and insurance policy number. Keep it to 2 sections.";

function CreatePanel() {
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"custom" | "template">("custom");
  const navigate = useNavigate();
  const send = () => {
    const text = draft.trim();
    // Custom always builds a brand-new intake, never starting from the car-accident template.
    const ask = mode === "custom" && !isCreateRequest(text) ? `Create an intake: ${text}` : text;
    void navigate({ to: "/templates/mva", search: { ask } });
  };
  const tab = (m: typeof mode, label: string) => (
    <button type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
      className={cn("min-h-11 rounded-md px-4 text-sm font-medium", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>{label}</button>
  );
  return (
    <div>
      <div role="tablist" aria-label="What do you want to do?" className="mb-3 inline-flex gap-1 rounded-lg border border-border bg-card p-1">
        {tab("custom", "Custom intake (from scratch)")}
        {tab("template", "Change the car-accident template")}
      </div>
      <ChangeComposer
        title={mode === "custom" ? "Custom intake" : "AI Generate"}
        note={mode === "custom" ? "Describe the intake in your own words. It's built fresh — no existing template is used. You'll review it before patients see it." : "Describe a change to the car-accident template. You'll review it before patients see it."}
        placeholder={mode === "custom" ? CUSTOM_EXAMPLE : customizeExamples[0] ?? ""}
        examples={mode === "custom" ? [{ label: "Example", items: [CUSTOM_EXAMPLE] }] : [{ label: "Customize", items: customizeExamples }]}
        value={draft} onChange={setDraft} messages={[]} onSend={send} />
    </div>
  );
}

function TemplatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <h1 className="text-4xl text-foreground">PI template library</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">US General PI starting template — customize for your state, practice and workflow.</p>
        </div>
      </div>
      <div className="mt-6"><CreatePanel /></div>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => <TemplateCard key={t.id} t={t} />)}
      </div>
      <SavedTemplates />
    </div>
  );
}

/** Intakes the practice published before, kept for reuse below the starting templates. */
function SavedTemplates() {
  const list = useServerFn(listSavedTemplates);
  const status = useServerFn(getAdminStatus);
  const del = useServerFn(deleteSavedTemplate);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["saved-templates"], queryFn: () => list() });
  const { data: admin } = useQuery({ queryKey: ["admin-status"], queryFn: () => status() });
  return (
    <section className="mt-12" aria-labelledby="saved-heading">
      <h2 id="saved-heading" className="font-sans text-lg font-semibold text-foreground">Your saved intakes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Every intake you publish is kept here so you can start from it again.</p>
      {!data ? null : data.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Nothing saved yet. Publish an intake and it will appear here.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <div key={t.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
              <span className="text-[13px] font-semibold uppercase text-muted-foreground">Saved</span>
              <h3 className="mt-2 text-lg leading-snug text-foreground">{t.name}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{t.sections} sections · {t.questions} questions · {new Date(t.updatedAt).toLocaleDateString()}</p>
              <div className="mt-4 flex gap-2">
                <Link to="/templates/mva" search={{ use: t.id }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Use this intake <ArrowRight className="h-4 w-4" /></Link>
                {admin?.signedIn && (
                  <button type="button" aria-label={`Remove ${t.name}`} title="Remove from saved"
                    onClick={async () => { if (confirm(`Remove "${t.name}" from saved intakes? Published versions are not affected.`)) { await del({ data: { id: t.id } }); await qc.invalidateQueries({ queryKey: ["saved-templates"] }); } }}
                    className="grid min-h-11 w-11 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
