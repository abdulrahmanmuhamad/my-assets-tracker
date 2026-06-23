import { describe, expect, it } from "vitest";
import {
  accessErrorFor,
  canUseDevelopmentAuthBypass,
  initialAccessForIdentity,
  parseOwnerEmails,
} from "./auth-policy";

describe("user access policy", () => {
  it("bootstraps only configured verified owner emails", () => {
    expect(initialAccessForIdentity({ email: "OWNER@example.com", emailVerified: true, ownerEmails: "owner@example.com" })).toEqual({ role: "owner", accessStatus: "approved" });
    expect(initialAccessForIdentity({ email: "other@example.com", emailVerified: true, ownerEmails: "owner@example.com" })).toEqual({ role: "user", accessStatus: "pending_owner_approval" });
    expect(initialAccessForIdentity({ email: "owner@example.com", emailVerified: false, ownerEmails: "owner@example.com" })).toEqual({ role: "user", accessStatus: "pending_email_verification" });
    expect(initialAccessForIdentity({ email: "owner@example.com", emailVerified: true, ownerEmails: "" })).toEqual({ role: "user", accessStatus: "pending_owner_approval" });
  });

  it("accepts plain and documented markdown owner email lists", () => {
    expect([...parseOwnerEmails("Owner@Example.com, [second@example.com](mailto:second@example.com)")]).toEqual(["owner@example.com", "second@example.com"]);
  });

  it("returns stable API denial codes for every non-approved state", () => {
    expect(accessErrorFor("pending_email_verification", false)).toBe("EMAIL_NOT_VERIFIED");
    expect(accessErrorFor("pending_owner_approval", true)).toBe("PENDING_OWNER_APPROVAL");
    expect(accessErrorFor("rejected", true)).toBe("ACCOUNT_DISABLED");
    expect(accessErrorFor("suspended", true)).toBe("ACCOUNT_DISABLED");
    expect(accessErrorFor("approved", true)).toBeNull();
  });

  it("never permits the development bypass in production", () => {
    expect(canUseDevelopmentAuthBypass({ clerkConfigured: false, nodeEnv: "production", allowDevAuthBypass: "true" })).toBe(false);
    expect(canUseDevelopmentAuthBypass({ clerkConfigured: true, nodeEnv: "development", allowDevAuthBypass: "true" })).toBe(false);
  });
});
