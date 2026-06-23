import { beforeEach, describe, expect, it, vi } from "vitest";

const user = {
  findUnique: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
};

vi.mock("./prisma", () => ({ prisma: { user } }));

describe("Clerk user synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OWNER_EMAILS = "";
  });

  it("keeps the same local user when a verified Clerk primary email changes", async () => {
    const existing = {
      id: "local-1",
      authProviderUserId: "clerk-1",
      email: "old@example.com",
      emailVerified: true,
      username: "owner",
      displayName: "Owner",
      accessStatus: "approved",
      role: "user",
      approvedAt: new Date("2026-01-01"),
    };
    user.findUnique.mockResolvedValueOnce(existing);
    user.update.mockImplementation(async ({ data }) => ({ ...existing, ...data }));
    const { syncExternalUser } = await import("./user-sync");

    const result = await syncExternalUser({
      authProviderUserId: "clerk-1",
      email: "new@example.com",
      emailVerified: true,
      name: "Owner",
    });

    expect(user.findUnique).toHaveBeenNthCalledWith(1, { where: { authProviderUserId: "clerk-1" } });
    expect(user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "local-1" },
      data: expect.objectContaining({ email: "new@example.com" }),
    }));
    expect(user.create).not.toHaveBeenCalled();
    expect(result.id).toBe("local-1");
  });
});
