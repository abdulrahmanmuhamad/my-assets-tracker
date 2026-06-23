import { ConsoleEmailProvider } from "./console-provider";
import { ResendEmailProvider } from "./resend-provider";
import type { EmailMessage, EmailProvider } from "./types";

type EmailEnvironment = {
  RESEND_API_KEY?: string;
  ALERT_FROM_EMAIL?: string;
};

export function selectEmailProvider(environment: EmailEnvironment = process.env as EmailEnvironment): EmailProvider {
  if (environment.RESEND_API_KEY) {
    return new ResendEmailProvider(
      environment.RESEND_API_KEY,
      environment.ALERT_FROM_EMAIL || "Asset Alerts <alerts@example.com>",
    );
  }

  return new ConsoleEmailProvider();
}

export async function sendEmailNotification(message: EmailMessage) {
  return selectEmailProvider().send(message);
}
