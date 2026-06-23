import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { PasswordlessSignIn } from "@/components/auth/passwordless-sign-in";

export default function SignInPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <AuthFrame eyebrow="Private wealth workspace" title="Your portfolio, behind verified access." description="Sign in with a secure email link. Portfolio data remains isolated to your account and is never shared with application administrators.">
      {configured ? <PasswordlessSignIn /> : (
        <div className="text-center"><h2 className="text-xl font-semibold">Local development access</h2><p className="mt-3 text-sm leading-6 text-slate-600">Clerk keys are not configured. The explicit local bypass can open the development portfolio.</p><Link className="mt-6 inline-flex rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href="/">Open dashboard</Link></div>
      )}
    </AuthFrame>
  );
}
