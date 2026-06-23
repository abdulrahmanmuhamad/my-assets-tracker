import "server-only";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import {
  calculateHoldingGainLoss,
  calculateHoldingMarketValue,
  calculateHoldingROI,
  roundCurrency,
  toNumber,
} from "@/lib/calculations";
import type {
  BrokerageProvider,
  BrokerageSyncResult,
  NormalizedBrokerageAccount,
  NormalizedStockHolding,
  NormalizedStockTransaction,
} from "./types";
import { requirePlaidConfiguration } from "./config";

function plaidClient() {
  const config = requirePlaidConfiguration();
  const basePath = PlaidEnvironments[config.environment as keyof typeof PlaidEnvironments];

  return new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID as string,
          "PLAID-SECRET": process.env.PLAID_SECRET as string,
        },
      },
    }),
  );
}

function plaidProducts() {
  return requirePlaidConfiguration().products.filter((product) => product === "investments");
}

function plaidCountryCodes() {
  return requirePlaidConfiguration().countries;
}

function money(value: unknown) {
  const parsed = toNumber(value as never);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableMoney(value: unknown) {
  if (value === null || value === undefined) return null;
  return money(value);
}

function normalizeSecurity(security: Record<string, unknown> | undefined) {
  return {
    symbol: String(security?.ticker_symbol || security?.proxy_security_id || "").trim() || null,
    name: String(security?.name || security?.ticker_symbol || "Unknown security"),
    type: String(security?.type || "other").toLowerCase(),
    cusip: security?.cusip ? String(security.cusip) : null,
    isin: security?.isin ? String(security.isin) : null,
    id: security?.security_id ? String(security.security_id) : "unknown",
  };
}

function mapAccounts(accounts: Record<string, unknown>[], institutionName: string): NormalizedBrokerageAccount[] {
  return accounts.map((account) => ({
    providerAccountId: String(account.account_id),
    brokerName: institutionName,
    accountName: String(account.name || account.official_name || "Investment account"),
    accountType: String(account.type || "brokerage"),
    accountSubtype: account.subtype ? String(account.subtype) : null,
    mask: account.mask ? String(account.mask) : null,
    currency: String(account.iso_currency_code || account.unofficial_currency_code || "USD"),
    currentBalance: nullableMoney((account.balances as Record<string, unknown> | undefined)?.current),
    availableBalance: nullableMoney((account.balances as Record<string, unknown> | undefined)?.available),
    officialName: account.official_name ? String(account.official_name) : null,
  }));
}

function mapHoldings(
  holdings: Record<string, unknown>[],
  securities: Record<string, unknown>[],
): NormalizedStockHolding[] {
  const securitiesById = Object.fromEntries(securities.map((security) => [String(security.security_id), security]));

  return holdings.map((holding) => {
    const providerAccountId = String(holding.account_id);
    const securityId = String(holding.security_id || "cash");
    const security = normalizeSecurity(securitiesById[securityId]);
    const quantity = money(holding.quantity);
    const currentPrice = nullableMoney(holding.institution_price);
    const costBasis = nullableMoney(holding.cost_basis);
    const marketValue = holding.institution_value
      ? money(holding.institution_value)
      : calculateHoldingMarketValue(quantity, currentPrice || 0);
    const gainLoss = costBasis && costBasis > 0 ? calculateHoldingGainLoss(marketValue, costBasis) : null;

    return {
      providerHoldingId: `${providerAccountId}:${securityId}`,
      providerAccountId,
      symbol: security.symbol,
      securityName: security.name,
      securityType: security.type,
      cusip: security.cusip,
      isin: security.isin,
      quantity,
      costBasis,
      averageCost: costBasis && quantity > 0 ? roundCurrency(costBasis / quantity) : null,
      currentPrice,
      marketValue,
      unrealizedGainLoss: gainLoss,
      unrealizedGainLossPercent: costBasis && costBasis > 0 ? calculateHoldingROI(marketValue, costBasis) : null,
      currency: String(holding.iso_currency_code || holding.unofficial_currency_code || "USD"),
      asOfDate: new Date(),
    };
  });
}

function mapTransactions(
  transactions: Record<string, unknown>[],
  securities: Record<string, unknown>[],
): NormalizedStockTransaction[] {
  const securitiesById = Object.fromEntries(securities.map((security) => [String(security.security_id), security]));

  return transactions.map((transaction) => {
    const security = normalizeSecurity(securitiesById[String(transaction.security_id || "")]);
    return {
      providerTransactionId: String(transaction.investment_transaction_id),
      providerAccountId: String(transaction.account_id),
      symbol: security.symbol,
      securityName: security.name,
      transactionType: String(transaction.type || transaction.subtype || "other").toLowerCase(),
      quantity: nullableMoney(transaction.quantity),
      price: nullableMoney(transaction.price),
      amount: money(transaction.amount),
      fees: nullableMoney(transaction.fees),
      date: new Date(String(transaction.date)),
      currency: String(transaction.iso_currency_code || transaction.unofficial_currency_code || "USD"),
    };
  });
}

async function institutionDetails(client: PlaidApi, accessToken: string) {
  const item = await client.itemGet({ access_token: accessToken });
  const institutionId = item.data.item.institution_id || null;
  if (!institutionId) {
    return { institutionId: null, institutionName: "Connected brokerage", institutionLogoUrl: null };
  }

  try {
    const response = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: plaidCountryCodes() as never,
      options: { include_optional_metadata: true },
    });
    const institution = response.data.institution;
    return {
      institutionId,
      institutionName: institution.name || "Connected brokerage",
      institutionLogoUrl: institution.logo ? `data:image/png;base64,${institution.logo}` : null,
    };
  } catch {
    return { institutionId, institutionName: "Connected brokerage", institutionLogoUrl: null };
  }
}

async function syncPlaidAccessToken(accessToken: string): Promise<BrokerageSyncResult> {
  const client = plaidClient();
  const [institution, holdingsResponse] = await Promise.all([
    institutionDetails(client, accessToken),
    client.investmentsHoldingsGet({ access_token: accessToken }),
  ]);

  let transactions: NormalizedStockTransaction[] = [];
  try {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 1);
    const transactionsResponse = await client.investmentsTransactionsGet({
      access_token: accessToken,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      options: { count: 500, offset: 0 },
    });
    transactions = mapTransactions(
      transactionsResponse.data.investment_transactions as unknown as Record<string, unknown>[],
      transactionsResponse.data.securities as unknown as Record<string, unknown>[],
    );
  } catch {
    transactions = [];
  }

  return {
    providerItemId: holdingsResponse.data.item.item_id,
    institutionId: institution.institutionId,
    institutionName: institution.institutionName,
    institutionLogoUrl: institution.institutionLogoUrl,
    accounts: mapAccounts(
      holdingsResponse.data.accounts as unknown as Record<string, unknown>[],
      institution.institutionName,
    ),
    holdings: mapHoldings(
      holdingsResponse.data.holdings as unknown as Record<string, unknown>[],
      holdingsResponse.data.securities as unknown as Record<string, unknown>[],
    ),
    transactions,
  };
}

export const plaidProvider: BrokerageProvider = {
  provider: "plaid",

  async createLinkToken(userId: string) {
    const response = await plaidClient().linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Asset Portfolio Tracker",
      products: plaidProducts() as never,
      country_codes: plaidCountryCodes() as never,
      language: "en",
      redirect_uri: process.env.PLAID_STOCKS_REDIRECT_URI || process.env.PLAID_REDIRECT_URI || undefined,
    });

    return { linkToken: response.data.link_token, expiration: response.data.expiration };
  },

  async exchangePublicToken(_userId: string, publicToken: string) {
    const exchange = await plaidClient().itemPublicTokenExchange({ public_token: publicToken });
    const sync = await syncPlaidAccessToken(exchange.data.access_token);

    return {
      providerItemId: exchange.data.item_id,
      accessToken: exchange.data.access_token,
      institutionId: sync.institutionId,
      institutionName: sync.institutionName,
      institutionLogoUrl: sync.institutionLogoUrl,
      sync,
    };
  },

  async syncConnection(accessToken: string) {
    return syncPlaidAccessToken(accessToken);
  },
};
