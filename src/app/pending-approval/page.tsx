import { redirect } from "next/navigation";
import { AccessStatusCard } from "@/components/auth/access-status-card";
import { AuthFrame } from "@/components/auth/auth-frame";
import { requireAuthenticatedPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function PendingApprovalPage() {
  const user = await requireAuthenticatedPageUser();
  if (!user.emailVerified || user.accessStatus === "pending_email_verification") redirect("/verify-email");
  if (user.accessStatus === "approved") redirect("/");
  if (user.accessStatus === "rejected" || user.accessStatus === "suspended") redirect("/account-disabled");
  return <AuthFrame eyebrow="Access review" title="Identity verified. Access is the next step." description="Approval controls who may use the application while keeping each person’s portfolio data strictly isolated."><AccessStatusCard user={user} /></AuthFrame>;
}
