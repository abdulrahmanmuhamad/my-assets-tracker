import Link from "next/link";
import { AuthFrame } from "@/components/auth/auth-frame";
import { PasswordlessSignUp } from "@/components/auth/passwordless-sign-up";

export default function SignUpPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  return (
    <AuthFrame eyebrow="Controlled membership" title="A private account built around your assets." description="Every new account verifies its email and waits for an owner's approval before any portfolio feature or API becomes available.">
      {configured ? <PasswordlessSignUp /> : (
        <div className="text-center"><h2 className="text-xl font-semibold">Clerk setup required</h2><p className="mt-3 text-sm leading-6 text-slate-600">Add Clerk development keys and disable the local bypass to test account creation.</p><Link className="mt-6 inline-flex text-sm font-semibold text-sky-700" href="/sign-in">Back to sign in</Link></div>
      )}
    </AuthFrame>
  );
}
