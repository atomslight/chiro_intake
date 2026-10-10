# Phase 1.5 — UX / Product Cleanup Pass

One focused polish pass on the existing demo. Still no AI, database, voice or backend. After this, the visual design is frozen and we move to Phase 2.

## Dashboard and navigation
- Fix statuses: anything with open items shows "Needs review" / "Needs clarification"; "Ready for review" only when there are 0 items. Singular/plural grammar ("1 item to review").
- Nav becomes **Dashboard | Templates | Intakes**. New Intakes page lists the synthetic submissions; Jordan's row opens the sample report. Other rows are clearly marked as non-openable examples.
- Copy: "before the visit" instead of "before the patient walks in".
- Product name standardized to **ClearIntake** everywhere.
- Add an empty-state message for the intakes list (for when it's ever empty).

## Demo controls and synthetic notice
- The Practice Workspace / Patient Experience switch moves into a slim **demo bar** across the very top, visually separate from the product. The same bar carries the single "Demo environment — synthetic patient information only" notice; the repeated footer notice goes away.
- Remove all development wording from the screens ("later phase", "mock", etc.); use "Coming soon" only.
- All organizations and numbers made obviously fictional (e.g. "Example Mutual Insurance", "Sample & Sample LLP", report "#DEMO-0001").

## Template library
- Category (small caps, left) and status badge (right) clearly separated.
- Time copy: "Typical path · ~9 min".
- Preview cards are not clickable; they show a disabled "Preview only" button. MVA card has "Open template".
- Existing Patient — New Accident description: "Reuse existing demographics and history; ask only what's changed plus details of the new incident."

## MVA — Full PI template page
- Summary header above the modules: 14 modules · ~65 possible questions · ~20–25 shown on a typical path · ~9 min estimated patient time · number of conditional branches · 1 practice-specific section. Counts derived from the seeded data so they stay consistent.
- Each module gets a scope tag: "Asked once" or "Repeats for each selected body area".
- Inside expanded modules, conditional follow-ups show "Shown because ER visit = Yes" (practice view only).
- AI teaser: the disabled box plus three disabled example commands:
  "Only ask ER details if the patient went to the ER" · "Make attorney information optional" · "Ask prior injury history once for each affected body area".

## Patient Experience
- The demo bar sits outside the questionnaire. The page reads **"Your Practice · Personal Injury Intake"**, with "Powered by ClearIntake" kept small.
- Progress: "Incident Basics · Step 3" plus progress bar and "Questions adapt to your answers — you'll only see what applies." No changing denominator.
- One decision or one small group per screen: ER follow-ups (facility, imaging, medication) on one card; attorney name, firm and contact on one card; prior-injury when / treatment / resolved on one card.
- New **body-area selector**: Head, Neck, Upper back, Low back, Shoulder, Arm, Wrist/Hand, Hip, Knee, Leg, Ankle/Foot, with Left / Right / Both for limbs.
- Pain asked as numbers (current pain 0–10, worst pain 0–10), no "Severe" labels.
- Back hidden on the first screen. Required questions block Continue with an inline message; optional questions say "Optional". No pop-up messages for validation.
- Narrative step gets a highlighted, more prominent card ("Tell us what happened, in your own words"), with the voice button marked Coming soon.
- Mobile: sticky Back / Continue bar, large tap targets, no horizontal scrolling at 360–430 px.

## Sample Intake Report
- New order: header metric strip ("3 items to review · 2 affected areas · ER visit · 1 prior same-area injury") -> 30-second summary -> **Needs attention (3)** -> Patient's own words -> Intake details.
- Rename "Structured information extracted from intake" to **"Intake details"**.
- Intake details sections become collapsible, collapsed by default.
- Each attention item gets "View answer ->", which opens and scrolls to its section.
- The three categories keep distinct icons and neutral amber styling (no red).
- The summary is styled as a review card; the patient's words are styled as a quote/transcript, clearly separate.
- Pain shown as "Current pain: 6/10 · Worst reported pain: 8/10".
- Jordan's intentionally messy facts (missing ER facility, contradiction, incomplete prior injury) are kept.

## Accessibility and speed basics
- Visible keyboard focus, labelled inputs, ~44px touch targets, selected options shown with a check mark (not only color), polite screen-reader announcement when follow-up questions appear.
- Fonts already load with swap; keep that. Animations stay short (fades/slides under 200ms).

## Not doing now
- Narrative-first flow with AI extraction (#31): the data model will allow a narrative step anywhere, but the flow stays as is.
- Saving progress on the device.

## Technical details
- New route `src/routes/intakes.tsx`; `Reports` nav item removed.
- `src/components/intake/DemoBar.tsx` replaces the in-header switch; AppShell renders a lighter patient header on `/patient`.
- `PatientQuestion` gains a `group` type with `fields[]`, a `required` flag and a `bodyAreas` type; progress uses module name + step index.
- Template counts computed from `mvaModules`; modules get `scope: "once" | "per-area"`; follow-ups carry a `reason` string.
- Report sections get stable ids; findings reference a section id for "View answer" (controlled accordion + scrollIntoView).
- Submission status derived from flag count in the data helpers.

## Final corrections (folded in)
- All displayed counts derived from the seeded data (template stats, branch count, "3 items to review", "2 affected areas", etc.).
- Two separate concepts: template stats count individual answerable **fields** ("~65 possible fields · ~20–25 fields on a typical path"); patient progress counts **screens** ("Incident Basics · Step 3").
- Left / Right / Both only for shoulder, arm, wrist/hand, hip, knee, leg, ankle/foot; never for head, neck or back.
- Patient page branded **"Example Chiropractic Center · Personal Injury Intake"** with "Powered by ClearIntake" below.
- Logic stored as rule data (e.g. field `er_visit` equals `Yes`); the "Shown because ER visit = Yes" text is generated from it, not stored as the rule.
- "View answer ->" opens the right section, scrolls to it and briefly highlights the exact field (about 1.5s).
- Grouped screens are conditional as a whole (e.g. Emergency Care Details: facility, imaging, medication share one rule).
- Fields marked required / optional / conditionally expected; a blank optional field is never shown as Missing information.
- Each answer carries a source type: direct answer, patient narrative text, voice transcript, AI-extracted fact, patient-confirmed extracted fact (only the first two used now).
- Status vocabulary defined: In progress, Submitted, Needs review, Needs clarification, Reviewed. "Ready for review" is dropped.
- Mobile: sticky Back / Continue with bottom padding equal to bar height plus safe-area inset so it never covers content.
- On Continue, focus moves to the new question heading; the current step is marked for screen readers.

After this pass, the visual design is frozen and Phase 2 is engineering only.
