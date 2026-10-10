import { useEffect, useRef, useState, type ReactNode } from "react";
import { Send, Wand2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dictation } from "@/components/intake/Dictation";
import { suggestCompletionFn } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";

export interface ComposerMessage { role: "user" | "system"; text: string; tone?: "ok" | "info" | "warn" }
export interface ExampleGroup { label: string; items: string[] }

interface Props {
  title?: string;
  note?: string;
  examples: ExampleGroup[];
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  messages: ComposerMessage[];
  busy?: boolean;
  placeholder?: string;
  children?: ReactNode;
}

const MIN_WORDS = 6;
const fieldText = "px-4 py-3 text-base leading-6";

/** The one "AI Generate" box: create a whole intake or change the current one, typed or dictated, with inline autocomplete. */
export function ChangeComposer({ title = "AI Generate", note = "Type or dictate. You'll see the changes before anything is saved.", examples, value, onChange, onSend, messages, busy, placeholder, children }: Props) {
  const suggest = useServerFn(suggestCompletionFn);
  const [ghost, setGhost] = useState("");
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const go = () => { if (value.trim() && !busy) { setGhost(""); onSend(); } };
  const accept = () => { if (ghost) { onChange(value + ghost); setGhost(""); } };
  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const canSuggest = words >= MIN_WORDS && !busy && value.length <= 1400;

  // Typing invalidates any pending or shown suggestion.
  useEffect(() => { setGhost(""); setLoading(false); reqId.current++; }, [value]);

  /** Generate a suggestion only when the practice asks for one. */
  const requestSuggestion = async () => {
    if (!canSuggest || loading) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const r = await suggest({ data: { text: value } });
      if (id === reqId.current && r.completion.trim()) setGhost(r.completion);
    } catch { /* optional — ignore */ } finally { if (id === reqId.current) setLoading(false); }
  };

  const items = examples.flatMap((g) => g.items);
  return (
    <section className="rounded-lg border-2 border-primary/40 bg-card p-5" aria-labelledby="composer-heading">
      <h2 id="composer-heading" className="flex items-center gap-2 font-sans text-lg font-semibold text-foreground"><Wand2 className="h-5 w-5 text-primary" aria-hidden />{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      <form className="mt-3" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <label htmlFor="composer-input" className="sr-only">{title}</label>
        <div className="relative rounded-lg border border-input bg-background focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40">
          <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-transparent", fieldText)}>
            {value}<span className="text-muted-foreground/70">{ghost}</span>
          </div>
          <textarea id="composer-input" rows={3} value={value} onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Tab" && ghost) { e.preventDefault(); accept(); return; }
              if (e.key === "Tab" && !e.shiftKey && canSuggest) { e.preventDefault(); void requestSuggestion(); return; }
              if (e.key === "Escape" && ghost) { setGhost(""); return; }
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); }
            }}
            placeholder={placeholder ?? items[0]}
            className={cn("relative block w-full resize-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground", fieldText, (ghost || canSuggest) && "pr-14")} />
          {(ghost || canSuggest) && (
            <button type="button" onClick={ghost ? accept : () => void requestSuggestion()} disabled={loading}
              aria-label={ghost ? "Accept suggestion (Tab)" : "Suggest how to finish (Tab)"} title={ghost ? "Accept suggestion (Tab)" : "Suggest how to finish (Tab)"}
              className="absolute bottom-1.5 right-1.5 grid h-11 w-11 place-items-center rounded-full text-primary animate-in fade-in zoom-in-75 duration-300 hover:bg-secondary">
              {loading
                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
                : <Wand2 className={cn("h-4 w-4", ghost ? "" : "motion-safe:animate-pulse")} aria-hidden />}
            </button>
          )}
        </div>
        <p className="mt-1 min-h-4 text-xs text-muted-foreground">
          {ghost ? "Press Tab or tap the wand to accept. Keep typing to ignore." : loading ? "Writing a suggestion…" : canSuggest ? "Tap the wand (or press Tab) for a suggested ending." : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <Dictation label="Dictate" onTranscript={(t) => onChange(value.trim() ? `${value.trim()} ${t}` : t)} />
          <Button type="submit" disabled={!value.trim() || busy} className="min-h-11"><Send /> {busy ? "Working…" : "Generate"}</Button>
        </div>
      </form>
      {messages.length > 0 && (
        <ol aria-live="polite" className="mt-4 space-y-2">
          {messages.map((m, i) => (
            <li key={i} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : m.tone === "warn" ? "bg-attention/20 text-foreground" : "bg-secondary text-secondary-foreground")}>{m.text}</li>
          ))}
        </ol>
      )}
      {children}
      {items.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {items.map((ex) => <Button key={ex} type="button" variant="outline" size="sm" onClick={() => onChange(ex)} className="h-auto min-h-11 whitespace-normal py-2 text-left text-sm font-normal">“{ex}”</Button>)}
        </div>
      )}
    </section>
  );
}
