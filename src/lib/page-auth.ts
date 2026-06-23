import { redirect } from "next/navigation";
import { AuthenticationError, requireApprovedUser, requireAuthenticatedUser } from "./auth";

export async function requireApprovedPageUser() {
  try {
    return await requireApprovedUser();
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    if (error.code === "EMAIL_NOT_VERIFIED") redirect("/verify-email");
    if (error.code === "PENDING_OWNER_APPROVAL") redirect("/pending-approval");
    if (error.code === "ACCOUNT_DISABLED") redirect("/account-disabled");
    redirect("/sign-in");
  }
}

export async function requireAuthenticatedPageUser() {
  try {
    return await requireAuthenticatedUser();
  } catch (error) {
    if (!(error instanceof AuthenticationError)) throw error;
    redirect("/sign-in");
  }
}
