import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("bank and stock provider availability", () => {
  it("renders both workspaces directly without the old Plaid approval overlay", () => {
    const stocks = readFileSync(resolve(process.cwd(), "src/app/stocks/page.tsx"), "utf8");
    const banks = readFileSync(resolve(process.cwd(), "src/app/banks/page.tsx"), "utf8");
    expect(stocks).toContain("<StocksWorkspace");
    expect(banks).toContain("<BanksWorkspace");
    expect(stocks).not.toContain("FeatureComingSoonOverlay");
    expect(banks).not.toContain("FeatureComingSoonOverlay");
  });
});
