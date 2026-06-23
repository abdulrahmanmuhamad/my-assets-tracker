import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return readFileSync(resolve(process.cwd(), file), "utf8");
}

describe("custom passwordless pages", () => {
  it("contains no password input in sign-up or sign-in", () => {
    const authSource = `${source("src/components/auth/passwordless-sign-up.tsx")}\n${source("src/components/auth/passwordless-sign-in.tsx")}`;
    expect(authSource).not.toMatch(/type=["']password["']/i);
    expect(authSource).not.toMatch(/\.password\s*\(/);
  });

  it("collects username only during sign-up", () => {
    expect(source("src/components/auth/passwordless-sign-up.tsx")).toContain("Username");
    expect(source("src/components/auth/passwordless-sign-in.tsx")).not.toContain("Username");
  });

  it("hides sensitive settings unless the local role is owner", () => {
    const settings = source("src/components/settings/settings-panel.tsx");
    expect(settings).toContain('securityUser.role === "owner"');
    expect(settings).toContain('activeTab === "access" && ownerOnly');
    expect(settings).toContain('activeTab === "developer" && ownerOnly');
    expect(settings).toContain('activeTab === "integrations" && ownerOnly');
  });

  it("hides the Portfolio OS sidebar footer unless the profile role is owner", () => {
    const shell = source("src/components/app-shell.tsx");
    expect(shell).toContain('profile?.role === "owner"');
    expect(shell).toContain("Portfolio OS");
  });
});
