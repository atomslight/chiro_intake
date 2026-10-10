/** Tap-to-fill examples for the AI Generate box. Written the way a practice would say them out loud. */
export const createExamples = [
  "Create a car-accident intake. Ask about the accident once, then ask about symptoms for each injured body area.",
];
export const customizeExamples = [
  "Make attorney details optional and only ask ER follow-up questions if the patient visited the ER.",
];
export const composerExamples = [...createExamples, ...customizeExamples];
/** A request that asks for a whole new intake rather than a change. */
export const isCreateRequest = (t: string) => /^\s*(please\s+)?(create|build|generate|make|set up|start)\b[^.]*\b(intake|survey|questionnaire|form)\b/i.test(t);
