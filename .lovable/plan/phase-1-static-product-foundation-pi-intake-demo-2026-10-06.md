# Phase 1 — Static Product Foundation (PI Intake Demo)

Clickable, polished demo using only local mock data. No AI, no database, no API, no working voice. Stop after this phase for your review.

## Journey

```text
Dashboard -> PI Template Library -> MVA — Full PI (15 modules + visible logic)
  -> Patient Experience (adaptive questionnaire) -> Submit -> Sample Intake Report
```

Top bar: logo | **Practice Workspace** / **Patient Experience** switch | subtle "Demo environment — use synthetic patient information only."

1. **Dashboard (/)** — value prop ("Describe the intake you want..."), 3 outcome cards (Build faster / Capture better / Review faster), recent synthetic submissions with status chips.
2. **Template library (/templates)** — "US General PI starting template — customize for your state, practice and workflow."
   - Motor Vehicle Accident — Full PI (Interactive demo)
   - Motor Vehicle Accident — Quick
   - Slip / Trip / Fall
   - Road User Accident — Pedestrian / Bicycle / Motorcycle
   - Existing Patient — New Accident
   - General Personal Injury
   Other cards marked "Preview". No Workers' Compensation.
3. **MVA Full PI detail (/templates/mva)** — 14 collapsible intake modules (collapsed by default) + 1 practice-specific consent block. Modules: Incident Basics, Collision Mechanics, Immediate Aftermath, Injured Body Areas, Complaint Details, Previous Same-Area Injuries / Conditions, Prior Accidents / Claims, Care Since Accident, Imaging / Diagnostic Testing, Functional Impact, Work Status, Insurance / Claim Information, Attorney Information, Patient Narrative. Each shows question count and logic badges ("Conditional · 4 follow-up questions", "Shown only if ER = Yes", "Repeats for selected body areas"). Below them, a separate **Practice Consent / Acknowledgments** block: "Practice-specific · Uses your own forms and wording". A disabled "Describe a change…" box marked "Coming soon".
4. **Patient Experience (/patient)** — one question per screen, "Question 8 of 23 relevant questions" (count updates with branching), Back/Next, three visible branches:
   - Visited ER? Yes -> Facility -> Imaging -> Medication
   - Prior injury to this body area? Yes -> When? -> Treatment? -> Fully resolved before accident?
   - Represented by attorney? Yes -> Attorney -> Firm -> Contact
   Plus an "Explain in your own words" field with a voice button marked coming soon. Ends on a submitted screen linking to the report.
5. **Sample Intake Report (/reports/sample)** — clearly labelled "Synthetic Sample Report". 30-second summary, **Patient's own words** narrative, structured information by module, and three visually distinct sections, each with its own icon/label:
   - Missing information: ER facility not entered
   - Potential inconsistency (neutral wording): "no immediate symptoms" selected, headache at scene reported later
   - Needs clarification: previous neck injury reported, treatment and resolution status missing
   Notice: "Human review required — AI does not diagnose, recommend treatment or determine causation."

## Success criteria
Someone understands the product and its value with no AI running: complicated PI intake -> simple patient experience -> review clearly surfaces what needs attention.

## Visual direction
Clean, calm, obvious, fast: warm off-white, deep teal primary, amber for attention items, serif headings with clean sans body, generous spacing.

## Mock vs real after Phase 1
Everything is mock; branching is hard-coded. Phase 2 makes the schema and rule engine real; Phase 12 makes report analysis real.

## Technical details
- Keep the existing TanStack Start setup; routes `index`, `templates`, `templates.mva`, `patient`, `reports.sample`, each with own head() metadata.
- Typed mock data in `src/data/`, types in `src/types/`; consent stored as a separate configurable block, not a fixed module.
- Components: AppShell, WorkspaceSwitch, TemplateCard, ModuleAccordion, LogicBadge, PatientQuestion, report sections.
- Theme tokens in `src/styles.css`; fonts via `<link>` in root.

## Later phases (no action now)
Cloudflare D1 isn't built into this environment; at Phase 5 I'll explain options and wait. Groq/Gemini keys requested only at Phases 7–8, kept server-side.
