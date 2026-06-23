import { AuthFrame } from "@/components/auth/auth-frame";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";

export default function VerifyEmailPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <AuthFrame eyebrow="Identity verification" title="Completing your secure sign-in." description="The email verification is validated by Clerk. No password or third-party account credential is handled by this application.">
      {configured ? <VerifyEmailClient /> : (
        <div className="text-center"><h2 className="text-xl font-semibold">Clerk setup required</h2><p className="mt-3 text-sm leading-6 text-slate-600">Add Clerk development keys before using email verification.</p></div>
      )}
    </AuthFrame>
  );
}
