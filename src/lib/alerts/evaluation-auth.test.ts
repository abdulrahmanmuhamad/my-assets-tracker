import { describe, expect, it } from "vitest";
import { isEvaluationRequestAuthorized } from "./evaluation-auth";

describe("alert evaluation endpoint authorization", () => {
  it("rejects missing and incorrect bearer secrets", () => {
    expect(isEvaluationRequestAuthorized(null, ["correct-secret"])).toBe(false);
    expect(isEvaluationRequestAuthorized("Bearer wrong-secret", ["correct-secret"])).toBe(false);
  });

  it("accepts either configured server-side secret", () => {
    expect(isEvaluationRequestAuthorized("Bearer alert-secret", ["alert-secret", "cron-secret"])).toBe(true);
    expect(isEvaluationRequestAuthorized("Bearer cron-secret", ["alert-secret", "cron-secret"])).toBe(true);
  });
});
