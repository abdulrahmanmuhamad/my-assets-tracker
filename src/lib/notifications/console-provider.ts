import type { EmailMessage, EmailProvider } from "./types";

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return "invalid-recipient";
  return `${local.slice(0, 2)}***@${domain}`;
}

export class ConsoleEmailProvider implements EmailProvider {
  name = "console_dev";

  async send(message: EmailMessage) {
    console.info("[alert-email:console]", {
      to: maskEmail(message.to),
      subject: message.subject,
      preview: message.text.slice(0, 240),
    });
    return { provider: this.name, messageId: `console-${Date.now()}` };
  }
}
