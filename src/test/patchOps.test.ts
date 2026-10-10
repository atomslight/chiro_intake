import { describe, expect, it } from "vitest";
import { applyPatches } from "@/lib/surveyEngine";
import { mvaSurvey } from "@/data/mvaSurvey";

const s = mvaSurvey;
describe("extended patch ops", () => {
  it("moves, duplicates and renames", () => {
    const r = applyPatches(s, [{ op: "move_question", question: "role", direction: "up" }, { op: "duplicate_question", question: "date", newId: "date_2" }, { op: "rename_group", group: "when", value: "When & where" }], s.revision);
    expect(r.ok).toBe(true);
    if (r.ok) { const g = r.survey.modules[0]!.groups[0]!; expect(g.title).toBe("When & where"); expect(g.questions.map((q) => q.id).slice(0, 3)).toEqual(["role", "date", "date_2"]); }
  });
  it("sets and removes conditions, rejects dangling ones", () => {
    expect(applyPatches(s, [{ op: "set_group_condition", group: "attorney_details", rule: { question: "er_visit", op: "equals", value: "Yes" } }], s.revision).ok).toBe(true);
    expect(applyPatches(s, [{ op: "set_condition", question: "date", rule: { question: "attorney", op: "equals", value: "Yes" } }], s.revision).ok).toBe(false);
    expect(applyPatches(s, [{ op: "remove_question", question: "er_visit" }], s.revision).ok).toBe(false);
    expect(applyPatches(s, [{ op: "remove_group", group: "er_details" }, { op: "remove_question", question: "er_visit" }], s.revision).ok).toBe(true);
  });
  it("changes answer type and adds a section", () => {
    const r = applyPatches(s, [{ op: "set_type", question: "frequency", value: "choice", options: ["Highway", "City street"] }, { op: "add_group", module: "accident", group: { id: "vehicle", title: "Vehicle" }, question: { id: "vehicle_make", label: "Make", type: "text", required: false } }], s.revision);
    expect(r.ok).toBe(true);
  });
});
