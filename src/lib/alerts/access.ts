export function alertOwnershipWhere(userId: string, id: string) {
  return { id, userId };
}

export function notificationOwnershipWhere(userId: string, id: string) {
  return { id, userId };
}

export function notificationReadUpdate(existingReadAt: Date | null, now = new Date()) {
  return { readAt: existingReadAt || now };
}
