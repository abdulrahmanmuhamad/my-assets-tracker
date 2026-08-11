import "server-only";
import { prisma } from "@/lib/prisma";
import { syncAllBankConnections } from "@/lib/banks/bank-sync-service";
import { syncAllBrokerageConnections } from "@/services/brokerage/syncService";

export async function syncAllConfiguredProviders() {
  const credentials = await prisma.providerCredential.findMany({
    where: {
      provider: { in: ["simplefin", "snaptrade"] },
      user: { accessStatus: "approved" },
    },
    select: { userId: true, provider: true },
  });
  const providersByUser = new Map<string, Set<string>>();
  for (const credential of credentials) {
    const providers = providersByUser.get(credential.userId) || new Set<string>();
    providers.add(credential.provider);
    providersByUser.set(credential.userId, providers);
  }
  let completed = 0;
  let failed = 0;

  for (const [userId, providers] of providersByUser) {
    const tasks = [];
    if (providers.has("simplefin")) tasks.push(syncAllBankConnections(userId));
    if (providers.has("snaptrade")) tasks.push(syncAllBrokerageConnections(userId));
    const results = await Promise.allSettled(tasks);
    completed += results.filter((result) => result.status === "fulfilled").length;
    failed += results.filter((result) => result.status === "rejected").length;
  }

  return { users: providersByUser.size, completed, failed };
}
