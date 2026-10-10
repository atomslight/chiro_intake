# Simpler intake builder: AI Generate, clear Publish, full editing

Goal: fix the lead's pain ("surveys aren't usable, correcting them takes hours, the platform is needlessly complicated"). The intake builder should feel simpler than ChiroUp: describe it, review it, publish it. Notes stay out of scope.

This reopens the frozen visual design only for the template pages. The colours and fonts stay the same.

## 1. One clear "AI Generate" box with real examples
- On both the template library page and the template page there is a single prominent box labelled **AI Generate** with a sparkle-free wand icon.
- The placeholder text and tap-to-fill example chips are written as things you can say out loud:
  - Create: "Create a car-accident intake. Ask about the accident once, then ask about symptoms for each injured body area."
  - Customize: "Make attorney details optional and only ask ER follow-up questions if the patient visited the ER."
  - Plus 2 more (add an airbag question, reword the seat question).
- A short line above it: "Type or dictate. You'll see the changes before anything is saved."
- Dictate stays next to Send.

## 2. Build a whole intake from one description (the missing M4b)
- "Create …" requests produce a complete new questionnaire draft built from the existing 14 PI modules (accident once, symptoms repeated per body area, consent kept separate).
- The result opens in the editor as a draft with a summary ("12 sections, 64 questions — review below"), never published automatically.
- Compound customize requests (several changes in one sentence) are proposed together and applied as one undoable step.
- New follow-up rules ("only ask X if Y") become supported, not declined.

## 3. Obvious Save / Publish
- A sticky top bar on the template page: status pill (Draft · Unsaved changes / Published v3), **Preview**, **Save draft**, and a big primary **Publish** button.
- Publish opens a short confirm ("Patients will get this version from now on") with an optional note.
- Version history moves into a small "Versions" menu instead of taking page space.

## 4. Full editing of every question (CRUD)
- Each question row has Edit, Duplicate, Delete and Move up/down.
- "+ Add question" at the end of every section; "+ Add section" per module; sections can be renamed or removed.
- Edit dialog covers wording, answer type, choices (add/remove/reorder), required, and "only ask if…" condition picked from dropdowns.
- Deleting something another question depends on shows a plain warning and lets you remove both or cancel.
- Every change still has Undo.

## 5. Less clutter
- Remove the four stats cards and the explanatory paragraphs; keep one line of counts.
- Modules start collapsed with a one-line summary; search box to find a question.
- Same flow on phone width.

## Technical details
- Extend `surveyPatchSchema` with allowlisted ops: `set_type`, `move_question`, `duplicate_question`, `add_group`, `rename_group`, `remove_group`, `set_condition` (full rule), `remove_condition`. All still go through `applyPatches` (atomic, base revision, dangling-rule check), so chat, AI and direct edits share one path.
- New `generateSurvey(description)` in `src/lib/ai/tasks.server.ts` (Gemini, JSON) returning a full survey validated by `surveySchema` plus engine checks (unique ids, valid rules, phases 0–4, consent block untouched); exposed as `generateIntake` server fn behind `requireAdmin`. Result is loaded into the working draft; Save/Publish unchanged.
- `editSurvey` prompt updated for the new ops and multi-change requests.
- `ChangeComposer` restyled into the AI Generate box; examples moved to `src/data/changeRequests.ts` (create + customize sets).
- `DraftBar` becomes a sticky bar with Publish confirm dialog; versions in a dropdown.
- Tests: patch ops (move/duplicate/remove group/set condition), generated-survey validation, dangling-delete warning. Playwright check of generate → edit → publish with the passcode session.
- Update `AGENTS.md` (patch op list) and `roadmap.md` (M4b in progress).
