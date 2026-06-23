"use client";

import { useState } from "react";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { usernameSchema } from "@/lib/user-access";

function clerkErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") return error.message;
  return error instanceof Error ? error.message : "Unable to create account";
}

export function PasswordlessSignUp() {
  const { signUp, fetchStatus } = useSignUp();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const usernameResult = usernameSchema.safeParse(username);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!signUp) return;
    setError("");
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Enter a valid username");
      return;
    }

    setPending(true);
    try {
      const availability = await fetch("/api/auth/username-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: parsed.data }),
      });
      const availabilityData = await availability.json();
      if (!availability.ok || !availabilityData.available) throw new Error(availabilityData.error || "That username is already in use");

      const createResult = await signUp.create({ emailAddress: email.trim().toLowerCase(), unsafeMetadata: { username: parsed.data } });
      if (createResult.error) throw createResult.error;
      const sendResult = await signUp.verifications.sendEmailCode();
      if (sendResult.error) throw sendResult.error;
      setSent(true);
    } catch (submitError) {
      setError(clerkErrorMessage(submitError));
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!signUp) return;
    setPending(true);
    setError("");
    try {
      const result = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (result.error) throw result.error;
      const finalizeResult = await signUp.finalize();
      if (finalizeResult.error) throw finalizeResult.error;
      router.push("/");
      router.refresh();
    } catch (verifyError) {
      setError(clerkErrorMessage(verifyError));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Mail className="h-5 w-5" />
        </span>
        <h2 className="mt-5 text-center text-xl font-semibold">Enter your verification code</h2>
        <p className="mt-2 text-center text-sm leading-6 text-slate-600">
          We sent a secure verification code to <strong>{email}</strong>.
        </p>
        <form className="mt-7 space-y-5" onSubmit={verifyCode}>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Verification code
            <input
              className="h-11 rounded-md border border-slate-300 px-3 text-center text-lg font-semibold tracking-[0.2em] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              placeholder="123456"
            />
          </label>
          {error ? <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50" disabled={!signUp || pending || fetchStatus === "fetching"} type="submit">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {pending ? "Verifying..." : "Verify email"}
          </button>
        </form>
        <button type="button" className="mx-auto mt-6 block text-sm font-semibold text-sky-700 hover:text-sky-900" onClick={() => { setSent(false); setCode(""); setError(""); }}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-semibold">Create your private portfolio account</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Enter a username and email. We will send a secure verification code before your account can be reviewed for access.</p>
      <form className="mt-7 space-y-5" onSubmit={submit}>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Username
          <input className="h-11 rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required minLength={3} maxLength={30} placeholder="portfolio_owner" />
          <span className={username ? (usernameResult.success ? "flex items-center gap-1 text-xs font-normal text-emerald-700" : "text-xs font-normal text-rose-600") : "text-xs font-normal text-slate-500"}>
            {username && usernameResult.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
            {username ? (usernameResult.success ? "Username format looks good" : usernameResult.error.issues[0]?.message) : "3-30 characters: letters, numbers, underscores, or hyphens"}
          </span>
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Email
          <input className="h-11 rounded-md border border-slate-300 px-3 font-normal outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="you@example.com" />
        </label>
        {error ? <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        <button className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50" disabled={!signUp || pending || fetchStatus === "fetching"} type="submit">
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {pending ? "Sending code..." : "Send verification code"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have access? <Link className="font-semibold text-sky-700 hover:text-sky-900" href="/sign-in">Sign in</Link>
      </p>
    </>
  );
}
