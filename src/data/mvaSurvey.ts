import type { Question, Survey, SurveyRule } from "@/types/survey";

export const PHASES = ["About the accident", "Your symptoms", "Care and claim"];

const q = (id: string, label: string, type: Question["type"], extra: Partial<Question> = {}): Question => ({ id, label, type, required: true, ...extra });
const opt = (id: string, label: string, type: Question["type"], extra: Partial<Question> = {}): Question => q(id, label, type, { required: false, ...extra });
const eq = (question: string, value: string): SurveyRule => ({ question, op: "equals", value });
const scale = Array.from({ length: 11 }, (_, i) => String(i));

export const mvaSurvey: Survey = {
  id: "mva",
  name: "Motor Vehicle Accident — Concise PI",
  revision: 1,
  phases: PHASES,
  modules: [
    {
      id: "accident", title: "The Accident", summary: "When, your role, the impact and the police report.", scope: "once",
      groups: [
        { id: "when", title: "About the accident", phase: 0, questions: [
          q("date", "Date of accident", "date"),
          q("role", "Your role", "choice", { options: ["Driver", "Passenger", "Pedestrian", "Cyclist"], allowOther: true }),
          q("seat", "Where were you sitting?", "choice", { options: ["Front passenger", "Rear left", "Rear middle", "Rear right"], showIf: eq("role", "Passenger") }),
          q("police_report", "Was a police report made?", "yes_no", { allowUnsure: true }),
        ] },
        { id: "impact", title: "At the moment of impact", phase: 0, showIf: { question: "role", op: "one_of", value: ["Driver", "Passenger"] }, questions: [
          q("impact", "How was your vehicle hit?", "choice", { options: ["Rear-end", "Front", "Side", "Rollover"], allowOther: true }),
          q("seatbelt", "Seatbelt worn?", "yes_no", { allowUnsure: true }),
          opt("airbag", "Did an airbag deploy?", "yes_no", { allowUnsure: true }),
        ] },
      ],
    },
    {
      id: "aftermath", title: "Right After", summary: "Symptoms at the scene and any ER visit.", scope: "once",
      groups: [
        { id: "symptoms", title: "Right after the accident", phase: 0, questions: [
          q("symptoms_now", "Symptoms you noticed right away", "multi", { options: ["Pain", "Headache", "Dizziness", "Nausea", "No immediate symptoms"], exclusiveOptions: ["No immediate symptoms"], allowOther: true }),
          q("loc", "Did you lose consciousness?", "yes_no", { allowUnsure: true }),
          q("er_visit", "Did you go to an ER or urgent care?", "yes_no"),
        ] },
        { id: "er_details", title: "Emergency care", phase: 0, showIf: eq("er_visit", "Yes"), questions: [
          opt("er_facility", "Facility name", "text", { placeholder: "e.g. Example General ER" }),
          q("er_imaging", "Imaging done there", "multi", { options: ["X-ray", "CT scan", "MRI", "None"], exclusiveOptions: ["None"], allowUnsure: true }),
        ] },
      ],
    },
    {
      id: "body_areas", title: "Injured Body Areas", summary: "Select every area that hurts — side asked only for limbs.", scope: "once",
      groups: [{ id: "areas", title: "Where do you hurt since the accident?", help: "Tap every area. For arms and legs, choose the side.", phase: 1, questions: [q("areas", "Injured areas", "body_areas")] }],
    },
    {
      id: "complaints", title: "Symptoms per Area", summary: "Pain, frequency, radiation and earlier problems — for each area.", scope: "per_area",
      groups: [
        { id: "pain", title: "How is this area?", phase: 1, questions: [
          q("pain_now", "Current pain (0 = none, 10 = worst imaginable)", "scale", { options: scale }),
          q("frequency", "How often?", "choice", { options: ["Constant", "Frequent", "Occasional"] }),
          q("radiates", "Does the pain travel, or do you feel numbness or tingling?", "yes_no", { allowUnsure: true }),
          q("prior_injury", "Any injury or problem in this area before the accident?", "yes_no", { allowUnsure: true }),
        ] },
      ],
    },
    {
      id: "care", title: "Care and Daily Life", summary: "Other providers, harder activities and missed work.", scope: "once",
      groups: [{ id: "care", title: "Since the accident", phase: 2, questions: [
        q("other_provider", "Have you seen another provider since the accident?", "yes_no"),
        q("harder", "Which everyday activities are harder now?", "multi", { options: ["Sleeping", "Driving", "Sitting", "Lifting", "Work tasks", "None"], exclusiveOptions: ["None"], allowOther: true }),
        q("missed_work", "Have you missed work because of the accident?", "choice", { options: ["Yes", "No", "Not employed"] }),
      ] }],
    },
    {
      id: "insurance", title: "Insurance and Attorney", summary: "Carrier, claim number and representation.", scope: "once",
      groups: [
        { id: "insurance", title: "Insurance and attorney", phase: 2, questions: [
          q("carrier", "Your auto insurance carrier", "text", { placeholder: "e.g. Example Mutual", allowUnsure: true, notApplicableLabel: "I don't have auto insurance" }),
          opt("claim_no", "Claim number, if you have it", "text", { reviewExpected: true }),
          q("attorney", "Are you represented by an attorney for this accident?", "yes_no"),
        ] },
        { id: "attorney_details", title: "Attorney details", phase: 2, showIf: eq("attorney", "Yes"), questions: [
          opt("attorney_name", "Attorney's name", "text"),
          opt("attorney_firm", "Law firm", "text"),
        ] },
      ],
    },
    {
      id: "narrative", title: "Patient Narrative", summary: "The patient explains what happened in their own words.", scope: "once",
      groups: [{ id: "narrative", title: "Anything else we should know?", phase: 2, highlight: true,
        help: "Optional — add anything the questions didn't cover.",
        questions: [opt("narrative", "Your story", "longtext", { placeholder: "I was stopped at a red light when…" })] }],
    },
  ],
};
