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
  const { evaluateAllAlerts } = await import("../src/lib/alerts/evaluate-alerts");
  const result = await evaluateAllAlerts();
  console.log(`Alert evaluation complete: ${result.checked} checked, ${result.triggered} triggered, ${result.skippedCooldown} cooldown skips, ${result.failed} failed.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Alert evaluation failed");
  process.exitCode = 1;
});
