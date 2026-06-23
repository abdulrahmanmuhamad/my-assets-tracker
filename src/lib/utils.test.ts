import { describe, expect, it } from "vitest";
import { dateInputValue, formatDisplayDate, titleFromSnake } from "./utils";

describe("date and label utilities", () => {
  it("formats date-only strings without shifting the day", () => {
    expect(dateInputValue("2026-06-16")).toBe("2026-06-16");
    expect(formatDisplayDate("2026-06-16")).toBe("Jun 16, 2026");
  });

  it("turns technical field keys into readable labels", () => {
    expect(titleFromSnake("effectiveQuantityInGrams")).toBe("Effective Quantity In Grams");
    expect(titleFromSnake("purchase_price")).toBe("Purchase Price");
    expect(titleFromSnake("monthlyExpenses.tax")).toBe("Monthly Expenses Tax");
  });
});
