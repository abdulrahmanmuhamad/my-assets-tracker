export type AuthPolicyEnvironment = {
  nodeEnv?: string;
  npmLifecycleEvent?: string;
  allowDevAuthBypass?: string;
  clerkConfigured: boolean;
};

export const ACCESS_STATUSES = [
  "pending_email_verification",
  "pending_owner_approval",
  "approved",
  "rejected",
  "suspended",
] as const;

export const USER_ROLES = ["owner", "admin", "user"] as const;

export type AccessStatus = (typeof ACCESS_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type AccessErrorCode = "EMAIL_NOT_VERIFIED" | "PENDING_OWNER_APPROVAL" | "ACCOUNT_DISABLED";

export function canUseDevelopmentAuthBypass(environment: AuthPolicyEnvironment) {
  if (environment.clerkConfigured || environment.nodeEnv === "production") return false;

  return (
    environment.allowDevAuthBypass === "true" ||
    environment.npmLifecycleEvent === "build"
  );
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function parseOwnerEmails(value?: string) {
  if (!value?.trim()) return new Set<string>();

  return new Set(
    value
      .split(",")
      .map((entry) => {
        const trimmed = entry.trim();
        const markdownEmail = trimmed.match(/\[([^\]]+)\]\(mailto:[^)]+\)/i)?.[1];
        return normalizeEmail((markdownEmail || trimmed).replace(/^mailto:/i, "").replace(/^['"]|['"]$/g, ""));
      })
      .filter(Boolean),
  );
}

export function isConfiguredOwnerEmail(email: string | null | undefined, configuredEmails = process.env.OWNER_EMAILS) {
  return Boolean(email && parseOwnerEmails(configuredEmails).has(normalizeEmail(email)));
}

export function accessErrorFor(status: string, emailVerified: boolean): AccessErrorCode | null {
  if (!emailVerified || status === "pending_email_verification") return "EMAIL_NOT_VERIFIED";
  if (status === "pending_owner_approval") return "PENDING_OWNER_APPROVAL";
  if (status === "rejected" || status === "suspended") return "ACCOUNT_DISABLED";
  return null;
}

export function initialAccessForIdentity(input: { email: string | null | undefined; emailVerified: boolean; ownerEmails?: string }) {
  const isOwner = input.emailVerified && isConfiguredOwnerEmail(input.email, input.ownerEmails);
  return {
    role: (isOwner ? "owner" : "user") as UserRole,
    accessStatus: (isOwner
      ? "approved"
      : input.emailVerified
        ? "pending_owner_approval"
        : "pending_email_verification") as AccessStatus,
  };
}
