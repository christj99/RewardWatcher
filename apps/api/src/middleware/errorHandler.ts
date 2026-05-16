import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { HttpError } from "../lib/httpErrors.js";
import { logger } from "../lib/logger.js";
import { captureException } from "../services/observability/errorReporter.js";

type ErrorResponse = {
  error: {
    message: string;
    code: string;
    requestId?: string;
    details?: unknown;
  };
};

export function registerErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    if (error instanceof ZodError) {
      const response: ErrorResponse = {
        error: {
          message: "Invalid request data",
          code: "VALIDATION_ERROR",
          requestId,
        },
      };

      void reply.status(400).send(response);
      return;
    }

    if (error instanceof HttpError) {
      const response: ErrorResponse = {
        error: {
          message: error.message,
          code: error.code,
          requestId,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      };

      void reply.status(error.statusCode).send(response);
      return;
    }

    const statusCode =
      error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (statusCode >= 500) {
      captureException(error, {
        requestId,
        method: request.method,
        url: request.url,
        headers: request.headers,
      });
      logger.error("Unhandled request error", {
        requestId,
        error,
        method: request.method,
        url: request.url,
        headers: request.headers,
      });
    }
    const isProduction = process.env.NODE_ENV === "production";
    const response: ErrorResponse = {
      error: {
        message:
          statusCode === 500 || isProduction
            ? statusCode === 500
              ? "Internal server error"
              : "Request failed"
            : error.message,
        code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR",
        requestId,
      },
    };

    void reply.status(statusCode).send(response);
  });
}
