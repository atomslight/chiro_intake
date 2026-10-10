<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Survey navigation, branching, progress and validation run locally in the browser; never call AI for them. Why: speed and determinism are core product claims.
- Typed mock/seed data lives in `src/data/`, shared types in `src/types/`. Why: later phases swap data sources without touching UI.
- Practice consent is a separate configurable block, not an intake module. Why: consent wording varies by practice/state.
- AI keys (when added) stay server-side only. Why: never expose provider keys to the browser.
- The survey schema (src/types/survey.ts, Zod) is the single source for patient screens, validation, progress, template view, edits and reports; the engine lives in src/lib/surveyEngine.ts. Why: no competing hard-coded flows.
- All template edits (AI, chat and direct CRUD: label, type, options, required, conditions, add/move/duplicate/remove questions and sections) go through allowlisted SurveyPatch ops applied atomically with a base revision and validated for dangling rules. Why: same path for chat, AI and direct edits; invalid edits change nothing.
- Whole-intake generation builds a fresh intake from AI sections whose every question is validated by newQuestionSchema; only the body-area picker and narrative are reused from the library, and follow-up rules go through set_condition patches. Why: "create" must start blank yet stay structurally valid.
- Each submission stores a snapshot of the survey it was answered with. Why: later edits must not alter existing intakes.
- Groups carry a fixed phase index (surveys have 1–5 phases; the demo uses 3). The patient counter is "Question x of visible total". Why: branching must not reshuffle parts and patients see a real total.
- Persistence is Lovable Cloud tables (survey_drafts, immutable survey_versions, submissions) reached only from server functions in src/lib/surveys.functions.ts with the service-role client; tables have RLS on and no client policies. Why: the browser never touches the database directly.
- Practice-only actions call requireAdmin() (signed httpOnly cookie from a server-checked passcode, src/lib/admin.server.ts). Why: the demo view switch is not security.
- Patients get the latest published version; submissions store the server-loaded version snapshot and a client UUID, inserted idempotently. Why: retries never duplicate and edits never alter past intakes.
- src/lib/surveyStore.ts holds only the practice's unsaved working draft and Undo history. Why: Save draft/Publish are explicit server writes guarded by a revision check.

- AI calls live in src/lib/ai/ (providers.server.ts adapters for Groq/Gemini with one bounded retry and cross-provider fallback; tasks.server.ts validates every AI output against the survey). Why: AI output is untrusted; only validated patches, quoted facts and row-linked findings reach the UI.
- Audio goes to /api/transcribe and is never stored; transcripts are always editable and never auto-applied. Why: patient privacy and no hidden actions.
- Practice actions are logged best-effort to admin_events via logEvent() in surveys.server.ts and shown on /stats (requireAdmin). Why: one audit trail without blocking the action.
- Every publish upserts a reusable copy into saved_templates (keyed by intake name); "Use this intake" loads it as a reviewable proposal, never applied directly. Why: reuse goes through the same review/undo path.
- QueryClient uses a 30s staleTime; every write must invalidate the queries it affects. Why: fast page switches without stale data after edits.
