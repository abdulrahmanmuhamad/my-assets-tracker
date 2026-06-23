import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncExternalUser } from "@/lib/user-sync";

export async function POST(request: NextRequest) {
  const signingSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!signingSecret) return Response.json({ error: "Clerk webhook is not configured" }, { status: 503 });

  try {
    const event = await verifyWebhook(request, { signingSecret });
    if (event.type === "user.deleted") {
      if (event.data.id) {
        await prisma.user.updateMany({
          where: { authProviderUserId: event.data.id },
          data: { accessStatus: "suspended", suspendedAt: new Date() },
        });
      }
      return Response.json({ received: true });
    }

    if (event.type === "user.created" || event.type === "user.updated") {
      const primary = event.data.email_addresses.find((email) => email.id === event.data.primary_email_address_id) || event.data.email_addresses[0];
      const emailVerified = primary?.verification?.status === "verified";
      const metadata = event.data.unsafe_metadata as Record<string, unknown>;
      await syncExternalUser({
        authProviderUserId: event.data.id,
        email: emailVerified ? primary?.email_address : undefined,
        emailVerified,
        phone: event.data.phone_numbers.find((phone) => phone.id === event.data.primary_phone_number_id)?.phone_number,
        name: [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || undefined,
        displayName: typeof metadata.displayName === "string" ? metadata.displayName : undefined,
        username: typeof metadata.username === "string" ? metadata.username : event.data.username,
        imageUrl: event.data.image_url,
      });
    }
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 });
  }
}
