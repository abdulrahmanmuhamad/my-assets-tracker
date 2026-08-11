import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, syncBanks, syncBrokerages } = vi.hoisted(() => ({
  findMany: vi.fn(),
  syncBanks: vi.fn(),
  syncBrokerages: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { providerCredential: { findMany } } }));
vi.mock("@/lib/banks/bank-sync-service", () => ({ syncAllBankConnections: syncBanks }));
vi.mock("@/services/brokerage/syncService", () => ({ syncAllBrokerageConnections: syncBrokerages }));

import { syncAllConfiguredProviders } from "./scheduled-sync";

beforeEach(() => {
  vi.clearAllMocks();
  syncBanks.mockResolvedValue([]);
  syncBrokerages.mockResolvedValue([]);
});

describe("scheduled provider sync", () => {
  it("syncs only the providers configured by each approved user", async () => {
    findMany.mockResolvedValue([
      { userId: "user-1", provider: "simplefin" },
      { userId: "user-1", provider: "snaptrade" },
      { userId: "user-2", provider: "simplefin" },
    ]);

    await expect(syncAllConfiguredProviders()).resolves.toEqual({ users: 2, completed: 3, failed: 0 });
    expect(syncBanks).toHaveBeenCalledTimes(2);
    expect(syncBanks).toHaveBeenCalledWith("user-1");
    expect(syncBanks).toHaveBeenCalledWith("user-2");
    expect(syncBrokerages).toHaveBeenCalledOnce();
    expect(syncBrokerages).toHaveBeenCalledWith("user-1");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ user: { accessStatus: "approved" } }),
    }));
  });

  it("reports provider failures without exposing user details", async () => {
    findMany.mockResolvedValue([{ userId: "user-1", provider: "snaptrade" }]);
    syncBrokerages.mockRejectedValue(new Error("provider secret"));
    await expect(syncAllConfiguredProviders()).resolves.toEqual({ users: 1, completed: 0, failed: 1 });
  });
});
