import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Coming Soon feature covers", () => {
  it("uses the reusable professional overlay on stocks and banks", () => {
    const stocks = readFileSync(resolve(process.cwd(), "src/app/stocks/page.tsx"), "utf8");
    const banks = readFileSync(resolve(process.cwd(), "src/app/banks/page.tsx"), "utf8");
    const overlay = readFileSync(resolve(process.cwd(), "src/components/features/feature-coming-soon-overlay.tsx"), "utf8");
    expect(stocks).toContain("Brokerage account syncing is being prepared");
    expect(banks).toContain("Bank account syncing is being prepared");
    expect(stocks).toContain("FeatureComingSoonOverlay");
    expect(banks).toContain("FeatureComingSoonOverlay");
    expect(overlay).toContain("backdrop-blur-sm");
    expect(overlay).toContain("pointer-events-none");
  });
});
