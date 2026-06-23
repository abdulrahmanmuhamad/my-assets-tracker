import { PrismaClient } from "@prisma/client";
import {
  calculateEquity,
  calculateJewelryCurrentValue,
  calculateMineralCurrentValue,
  calculateMonthlyNetCashFlow,
  calculateROI,
  convertToGrams,
} from "../src/lib/calculations";

const prisma = new PrismaClient();

const priceMap = {
  XAU: { gram: 138.03, ounce: 4293.3, source: "seed-current-fallback" },
  XAG: { gram: 2.25, ounce: 69.95, source: "seed-current-fallback" },
  XPT: { gram: 56.85, ounce: 1768.2, source: "seed-current-fallback" },
  XPD: { gram: 43.07, ounce: 1339.72, source: "seed-current-fallback" },
  XCU: { gram: 0.011, ounce: 0.34, source: "seed-current-fallback" },
};

async function main() {
  const email = process.env.APP_USER_EMAIL || "owner@example.com";
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: process.env.APP_USER_NAME || "Portfolio Owner",
      displayName: process.env.APP_USER_NAME || "Portfolio Owner",
      emailVerified: true,
      accessStatus: "approved",
      role: "owner",
      approvedAt: new Date(),
    },
    create: {
      email,
      name: process.env.APP_USER_NAME || "Portfolio Owner",
      displayName: process.env.APP_USER_NAME || "Portfolio Owner",
      emailVerified: true,
      accessStatus: "approved",
      role: "owner",
      approvedAt: new Date(),
    },
  });

  await prisma.assetFile.deleteMany({ where: { userId: user.id } });
  await prisma.mineralTransaction.deleteMany({ where: { userId: user.id } });
  await prisma.realEstateProperty.deleteMany({ where: { userId: user.id } });
  await prisma.jewelryItem.deleteMany({ where: { userId: user.id } });
  await prisma.assetCategory.deleteMany({ where: { userId: user.id } });

  for (const name of ["Minerals", "Real Estate", "Jewelry"]) {
    await prisma.assetCategory.create({ data: { userId: user.id, name } });
  }

  await prisma.settings.upsert({
    where: { userId: user.id },
    update: {
      defaultCurrency: "USD",
      preferredMineralUnit: "troy ounce",
      preferredJewelryWeightUnit: "gram",
      livePriceProvider: "yahoo",
      manualPriceOverrides: { XAU: 138.03, XAG: 2.25, XPT: 56.85, XPD: 43.07, XCU: 0.011 },
      dashboardVisibility: {
        allocationByCategory: true,
        allocationBySubtype: true,
        realEstateCashFlow: true,
      },
      theme: "system",
    },
    create: {
      userId: user.id,
      livePriceProvider: "yahoo",
      manualPriceOverrides: { XAU: 138.03, XAG: 2.25, XPT: 56.85, XPD: 43.07, XCU: 0.011 },
      dashboardVisibility: {
        allocationByCategory: true,
        allocationBySubtype: true,
        realEstateCashFlow: true,
      },
    },
  });

  for (const [symbol, price] of Object.entries(priceMap)) {
    await prisma.priceCache.upsert({
      where: { symbol },
      update: {
        pricePerGram: price.gram,
        pricePerTroyOunce: price.ounce,
        source: price.source,
        fetchedAt: new Date(),
      },
      create: {
        symbol,
        pricePerGram: price.gram,
        pricePerTroyOunce: price.ounce,
        currency: "USD",
        source: price.source,
        fetchedAt: new Date(),
      },
    });
  }

  const mineralRows = [
    {
      mineralType: "Gold",
      purchaseDate: new Date("2024-02-14"),
      purchasePrice: 8100,
      quantity: 3.5,
      unit: "troy ounce",
      purchaseLocation: "Dallas Bullion Exchange",
      receiptNumber: "GLD-240214",
      currentPricePerGram: priceMap.XAU.gram,
      notes: "Assorted sovereign coins.",
      sortOrder: 1,
    },
    {
      mineralType: "Silver",
      purchaseDate: new Date("2023-11-02"),
      purchasePrice: 4500,
      quantity: 5,
      unit: "kilogram",
      purchaseLocation: "Online dealer",
      receiptNumber: "SLV-231102",
      currentPricePerGram: priceMap.XAG.gram,
      notes: "Five serialized bars.",
      sortOrder: 2,
    },
    {
      mineralType: "Platinum",
      purchaseDate: new Date("2025-01-18"),
      purchasePrice: 5300,
      quantity: 160,
      unit: "gram",
      purchaseLocation: "Estate purchase",
      receiptNumber: "PLT-250118",
      currentPricePerGram: priceMap.XPT.gram,
      notes: "Stored in safe deposit box.",
      sortOrder: 3,
    },
  ];

  for (const row of mineralRows) {
    const quantityInGrams = convertToGrams(row.quantity, row.unit);
    const currentValue = calculateMineralCurrentValue(quantityInGrams, row.currentPricePerGram);
    await prisma.mineralTransaction.create({
      data: {
        ...row,
        userId: user.id,
        purchaseCurrency: "USD",
        quantityInGrams,
        currentValue,
        roiPercent: calculateROI(currentValue, row.purchasePrice),
      },
    });
  }

  const propertyRows = [
    {
      propertyName: "Maple Ridge House",
      propertyType: "Residential",
      purchaseDate: new Date("2020-05-01"),
      purchasePrice: 325000,
      estimatedCurrentPrice: 438000,
      address: "Austin, TX",
      isPaidOff: false,
      totalPaymentMonths: 360,
      monthsPaid: 73,
      monthsLeft: 287,
      monthlyPayment: 1850,
      remainingBalance: 268000,
      isRented: true,
      monthlyRent: 2650,
      rentStartDate: new Date("2024-06-01"),
      monthlyExpenses: { maintenance: 250, tax: 420, insurance: 160, management: 0, other: 80 },
      notes: "Long-term tenant renewed through May 2027.",
      sortOrder: 1,
    },
    {
      propertyName: "North Loop Retail Unit",
      propertyType: "Commercial",
      purchaseDate: new Date("2022-09-15"),
      purchasePrice: 610000,
      estimatedCurrentPrice: 705000,
      address: "Phoenix, AZ",
      isPaidOff: false,
      totalPaymentMonths: 240,
      monthsPaid: 45,
      monthsLeft: 195,
      monthlyPayment: 4100,
      remainingBalance: 505000,
      isRented: true,
      monthlyRent: 5600,
      rentStartDate: new Date("2023-01-01"),
      monthlyExpenses: { maintenance: 420, tax: 730, insurance: 280, management: 280, other: 120 },
      notes: "Triple-net lease review due Q4.",
      sortOrder: 2,
    },
  ];

  for (const row of propertyRows) {
    const monthlyNetCashFlow = calculateMonthlyNetCashFlow(row);
    const equity = calculateEquity(row);
    await prisma.realEstateProperty.create({
      data: {
        ...row,
        userId: user.id,
        monthlyNetCashFlow,
        equity,
        roiPercent: calculateROI(row.estimatedCurrentPrice, row.purchasePrice),
      },
    });
  }

  const jewelryRows = [
    {
      jewelryType: "Gold",
      itemName: "22K Wedding Set",
      purchaseDate: new Date("2021-08-20"),
      purchasePrice: 6200,
      estimatedPriceNow: null,
      weight: 96,
      unit: "gram",
      pricePerGram: priceMap.XAU.gram,
      karat: 22,
      purityPercent: null,
      gemstoneType: null,
      caratWeight: null,
      purchaseLocation: "Family jeweler",
      receiptNumber: "JWL-210820",
      notes: "Includes necklace, bracelet, and earrings.",
      sortOrder: 1,
    },
    {
      jewelryType: "Gemstone",
      itemName: "Certified Sapphire Ring",
      purchaseDate: new Date("2024-04-12"),
      purchasePrice: 7800,
      estimatedPriceNow: 9100,
      weight: 8,
      unit: "gram",
      pricePerGram: null,
      karat: null,
      purityPercent: null,
      gemstoneType: "Blue sapphire",
      caratWeight: 2.1,
      purchaseLocation: "New York auction",
      receiptNumber: "SAP-240412",
      notes: "Certificate included in files.",
      sortOrder: 2,
    },
  ];

  for (const row of jewelryRows) {
    const weightInGrams = convertToGrams(row.weight, row.unit);
    const currentValue = calculateJewelryCurrentValue({ ...row, weightInGrams });
    await prisma.jewelryItem.create({
      data: {
        ...row,
        userId: user.id,
        weightInGrams,
        currentValue,
        roiPercent: calculateROI(currentValue, row.purchasePrice),
      },
    });
  }

  console.log(`Seeded portfolio for ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
