import { prisma } from "./prisma";
import { TROY_OUNCE_GRAMS, toNumber } from "./calculations";
import { MARKET_SYMBOL_BY_METAL_SYMBOL, METAL_NAME_BY_SYMBOL } from "./constants";
import { getCurrentUser } from "./auth";

type RefreshResult = {
  prices: {
    symbol: string;
    pricePerGram: number;
    pricePerTroyOunce: number;
    currency: string;
    source: string;
    fetchedAt: string;
  }[];
  warning?: string;
};

const POUND_GRAMS = 453.59237;
const SYMBOLS = ["XAU", "XAG", "XPT", "XPD", "XCU"] as const;

function ttlMinutes() {
  return Math.max(5, Number(process.env.PRICE_CACHE_TTL_MINUTES || 1440));
}

async function manualPrices(source = "manual override") {
  const user = await getCurrentUser();
  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const overrides = (settings?.manualPriceOverrides || {}) as Record<string, unknown>;
  const now = new Date();

  for (const symbol of SYMBOLS) {
    const perGram = toNumber(overrides[symbol] as never) || defaultManualPrice(symbol);
    await prisma.priceCache.upsert({
      where: { symbol },
      update: {
        pricePerGram: perGram,
        pricePerTroyOunce: perGram * TROY_OUNCE_GRAMS,
        currency: "USD",
        source,
        fetchedAt: now,
      },
      create: {
        symbol,
        pricePerGram: perGram,
        pricePerTroyOunce: perGram * TROY_OUNCE_GRAMS,
        currency: "USD",
        source,
        fetchedAt: now,
      },
    });
  }
}

function defaultManualPrice(symbol: string) {
  const defaults: Record<string, number> = {
    XAU: 138.03,
    XAG: 2.25,
    XPT: 56.85,
    XPD: 43.07,
    XCU: 0.011,
  };
  return defaults[symbol] || 0;
}

async function fetchYahooCommodityPrice(symbol: string) {
  const marketSymbol = MARKET_SYMBOL_BY_METAL_SYMBOL[symbol];
  if (!marketSymbol) {
    throw new Error(`No public market symbol configured for ${symbol}`);
  }

  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(marketSymbol)}?range=5d&interval=1d`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 Asset Portfolio Tracker",
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Daily market data ${marketSymbol} request failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    chart?: {
      result?: Array<{
        meta?: { regularMarketPrice?: number; previousClose?: number };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
      error?: { description?: string };
    };
  };

  const result = data.chart?.result?.[0];
  const closeValues = result?.indicators?.quote?.[0]?.close?.filter((value): value is number => typeof value === "number");
  const perOunce = toNumber(result?.meta?.regularMarketPrice) || toNumber(closeValues?.at(-1)) || toNumber(result?.meta?.previousClose);

  if (perOunce <= 0) {
    throw new Error(`Daily market data ${marketSymbol} did not return a usable price`);
  }

  if (symbol === "XCU") {
    return {
      perOunce: (perOunce / POUND_GRAMS) * TROY_OUNCE_GRAMS,
      perGram: perOunce / POUND_GRAMS,
      source: `Yahoo Finance daily ${marketSymbol} (converted from USD/lb)`,
    };
  }

  return {
    perOunce,
    perGram: perOunce / TROY_OUNCE_GRAMS,
    source: `Yahoo Finance daily ${marketSymbol}`,
  };
}

async function fetchGoldApiPrice(symbol: string, apiKey: string) {
  const response = await fetch(`https://www.goldapi.io/api/${symbol}/USD`, {
    headers: {
      "x-access-token": apiKey,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`GoldAPI ${symbol} request failed with ${response.status}`);
  }

  const data = (await response.json()) as { price?: number; price_gram_24k?: number };
  const perOunce = toNumber(data.price);
  const perGram = toNumber(data.price_gram_24k) || perOunce / TROY_OUNCE_GRAMS;
  return { perGram, perOunce };
}

export async function listCachedPrices() {
  return prisma.priceCache.findMany({ orderBy: { symbol: "asc" } });
}

export async function refreshLivePrices(forceManual = false): Promise<RefreshResult> {
  const provider = (process.env.METAL_PRICE_PROVIDER || "manual").toLowerCase();
  const apiKey = process.env.METAL_PRICE_API_KEY;
  let warning: string | undefined;

  if (forceManual || provider === "manual") {
    await manualPrices(provider === "manual" ? "manual override" : "manual fallback");
  } else if (provider === "yahoo" || provider === "daily" || provider === "marketdata") {
    try {
      const now = new Date();
      for (const symbol of SYMBOLS) {
        const { perGram, perOunce, source } = await fetchYahooCommodityPrice(symbol);
        await prisma.priceCache.upsert({
          where: { symbol },
          update: {
            pricePerGram: perGram,
            pricePerTroyOunce: perOunce,
            currency: "USD",
            source,
            fetchedAt: now,
          },
          create: {
            symbol,
            pricePerGram: perGram,
            pricePerTroyOunce: perOunce,
            currency: "USD",
            source,
            fetchedAt: now,
          },
        });
      }
    } catch (error) {
      await manualPrices("current spot fallback");
      warning = error instanceof Error ? `${error.message}; using current spot fallback prices.` : "Daily market data failed; using current spot fallback prices.";
    }
  } else if (!apiKey) {
    await manualPrices("current spot fallback");
    warning = "No metal price API key configured; using current spot fallback prices.";
  } else if (provider === "goldapi" || provider === "goldapi.io") {
    try {
      const now = new Date();
      for (const symbol of SYMBOLS) {
        const { perGram, perOunce } = await fetchGoldApiPrice(symbol, apiKey);
        await prisma.priceCache.upsert({
          where: { symbol },
          update: {
            pricePerGram: perGram,
            pricePerTroyOunce: perOunce,
            currency: "USD",
            source: "GoldAPI.io",
            fetchedAt: now,
          },
          create: {
            symbol,
            pricePerGram: perGram,
            pricePerTroyOunce: perOunce,
            currency: "USD",
            source: "GoldAPI.io",
            fetchedAt: now,
          },
        });
      }
    } catch (error) {
      warning = error instanceof Error ? `${error.message}; using last cached prices.` : "Price API failed; using last cached prices.";
    }
  } else {
    await manualPrices("manual fallback");
    warning = `${provider} is not configured in this starter; using manual override prices.`;
  }

  const prices = await listCachedPrices();
  return {
    warning,
    prices: prices.map((price) => ({
      symbol: price.symbol,
      pricePerGram: toNumber(price.pricePerGram),
      pricePerTroyOunce: toNumber(price.pricePerTroyOunce),
      currency: price.currency,
      source: price.source,
      fetchedAt: price.fetchedAt.toISOString(),
      name: METAL_NAME_BY_SYMBOL[price.symbol],
    })),
  };
}

export async function autoRefreshPricesIfStale() {
  const newest = await prisma.priceCache.findFirst({ orderBy: { fetchedAt: "desc" } });
  if (!newest || Date.now() - newest.fetchedAt.getTime() > ttlMinutes() * 60 * 1000) {
    return refreshLivePrices();
  }

  const prices = await listCachedPrices();
  return {
    prices: prices.map((price) => ({
      symbol: price.symbol,
      pricePerGram: toNumber(price.pricePerGram),
      pricePerTroyOunce: toNumber(price.pricePerTroyOunce),
      currency: price.currency,
      source: price.source,
      fetchedAt: price.fetchedAt.toISOString(),
    })),
  };
}
