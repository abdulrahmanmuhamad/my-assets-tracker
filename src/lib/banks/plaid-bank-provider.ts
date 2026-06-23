import "server-only";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { toNumber } from "@/lib/calculations";
import { requirePlaidBankingConfiguration, requirePlaidConfiguration } from "@/services/brokerage/config";
import { defaultIncludeInLiquidCash, isCreditCardAccount } from "./calculations";
import type { BankSyncResult, NormalizedBankAccount, NormalizedBankTransaction } from "./types";

function plaidClient() {
  const config = requirePlaidConfiguration();
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[config.environment as keyof typeof PlaidEnvironments],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID as string,
          "PLAID-SECRET": process.env.PLAID_SECRET as string,
        },
      },
    }),
  );
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = toNumber(value as never);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function warningMessage(error: unknown, label: string) {
  const candidate = error as { response?: { data?: { error_code?: string; error_message?: string } }; message?: string };
  const code = candidate.response?.data?.error_code;
  const message = candidate.response?.data?.error_message || candidate.message;
  return `${label}: ${code || message || "temporarily unavailable"}`;
}

export function normalizePlaidBankAccount(
  raw: Record<string, unknown>,
  institutionName: string,
  now = new Date(),
): NormalizedBankAccount {
  const balances = (raw.balances || {}) as Record<string, unknown>;
  const accountType = String(raw.type || "other").toLowerCase();
  const accountSubtype = text(raw.subtype)?.toLowerCase() || null;
  return {
    providerAccountId: String(raw.account_id),
    institutionName,
    accountName: String(raw.name || raw.official_name || "Bank account"),
    officialName: text(raw.official_name),
    accountType,
    accountSubtype,
    mask: text(raw.mask),
    currency: String(balances.iso_currency_code || balances.unofficial_currency_code || "USD"),
    currentBalance: nullableNumber(balances.current),
    availableBalance: nullableNumber(balances.available),
    creditLimit: nullableNumber(balances.limit),
    includeInLiquidCash: defaultIncludeInLiquidCash(accountType, accountSubtype),
    isDebtAccount: isCreditCardAccount(accountType, accountSubtype),
    lastBalanceUpdatedAt: now,
  };
}

export function normalizePlaidBankTransaction(raw: Record<string, unknown>): NormalizedBankTransaction {
  const category = Array.isArray(raw.category) ? raw.category.filter((item) => typeof item === "string").join(" / ") : null;
  const financeCategory = raw.personal_finance_category as Record<string, unknown> | null | undefined;
  return {
    providerTransactionId: String(raw.transaction_id),
    providerAccountId: String(raw.account_id),
    date: new Date(`${String(raw.date)}T00:00:00.000Z`),
    authorizedDate: raw.authorized_date ? new Date(`${String(raw.authorized_date)}T00:00:00.000Z`) : null,
    name: String(raw.name || raw.merchant_name || "Transaction"),
    merchantName: text(raw.merchant_name),
    category,
    personalFinanceCategory: text(financeCategory?.detailed || financeCategory?.primary),
    amount: toNumber(raw.amount as never),
    currency: String(raw.iso_currency_code || raw.unofficial_currency_code || "USD"),
    pending: Boolean(raw.pending),
    paymentChannel: text(raw.payment_channel),
    transactionType: text(raw.transaction_type),
  };
}

async function institutionDetails(client: PlaidApi, accessToken: string, countries: string[]) {
  const item = await client.itemGet({ access_token: accessToken });
  const institutionId = item.data.item.institution_id || null;
  if (!institutionId) return { institutionId: null, institutionName: "Connected bank", institutionLogoUrl: null };

  try {
    const response = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: countries as never,
      options: { include_optional_metadata: true },
    });
    const institution = response.data.institution;
    return {
      institutionId,
      institutionName: institution.name || "Connected bank",
      institutionLogoUrl: institution.logo ? `data:image/png;base64,${institution.logo}` : null,
    };
  } catch {
    return { institutionId, institutionName: "Connected bank", institutionLogoUrl: null };
  }
}

async function loadTransactions(client: PlaidApi, accessToken: string, startingCursor?: string | null) {
  let cursor = startingCursor || undefined;
  let hasMore = true;
  const transactions: NormalizedBankTransaction[] = [];
  const removedTransactionIds: string[] = [];

  while (hasMore) {
    const response = await client.transactionsSync({ access_token: accessToken, cursor, count: 500 });
    transactions.push(
      ...[...response.data.added, ...response.data.modified].map((transaction) =>
        normalizePlaidBankTransaction(transaction as unknown as Record<string, unknown>),
      ),
    );
    removedTransactionIds.push(...response.data.removed.map((transaction) => transaction.transaction_id));
    cursor = response.data.next_cursor;
    hasMore = response.data.has_more;
  }

  return { transactions, removedTransactionIds, cursor };
}

export async function syncPlaidBankAccessToken(
  accessToken: string,
  transactionsCursor?: string | null,
): Promise<BankSyncResult> {
  const client = plaidClient();
  const config = requirePlaidConfiguration();
  const balanceResponse = await client.accountsBalanceGet({ access_token: accessToken });
  const institution = await institutionDetails(client, accessToken, config.countries);
  const warnings: string[] = [];
  let transactions: NormalizedBankTransaction[] = [];
  let removedTransactionIds: string[] = [];
  let nextCursor = transactionsCursor || null;

  if (config.products.includes("transactions")) {
    try {
      const result = await loadTransactions(client, accessToken, transactionsCursor);
      transactions = result.transactions;
      removedTransactionIds = result.removedTransactionIds;
      nextCursor = result.cursor || null;
    } catch (error) {
      warnings.push(warningMessage(error, "Transactions"));
    }
  }

  if (config.products.includes("liabilities")) {
    try {
      await client.liabilitiesGet({ access_token: accessToken });
    } catch (error) {
      warnings.push(warningMessage(error, "Liabilities"));
    }
  }

  const supportedAccounts = balanceResponse.data.accounts.filter((account) =>
    ["depository", "credit", "loan"].includes(String(account.type).toLowerCase()),
  );

  return {
    providerItemId: balanceResponse.data.item.item_id,
    institutionId: institution.institutionId,
    institutionName: institution.institutionName,
    institutionLogoUrl: institution.institutionLogoUrl,
    productsEnabled: config.products,
    accounts: supportedAccounts.map((account) =>
      normalizePlaidBankAccount(account as unknown as Record<string, unknown>, institution.institutionName),
    ),
    transactions,
    removedTransactionIds,
    transactionsCursor: nextCursor,
    warnings,
  };
}

export async function createBankLinkToken(userId: string) {
  const config = requirePlaidBankingConfiguration();
  const response = await plaidClient().linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Asset Portfolio Tracker",
    products: config.products.filter((product) => product !== "investments") as never,
    country_codes: config.countries as never,
    language: "en",
    redirect_uri: process.env.PLAID_BANKS_REDIRECT_URI || process.env.PLAID_REDIRECT_URI || undefined,
  });
  return { linkToken: response.data.link_token, expiration: response.data.expiration };
}

export async function exchangeBankPublicToken(publicToken: string) {
  const exchange = await plaidClient().itemPublicTokenExchange({ public_token: publicToken });
  const sync = await syncPlaidBankAccessToken(exchange.data.access_token);
  return { accessToken: exchange.data.access_token, providerItemId: exchange.data.item_id, sync };
}
