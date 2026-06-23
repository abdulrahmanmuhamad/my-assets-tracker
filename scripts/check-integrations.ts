import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadLocalEnvironment() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    if (process.env[key]) continue;
    process.env[key] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
}

async function main() {
  loadLocalEnvironment();
  const [{ inspectPlaidConfiguration, inspectPlaidBankingConfiguration }, { isValidTokenEncryptionKey }, { selectEmailProvider }] = await Promise.all([
    import("../src/services/brokerage/config"),
    import("../src/lib/encryption-key"),
    import("../src/lib/notifications/email-provider"),
  ]);

  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  const secret = process.env.CLERK_SECRET_KEY || "";
  const clerkDevelopment = publishable.startsWith("pk_test_") && secret.startsWith("sk_test_");
  const plaid = inspectPlaidConfiguration(process.env);
  const plaidBanking = inspectPlaidBankingConfiguration(process.env);
  const plaidEnabled = process.env.ENABLE_PLAID_FEATURES === "true";

  console.log("Local integration readiness");
  console.log(`- App URL: ${process.env.NEXT_PUBLIC_APP_URL || "missing"}`);
  console.log(`- Clerk development keys: ${clerkDevelopment ? "ready" : "missing"}`);
  console.log(`- Clerk webhook: ${process.env.CLERK_WEBHOOK_SECRET ? "ready" : "optional / missing"}`);
  console.log(`- Owner bootstrap: ${process.env.OWNER_EMAILS?.trim() ? "ready" : "missing"}`);
  console.log(`- Dev auth bypass: ${process.env.ALLOW_DEV_AUTH_BYPASS === "true" ? "enabled" : "disabled"}`);
  console.log(`- Plaid features: ${plaidEnabled ? "enabled" : "disabled (optional for this deployment)"}`);
  console.log(`- Plaid ${plaid.environment}: ${!plaidEnabled ? "not required" : plaid.configured ? "ready" : `blocked (${plaid.issues.join("; ")})`}`);
  console.log(`- Plaid banking products: ${!plaidEnabled ? "not required" : plaidBanking.configured ? "ready" : `blocked (${plaidBanking.issues.join("; ")})`}`);
  console.log(`- Token encryption key: ${isValidTokenEncryptionKey(process.env.TOKEN_ENCRYPTION_KEY) ? "ready" : "missing or invalid"}`);
  console.log(`- Alert evaluation secret: ${process.env.ALERTS_EVALUATION_SECRET ? "ready" : "missing"}`);
  console.log(
    `- Email provider: ${selectEmailProvider({
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      ALERT_FROM_EMAIL: process.env.ALERT_FROM_EMAIL,
    }).name}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Integration readiness check failed");
  process.exitCode = 1;
});
