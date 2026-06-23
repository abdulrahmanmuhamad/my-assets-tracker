import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { initialAccessForIdentity, isConfiguredOwnerEmail } from "./auth-policy";
import { normalizeOptionalUsername } from "./user-access";

export type ExternalUserIdentity = {
  authProviderUserId: string;
  email?: string | null;
  emailVerified: boolean;
  phone?: string | null;
  name?: string | null;
  displayName?: string | null;
  username?: string | null;
  imageUrl?: string | null;
};

async function availableUsername(requested: string | undefined, currentUserId?: string) {
  if (!requested) return undefined;
  const conflict = await prisma.user.findUnique({ where: { username: requested }, select: { id: true } });
  return !conflict || conflict.id === currentUserId ? requested : undefined;
}

export async function syncExternalUser(identity: ExternalUserIdentity, options: { recordLogin?: boolean } = {}) {
  const verifiedEmail = identity.emailVerified && identity.email ? identity.email.trim().toLowerCase() : undefined;
  const existingByAuth = await prisma.user.findUnique({ where: { authProviderUserId: identity.authProviderUserId } });
  const existingByEmail = !existingByAuth && verifiedEmail
    ? await prisma.user.findUnique({ where: { email: verifiedEmail } })
    : null;
  const existing = existingByAuth || existingByEmail;
  const owner = identity.emailVerified && isConfiguredOwnerEmail(verifiedEmail);
  const initial = initialAccessForIdentity({ email: verifiedEmail, emailVerified: identity.emailVerified });
  const requestedUsername = normalizeOptionalUsername(identity.username);
  const username = await availableUsername(requestedUsername, existing?.id);
  const now = new Date();

  let accessStatus = existing?.accessStatus || initial.accessStatus;
  let role = existing?.role || initial.role;
  if (owner) {
    accessStatus = "approved";
    role = "owner";
  } else if (existing?.accessStatus === "pending_email_verification" && identity.emailVerified) {
    accessStatus = "pending_owner_approval";
  }

  const data = {
    authProviderUserId: identity.authProviderUserId,
    ...(verifiedEmail ? { email: verifiedEmail } : {}),
    emailVerified: identity.emailVerified,
    phone: identity.phone || undefined,
    name: identity.name || undefined,
    displayName: existing?.displayName || identity.displayName || undefined,
    username: existing?.username || username,
    imageUrl: identity.imageUrl || undefined,
    accessStatus,
    role,
    ...(accessStatus === "approved" ? { approvedAt: existing?.approvedAt || now } : {}),
    ...(owner ? { rejectedAt: null, suspendedAt: null } : {}),
    ...(options.recordLogin ? { lastLoginAt: now } : {}),
  };

  try {
    if (existing) return await prisma.user.update({ where: { id: existing.id }, data });
    return await prisma.user.create({ data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && username) {
      const retryData = { ...data, username: undefined };
      if (existing) return prisma.user.update({ where: { id: existing.id }, data: retryData });
      return prisma.user.create({ data: retryData });
    }
    throw error;
  }
}
