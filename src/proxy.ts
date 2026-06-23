import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { canUseDevelopmentAuthBypass } from "@/lib/auth-policy";
import { disabledFeatureForApiPath, FEATURE_DISABLED_MESSAGE } from "@/lib/features";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/verify-email(.*)",
  "/api/auth/username-availability(.*)",
  "/api/webhooks(.*)",
  "/api/alerts/evaluate(.*)",
]);

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
const allowDevBypass = canUseDevelopmentAuthBypass({
  clerkConfigured,
  nodeEnv: process.env.NODE_ENV,
  npmLifecycleEvent: process.env.npm_lifecycle_event,
  allowDevAuthBypass: process.env.ALLOW_DEV_AUTH_BYPASS,
});

const protectedProxy = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (disabledFeatureForApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: "FEATURE_DISABLED", message: FEATURE_DISABLED_MESSAGE },
      { status: 503 },
    );
  }

  if (!clerkConfigured) {
    if (allowDevBypass) {
      return NextResponse.next();
    }

    return new NextResponse(
      "Authentication is not configured. Set valid Clerk keys; the development auth bypass is disabled.",
      { status: 503 },
    );
  }

  return protectedProxy(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
