import type { ConsentBlock, TemplateSummary } from "@/types/intake";

export const templates: TemplateSummary[] = [
  { id: "mva", name: "Motor Vehicle Accident — Concise PI", category: "Auto accident", description: "Short, focused PI intake: the accident, symptoms per body area, care, insurance and attorney.", modules: 7, estMinutes: 4, status: "interactive" },
  { id: "mva-quick", name: "Motor Vehicle Accident — Quick", category: "Auto accident", description: "Short first-visit version for same-week appointments. Expands later as needed.", modules: 7, estMinutes: 4, status: "preview" },
  { id: "slip-fall", name: "Slip / Trip / Fall", category: "Premises", description: "Surface, lighting, footwear, fall direction, point of impact and witnesses.", modules: 10, estMinutes: 7, status: "preview" },
  { id: "road-user", name: "Road User Accident — Pedestrian / Bicycle / Motorcycle", category: "Auto accident", description: "Vulnerable road-user mechanics, protective gear, ejection and point of contact.", modules: 12, estMinutes: 8, status: "preview" },
  { id: "existing-new", name: "Existing Patient — New Accident", category: "Returning patient", description: "Reuse existing demographics and history; ask only what's changed plus details of the new incident.", modules: 8, estMinutes: 5, status: "preview" },
  { id: "general-pi", name: "General Personal Injury", category: "Other", description: "Flexible starting point for incidents that don't fit the other templates.", modules: 9, estMinutes: 6, status: "preview" },
];

export const practiceConsent: ConsentBlock = {
  title: "Practice Consent / Acknowledgments",
  note: "Practice-specific · Uses your own forms and wording",
  items: ["Consent to examination & treatment", "Financial responsibility / assignment of benefits", "Privacy notice acknowledgment"],
};
