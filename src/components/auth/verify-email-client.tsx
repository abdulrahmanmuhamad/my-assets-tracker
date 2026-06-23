"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { CircleAlert, LoaderCircle } from "lucide-react";

export function VerifyEmailClient() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [error, setError] = useState("");
  const completing = useRef(false);
  const verification = signIn?.emailLink.verification || signUp?.verifications.emailLinkVerification;
  const verificationError = verification && verification.status !== "verified"
    ? verification.status === "client_mismatch"
      ? "Open this link in the same browser where you requested it."
      : "This verification link is invalid or expired."
    : "";

  useEffect(() => {
    if (completing.current) return;
    const signInVerification = signIn?.emailLink.verification;
    const signUpVerification = signUp?.verifications.emailLinkVerification;
    const currentVerification = signInVerification || signUpVerification;
    if (!currentVerification || currentVerification.status !== "verified") return;

    completing.current = true;
    const resource = signInVerification ? signIn : signUp;
    resource?.finalize().then(({ error: finalizeError }) => {
      if (finalizeError) throw finalizeError;
      window.location.assign("/pending-approval");
    }).catch((finalizeError) => {
      completing.current = false;
      setError(finalizeError instanceof Error ? finalizeError.message : "Email verification could not be completed.");
    });
  }, [signIn, signUp]);

  const displayedError = error || verificationError;
  return displayedError ? (
    <div className="text-center">
      <CircleAlert className="mx-auto h-10 w-10 text-rose-600" />
      <h2 className="mt-4 text-xl font-semibold">We could not verify this link</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{displayedError}</p>
      <Link className="mt-6 inline-flex text-sm font-semibold text-sky-700" href="/sign-in">Request a new link</Link>
    </div>
  ) : (
    <div className="text-center">
      <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-sky-600" />
      <h2 className="mt-4 text-xl font-semibold">Verifying your email</h2>
      <p className="mt-2 text-sm text-slate-600">Keep this page open for a moment.</p>
    </div>
  );
}
