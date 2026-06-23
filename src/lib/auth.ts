import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import {
  accessErrorFor,
  canUseDevelopmentAuthBypass,
  isConfiguredOwnerEmail,
  type AccessErrorCode,
} from "./auth-policy";
import { syncExternalUser, type ExternalUserIdentity } from "./user-sync";

export class AuthenticationError extends Error {
  status: number;
  code?: AccessErrorCode | "OWNER_OR_ADMIN_REQUIRED" | "OWNER_REQUIRED";

  constructor(message = "Authentication required", status = 401, code?: AuthenticationError["code"]) {
    super(message);
    this.name = "AuthenticationError";
    this.status = status;
    this.code = code;
  }
}

export function isClerkConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

function allowDevAuthBypass() {
  return canUseDevelopmentAuthBypass({
    clerkConfigured: isClerkConfigured(),
    nodeEnv: process.env.NODE_ENV,
    npmLifecycleEvent: process.env.npm_lifecycle_event,
    allowDevAuthBypass: process.env.ALLOW_DEV_AUTH_BYPASS,
  });
}

function primaryEmailResource(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return undefined;
  return user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId) || user.emailAddresses[0];
}

function primaryPhone(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return undefined;
  return user.phoneNumbers.find((phone) => phone.id === user.primaryPhoneNumberId)?.phoneNumber || user.phoneNumbers[0]?.phoneNumber;
}

async function getDevelopmentUser() {
  const email = (process.env.APP_USER_EMAIL || "owner@example.com").trim().toLowerCase();
  const name = process.env.APP_USER_NAME || "Portfolio Owner";
  const authProviderUserId = `dev:${email}`;
  const existingByAuth = await prisma.user.findUnique({ where: { authProviderUserId } });
  const existingByEmail = existingByAuth ? null : await prisma.user.findUnique({ where: { email } });
  const existing = existingByAuth || existingByEmail;

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        authProviderUserId,
        email,
        emailVerified: true,
        name,
        displayName: existing.displayName || name,
        accessStatus: "approved",
        role: "owner",
        approvedAt: existing.approvedAt || new Date(),
        rejectedAt: null,
        suspendedAt: null,
        lastLoginAt: new Date(),
      },
    });
  }

  return prisma.user.create({
    data: {
      authProviderUserId,
      email,
      emailVerified: true,
      name,
      displayName: name,
      accessStatus: "approved",
      role: "owner",
      approvedAt: new Date(),
      lastLoginAt: new Date(),
    },
  });
}

function clerkIdentity(clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>, userId: string): ExternalUserIdentity {
  const primaryEmail = primaryEmailResource(clerkUser);
  const emailVerified = primaryEmail?.verification?.status === "verified";
  const metadata = clerkUser.unsafeMetadata as Record<string, unknown>;

  return {
    authProviderUserId: userId,
    email: emailVerified ? primaryEmail?.emailAddress : undefined,
    emailVerified,
    phone: primaryPhone(clerkUser),
    name: clerkUser.fullName || clerkUser.firstName || primaryEmail?.emailAddress || "Portfolio user",
    displayName: typeof metadata.displayName === "string" ? metadata.displayName : clerkUser.fullName || undefined,
    username: typeof metadata.username === "string" ? metadata.username : clerkUser.username || undefined,
    imageUrl: clerkUser.imageUrl,
  };
}

export async function requireAuthenticatedUser() {
  if (allowDevAuthBypass()) return getDevelopmentUser();
  if (!isClerkConfigured()) throw new AuthenticationError("Clerk is not configured");

  const session = await auth();
  if (!session.userId) throw new AuthenticationError();

  const clerkUser = await currentUser();
  if (!clerkUser) throw new AuthenticationError();

  return syncExternalUser(clerkIdentity(clerkUser, session.userId), { recordLogin: true });
}

export async function requireApprovedUser() {
  const user = await requireAuthenticatedUser();
  const code = accessErrorFor(user.accessStatus, user.emailVerified);
  if (!code) return user;

  const messages: Record<AccessErrorCode, string> = {
    EMAIL_NOT_VERIFIED: "Verify your email before accessing the application",
    PENDING_OWNER_APPROVAL: "Your account is waiting for owner approval",
    ACCOUNT_DISABLED: "This account does not currently have access",
  };
  throw new AuthenticationError(messages[code], 403, code);
}

export async function requireOwnerOrAdmin() {
  const user = await requireApprovedUser();
  if (user.role !== "owner" && user.role !== "admin") {
    throw new AuthenticationError("Owner or administrator access is required", 403, "OWNER_OR_ADMIN_REQUIRED");
  }
  return user;
}

export async function requireOwner() {
  const user = await requireApprovedUser();
  if (user.role !== "owner") throw new AuthenticationError("Owner access is required", 403, "OWNER_REQUIRED");
  return user;
}

export async function requireUser() {
  return requireApprovedUser();
}

export async function getCurrentUser() {
  return requireApprovedUser();
}

export { isConfiguredOwnerEmail };
