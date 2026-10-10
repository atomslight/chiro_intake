import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PracticeGate } from "@/components/intake/PracticeGate";
import { getPracticeTemplate, publishDraft, saveDraft, getSavedTemplate } from "@/lib/surveys.functions";
import { ArrowDown, ArrowUp, ChevronLeft, CornerDownRight, Copy, FileSignature, History, MoreHorizontal, Pencil, Play, Plus, Redo2, Repeat, Search, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { practiceConsent } from "@/data/templates";
import { createExamples, customizeExamples, isCreateRequest } from "@/data/changeRequests";
import { generateIntake, proposeEdit } from "@/lib/ai.functions";
import type { EditResult, GenerateResult } from "@/types/ai";
import { ChangeComposer, type ComposerMessage } from "@/components/intake/ChangeComposer";
import { applyPatches, describeRule, type SurveyPatch } from "@/lib/surveyEngine";
import { surveyStore, useSurveyStore } from "@/lib/surveyStore";
import type { Group, Question, Survey, SurveyRule } from "@/types/survey";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/templates/mva")({
  validateSearch: z.object({ ask: z.string().max(1500).optional(), use: z.string().uuid().optional() }),
  head: () => ({ meta: [
    { title: "Motor Vehicle Accident — Concise PI Template — ClearIntake" },
    { name: "description", content: "Generate, edit and publish a personal-injury intake by describing it in plain language." },
    { property: "og:title", content: "MVA — Concise PI Template — ClearIntake" },
    { property: "og:description", content: "Describe it, review it, publish it." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MvaTemplate,
});

type Proposal =
  | { type: "edit"; summary: string; patches: SurveyPatch[]; diff: string[]; baseRevision: number; module: string }
  | { type: "generated"; summary: string; survey: Survey; diff: string[]; baseRevision: number };

function MvaTemplate() {
  return <PracticeGate what="edit and publish templates"><MvaLoader /></PracticeGate>;
}

export const practiceTemplateKey = ["practice-template"] as const;
type Versions = Awaited<ReturnType<typeof getPracticeTemplate>>["versions"];

function MvaLoader() {
  const fetchTemplate = useServerFn(getPracticeTemplate);
  const { data, error } = useQuery({ queryKey: practiceTemplateKey, queryFn: () => fetchTemplate(), refetchOnWindowFocus: false });
  const { survey } = useSurveyStore();
  useEffect(() => { if (data) surveyStore.load(data.survey, data.revision); }, [data]);
  if (error) return <div role="alert" className="mx-auto max-w-6xl px-5 py-12 text-foreground">Couldn't load the template. Please reload the page.</div>;
  if (!data || !survey) return <div className="mx-auto max-w-6xl px-5 py-12 text-muted-foreground">Loading template…</div>;
  return <MvaEditor versions={data.versions} />;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "item";
function uniqueId(survey: Survey, base: string, kind: "q" | "g") {
  const taken = new Set(kind === "q" ? survey.modules.flatMap((m) => m.groups.flatMap((g) => g.questions.map((q) => q.id))) : survey.modules.flatMap((m) => m.groups.map((g) => g.id)));
  let id = slug(base); let n = 2;
  while (taken.has(id)) id = `${slug(base)}_${n++}`;
  return id;
}

// ---------- Sticky save / publish bar ----------
function TopBar({ versions, onMessage }: { versions: Versions; onMessage: (m: ComposerMessage) => void }) {
  const { survey, dirty, savedRevision, history } = useSurveyStore();
  const save = useServerFn(saveDraft);
  const publish = useServerFn(publishDraft);
  const fetchTemplate = useServerFn(getPracticeTemplate);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);
  const latest = versions[0];
  const lastChange = history.at(-1);
  const run = async (kind: "save" | "publish") => {
    if (!survey) return;
    setBusy(kind); setMsg(null);
    try {
      const res = kind === "save" ? await save({ data: { survey, baseRevision: savedRevision } }) : await publish({ data: { survey, baseRevision: savedRevision, note } });
      if (!res.ok) { setMsg({ text: res.error, warn: true }); return; }
      surveyStore.markSaved(res.revision);
      if (kind === "publish" && "version" in res) { setNote(""); setConfirm(false); setMsg({ text: `Published version ${res.version}. New patients get it now.` }); }
      else setMsg({ text: "Draft saved." });
      await qc.invalidateQueries({ queryKey: practiceTemplateKey });
      await qc.invalidateQueries({ queryKey: ["published-survey"] });
      await qc.invalidateQueries({ queryKey: ["saved-templates"] });
    } catch { setMsg({ text: "Couldn't reach the server — your edits are still here. Try again.", warn: true }); }
    finally { setBusy(null); }
  };
  const reload = async () => { const d = await fetchTemplate(); surveyStore.forceLoad(d.survey, d.revision); qc.setQueryData(practiceTemplateKey, d); onMessage({ role: "system", text: "Reloaded the latest saved draft." }); setMsg(null); };
  const undo = () => { if (!lastChange) return; surveyStore.undo(); onMessage({ role: "system", text: `Undone: ${lastChange.diff.slice(0, 3).join("; ")}.` }); };
  return (
    <div className="sticky top-0 z-30 -mx-5 mt-4 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("inline-flex min-h-8 items-center rounded-full px-3 text-sm font-medium", dirty ? "bg-attention/25 text-foreground" : "bg-secondary text-secondary-foreground")}>
          {dirty ? "Unsaved changes" : "Draft saved"}
        </span>
        <span className="text-sm text-muted-foreground">{latest ? `Live for patients: version ${latest.version}` : "Not published yet"}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {lastChange && <Button type="button" variant="ghost" className="min-h-11" onClick={undo}><Redo2 className="-scale-x-100" /> Undo</Button>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="min-h-11"><History /> Versions</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Published versions</DropdownMenuLabel>
              {versions.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">None yet.</p>}
              {versions.map((v) => <div key={v.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 px-2 py-1.5 text-sm"><span className="font-medium">v{v.version}</span><span className="truncate text-muted-foreground">{v.note || "No note"}</span><span className="text-muted-foreground">{v.submissions} intakes</span></div>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild variant="outline" className="min-h-11"><Link to="/patient" search={{ preview: true }} onClick={(e) => { if (dirty) { e.preventDefault(); setMsg({ text: "Save the draft first — Preview shows the last saved draft.", warn: true }); } }}><Play /> Preview</Link></Button>
          <Button type="button" variant="outline" className="min-h-11" disabled={!dirty || busy !== null} onClick={() => run("save")}>{busy === "save" ? "Saving…" : "Save draft"}</Button>
          <Button type="button" className="min-h-11 px-6 text-base" disabled={busy !== null} onClick={() => setConfirm(true)}>Publish</Button>
        </div>
      </div>
      {msg && <div role="status" className={cn("mt-2 flex flex-wrap items-center gap-2 text-sm", msg.warn ? "text-destructive" : "text-foreground")}>{msg.text}{msg.warn && msg.text.includes("Reload") && <Button type="button" variant="ghost" className="h-9" onClick={reload}>Reload</Button>}</div>}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-sans">Publish this intake?</DialogTitle><DialogDescription>Patients will get this version from now on. Intakes already submitted keep the version they answered.</DialogDescription></DialogHeader>
          <label className="block text-sm font-medium text-foreground">Note (optional)
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Attorney details optional" className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground" />
          </label>
          <DialogFooter className="gap-2"><Button variant="outline" className="min-h-11" onClick={() => setConfirm(false)}>Cancel</Button><Button className="min-h-11" disabled={busy !== null} onClick={() => run("publish")}>{busy === "publish" ? "Publishing…" : "Publish now"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Editor ----------
function MvaEditor({ versions }: { versions: Versions }) {
  const { survey: loaded } = useSurveyStore();
  const survey = loaded as Survey;
  const { ask, use } = Route.useSearch();
  const loadSaved = useServerFn(getSavedTemplate);
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ComposerMessage[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [thinking, setThinking] = useState(false);
  const askEdit = useServerFn(proposeEdit);
  const askGenerate = useServerFn(generateIntake);
  const [open, setOpen] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ mode: "edit"; question: Question } | { mode: "add"; group: Group } | { mode: "add_group"; module: string } | null>(null);
  const [deleting, setDeleting] = useState<{ kind: "question"; id: string; label: string } | { kind: "group"; id: string; label: string } | null>(null);
  const say = (m: ComposerMessage[]) => setMessages((c) => [...c, ...m].slice(-6));

  const send = async (textArg?: string) => {
    const text = (textArg ?? draft).trim();
    if (!text) return;
    setDraft(""); setProposal(null); say([{ role: "user", text }]); setThinking(true);
    try {
      if (isCreateRequest(text)) {
        let r: GenerateResult;
        try { r = await askGenerate({ data: { description: text, survey } }); } catch { r = { kind: "rejected", message: "Couldn't reach the AI service. Nothing was changed — try again." }; }
        if (r.kind === "generated") {
          const qs = r.survey.modules.reduce((n, m) => n + m.groups.reduce((k, g) => k + g.questions.length, 0), 0);
          setProposal({ type: "generated", summary: r.summary, survey: r.survey, diff: r.diff, baseRevision: survey.revision });
          say([{ role: "system", text: `Built "${r.summary}": ${r.survey.modules.length} modules, ${qs} questions. Review below, then Use this intake or Cancel.` }]);
        } else say([{ role: "system", text: r.message, tone: r.kind === "clarify" ? "info" : "warn" }]);
        return;
      }
      let reply: EditResult;
      try { reply = await askEdit({ data: { request: text, survey } }); } catch { reply = { kind: "rejected", message: "Couldn't reach the AI service. Nothing was changed — try again." }; }
      if (reply.kind === "proposal") { setProposal({ type: "edit", ...reply }); say([{ role: "system", text: `Proposed: ${reply.summary}. Review below, then Apply or Cancel.` }]); return; }
      if (reply.kind === "configured") { say([{ role: "system", text: reply.message }]); focusModule(reply.module); return; }
      if (reply.kind === "clarify") { say([{ role: "system", text: reply.message }]); return; }
      say([{ role: "system", text: reply.kind === "unsupported" ? `${reply.message} Nothing was changed.` : reply.message, tone: "warn" }]);
    } finally { setThinking(false); }
  };

  // Run a request passed from the template library once.
  const askedRef = useRef(false);
  useEffect(() => {
    if (ask && !askedRef.current) { askedRef.current = true; void navigate({ search: {}, replace: true }); void send(ask); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  // Open a saved intake from the library as a reviewable proposal (nothing changes until "Use this intake").
  const usedRef = useRef(false);
  useEffect(() => {
    if (!use || usedRef.current) return;
    usedRef.current = true; void navigate({ search: {}, replace: true });
    void (async () => {
      const saved = await loadSaved({ data: { id: use } }).catch(() => null);
      if (!saved) { say([{ role: "system", text: "That saved intake couldn't be loaded.", tone: "warn" }]); return; }
      const next = { ...saved, id: survey.id, revision: survey.revision + 1 };
      const qs = next.modules.reduce((n, m) => n + m.groups.reduce((k, g) => k + g.questions.length, 0), 0);
      setProposal({ type: "generated", summary: saved.name, survey: next, diff: [`Saved intake "${saved.name}": ${next.modules.length} sections, ${qs} questions.`], baseRevision: survey.revision });
      say([{ role: "system", text: `Loaded your saved intake "${saved.name}". Review below, then Use this intake or Cancel.` }]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [use]);

  const focusModule = (module: string) => {
    setOpen((c) => (c.includes(module) ? c : [...c, module]));
    setTimeout(() => document.getElementById(`module-${module}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  };
  const commit = (patches: SurveyPatch[], base = survey.revision, module?: string): boolean => {
    const res = applyPatches(survey, patches, base);
    if (!res.ok) { say([{ role: "system", tone: "warn", text: `Not applied — ${res.errors.join(" ")}` }]); return false; }
    surveyStore.commit(res.survey, res.diff);
    say([{ role: "system", text: `Done: ${res.diff.slice(0, 4).join("; ")}${res.diff.length > 4 ? "…" : ""}.` }]);
    if (module) focusModule(module);
    return true;
  };
  const apply = () => {
    if (!proposal) return;
    if (proposal.type === "edit") { if (commit(proposal.patches, proposal.baseRevision, proposal.module)) setProposal(null); return; }
    if (proposal.baseRevision !== survey.revision) { say([{ role: "system", tone: "warn", text: "The template changed since this was generated. Generate again." }]); return; }
    surveyStore.commit(proposal.survey, [`Replaced with generated intake: ${proposal.summary}`]);
    say([{ role: "system", text: "New intake loaded into your draft. Review it, then Save draft or Publish. Undo brings back the previous one." }]);
    setProposal(null);
  };
  const cancel = () => { setProposal(null); say([{ role: "system", text: "Cancelled — nothing was changed." }]); };

  const moduleOf = (qid: string) => survey.modules.find((m) => m.groups.some((g) => g.questions.some((x) => x.id === qid)))?.id;
  const dependents = (id: string, kind: "question" | "group") => {
    const ids = kind === "question" ? [id] : survey.modules.flatMap((m) => m.groups).find((g) => g.id === id)?.questions.map((q) => q.id) ?? [];
    const qs: Question[] = []; const gs: Group[] = [];
    for (const m of survey.modules) for (const g of m.groups) {
      if (g.id !== id && g.showIf && ids.includes(g.showIf.question)) gs.push(g);
      for (const q of g.questions) if (!ids.includes(q.id) && q.showIf && ids.includes(q.showIf.question)) qs.push(q);
    }
    return { qs, gs };
  };

  const counts = useMemo(() => {
    const qs = survey.modules.flatMap((m) => m.groups.flatMap((g) => g.questions));
    return { modules: survey.modules.length, questions: qs.length, followUps: qs.filter((q) => q.showIf).length + survey.modules.flatMap((m) => m.groups).filter((g) => g.showIf).length };
  }, [survey]);
  const q = query.trim().toLowerCase();
  const matches = (x: Question) => !q || x.label.toLowerCase().includes(q);
  const shownModules = survey.modules.filter((m) => !q || m.title.toLowerCase().includes(q) || m.groups.some((g) => g.questions.some(matches)));
  useEffect(() => { if (q) setOpen(shownModules.map((m) => m.id)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);

  return (
    <div className="mx-auto max-w-5xl px-5 pb-16 pt-6">
      <Link to="/templates" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft /> Templates</Link>
      <h1 className="text-3xl leading-tight text-foreground sm:text-4xl">{survey.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{counts.modules} modules · {counts.questions} questions · {counts.followUps} follow-up rules</p>
      <TopBar versions={versions} onMessage={(m) => say([m])} />

      <div className="mt-6">
        <ChangeComposer examples={[{ label: "Create a whole intake", items: createExamples }, { label: "Customize this intake", items: customizeExamples }]}
          value={draft} onChange={setDraft} onSend={() => void send()} messages={messages} busy={thinking}>
          {proposal && (
            <div className="mt-4 rounded-md border border-primary/40 bg-background p-4">
              <p className="text-sm font-medium text-foreground">{proposal.type === "generated" ? "Generated intake" : "Proposed change"} · {proposal.summary}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground">{proposal.diff.map((d) => <li key={d}>{d}</li>)}</ul>
              {proposal.type === "generated" && <p className="mt-2 text-sm text-muted-foreground">This replaces your current draft (Undo brings it back). Patients won't see it until you Publish.</p>}
              <div className="mt-3 flex gap-2"><Button type="button" onClick={apply} className="min-h-11">{proposal.type === "generated" ? "Use this intake" : "Apply"}</Button><Button type="button" variant="outline" onClick={cancel} className="min-h-11">Cancel</Button></div>
            </div>
          )}
        </ChangeComposer>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-lg font-semibold text-foreground">Questions</h2>
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Find a question</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a question" className="min-h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-base text-foreground" />
        </label>
      </div>

      <Accordion type="multiple" value={open} onValueChange={setOpen} className="mt-3 space-y-2">
        {shownModules.map((module) => {
          const total = module.groups.reduce((n, g) => n + g.questions.length, 0);
          return (
            <AccordionItem id={`module-${module.id}`} key={module.id} value={module.id} className="rounded-lg border border-border bg-card px-4">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 pr-3 text-left font-sans">
                  <span className="font-medium text-foreground">{module.title}</span>
                  {module.scope === "per_area" && <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground"><Repeat className="h-3.5 w-3.5" aria-hidden />per body area</span>}
                  <span className="ml-auto text-sm text-muted-foreground">{total} {total === 1 ? "question" : "questions"}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-3">
                  {module.groups.map((g) => {
                    const visible = g.questions.filter(matches);
                    if (q && !visible.length) return null;
                    return (
                      <div key={g.id} className="rounded-md border border-border/70">
                        <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{g.title}</p>
                            {g.showIf && <p className="text-[13px] text-muted-foreground">Only if {describeRule(survey, g.showIf)}</p>}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Section options for ${g.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => { const v = window.prompt("Section name", g.title); if (v && v.trim()) commit([{ op: "rename_group", group: g.id, value: v.trim() }], survey.revision, module.id); }}><Pencil /> Rename section</DropdownMenuItem>
                              {g.showIf && <DropdownMenuItem onSelect={() => commit([{ op: "remove_group_condition", group: g.id }], survey.revision, module.id)}><CornerDownRight /> Always ask this section</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting({ kind: "group", id: g.id, label: g.title })}><Trash2 /> Delete section</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <ul className="divide-y divide-border/60">
                          {visible.map((x, i) => (
                            <li key={x.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-1 px-3 py-1.5 text-sm">
                              <div className="min-w-0">
                                <p className="text-foreground">{x.showIf && <CornerDownRight className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" aria-hidden />}{x.label}</p>
                                <p className="text-[13px] text-muted-foreground">{typeLabel(x)}{x.options ? ` · ${x.options.join(", ")}` : ""}{x.showIf ? ` · only if ${describeRule(survey, x.showIf)}` : ""}</p>
                              </div>
                              <span className={cn("px-1 text-[13px] font-medium", x.required ? "text-primary" : "text-muted-foreground")}>{x.required ? "Required" : "Optional"}</span>
                              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Edit ${x.label}`} onClick={() => setDialog({ mode: "edit", question: x })}><Pencil /></Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`More actions for ${x.label}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem disabled={i === 0 || !!q} onSelect={() => commit([{ op: "move_question", question: x.id, direction: "up" }])}><ArrowUp /> Move up</DropdownMenuItem>
                                  <DropdownMenuItem disabled={i === visible.length - 1 || !!q} onSelect={() => commit([{ op: "move_question", question: x.id, direction: "down" }])}><ArrowDown /> Move down</DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => commit([{ op: "duplicate_question", question: x.id, newId: uniqueId(survey, x.id, "q") }])}><Copy /> Duplicate</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting({ kind: "question", id: x.id, label: x.label })}><Trash2 /> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </li>
                          ))}
                        </ul>
                        {!q && <Button variant="ghost" className="m-1 min-h-11 text-primary" onClick={() => setDialog({ mode: "add", group: g })}><Plus /> Add question</Button>}
                      </div>
                    );
                  })}
                  {!q && <Button variant="outline" className="min-h-11" onClick={() => setDialog({ mode: "add_group", module: module.id })}><Plus /> Add section</Button>}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
        {shownModules.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No questions match “{query}”.</p>}
      </Accordion>

      <div className="mt-6 rounded-lg border border-border bg-muted/50 p-5">
        <div className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" aria-hidden /><p className="font-medium text-foreground">{practiceConsent.title}</p></div>
        <p className="mt-1 text-sm text-muted-foreground">{practiceConsent.note}</p>
      </div>

      {dialog && (
        <QuestionDialog key={dialog.mode === "edit" ? dialog.question.id : dialog.mode === "add" ? dialog.group.id : dialog.module} survey={survey}
          question={dialog.mode === "edit" ? dialog.question : undefined} withSectionTitle={dialog.mode === "add_group"}
          onClose={() => setDialog(null)}
          onSave={(make) => {
            let patches: SurveyPatch[]; let module: string | undefined;
            if (dialog.mode === "edit") { patches = make.edit(dialog.question); module = moduleOf(dialog.question.id); }
            else if (dialog.mode === "add") { const nq = make.create(); patches = [{ op: "add_question", group: dialog.group.id, question: nq }]; module = moduleOf(dialog.group.questions[0]!.id); }
            else { const nq = make.create(); module = dialog.module; patches = [{ op: "add_group", module: dialog.module, group: { id: uniqueId(survey, make.sectionTitle || nq.label, "g"), title: make.sectionTitle || nq.label }, question: nq }]; }
            if (commit(patches, survey.revision, module)) setDialog(null);
          }} />
      )}

      {deleting && (() => {
        const dep = dependents(deleting.id, deleting.kind);
        const n = dep.qs.length + dep.gs.length;
        const doDelete = (withDependents: boolean) => {
          const base: SurveyPatch = deleting.kind === "question" ? { op: "remove_question", question: deleting.id } : { op: "remove_group", group: deleting.id };
          const extra: SurveyPatch[] = withDependents ? [...dep.qs.map((x) => ({ op: "remove_question", question: x.id }) as SurveyPatch), ...dep.gs.map((g) => ({ op: "remove_group", group: g.id }) as SurveyPatch)] : [];
          if (commit([...extra, base])) setDeleting(null);
        };
        return (
          <Dialog open onOpenChange={(o) => !o && setDeleting(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="font-sans">Delete “{deleting.label}”?</DialogTitle>
                <DialogDescription>{n ? `${n} follow-up ${n === 1 ? "item depends" : "items depend"} on this. Deleting it means they can't be asked either.` : "You can Undo this."}</DialogDescription></DialogHeader>
              {n > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">{[...dep.gs.map((g) => `Section: ${g.title}`), ...dep.qs.map((x) => x.label)].map((t) => <li key={t}>{t}</li>)}</ul>}
              <DialogFooter className="gap-2"><Button variant="outline" className="min-h-11" onClick={() => setDeleting(null)}>Cancel</Button>
                <Button variant="destructive" className="min-h-11" onClick={() => doDelete(n > 0)}>{n ? "Delete all of these" : "Delete"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}

const TYPES: { value: Question["type"]; label: string }[] = [
  { value: "choice", label: "Pick one" }, { value: "multi", label: "Pick several" }, { value: "yes_no", label: "Yes / No" },
  { value: "text", label: "Short text" }, { value: "longtext", label: "Long text" }, { value: "number", label: "Number" }, { value: "date", label: "Date" },
];
const typeLabel = (q: Question) => TYPES.find((t) => t.value === q.type)?.label ?? (q.type === "scale" ? "0–10 scale" : "Body map");

interface Makers { edit: (q: Question) => SurveyPatch[]; create: () => Extract<SurveyPatch, { op: "add_question" }>["question"]; sectionTitle: string }

function QuestionDialog({ survey, question, withSectionTitle, onClose, onSave }: { survey: Survey; question?: Question | undefined; withSectionTitle?: boolean; onClose: () => void; onSave: (m: Makers) => void }) {
  const [sectionTitle, setSectionTitle] = useState("");
  const [label, setLabel] = useState(question?.label ?? "");
  const [type, setType] = useState<Question["type"]>(question?.type ?? "yes_no");
  const [required, setRequired] = useState(question?.required ?? false);
  const [options, setOptions] = useState((question?.options ?? []).join("\n"));
  const [condQ, setCondQ] = useState(question?.showIf?.question ?? "");
  const [condV, setCondV] = useState(typeof question?.showIf?.value === "string" ? question.showIf.value : Array.isArray(question?.showIf?.value) ? question.showIf.value[0] ?? "" : "");
  const special = question && (question.type === "scale" || question.type === "body_areas");
  const needsOptions = type === "choice" || type === "multi";
  // Earlier questions with fixed answers can drive a follow-up.
  const sources = useMemo(() => {
    const out: Question[] = [];
    for (const m of survey.modules) for (const g of m.groups) for (const x of g.questions) {
      if (question && x.id === question.id) return out;
      if (x.type === "yes_no" || x.type === "choice" || x.type === "multi") out.push(x);
    }
    return out;
  }, [survey, question]);
  const src = sources.find((s) => s.id === condQ);
  const srcOpts = src ? (src.type === "yes_no" ? ["Yes", "No"] : src.options ?? []) : [];
  const opts = options.split("\n").map((s) => s.trim()).filter(Boolean);
  const rule: SurveyRule | undefined = src && condV ? { question: src.id, op: src.type === "multi" ? "contains" : "equals", value: condV } : undefined;
  const canSave = label.trim() && (!needsOptions || opts.length >= 2) && (!withSectionTitle || sectionTitle.trim());

  const makers: Makers = {
    sectionTitle: sectionTitle.trim(),
    edit: (q) => {
      const p: SurveyPatch[] = [{ op: "set_label", question: q.id, value: label.trim() }, { op: "set_required", question: q.id, value: required }];
      if (!special && type !== q.type) p.push({ op: "set_type", question: q.id, value: type as never, options: needsOptions ? opts : undefined });
      else if (needsOptions && q.options && opts.join("|") !== q.options.join("|")) p.push({ op: "set_options", question: q.id, value: opts });
      const before = JSON.stringify(q.showIf ?? null);
      if (rule && JSON.stringify(rule) !== before) p.push({ op: "set_condition", question: q.id, rule });
      if (!rule && q.showIf && !condQ) p.push({ op: "remove_condition", question: q.id });
      return p;
    },
    create: () => ({ id: uniqueId(survey, label, "q"), label: label.trim(), type: type as never, required, ...(needsOptions ? { options: opts } : {}) }),
  };
  const created = !question;
  const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:border-primary";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle className="font-sans">{withSectionTitle ? "Add section" : created ? "Add question" : "Edit question"}</DialogTitle><DialogDescription>Checked before saving. You can Undo.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          {withSectionTitle && <label className="block text-sm font-medium text-foreground">Section name<input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="e.g. Vehicle details" className={cn(field, "mt-1")} /></label>}
          <label className="block text-sm font-medium text-foreground">Question<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Did your airbag deploy?" className={cn(field, "mt-1")} /></label>
          {!special && (
            <label className="block text-sm font-medium text-foreground">Answer type
              <select value={type} onChange={(e) => setType(e.target.value as Question["type"])} className={cn(field, "mt-1 min-h-11")}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            </label>
          )}
          {needsOptions && <label className="block text-sm font-medium text-foreground">Choices (one per line)<textarea rows={4} value={options} onChange={(e) => setOptions(e.target.value)} className={cn(field, "mt-1")} /></label>}
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-medium text-foreground">Required<Switch checked={required} onCheckedChange={setRequired} /></label>
          {!created && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">When to ask</legend>
              <select value={condQ} onChange={(e) => { setCondQ(e.target.value); setCondV(""); }} className={cn(field, "min-h-11")}>
                <option value="">Always ask</option>
                {sources.map((s) => <option key={s.id} value={s.id}>Only if “{s.label}” is…</option>)}
              </select>
              {src && <select value={condV} onChange={(e) => setCondV(e.target.value)} className={cn(field, "min-h-11")}><option value="">Choose an answer</option>{srcOpts.map((o) => <option key={o}>{o}</option>)}</select>}
            </fieldset>
          )}
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose} className="min-h-11">Cancel</Button><Button onClick={() => onSave(makers)} disabled={!canSave || (!!condQ && !condV)} className="min-h-11">{created ? "Add" : "Save change"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
