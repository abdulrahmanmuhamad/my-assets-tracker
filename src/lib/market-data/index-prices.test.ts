import { describe, expect, it } from "vitest";
import { isMarketIndexCacheStale, parseYahooIndexChart } from "./index-prices";

describe("market index parsing", () => {
  it("parses price, daily change, percentage, and metadata", () => {
    const quote = parseYahooIndexChart(
      {
        chart: {
          result: [{
            meta: { regularMarketPrice: 5500, previousClose: 5450, currency: "USD" },
            indicators: { quote: [{ close: [5400, 5450, 5500] }] },
          }],
        },
      },
      { symbol: "^GSPC", name: "S&P 500" },
      new Date("2026-06-21T12:00:00Z"),
    );
    expect(quote.price).toBe(5500);
    expect(quote.changeAmount).toBe(50);
    expect(quote.changePercent).toBeCloseTo((50 / 5450) * 100);
    expect(quote.symbol).toBe("^GSPC");
  });

  it("marks incomplete or expired index caches as stale", () => {
    const now = new Date("2026-06-21T12:30:00Z");
    expect(isMarketIndexCacheStale(new Date("2026-06-21T12:20:00Z"), 5, now, 15)).toBe(false);
    expect(isMarketIndexCacheStale(new Date("2026-06-21T12:00:00Z"), 5, now, 15)).toBe(true);
    expect(isMarketIndexCacheStale(new Date("2026-06-21T12:20:00Z"), 4, now, 15)).toBe(true);
  });
});
