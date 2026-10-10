import { test, expect } from "vitest";
import { parseLimits } from "@/lib/ai/tasks.server";
test("limits", () => {
  expect(parseLimits("minimal not exceeding 2 modules").maxSections).toBe(2);
  expect(parseLimits("minimal not exceeding phase 2").maxSections).toBe(2);
  expect(parseLimits("max three sections, under 10 questions")).toEqual({ maxSections: 3, maxQuestions: 9 });
});
