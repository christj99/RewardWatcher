export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "REQUEST_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message, "BAD_REQUEST");
}

export function unauthorized(message: string): HttpError {
  return new HttpError(401, message, "UNAUTHORIZED");
}

export function forbidden(message: string): HttpError {
  return new HttpError(403, message, "FORBIDDEN");
}

export function entitlementRequired(entitlement: string): HttpError {
  return new HttpError(
    403,
    "This feature requires Premium.",
    "ENTITLEMENT_REQUIRED",
    {
      entitlement,
    },
  );
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message, "NOT_FOUND");
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message, "CONFLICT");
}

export function unprocessable(message: string): HttpError {
  return new HttpError(422, message, "UNPROCESSABLE_ENTITY");
}
