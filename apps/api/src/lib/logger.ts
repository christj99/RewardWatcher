import { redactSensitive } from "./redaction.js";

type LogMetadata = unknown;

export const logger = {
  info(message: string, metadata?: LogMetadata): void {
    if (metadata === undefined) {
      console.info(message);
      return;
    }

    console.info(message, redactSensitive(metadata));
  },

  warn(message: string, metadata?: LogMetadata): void {
    if (metadata === undefined) {
      console.warn(message);
      return;
    }

    console.warn(message, redactSensitive(metadata));
  },

  error(message: string, metadata?: LogMetadata): void {
    if (metadata === undefined) {
      console.error(message);
      return;
    }

    console.error(message, redactSensitive(metadata));
  },
};
