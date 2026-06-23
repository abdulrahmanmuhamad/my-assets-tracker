import { describe, expect, it } from "vitest";
import { selectEmailProvider } from "./email-provider";

describe("email provider selection", () => {
  it("uses the console provider when Resend is not configured", () => {
    expect(selectEmailProvider({}).name).toBe("console_dev");
  });

  it("uses Resend when an API key is configured", () => {
    expect(selectEmailProvider({ RESEND_API_KEY: "test-key", ALERT_FROM_EMAIL: "alerts@example.com" }).name).toBe("resend");
  });
});
