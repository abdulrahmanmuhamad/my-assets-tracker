import { redirect } from "next/navigation";
import { AccessStatusCard } from "@/components/auth/access-status-card";
import { AuthFrame } from "@/components/auth/auth-frame";
import { requireAuthenticatedPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function AccountDisabledPage() {
  const user = await requireAuthenticatedPageUser();
  if (user.accessStatus === "approved") redirect("/dashboard");
  if (user.accessStatus === "pending_owner_approval") redirect("/pending-approval");
  if (!user.emailVerified || user.accessStatus === "pending_email_verification") redirect("/verify-email");
  return <AuthFrame eyebrow="Account status" title="Portfolio access is currently unavailable." description="No private portfolio information is displayed on this page. An owner can restore eligible accounts from User Access settings."><AccessStatusCard user={user} disabled /></AuthFrame>;
}
