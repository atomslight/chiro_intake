import { describe, expect, it } from "vitest";
import { mvaSurvey } from "@/data/mvaSurvey";
import { activeAnswers, applyPatches, buildReport, evaluateRule, validateSurvey, validateValue, visibleScreens, findQuestion } from "@/lib/surveyEngine";

describe("survey engine", () => {
  it("seed survey is valid", () => expect(validateSurvey(mvaSurvey)).toEqual([]));

  it("unsure never acts like Yes", () => {
    expect(evaluateRule({ question: "er_visit", op: "equals", value: "Yes" }, { er_visit: "unsure" })).toBe(false);
  });

  it("per-area modules repeat per selected area with separate answers", () => {
    const a = { areas: ["Neck", "Knee|Left"] };
    const keys = visibleScreens(mvaSurvey, a).map((s) => s.key);
    expect(keys).toContain("pain@Neck");
    expect(keys).toContain("pain@Knee");
  });

  it("removed areas and hidden branches don't leak", () => {
    const answers = { areas: ["Neck"], "pain_now@Knee": "7", er_visit: "No", er_facility: "Old ER" };
    const act = activeAnswers(mvaSurvey, answers);
    expect(act["pain_now@Knee"]).toBeUndefined();
    expect(act["er_facility"]).toBeUndefined();
  });

  it("rejects future and invalid dates", () => {
    const q = findQuestion(mvaSurvey, "date")!;
    expect(validateValue(q, "02/30/2024")).toMatch(/exist/);
    expect(validateValue(q, "01/01/2999")).toMatch(/future/);
    expect(validateValue(q, "01/15/2024")).toBeNull();
  });

  it("patches apply atomically, reject stale and dangling", () => {
    const ok = applyPatches(mvaSurvey, [{ op: "set_required", question: "attorney_name", value: false }], mvaSurvey.revision);
    expect(ok.ok && findQuestion(ok.survey, "attorney_name")!.required).toBe(false);
    expect(applyPatches(mvaSurvey, [{ op: "set_required", question: "attorney_name", value: false }], 0).ok).toBe(false);
    const dangling = applyPatches(mvaSurvey, [{ op: "set_options", question: "role", value: ["Driver", "Pedestrian"] }], mvaSurvey.revision);
    expect(dangling.ok).toBe(false); // seat's condition refers to "Passenger"
  });

  it("report reflects only this submission; optional blank is not missing", () => {
    const answers = { role: "Pedestrian", er_visit: "No", attorney: "No", areas: ["Neck"], narrative: "I was crossing the street.", carrier: "not_applicable" };
    const r = buildReport({ id: "x", survey: mvaSurvey, submittedAt: "", answers });
    expect(r.narrative).toBe("I was crossing the street.");
    expect(r.summary).toContain("Pedestrian");
    expect(r.summary).not.toContain("Jordan");
    expect(r.findings.filter((f) => f.kind === "missing").map((f) => f.rowKey)).toEqual(["claim_no"]);
  });
});
