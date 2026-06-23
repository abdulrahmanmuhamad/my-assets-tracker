import { isValidTokenEncryptionKey } from "@/lib/encryption-key";

type PlaidEnvironment = Record<string, string | undefined>;

const VALID_ENVIRONMENTS = ["sandbox", "development", "production"];
const BANKING_PRODUCTS = ["auth", "transactions", "liabilities"];

export function inspectPlaidConfiguration(environment: PlaidEnvironment = process.env) {
  const plaidEnvironment = (environment.PLAID_ENV || "sandbox").toLowerCase();
  const products = (environment.PLAID_PRODUCTS || "investments").split(",").map((value) => value.trim()).filter(Boolean);
  const countries = (environment.PLAID_COUNTRY_CODES || "US").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
  const issues: string[] = [];

  if (!environment.PLAID_CLIENT_ID) issues.push("PLAID_CLIENT_ID is required");
  if (!environment.PLAID_SECRET) issues.push("PLAID_SECRET is required");
  if (!VALID_ENVIRONMENTS.includes(plaidEnvironment)) issues.push("PLAID_ENV must be sandbox, development, or production");
  if (!products.includes("investments")) issues.push("PLAID_PRODUCTS must include investments");
  if (!countries.length || countries.some((country) => !/^[A-Z]{2}$/.test(country))) issues.push("PLAID_COUNTRY_CODES must contain two-letter country codes");
  for (const key of ["PLAID_REDIRECT_URI", "PLAID_STOCKS_REDIRECT_URI", "PLAID_BANKS_REDIRECT_URI"] as const) {
    if (!environment[key]) continue;
    try {
      new URL(environment[key]);
    } catch {
      issues.push(`${key} must be a valid URL`);
    }
  }
  if (!isValidTokenEncryptionKey(environment.TOKEN_ENCRYPTION_KEY)) issues.push("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");

  return { configured: issues.length === 0, issues, environment: plaidEnvironment, products, countries };
}

export function requirePlaidConfiguration(environment: PlaidEnvironment = process.env) {
  const config = inspectPlaidConfiguration(environment);
  if (!config.configured) throw new Error(`Plaid configuration error: ${config.issues.join("; ")}`);
  return config;
}

export function inspectPlaidBankingConfiguration(environment: PlaidEnvironment = process.env) {
  const config = inspectPlaidConfiguration(environment);
  const issues = [...config.issues];
  if (!config.products.some((product) => BANKING_PRODUCTS.includes(product))) {
    issues.push("PLAID_PRODUCTS must include at least one banking product: auth, transactions, or liabilities");
  }
  return { ...config, configured: issues.length === 0, issues };
}

export function requirePlaidBankingConfiguration(environment: PlaidEnvironment = process.env) {
  const config = inspectPlaidBankingConfiguration(environment);
  if (!config.configured) throw new Error(`Plaid banking configuration error: ${config.issues.join("; ")}`);
  return config;
}
