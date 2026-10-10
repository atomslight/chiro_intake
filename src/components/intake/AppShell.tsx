import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { practiceBranding } from "@/data/patientFlow";

function DemoBar({ patient }: { patient: boolean }) {
  const base = "rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary";
  return (
    <div className="border-b border-border bg-foreground/[0.04]">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-5 py-1.5">
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          <span className="sm:hidden">Synthetic demo</span>
          <span className="hidden sm:inline">Demo environment — synthetic patient information only</span>
        </p>
        <nav aria-label="Demo view" className="flex items-center gap-1">
          <Link to="/" aria-current={!patient ? "page" : undefined} className={cn(base, !patient ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            Practice Workspace
          </Link>
          <Link to="/patient" aria-current={patient ? "page" : undefined} className={cn(base, patient ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            Patient Experience
          </Link>
        </nav>
      </div>
    </div>
  );
}

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/templates", label: "Templates" },
  { to: "/intakes", label: "Intakes" },
  { to: "/stats", label: "Stats" },
] as const;

function PracticeHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)] items-center gap-4 px-5 py-3 sm:gap-8">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="ClearIntake home">
          <span aria-hidden className="h-7 w-7 rounded-lg bg-primary" />
          <span className="font-display text-xl text-foreground">ClearIntake</span>
        </Link>
        <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {navItems.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground font-medium bg-muted", "aria-current": "page" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function PatientHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto max-w-2xl px-5 py-4">
        <p className="font-display text-lg text-foreground">{practiceBranding.clinic}</p>
        <p className="text-sm text-muted-foreground">{practiceBranding.intakeName}</p>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const patient = pathname.startsWith("/patient");
  return (
    <div className="min-h-screen bg-background">
      <DemoBar patient={patient} />
      {patient ? <PatientHeader /> : <PracticeHeader />}
      <main>{children}</main>
    </div>
  );
}
