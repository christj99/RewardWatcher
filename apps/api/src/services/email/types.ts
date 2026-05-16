import type { EmailType, Prisma } from "@prisma/client";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string | undefined;
  idempotencyKey?: string | undefined;
  metadata?: Prisma.InputJsonValue | undefined;
};

export type EmailSendResult = {
  provider: string;
  providerMessageId?: string | undefined;
};

export type SendTransactionalEmailInput = SendEmailInput & {
  userId?: string | null | undefined;
  emailType: EmailType;
};
