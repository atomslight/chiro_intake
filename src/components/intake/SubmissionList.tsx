import { Link } from "@tanstack/react-router";
import { ChevronRight, Inbox } from "lucide-react";
import type { Submission } from "@/types/intake";
import { plural, submissionStatus } from "@/data/report";
import { StatusChip } from "./StatusChip";

export function SubmissionList({ items }: { items: Submission[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" />
        <p className="mt-3 font-medium text-foreground">No intakes yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Submitted patient intakes will appear here.</p>
      </div>
    );
  }
  return (
    <ul className="overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((s) => {
        const n = s.findingKinds.length;
        const row = (
          <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{s.patient}</p>
              <p className="truncate text-sm text-muted-foreground">
                {s.template} · {s.submitted}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {n > 0 && <span className="text-xs text-muted-foreground">{plural(n, "item")} to review</span>}
              <StatusChip status={submissionStatus(s)} />
              {s.openable ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <span className="w-4" aria-hidden />}
            </div>
          </div>
        );
        return (
          <li key={s.id} className="border-b border-border last:border-b-0">
            {s.openable ? (
              <Link to="/reports/sample" className="block transition hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                {row}
              </Link>
            ) : (
              <div title="Example row — detailed report not included in this demo">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
