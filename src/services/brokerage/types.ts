export type BrokerageProviderName = "plaid" | "snaptrade";

export type NormalizedBrokerageAccount = {
  providerAccountId: string;
  brokerName: string;
  accountName: string;
  accountType: string;
  accountSubtype?: string | null;
  mask?: string | null;
  currency: string;
  currentBalance?: number | null;
  availableBalance?: number | null;
  officialName?: string | null;
};

export type NormalizedStockHolding = {
  providerHoldingId: string;
  providerAccountId: string;
  symbol?: string | null;
  securityName: string;
  securityType: string;
  cusip?: string | null;
  isin?: string | null;
  quantity: number;
  costBasis?: number | null;
  averageCost?: number | null;
  currentPrice?: number | null;
  marketValue: number;
  unrealizedGainLoss?: number | null;
  unrealizedGainLossPercent?: number | null;
  currency: string;
  asOfDate: Date;
};

export type NormalizedStockTransaction = {
  providerTransactionId: string;
  providerAccountId: string;
  symbol?: string | null;
  securityName?: string | null;
  transactionType: string;
  quantity?: number | null;
  price?: number | null;
  amount: number;
  fees?: number | null;
  date: Date;
  currency: string;
};

export type BrokerageSyncResult = {
  providerItemId?: string | null;
  institutionId?: string | null;
  institutionName?: string | null;
  institutionLogoUrl?: string | null;
  accounts: NormalizedBrokerageAccount[];
  holdings: NormalizedStockHolding[];
  transactions: NormalizedStockTransaction[];
};

export type BrokerageProvider = {
  provider: BrokerageProviderName;
  createLinkToken(userId: string): Promise<{ linkToken: string; expiration?: string }>;
  exchangePublicToken(userId: string, publicToken: string): Promise<{
    providerItemId: string;
    accessToken: string;
    institutionId?: string | null;
    institutionName?: string | null;
    institutionLogoUrl?: string | null;
    sync: BrokerageSyncResult;
  }>;
  syncConnection(accessToken: string): Promise<BrokerageSyncResult>;
};
