// ---------- Rules (data, not display text) ----------
export interface Rule {
  field: string;
  op: "eq" | "includes";
  value: string;
}

export type Requirement = "required" | "optional" | "conditional";

// ---------- Template (practice view) ----------
export type TemplateStatus = "interactive" | "preview";

export interface TemplateSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  modules: number;
  estMinutes: number;
  status: TemplateStatus;
}

export interface ModuleField {
  id: string;
  label: string;
  requirement: Requirement;
  showIf?: Rule | undefined;
}

export interface IntakeModule {
  id: string;
  title: string;
  summary: string;
  scope: "once" | "per-area";
  fields: ModuleField[];
}

export interface ConsentBlock {
  title: string;
  note: string;
  items: string[];
}

// ---------- Patient flow ----------
export type FieldType = "single" | "multi" | "text" | "date" | "longtext" | "scale" | "bodyAreas";

export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

export interface StepField {
  id: string;
  label: string;
  type: FieldType;
  requirement: Requirement;
  options?: string[];
  placeholder?: string;
  /** Multi-choice options that cannot coexist with any other selection (e.g. "None"). */
  exclusiveOptions?: string[];
  /** Text fields: escape choices stored as "not_applicable" / "unsure" instead of forcing invented text. */
  escapeOptions?: { label: string; value: "not_applicable" | "unsure" }[];
}

/** Answer states are distinct: optional blank and unsure are never "missing". */
export type AnswerState = "blank" | "answered" | "unsure" | "not_applicable";

export interface PatientStep {
  id: string;
  module: string;
  phase: "About the accident" | "Your injuries" | "Medical history" | "Care and work" | "Claim and your story";
  title: string;
  help?: string;
  /** Whole step shown/hidden by one rule. */
  showIf?: Rule;
  fields: StepField[];
  highlight?: boolean;
}

// ---------- Answer provenance ----------
export type AnswerSource =
  | "direct_question_answer"
  | "patient_narrative_text"
  | "patient_voice_transcript"
  | "ai_extracted_fact"
  | "patient_confirmed_extracted_fact";

// ---------- Submissions & report ----------
export type SubmissionStatus = "in-progress" | "submitted" | "needs-review" | "needs-clarification" | "reviewed";

export type FindingKind = "missing" | "inconsistency" | "clarify";

export interface Submission {
  id: string;
  patient: string;
  template: string;
  submitted: string;
  completed: boolean;
  reviewed?: boolean;
  findingKinds: FindingKind[];
  openable?: boolean;
}

export interface Finding {
  kind: FindingKind;
  title: string;
  detail: string;
  sectionId: string;
  rowId: string;
}

export interface ReportRow {
  id: string;
  label: string;
  value: string;
  flagged?: boolean;
  source: AnswerSource;
}

export interface ReportSection {
  id: string;
  module: string;
  rows: ReportRow[];
}

export interface IntakeReport {
  id: string;
  patient: string;
  dob: string;
  accidentDate: string;
  template: string;
  submitted: string;
  summary: string;
  narrative: { text: string; source: AnswerSource };
  facts: { bodyAreas: string[]; erVisit: boolean; priorSameAreaInjuries: number };
  findings: Finding[];
  sections: ReportSection[];
}
