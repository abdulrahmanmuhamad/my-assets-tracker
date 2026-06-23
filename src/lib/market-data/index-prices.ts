import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/calculations";

export const DEFAULT_MARKET_INDEXES = [
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^DJI", name: "Dow Jones Industrial Average" },
  { symbol: "^IXIC", name: "Nasdaq Composite" },
  { symbol: "^NDX", name: "Nasdaq 100" },
  { symbol: "^RUT", name: "Russell 2000" },
] as const;

export type MarketIndexQuote = {
  symbol: string;
  name: string;
  price: number;
  changeAmount: number;
  changePercent: number;
  currency: string;
  source: string;
  fetchedAt: string;
};

type YahooChartPayload = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        currency?: string;
      };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
    error?: { description?: string };
  };
};

function ttlMinutes() {
  return Math.max(5, Number(process.env.MARKET_INDEX_CACHE_TTL_MINUTES || 15));
}

export function isMarketIndexCacheStale(
  fetchedAt: Date | null,
  cachedCount: number,
  now = new Date(),
  configuredTtlMinutes = ttlMinutes(),
) {
  return (
    cachedCount < DEFAULT_MARKET_INDEXES.length ||
    !fetchedAt ||
    now.getTime() - fetchedAt.getTime() > configuredTtlMinutes * 60_000
  );
}

export function parseYahooIndexChart(
  payload: YahooChartPayload,
  index: { symbol: string; name: string },
  fetchedAt = new Date(),
): MarketIndexQuote {
  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new Error(payload.chart?.error?.description || `No market data returned for ${index.symbol}`);
  }

  const closes = result.indicators?.quote?.[0]?.close?.filter((value): value is number => typeof value === "number") || [];
  const price = toNumber(result.meta?.regularMarketPrice) || toNumber(closes.at(-1));
  const previousClose =
    toNumber(result.meta?.previousClose) ||
    toNumber(result.meta?.chartPreviousClose) ||
    toNumber(closes.length > 1 ? closes.at(-2) : 0);

  if (price <= 0) throw new Error(`Market data for ${index.symbol} did not include a usable price`);

  const changeAmount = previousClose > 0 ? price - previousClose : 0;
  const changePercent = previousClose > 0 ? (changeAmount / previousClose) * 100 : 0;

  return {
    symbol: index.symbol,
    name: index.name,
    price,
    changeAmount,
    changePercent,
    currency: result.meta?.currency || "USD",
    source: `Yahoo Finance ${index.symbol}`,
    fetchedAt: fetchedAt.toISOString(),
  };
}

async function fetchYahooIndex(index: { symbol: string; name: string }) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(index.symbol)}?range=5d&interval=1d`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 Asset Portfolio Tracker",
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error(`Market data request for ${index.symbol} failed with ${response.status}`);
  return parseYahooIndexChart((await response.json()) as YahooChartPayload, index);
}

function serialize(row: {
  symbol: string;
  name: string;
  price: unknown;
  changeAmount: unknown;
  changePercent: unknown;
  currency: string;
  source: string;
  fetchedAt: Date;
}): MarketIndexQuote {
  return {
    symbol: row.symbol,
    name: row.name,
    price: toNumber(row.price as never),
    changeAmount: toNumber(row.changeAmount as never),
    changePercent: toNumber(row.changePercent as never),
    currency: row.currency,
    source: row.source,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

export async function refreshMarketIndexes(symbols?: string[]) {
  const indexes = DEFAULT_MARKET_INDEXES.filter((index) => !symbols?.length || symbols.includes(index.symbol));
  const results: MarketIndexQuote[] = [];

  for (const index of indexes) {
    const quote = await fetchYahooIndex(index);
    const fetchedAt = new Date(quote.fetchedAt);
    const saved = await prisma.marketIndexPriceCache.upsert({
      where: { symbol: index.symbol },
      update: {
        name: quote.name,
        price: quote.price,
        changeAmount: quote.changeAmount,
        changePercent: quote.changePercent,
        currency: quote.currency,
        source: quote.source,
        fetchedAt,
      },
      create: {
        symbol: index.symbol,
        name: quote.name,
        price: quote.price,
        changeAmount: quote.changeAmount,
        changePercent: quote.changePercent,
        currency: quote.currency,
        source: quote.source,
        fetchedAt,
      },
    });
    results.push(serialize(saved));
  }

  return results;
}

export async function getMarketIndexes(refreshIfStale = true) {
  const cached = await prisma.marketIndexPriceCache.findMany({ orderBy: { symbol: "asc" } });
  const newest = cached.reduce<Date | null>((latest, row) => (!latest || row.fetchedAt > latest ? row.fetchedAt : latest), null);
  const stale = isMarketIndexCacheStale(newest, cached.length);

  if (refreshIfStale && stale) {
    try {
      return await refreshMarketIndexes();
    } catch (error) {
      if (!cached.length) throw error;
    }
  }

  return cached.map(serialize);
}

export async function getMarketIndex(symbol: string, refreshIfStale = true) {
  const quotes = await getMarketIndexes(refreshIfStale);
  return quotes.find((quote) => quote.symbol === symbol) || null;
}
