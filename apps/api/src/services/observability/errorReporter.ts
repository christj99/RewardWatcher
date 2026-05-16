import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { redactSensitive } from "../../lib/redaction.js";

export type ErrorReporterContext = Record<string, unknown>;

export type ErrorReporter = {
  captureException(error: unknown, context?: ErrorReporterContext): void;
  captureMessage(message: string, context?: ErrorReporterContext): void;
};

class NoopErrorReporter implements ErrorReporter {
  captureException(): void {
    // Intentionally empty.
  }

  captureMessage(): void {
    // Intentionally empty.
  }
}

class SentryLikeErrorReporter implements ErrorReporter {
  captureException(error: unknown, context?: ErrorReporterContext): void {
    logger.error("Captured exception for external error reporting", {
      provider: "sentry",
      dsnConfigured: true,
      error,
      context: redactSensitive(context ?? {}),
    });
  }

  captureMessage(message: string, context?: ErrorReporterContext): void {
    logger.warn("Captured message for external error reporting", {
      provider: "sentry",
      dsnConfigured: true,
      message,
      context: redactSensitive(context ?? {}),
    });
  }
}

let reporterForTesting: ErrorReporter | null = null;

export function getErrorReporter(): ErrorReporter {
  if (reporterForTesting) {
    return reporterForTesting;
  }
  if (env.NODE_ENV === "test" || !env.SENTRY_DSN) {
    return new NoopErrorReporter();
  }
  return new SentryLikeErrorReporter();
}

export function setErrorReporterForTesting(
  reporter: ErrorReporter | null,
): void {
  reporterForTesting = reporter;
}

export function captureException(
  error: unknown,
  context?: ErrorReporterContext,
): void {
  getErrorReporter().captureException(
    error,
    redactSensitive(context ?? {}) as ErrorReporterContext,
  );
}

export function captureMessage(
  message: string,
  context?: ErrorReporterContext,
): void {
  getErrorReporter().captureMessage(
    message,
    redactSensitive(context ?? {}) as ErrorReporterContext,
  );
}
