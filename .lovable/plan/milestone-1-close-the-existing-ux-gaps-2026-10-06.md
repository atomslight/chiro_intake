# Milestone 1 — Close the existing UX gaps

Scope is Milestone 1 only from the final project prompt. Milestones 2–6 (survey engine, D1 persistence, Groq/Gemini AI, voice, review intelligence) are not started. Visual style stays frozen; only the elements below change.

## Audit — already working (keep as-is)
- Five stable phases with phase name and dots; branching never changes the phase count.
- Large choice targets (44px+), keyboard focus moves to each new question, validation messages, sticky mobile Back/Continue.
- Custom date control (Today / Yesterday / Pick a date / MM/DD/YYYY).
- "I'm not sure" on suitable non-critical questions.
- Sample report with metrics → summary → Needs attention → patient's own words → details, View answer, Copy summary.
- Undo bar on the template page; consent kept as a separate block.

## Audit — gaps to fix
1. Template page uses example buttons only — no free-text composer, no proposed-change preview, no Apply/Cancel.
2. Examples apply immediately instead of filling a composer; the ER example reports a soft success message rather than "Already configured."
3. No "Create an intake" entry in the template library.
4. No practitioner dictation entry point; patient "Speak instead · Coming soon" exists but wording is inconsistent.
5. Exclusive choices can coexist: "No immediate symptoms" with "Pain", "None" with "X-ray", "None" with "Sleeping".
6. Progress shows "Step 2 of 5" counting hidden steps, so numbers skip.
7. Insurance carrier is required with no way out — a pedestrian or uninsured patient must invent an answer.
8. Completion screen says "your intake is submitted… care team will review it" although nothing is sent.

## Changes

### Template page — "Describe your intake or a change"
- Multiline composer directly under the title, with Send button and a small conversation area above it (request bubble → system reply).
- Example chips fill the composer; they never apply anything on their own.
- A local, clearly labelled matcher recognises only the three supported requests:
  - ER details rule → reply "Already configured" (shows the existing rule), no change offered.
  - Make attorney information optional → proposed-change card.
  - Ask prior-injury history per body area → "Already configured" (that module already repeats per area).
- Proposed-change card shows a readable before/after line per field (e.g. "Attorney name: Required → Optional") with Apply and Cancel. Apply updates the module view and shows "Changed N settings · Undo"; Cancel changes nothing.
- Anything else gets an honest reply: "This demo can't make that change yet — real AI editing arrives in a later milestone." No fake success.
- Label on the composer: "Prototype — local matching only, no AI connected yet."
- Microphone button beside Send, disabled, labelled "Dictation · Not connected yet."
- Applied edits stay on this page for now; they start affecting the patient flow in Milestone 2 (stated in the label).

### Template library
- "Create an intake" card/button opening a short panel with the same composer style, replying honestly that creating from a description is not connected yet and offering "Start from MVA — Full PI".

### Patient flow
- Exclusive options: selecting "No immediate symptoms" / "None" clears other selections, and selecting any other option clears the exclusive one (symptoms, ER imaging, harder activities).
- Progress header: "About the accident · Phase 1 of 5" plus "Question 3", numbered consecutively across only the screens the patient actually sees (no skipped numbers, no fake total).
- Administrative escape options: insurance carrier gains "I don't have auto insurance" and "Not sure" choices alongside the text box; claim number stays optional. Not-applicable answers are stored distinctly from unsure and from blank.
- Recording entry point on the narrative step: "Record instead · Not connected yet" (disabled), typing stays primary.
- Completion screen: "Demo preview complete", note that answers were not saved or sent, buttons "Open example report" and "Start over". Example report keeps its "Synthetic example" labelling and is never presented as this patient's submission.

### Verification
- Playwright at 1440, 768, 390px: composer examples fill, Apply/Cancel/Undo, "Already configured", unsupported reply, exclusive choices, consecutive question numbers on driver and pedestrian paths, insurance escape, completion wording, no horizontal scroll, focus and 44px targets.
- Then report changes, tests actually run, limitations, and stop for review before Milestone 2.

## Technical details
- Files: `src/routes/templates.mva.tsx` (composer, matcher, diff card), new `src/components/intake/ChangeComposer.tsx`, new `src/data/changeRequests.ts` (typed supported intents + proposed field diffs), `src/routes/templates.index.tsx`, `src/routes/patient.tsx`, `src/data/patientFlow.ts` (add `exclusiveOptions` and `naOptions` on fields), `src/types/intake.ts` (field option metadata; answer states blank/answered/unsure/not_applicable).
- No network calls, no AI, no new packages; everything browser-only.
- Update `roadmap.md` with the six milestones; record in `AGENTS.md` that composer intent matching is temporary scaffolding replaced in Milestone 4.
- Update project memory: Groq + Gemini only (no OpenAI), Cloudflare/D1 for persistence (no Supabase), SOAP notes out of scope.
