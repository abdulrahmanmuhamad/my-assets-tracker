import { describe, expect, it } from "vitest";
import { adminUserSelect, assertAccessActionAllowed } from "./admin-access";

describe("admin access policy", () => {
  const owner = { id: "owner-1", role: "owner" };
  const admin = { id: "admin-1", role: "admin" };

  it("prevents self approval and other self access changes", () => {
    expect(() => assertAccessActionAllowed({ actor: owner, target: { id: owner.id, role: "owner", accessStatus: "approved", emailVerified: true }, action: "approve", ownerCount: 1 })).toThrow(/own access/i);
  });

  it("prevents disabling or demoting the last owner", () => {
    const target = { id: "owner-2", role: "owner", accessStatus: "approved", emailVerified: true };
    expect(() => assertAccessActionAllowed({ actor: owner, target, action: "suspend", ownerCount: 1 })).toThrow(/last owner/i);
    expect(() => assertAccessActionAllowed({ actor: owner, target, action: "change_role", nextRole: "admin", ownerCount: 1 })).toThrow(/last owner/i);
  });

  it("prevents administrators from changing owners or roles", () => {
    expect(() => assertAccessActionAllowed({ actor: admin, target: { id: "owner-2", role: "owner", accessStatus: "approved", emailVerified: true }, action: "suspend", ownerCount: 2 })).toThrow(/cannot change an owner/i);
    expect(() => assertAccessActionAllowed({ actor: admin, target: { id: "user-1", role: "user", accessStatus: "approved", emailVerified: true }, action: "change_role", nextRole: "admin", ownerCount: 1 })).toThrow(/only an owner/i);
  });

  it("does not approve an unverified email", () => {
    expect(() => assertAccessActionAllowed({ actor: owner, target: { id: "user-1", role: "user", accessStatus: "pending_email_verification", emailVerified: false }, action: "approve", ownerCount: 1 })).toThrow(/email must be verified/i);
  });

  it("allows an owner to approve a different verified user", () => {
    expect(() => assertAccessActionAllowed({ actor: owner, target: { id: "user-1", role: "user", accessStatus: "pending_owner_approval", emailVerified: true }, action: "approve", ownerCount: 1 })).not.toThrow();
  });

  it("limits the admin user list to identity and access metadata", () => {
    expect(Object.keys(adminUserSelect).sort()).toEqual(["accessStatus", "createdAt", "displayName", "email", "emailVerified", "id", "lastLoginAt", "role", "username"].sort());
  });
});
