export function bankOwnershipWhere(userId: string, connectionId: string) {
  return { id: connectionId, userId };
}

export function bankAccountOwnershipWhere(userId: string, accountId: string) {
  return { id: accountId, userId };
}

export function assertBankConnectionOwnership(existingUserId: string | null | undefined, userId: string) {
  if (existingUserId && existingUserId !== userId) throw new Error("Bank connection belongs to another user");
}

export function safeBankConnection(connection: {
  id: string;
  provider: string;
  institutionId: string | null;
  institutionName: string;
  institutionLogoUrl: string | null;
  status: string;
  productsEnabled: unknown;
  syncWarning: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: connection.id,
    provider: connection.provider,
    institutionId: connection.institutionId,
    institutionName: connection.institutionName,
    institutionLogoUrl: connection.institutionLogoUrl,
    status: connection.status,
    productsEnabled: Array.isArray(connection.productsEnabled) ? connection.productsEnabled : [],
    syncWarning: connection.syncWarning,
    lastSyncedAt: connection.lastSyncedAt?.toISOString() || null,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}
