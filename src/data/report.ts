import type { FindingKind, IntakeReport, Submission, SubmissionStatus } from "@/types/intake";

export const sampleReport: IntakeReport = {
  id: "sample",
  patient: "Jordan M. (synthetic)",
  dob: "1988-04-12",
  accidentDate: "2026-09-28",
  template: "MVA — Full PI",
  submitted: "Oct 6, 2026 · 9:42 AM",
  summary:
    "38-year-old driver, stopped at a red light, rear-ended by a moving vehicle. Seatbelt worn, airbag did not deploy, did not see the impact coming. Reports neck and low back pain (current 6/10, worst 8/10) with intermittent tingling into the right hand, plus headache since the scene. Visited an ER the same day; facility not recorded. Reports a prior neck injury (2019). Missed 3 days of work. Represented by counsel.",
  narrative: {
    source: "patient_narrative_text",
    text: "I was stopped at a red light on Main Street when someone hit me from behind. I didn't see it coming — my head snapped forward and back. I had a headache right there at the scene and my neck got really stiff that night. I went to the ER and they did an X-ray. Since then I wake up with tingling in my right hand and I can't turn my head to check my blind spot when I drive.",
  },
  facts: { bodyAreas: ["Neck", "Low back"], erVisit: true, priorSameAreaInjuries: 1 },
  findings: [
    { kind: "missing", title: "ER facility not entered", detail: "An ER visit was reported, but the facility name — expected when ER = Yes — is blank.", sectionId: "aftermath", rowId: "er_facility" },
    { kind: "inconsistency", title: "Immediate symptoms answers differ", detail: "“No immediate symptoms” was selected, while the narrative mentions a headache at the scene. Worth confirming with the patient.", sectionId: "aftermath", rowId: "symptoms_now" },
    { kind: "clarify", title: "Prior neck injury — details incomplete", detail: "A 2019 neck injury was reported, but treatment received and whether it fully resolved were not provided.", sectionId: "prior", rowId: "prior_treatment" },
  ],
  sections: [
    {
      id: "incident", module: "Incident Basics",
      rows: [
        { id: "date", label: "Date of accident", value: "Sep 28, 2026 · ~5:30 PM", source: "direct_question_answer" },
        { id: "location", label: "Location", value: "Main St & 4th Ave (example)", source: "direct_question_answer" },
        { id: "role", label: "Role", value: "Driver", source: "direct_question_answer" },
        { id: "police", label: "Police report", value: "Yes · #DEMO-0001", source: "direct_question_answer" },
        { id: "ems", label: "EMS at scene", value: "No", source: "direct_question_answer" },
      ],
    },
    {
      id: "mechanics", module: "Collision Mechanics",
      rows: [
        { id: "impact", label: "Impact type", value: "Rear-end", source: "direct_question_answer" },
        { id: "moving", label: "Vehicle", value: "Stopped", source: "direct_question_answer" },
        { id: "saw", label: "Saw impact coming", value: "No (unbraced)", source: "direct_question_answer" },
        { id: "brake", label: "Foot position", value: "On the brake", source: "direct_question_answer" },
        { id: "restraint", label: "Seatbelt / airbag", value: "Worn / not deployed", source: "direct_question_answer" },
      ],
    },
    {
      id: "aftermath", module: "Immediate Aftermath",
      rows: [
        { id: "symptoms_now", label: "Immediate symptoms", value: "No immediate symptoms", flagged: true, source: "direct_question_answer" },
        { id: "er_visit", label: "ER / urgent care", value: "Yes", source: "direct_question_answer" },
        { id: "er_facility", label: "Facility", value: "— not entered —", flagged: true, source: "direct_question_answer" },
        { id: "er_imaging", label: "Imaging", value: "X-ray", source: "direct_question_answer" },
        { id: "er_meds", label: "Medication", value: "Muscle relaxant", source: "direct_question_answer" },
      ],
    },
    {
      id: "areas", module: "Injured Body Areas & Complaints",
      rows: [
        { id: "areas", label: "Areas", value: "Neck, Low back", source: "direct_question_answer" },
        { id: "pain", label: "Pain", value: "Current 6/10 · Worst reported 8/10", source: "direct_question_answer" },
        { id: "radiates", label: "Travels / tingling", value: "Yes — right hand", source: "direct_question_answer" },
      ],
    },
    {
      id: "prior", module: "Previous Same-Area Injuries",
      rows: [
        { id: "prior_injury", label: "Prior injury", value: "Yes — neck, 2019", source: "direct_question_answer" },
        { id: "prior_treatment", label: "Treatment", value: "— not provided —", flagged: true, source: "direct_question_answer" },
        { id: "prior_resolved", label: "Resolved before accident", value: "— not provided —", flagged: true, source: "direct_question_answer" },
      ],
    },
    {
      id: "work", module: "Function, Work & Claim",
      rows: [
        { id: "harder", label: "Harder activities", value: "Sleeping, driving, lifting", source: "direct_question_answer" },
        { id: "work", label: "Work", value: "Employed · missed 3 days", source: "direct_question_answer" },
        { id: "insurance", label: "Insurance", value: "Example Mutual Insurance · claim pending", source: "direct_question_answer" },
        { id: "attorney", label: "Attorney", value: "Yes — A. Sample, Sample & Sample LLP", source: "direct_question_answer" },
      ],
    },
  ],
};

export const submissions: Submission[] = [
  { id: "sample", patient: sampleReport.patient, template: sampleReport.template, submitted: "Today, 9:42 AM", completed: true, findingKinds: sampleReport.findings.map((f) => f.kind), openable: true },
  { id: "s2", patient: "Priya K. (synthetic)", template: "MVA — Full PI", submitted: "Today, 8:15 AM", completed: true, findingKinds: [] },
  { id: "s3", patient: "Marcus T. (synthetic)", template: "Slip / Trip / Fall", submitted: "Yesterday", completed: true, findingKinds: ["missing"] },
  { id: "s5", patient: "Dana L. (synthetic)", template: "MVA — Full PI", submitted: "Oct 2", completed: true, reviewed: true, findingKinds: [] },
  { id: "s4", patient: "Elena R. (synthetic)", template: "MVA — Quick", submitted: "Started yesterday", completed: false, findingKinds: [] },
];

export function submissionStatus(s: Submission): SubmissionStatus {
  if (!s.completed) return "in-progress";
  if (s.reviewed) return "reviewed";
  if (s.findingKinds.some((k: FindingKind) => k === "clarify" || k === "inconsistency")) return "needs-clarification";
  if (s.findingKinds.length > 0) return "needs-review";
  return "submitted";
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
