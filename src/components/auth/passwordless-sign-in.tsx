"use client";

import { useState } from "react";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs";
import { ArrowRight, LoaderCircle, Mail, ShieldCheck } from "lucide-react";

function clerkErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return error instanceof Error ? error.message : "Unable to sign in";
}

export function PasswordlessSignIn() {
  const { signIn, fetchStatus } = useSignIn();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!signIn) return;
    setPending(true);
    setError("");
    try {
      const result = await signIn.emailLink.sendLink({
        emailAddress: email.trim().toLowerCase(),
        verificationUrl: `${window.location.origin}/verify-email`,
      });
      if (result.error) throw result.error;
      setSent(true);
    } catch (submitError) {
      setError(clerkErrorMessage(submitError));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-700"><Mail className="h-5 w-5" /></span>
        <h2 className="mt-5 text-xl font-semibold">Your secure link is on the way</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Check <strong>{email}</strong> and open the sign-in link on this device.</p>
        <button type="button" className="mt-6 text-sm font-semibold text-sky-700 hover:text-sky-900" onClick={() => setSent(false)}>Use a different email</button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-semibold">Welcome back</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">We’ll send a secure verification link or code to your email.</p>
      <form className="mt-7 space-y-5" onSubmit={submit}>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Email
          <input className="h-11 rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com" />
        </label>
        {error ? <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50" disabled={!signIn || pending || fetchStatus === "fetching"} type="submit">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {pending ? "Sending link…" : "Send sign-in link"}
        </button>
      </form>
      <div className="mt-5 flex items-start gap-2 rounded-md bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />No password required. Your account is protected by verified email and optional MFA.</div>
      <p className="mt-6 text-center text-sm text-slate-500">Need an account? <Link className="font-semibold text-sky-700 hover:text-sky-900" href="/sign-up">Request access</Link></p>
    </>
  );
}
