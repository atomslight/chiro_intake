# Fix intake generation, AI edits, question count and autocomplete

## What goes wrong today
1. **The AI ignores size limits.** "Minimal, no more than 2 modules" still builds 5 sections.
2. **Edits sometimes fail** with "The AI's answer didn't match the allowed edit format", and nothing changes.
3. **"Only 8 questions"**: the patient counter shows too few questions compared with what the intake really asks.
4. **Autocomplete appears by itself.** You want it to appear only when you press the wand.

## Changes

### 1. Respect size limits when creating an intake
- Read limits from the request: "2 modules/sections/parts/phases", "minimal", "short", "under N questions".
- Tell the AI the limits as hard rules, then check its answer. If it's still too big, ask it once more to merge sections. If it's still over, join the extra sections into the last allowed one so the limit is always met.
- The summary says so: "Built with 2 sections as requested."

### 2. Make edits reliable
- Find out which part of the AI's answer breaks the format (record the raw reason on the server; never show it to patients).
- Accept common harmless differences (for example a section name instead of its id, or "yes" instead of true) and convert them to the allowed form before checking.
- If the answer is still invalid, ask the AI once to fix it, giving the exact error. Only then show the message, worded more helpfully: what it could not do and an example sentence that works.

### 3. Correct question count for patients
- First reproduce it: walk through the published intake and compare "Question x of N" with the questions actually shown.
- Count every question the patient will answer on the current path (questions grouped on one screen count separately; follow-up and per-body-area questions are added when they apply), so the total matches reality and only grows when follow-ups open.

### 4. Autocomplete only on request
- No automatic suggestions while typing.
- After about 6 words a small wand appears (slight motion). Tap it, or press Tab, to generate a suggestion from what you've typed. It shows as grey text; Tab or the wand again accepts it, Esc or typing dismisses it.
- A small spinner shows while it's generating. If nothing useful comes back, the wand just goes still.

## Technical details
- `src/lib/ai/tasks.server.ts` `generateSurvey`: parse `maxGroups`/`maxQuestions` from the description; add them to the prompt; after validation, retry once with a "too many sections" correction; deterministic fallback merges extra groups' questions into the last allowed group (keeping conditions valid via the same patch path); phases limited to `min(maxGroups, 3)`.
- `editSurvey`: log the Zod issue list server-side; pre-normalize op payloads (group/question lookup by label → id, boolean/string coercion) before `surveyPatchSchema` parsing; one repair round-trip with the issues; better fallback message. All edits still go through `applyPatches`.
- Patient counter in `src/routes/patient.tsx` / `surveyEngine`: total = visible questions (expanded per area) on the current path, not screens; check it with a Playwright walk-through.
- `ChangeComposer.tsx`: remove the debounced auto-fetch; the wand click or Tab calls `suggestCompletionFn` on demand; loading, accept and dismiss states.
- Add tests for the limit parsing/merge, edit normalization and the counter.
