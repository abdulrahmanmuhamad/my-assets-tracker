export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailDeliveryResult = {
  provider: string;
  messageId?: string;
};

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}
