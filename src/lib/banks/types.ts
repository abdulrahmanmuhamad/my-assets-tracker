export type NormalizedBankAccount = {
  providerAccountId: string;
  institutionName: string;
  accountName: string;
  officialName?: string | null;
  accountType: string;
  accountSubtype?: string | null;
  mask?: string | null;
  currency: string;
  currentBalance?: number | null;
  availableBalance?: number | null;
  creditLimit?: number | null;
  includeInLiquidCash: boolean;
  isDebtAccount: boolean;
  lastBalanceUpdatedAt: Date;
};

export type NormalizedBankTransaction = {
  providerTransactionId: string;
  providerAccountId: string;
  date: Date;
  authorizedDate?: Date | null;
  name: string;
  merchantName?: string | null;
  category?: string | null;
  personalFinanceCategory?: string | null;
  amount: number;
  currency: string;
  pending: boolean;
  paymentChannel?: string | null;
  transactionType?: string | null;
};

export type BankSyncResult = {
  providerItemId?: string | null;
  institutionId?: string | null;
  institutionName?: string | null;
  institutionLogoUrl?: string | null;
  productsEnabled: string[];
  accounts: NormalizedBankAccount[];
  transactions: NormalizedBankTransaction[];
  removedTransactionIds: string[];
  transactionsCursor?: string | null;
  warnings: string[];
};

export type BankSummaryAccount = {
  accountType: string;
  accountSubtype?: string | null;
  currentBalance?: number | null;
  includeInLiquidCash: boolean;
  isDebtAccount: boolean;
};
