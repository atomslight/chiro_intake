# Milestones 3–6 — Persistence, real AI, patient voice, review intelligence

Built in order. Each milestone ends with a review report; setup items are explained before anything is connected. No Supabase, OpenAI, Railway, FastAPI or LangGraph.

## Milestone 3 — Versions, saving and a small server
- Template states: **Draft** (editable), **Published versions** (immutable, numbered), **Preview draft** (patient flow runs the draft without publishing).
- Buttons on the template page: Save draft, Preview, Publish (with version note). Version list with "answered with v3" counts.
- Patient sessions start from the latest published version and stay bound to it; later edits never change an existing intake.
- Submissions saved on the server with a client-generated id, so refresh/retry never duplicates. Report state (pending / ready / failed) saved alongside.
- Background saves never block Continue; patient answers keep working offline in the browser and sync on submit.
- Editing/publishing protected by a server-checked practice passcode (the Practice/Patient switch is only a demo toggle, not security).
- Browser store is replaced; existing local data is migrated once, then removed.

**Setup needed (I will stop and ask before connecting):**
1. A Cloudflare D1 database bound to the app as `DB`. I'll first check whether the hosting environment lets us attach it; if not, I'll explain the options and wait for your choice.
2. A secret `PRACTICE_ADMIN_PASSCODE` you set yourself in project secrets (never in chat).
Free-tier limits will be checked and reported; no "unlimited" promises.

## Milestone 4 — Real survey AI and practitioner dictation
- Provider-independent functions: generateSurvey, editSurvey, transcribeAudio, extractNarrative, analyzeIntake, generateSummary.
- Groq for quick edits and transcription; Gemini for creating whole intakes and nuanced review. Model names verified against current docs at build time.
- AI returns only validated survey data or the existing allowlisted change operations, tied to the draft's version; stale or invalid output is rejected and the draft stays unchanged.
- Readable before/after diff with affected rules; Apply only after approval; Cancel changes nothing. Ambiguous requests get one focused question; unsupported ones are declined honestly.
- "Create an intake" in the library uses real generation into a new draft.
- Dictation: Record → Stop/Cancel → transcript (editable) → sent as a chat request → diff → approve. Never auto-applied.
- Bounded timeouts and one retry; fallback only to a provider that supports the task. Keyword scaffolding removed.

**Setup needed:** secrets `GROQ_API_KEY` and `GEMINI_API_KEY`, added by you (I'll say where to get each).

## Milestone 5 — Patient narrative voice and confirmation
- Optional "Tell your story first" entry, or start the questions; the story is never asked twice.
- Type or Record. Recording only after a tap, with status, stop/cancel, playback, re-record and editable transcript. Size/length limits checked on the server; audio discarded after transcription.
- Suggested facts with the quoted excerpt; patient can Confirm, Edit or Dismiss. Conflicts with direct answers need an explicit choice. Editing the transcript marks affected suggestions stale.
- Confirmed facts prefill matching questions (still reviewable). Original narrative kept separately with provenance.
- Denied microphone, silence or failed transcription keep the session and typing available; no hidden browser speech fallback.

## Milestone 6 — Review intelligence and final checks
- Report order kept: metrics → summary → Needs attention → patient's own words → details, all from the saved versioned submission.
- Rule-based checks for known omissions and structured contradictions; AI adds cautious narrative inconsistencies and a summary. Every finding links to real fields/excerpts (validated, deduplicated); zero findings is allowed. No diagnoses or claim judgements.
- View answer highlights the source; contradictions show both sources. Copy summary copies the current report with qualifications.
- Submission saved before analysis; if AI fails, the report shows answers + rule findings with a clear "analysis failed / retry" state.
- Jordan's sample report stays fixed with its three findings.
- Full acceptance checklist from the brief, plus lab performance measurements (question transitions, LCP, INP) labelled as lab results, and real AI latency reported separately.

## Technical details
- Server functions (`createServerFn`) in `src/lib/*.functions.ts`; D1 access in `*.server.ts`. Tables: `surveys`, `survey_versions` (immutable JSON snapshot), `submissions` (version id, answers, narrative, provenance, idempotency key), `reports` (status, findings JSON).
- Admin passcode exchanged for a signed httpOnly cookie; admin server functions verify it.
- AI modules under `src/lib/ai/` (`groq.server.ts`, `gemini.server.ts`, `index.server.ts`) with Zod validation of every output into `SurveyPatch[]` or survey JSON.
- Audio upload via a server route with MIME/size/duration checks; recording code lazy-loaded.
- Survey loaded once per session; navigation/branching/validation stay local with zero AI calls.
- Visual design stays frozen; new controls reuse existing components.
