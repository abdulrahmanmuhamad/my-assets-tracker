import { describe, expect, it } from "vitest";
import {
  calculateEquity,
  calculateGoldPurity,
  calculateHoldingGainLoss,
  calculateHoldingMarketValue,
  calculateHoldingROI,
  calculateJewelryCurrentValue,
  calculateMonthlyNetCashFlow,
  calculatePortfolioSummary,
  calculateROI,
  calculateStocksPortfolioSummary,
  convertFromGrams,
  convertToGrams,
} from "./calculations";

describe("calculation service", () => {
  it("converts supported weight units to and from grams", () => {
    expect(convertToGrams(1, "kilogram")).toBe(1000);
    expect(convertToGrams(1, "troy ounce")).toBeCloseTo(31.1034768);
    expect(convertToGrams(1, "ounce")).toBeCloseTo(28.349523125);
    expect(convertToGrams(1, "pound")).toBeCloseTo(453.59237);
    expect(convertFromGrams(31.1034768, "troy ounce")).toBeCloseTo(1);
  });

  it("calculates ROI without dividing by zero", () => {
    expect(calculateROI(120, 100)).toBe(20);
    expect(calculateROI(80, 100)).toBe(-20);
    expect(calculateROI(80, 0)).toBe(0);
  });

  it("calculates gold purity and jewelry value", () => {
    expect(calculateGoldPurity(22)).toBeCloseTo(22 / 24);
    expect(
      calculateJewelryCurrentValue({
        jewelryType: "Gold",
        weightInGrams: 96,
        pricePerGram: 75,
        karat: 22,
      }),
    ).toBe(6600);
  });

  it("calculates real estate equity and monthly net cash flow", () => {
    const property = {
      estimatedCurrentPrice: 500000,
      purchasePrice: 400000,
      isPaidOff: false,
      remainingBalance: 250000,
      monthlyPayment: 2000,
      monthsLeft: 120,
      isRented: true,
      monthlyRent: 3200,
      monthlyExpenses: {
        maintenance: 150,
        tax: 400,
        insurance: 120,
        management: 100,
      },
    };

    expect(calculateEquity(property)).toBe(250000);
    expect(calculateMonthlyNetCashFlow(property)).toBe(430);
  });

  it("summarizes portfolio allocations", () => {
    const summary = calculatePortfolioSummary([
      {
        id: "gold-1",
        name: "Gold",
        category: "Minerals",
        subType: "Gold",
        purchaseDate: "2024-01-01",
        purchasePrice: 100,
        currentValue: 125,
        roiPercent: 25,
      },
      {
        id: "house-1",
        name: "House",
        category: "Real Estate",
        subType: "Residential",
        purchaseDate: "2020-01-01",
        purchasePrice: 300,
        currentValue: 375,
        roiPercent: 25,
      },
    ]);

    expect(summary.totalPortfolioValue).toBe(500);
    expect(summary.totalCostBasis).toBe(400);
    expect(summary.totalProfitLoss).toBe(100);
    expect(summary.totalRoiPercent).toBe(25);
    expect(summary.allocationByCategory).toHaveLength(2);
  });

  it("calculates stock holdings and excludes missing cost basis from ROI", () => {
    expect(calculateHoldingMarketValue(10, 12)).toBe(120);
    expect(calculateHoldingGainLoss(120, 100)).toBe(20);
    expect(calculateHoldingROI(120, 100)).toBe(20);
    expect(calculateHoldingROI(120, null)).toBeNull();

    const summary = calculateStocksPortfolioSummary([
      {
        id: "aapl",
        brokerName: "Fidelity",
        accountName: "Brokerage",
        symbol: "AAPL",
        securityName: "Apple",
        quantity: 10,
        costBasis: 100,
        currentPrice: 12,
        marketValue: 120,
      },
      {
        id: "cash",
        brokerName: "Fidelity",
        accountName: "Brokerage",
        symbol: "CASH",
        securityName: "Cash",
        quantity: 1,
        costBasis: null,
        currentPrice: 50,
        marketValue: 50,
      },
    ]);

    expect(summary.totalValue).toBe(170);
    expect(summary.totalCostBasis).toBe(100);
    expect(summary.costBasisMissingCount).toBe(1);
    expect(summary.totalROI).toBe(70);
  });
});
