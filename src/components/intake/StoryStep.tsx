import { useMemo, useState } from "react";
import { ArrowRight, Check, Quote, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dictation } from "@/components/intake/Dictation";
import { extractStory } from "@/lib/ai.functions";
import { formatAnswer } from "@/lib/surveyEngine";
import type { StoryFact } from "@/types/ai";
import type { AnswerValue } from "@/types/survey";
import { cn } from "@/lib/utils";

export interface StoryResult { text: string; confirmed: { question: string; value: AnswerValue; excerpt: string }[] }

const key = (v: AnswerValue) => (Array.isArray(v) ? v.join("|") : v);

/** Optional "tell your story first". AI only suggests; the patient confirms each fact. */
export function StoryStep({ preview, onDone, headingRef }: { preview: boolean; onDone: (r: StoryResult) => void; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const extract = useServerFn(extractStory);
  const [text, setText] = useState("");
  const [facts, setFacts] = useState<StoryFact[] | null>(null);
  const [extractedFrom, setExtractedFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** question → chosen value key, or "" for dismissed. Missing = not decided. */
  const [choice, setChoice] = useState<Record<string, string>>({});
  const stale = facts !== null && text.trim() !== extractedFrom;

  const groups = useMemo(() => {
    const m = new Map<string, StoryFact[]>();
    for (const f of facts ?? []) { const arr = m.get(f.question) ?? []; if (!arr.some((x) => key(x.value) === key(f.value))) arr.push(f); m.set(f.question, arr); }
    return [...m.entries()];
  }, [facts]);

  const find = async () => {
    setBusy(true); setError(null);
    try {
      const r = await extract({ data: { story: text.trim(), preview } });
      if (!r.ok) { setError(r.error); return; }
      setFacts(r.facts); setExtractedFrom(text.trim()); setChoice({});
    } catch { setError("We couldn't read your story right now. You can keep going and answer the questions instead."); }
    finally { setBusy(false); }
  };

  const finish = () => {
    const confirmed = stale ? [] : groups.flatMap(([q, list]) => {
      const c = choice[q]; const f = c ? list.find((x) => key(x.value) === c) : undefined;
      return f ? [{ question: q, value: f.value, excerpt: f.excerpt }] : [];
    });
    onDone({ text: text.trim(), confirmed });
  };

  return (
    <div className="mx-auto max-w-2xl px-5 pb-12 pt-6 sm:pt-8">
      <p className="text-sm font-semibold text-primary">Optional · before the questions</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-[26px] leading-tight text-foreground outline-none sm:text-[32px]">Tell your story first</h1>
      <p className="mt-3 text-lg text-muted-foreground">Describe what happened in your own words — type or record. We'll suggest answers from it, and you check each one. You can also skip this.</p>
      <label htmlFor="story" className="sr-only">Your story</label>
      <textarea id="story" rows={7} value={text} maxLength={6000} onChange={(e) => setText(e.target.value)} placeholder="I was stopped at a red light when…"
        className="mt-5 min-h-14 w-full rounded-lg border border-input bg-card px-4 py-3 text-lg text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus-visible:ring-2 focus-visible:ring-ring/40" />
      <Dictation className="mt-3" onTranscript={(t) => setText((c) => (c.trim() ? `${c.trim()}\n${t}` : t))} />
      <p className="mt-1 text-sm text-muted-foreground">Recordings are turned into text you can edit. The audio isn't saved.</p>

      {error && <p role="alert" className="mt-4 text-base text-attention-foreground">{error}</p>}
      {stale && <p role="status" className="mt-4 rounded-md bg-attention-soft px-4 py-3 text-base text-attention-foreground">You changed your story, so these suggestions may be out of date. Find details again to refresh them.</p>}

      {facts && !stale && (
        <section className="mt-6" aria-labelledby="sugg">
          <h2 id="sugg" className="font-sans text-lg font-medium text-foreground">{facts.length ? "Details we found — please check each one" : "We didn't find details we could fill in. That's fine — just continue."}</h2>
          <ul className="mt-3 space-y-3">
            {groups.map(([q, list]) => (
              <li key={q} className="rounded-lg border border-border bg-card p-4">
                <p className="text-base font-medium text-foreground">{list[0]!.label}</p>
                {list.length > 1 && <p className="text-sm text-attention-foreground">Your story mentions different answers — choose the right one.</p>}
                <div className="mt-2 space-y-2">
                  {list.map((f) => {
                    const on = choice[q] === key(f.value);
                    return (
                      <div key={key(f.value)} className={cn("rounded-md border px-3 py-2", on ? "border-primary bg-secondary" : "border-border")}>
                        <p className="text-base text-foreground">{formatAnswer(f.value)}</p>
                        <p className="mt-1 flex gap-1.5 text-sm text-muted-foreground"><Quote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />“{f.excerpt}”</p>
                        <div className="mt-2 flex gap-2">
                          <Button type="button" variant={on ? "default" : "outline"} className="min-h-11" onClick={() => setChoice((c) => ({ ...c, [q]: key(f.value) }))}><Check /> {on ? "Confirmed" : "Confirm"}</Button>
                        </div>
                      </div>
                    );
                  })}
                  <Button type="button" variant="ghost" className={cn("min-h-11", choice[q] === "" && "text-foreground underline")} onClick={() => setChoice((c) => ({ ...c, [q]: "" }))}><X /> {choice[q] === "" ? "Dismissed" : "Dismiss"}</Button>
                </div>
              </li>
            ))}
          </ul>
          {facts.length > 0 && <p className="mt-3 text-sm text-muted-foreground">Confirmed details fill in matching questions. You'll still see and can change every answer.</p>}
        </section>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="min-h-11 text-base text-muted-foreground" onClick={() => onDone({ text: "", confirmed: [] })}>Skip — just answer questions</Button>
        <div className="flex flex-wrap gap-2">
          {text.trim().length >= 20 && (!facts || stale) && <Button variant="outline" className="min-h-11 text-base" disabled={busy} onClick={find}>{busy ? "Reading your story…" : "Find details in my story"}</Button>}
          <Button className="min-h-11 px-6 text-base" disabled={busy} onClick={finish}>Continue <ArrowRight /></Button>
        </div>
      </div>
    </div>
  );
}
