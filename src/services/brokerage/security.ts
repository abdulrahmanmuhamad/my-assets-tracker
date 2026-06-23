export function brokerageOwnershipWhere(userId: string, connectionId: string) {
  return { id: connectionId, userId };
}

export function assertBrokerageConnectionOwnership(existingUserId: string | null | undefined, userId: string) {
  if (existingUserId && existingUserId !== userId) throw new Error("Brokerage connection belongs to another user");
}

export function safeBrokerageConnection(connection: {
  id: string;
  provider: string;
  institutionId: string | null;
  institutionName: string;
  institutionLogoUrl: string | null;
  status: string;
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
    lastSyncedAt: connection.lastSyncedAt?.toISOString() || null,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}
