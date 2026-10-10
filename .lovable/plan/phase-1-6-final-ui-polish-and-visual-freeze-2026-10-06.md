# Phase 1.6 — Final UI polish and visual freeze

## Goal
Make ClearIntake easier to read and use on desktop and mobile, bring the template-editing experience into immediate view, and make report review faster. Keep all routes, synthetic identities, clinical meaning, and underlying intake structure unchanged. Freeze visual design again after this pass.

## Changes

### 1. Readability and shared layout
- Strengthen primary and secondary text contrast to WCAG AA targets while preserving the warm off-white, deep teal, and amber palette.
- Standardize typography: larger patient text and inputs, readable practice text, serif limited to page titles and patient question headings, and upright patient quotes.
- Use one aligned practice-page container system; retain narrower reading widths for the patient flow and report.
- Keep visible focus rings, 44px minimum targets, comfortable line height, and prevent horizontal overflow.

### 2. Patient experience
- Replace the changing thin progress bar with five stable phases, each showing its name, phase dots, and “Step x of y.” Branches will not change the five-phase denominator.
- Move question content into the upper portion of the screen, enlarge full-width choice controls and text fields, and preserve the mobile safe-area navigation bar.
- Replace the native date control with Today, Yesterday, and Pick a date choices plus an MM/DD/YYYY entry path and calendar.
- Add “I’m not sure” only to suitable non-critical questions. It will display as “Patient not sure” and will not be classified as missing.
- Preserve the current deterministic browser-only branching and validation behavior.

### 3. Template detail page
- Move “Describe a change” directly below the title and restyle it as an active prototype rather than a disabled coming-soon area.
- Make its three examples apply clearly disclosed, scripted local edits; highlight affected rows and provide a “Changed 1 setting · Undo” result.
- Reduce the summary to four useful metrics, with total possible fields shown as secondary context.
- Remove “Asked once” badges. Keep only exception badges, compact branch counts, and field totals.
- Make expanded fields easier to scan with type icons, consistent Required/Optional labels, and readable indented conditions.

### 4. Report
- Keep the existing report order.
- Consolidate findings into one compact “Needs attention” list with restrained type chips, one-line title/detail, a static suggested question, and “View answer.”
- Keep the existing answer-opening, scrolling, and temporary highlighting behavior.
- Add a working “Copy summary” action with clear success feedback.
- Do not add “Confirmed with patient” state in this phase.
- Defer Print / Save as PDF; it is optional and not necessary for the agreed core polish.
- Increase summary readability and present the patient narrative upright.

### 5. Consistency and verification
- Standardize status chips across dashboard, intakes, and report.
- Preserve the existing routes, synthetic data, clinical wording, and practice/patient navigation.
- Ensure every content page retains complete, unique preview metadata.
- Test at desktop, tablet, and approximately 390px mobile widths with no horizontal scrolling.
- Walk the full path: Dashboard → Template → Patient flow → Report → View answer, including scripted edit/Undo, date entry, unsure answers, validation, keyboard focus, and Copy summary.

## Technical boundaries
- Frontend-only; no database, AI calls, network calls, authentication, or persistence.
- Scripted template edits and report copy feedback live only for the current browser session.
- No new review workflow state or changes to the report’s clinical meaning.
- Existing deterministic rule evaluation remains authoritative.

## Completion report
At the end of this phase, report:
1. What was implemented.
2. What was tested and at which widths.
3. What remains synthetic or browser-only.
4. The next Phase 2 step.

Then stop and wait for confirmation before Phase 2.
