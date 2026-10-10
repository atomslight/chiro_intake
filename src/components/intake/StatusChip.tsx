import type { SubmissionStatus } from "@/types/intake";
import { cn } from "@/lib/utils";

const map: Record<SubmissionStatus, { label: string; cls: string }> = {
  "in-progress": { label: "In progress", cls: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", cls: "bg-success-soft text-success" },
  "needs-review": { label: "Needs review", cls: "bg-attention-soft text-attention-foreground" },
  "needs-clarification": { label: "Needs clarification", cls: "bg-attention-soft text-attention-foreground" },
  reviewed: { label: "Reviewed", cls: "bg-secondary text-secondary-foreground" },
};

export function StatusChip({ status }: { status: SubmissionStatus }) {
  const s = map[status];
  return <span className={cn("inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-medium", s.cls)}>{s.label}</span>;
}
