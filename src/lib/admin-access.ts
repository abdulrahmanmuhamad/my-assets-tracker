import { prisma } from "./prisma";

export type AdminAction = "approve" | "reject" | "suspend" | "restore";
export type AccessActor = { id: string; role: string };
export type AccessTarget = { id: string; role: string; accessStatus: string; emailVerified: boolean };

export function assertAccessActionAllowed(input: {
  actor: AccessActor;
  target: AccessTarget;
  action: AdminAction | "change_role";
  nextRole?: "user" | "admin";
  ownerCount: number;
}) {
  const { actor, target, action, ownerCount } = input;
  if (actor.id === target.id) throw new Error("You cannot change your own access");
  if ((action === "approve" || action === "restore") && !target.emailVerified) throw new Error("Email must be verified before approval");
  if (actor.role === "admin" && target.role === "owner") throw new Error("Administrators cannot change an owner");
  if (action === "change_role" && actor.role !== "owner") throw new Error("Only an owner can change roles");
  if (target.role === "owner" && ownerCount <= 1 && (action === "reject" || action === "suspend" || action === "change_role")) {
    throw new Error("The last owner cannot be demoted or disabled");
  }
}

export async function updateUserAccess(actor: AccessActor, targetId: string, action: AdminAction) {
  return prisma.$transaction(async (tx) => {
    const [target, ownerCount] = await Promise.all([
      tx.user.findUnique({ where: { id: targetId } }),
      tx.user.count({ where: { role: "owner", accessStatus: "approved" } }),
    ]);
    if (!target) throw new Error("User not found");
    assertAccessActionAllowed({ actor, target, action, ownerCount });
    const now = new Date();
    const updates = {
      approve: { accessStatus: "approved", approvedAt: now, approvedByUserId: actor.id, rejectedAt: null, suspendedAt: null },
      reject: { accessStatus: "rejected", rejectedAt: now, suspendedAt: null },
      suspend: { accessStatus: "suspended", suspendedAt: now },
      restore: { accessStatus: "approved", approvedAt: now, approvedByUserId: actor.id, rejectedAt: null, suspendedAt: null },
    } as const;
    return tx.user.update({ where: { id: target.id }, data: updates[action] });
  });
}

export async function changeUserRole(actor: AccessActor, targetId: string, nextRole: "user" | "admin") {
  return prisma.$transaction(async (tx) => {
    const [target, ownerCount] = await Promise.all([
      tx.user.findUnique({ where: { id: targetId } }),
      tx.user.count({ where: { role: "owner", accessStatus: "approved" } }),
    ]);
    if (!target) throw new Error("User not found");
    assertAccessActionAllowed({ actor, target, action: "change_role", nextRole, ownerCount });
    return tx.user.update({ where: { id: target.id }, data: { role: nextRole } });
  });
}

export const adminUserSelect = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  emailVerified: true,
  accessStatus: true,
  role: true,
  createdAt: true,
  lastLoginAt: true,
} as const;
