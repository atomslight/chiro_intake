import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminSignIn, getAdminStatus } from "@/lib/surveys.functions";

export const adminStatusKey = ["admin-status"] as const;

/** Server-checked practice sign-in. The Practice/Patient switch in the demo bar is not security. */
export function PracticeGate({ children, what }: { children: ReactNode; what: string }) {
  const status = useServerFn(getAdminStatus);
  const signIn = useServerFn(adminSignIn);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: adminStatusKey, queryFn: () => status() });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isLoading || !data) return <div className="mx-auto max-w-6xl px-5 py-12 text-muted-foreground">Loading…</div>;
  if (data.signedIn) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const res = await signIn({ data: { passcode: code } });
      if (!res.ok) { setError(res.error); return; }
      setCode(""); await qc.invalidateQueries();
    } catch { setError("Couldn't reach the server. Please try again."); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <Lock className="h-8 w-8 text-primary" aria-hidden />
      <h1 className="mt-4 text-3xl text-foreground">Practice sign-in</h1>
      <p className="mt-2 text-muted-foreground">Enter the practice passcode to {what}.</p>
      {!data.configured && <p role="alert" className="mt-4 rounded-md border border-attention bg-attention-soft px-3 py-2 text-sm text-foreground">The practice passcode hasn't been set up yet, so sign-in is unavailable.</p>}
      <form onSubmit={submit} className="mt-6 space-y-3">
        <label htmlFor="passcode" className="text-sm font-medium text-foreground">Passcode</label>
        <input id="passcode" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)}
          className="block min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground" aria-invalid={Boolean(error)} aria-describedby={error ? "passcode-error" : undefined} />
        {error && <p id="passcode-error" role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={busy || !code || !data.configured} className="min-h-11 w-full">{busy ? "Checking…" : "Sign in"}</Button>
      </form>
    </div>
  );
}
