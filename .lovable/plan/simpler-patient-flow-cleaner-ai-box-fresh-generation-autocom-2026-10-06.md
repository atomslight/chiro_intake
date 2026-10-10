# Simpler patient flow, cleaner AI box, fresh generation, autocomplete

## 1. Patient experience: shorter and clearer progress
- Show a real counter on every question: **"Question 6 of 18"** with a thin progress bar. The total counts only the questions this patient will actually see (it updates if an answer adds or removes follow-ups, but never jumps backwards).
- Cut the five phases down to **three**: About the accident, Your symptoms, Review & submit. No phase dots — just the counter and bar.
- Trim the demo questionnaire: group related short questions onto one screen and drop low-value questions, aiming for roughly 15–20 screens instead of ~28.

## 2. AI Generate box: fewer examples
- Show **two** examples only: one "Create" and one "Customize" (your two sentences, word for word).
- Remove the group headings and "tap to use" lines; examples become small chips under the box.

## 3. "Create" starts from a blank intake
- When you ask to create an intake, it no longer copies the car-accident template. The AI builds sections and questions from your description onto an empty intake.
- Consent stays its own separate block. The result opens as a draft with a summary; nothing is published automatically.
- "Customize" requests still change the intake you have open.

## 4. Autocomplete while you type (practice side)
- After about 6 words in the AI Generate box, a small wand icon gently pulses at the end of the text and a faint grey continuation appears.
- Press **Tab** or tap the icon to accept; keep typing to ignore it. It refreshes after you pause typing (about half a second) and never sends anything by itself.
- Works the same on phone (tap the icon).

## Technical details
- Patient: compute `visibleScreens(survey, answers)` from the engine for the counter; total = max(seen-so-far + remaining visible). Survey `phases` reduced to 3; group `phase` indices remapped (0–2); update AGENTS rule "fixed phase index 0–4" to "fixed phase index (3 phases)". Trim/merge groups in `src/data/mvaSurvey.ts`; publish as a new seeded version so existing submissions keep their snapshots.
- `src/data/changeRequests.ts`: one create + one customize example; `ChangeComposer` renders flat chips.
- `generateSurvey`: start from an empty survey (consent block kept) and accept only `add_group` / `add_question` / `set_condition` patches via the existing `applyPatches` path, validated by `validateSurvey`. Still no free-form survey JSON. Update the prompt and AGENTS rule ("whole-intake generation builds from an empty survey with validated patches").
- New `suggestCompletion` server fn (behind `requireAdmin`, Groq, short max tokens, 3s timeout, returns plain text ≤ 120 chars, sanitized). Client: debounce 500ms, word count ≥ 6, abort stale requests, ghost text overlay in the textarea, Tab/icon accepts; icon uses a subtle CSS pulse with `prefers-reduced-motion` respected.
- Tests: counter math with branching, generation from empty survey passes validation, examples count. Playwright check of the patient flow counter at phone width.
