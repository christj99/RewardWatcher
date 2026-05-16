import { env } from "../../config/env.js";
import { badRequest } from "../../lib/httpErrors.js";
import { redactSensitive } from "../../lib/redaction.js";
import type { EmailSendResult, SendEmailInput } from "./types.js";

export interface EmailProvider {
  readonly name: string;
  sendEmail(input: SendEmailInput): Promise<EmailSendResult>;
}

const consoleSentEmails: SendEmailInput[] = [];

export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    consoleSentEmails.push(input);
    console.info("Console email", {
      to: redactEmail(input.to),
      subject: input.subject,
      idempotencyKey: input.idempotencyKey,
      metadata: redactSensitive(input.metadata),
    });
    return {
      provider: this.name,
      providerMessageId: `console-${consoleSentEmails.length}`,
    };
  }
}

export class PostmarkEmailProvider implements EmailProvider {
  readonly name = "postmark";

  async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    if (!env.POSTMARK_SERVER_TOKEN) {
      throw badRequest("POSTMARK_SERVER_TOKEN is required for Postmark email.");
    }

    const response = await fetch("https://api.postmarkapp.com/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Postmark-Server-Token": env.POSTMARK_SERVER_TOKEN,
      },
      body: JSON.stringify({
        From: env.EMAIL_FROM,
        To: input.to,
        ReplyTo: env.EMAIL_REPLY_TO,
        Subject: input.subject,
        TextBody: input.text,
        HtmlBody: input.html,
        MessageStream: "outbound",
        Metadata: {
          idempotencyKey: input.idempotencyKey,
        },
      }),
    });

    const body = (await response.json().catch(() => ({}))) as {
      MessageID?: string;
      Message?: string;
    };
    if (!response.ok) {
      throw badRequest(body.Message ?? "Postmark email send failed.");
    }
    return {
      provider: this.name,
      providerMessageId: body.MessageID,
    };
  }
}

export function getEmailProvider(): EmailProvider {
  return env.EMAIL_PROVIDER === "postmark"
    ? new PostmarkEmailProvider()
    : new ConsoleEmailProvider();
}

export function getConsoleSentEmails(): SendEmailInput[] {
  return [...consoleSentEmails];
}

export function clearConsoleSentEmails(): void {
  consoleSentEmails.length = 0;
}

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[REDACTED]";
  return `${local[0] ?? "*"}***@${domain}`;
}
