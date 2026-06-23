import type { EmailMessage, EmailProvider } from "./types";

export class ResendEmailProvider implements EmailProvider {
  name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
  ) {}

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      throw new Error(payload.message || `Resend request failed with ${response.status}`);
    }

    return { provider: this.name, messageId: payload.id };
  }
}
