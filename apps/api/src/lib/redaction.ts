const sensitiveKeyPatterns = [
  /authorization/i,
  /cookie/i,
  /password/i,
  /secret/i,
  /token/i,
  /access[_-]?token/i,
  /public[_-]?token/i,
  /plaid/i,
  /client[_-]?secret/i,
  /api[_-]?key/i,
  /^key$/i,
  /encrypted/i,
  /accessTokenEncrypted/i,
  /^account[_-]?id$/i,
  /^email$/i,
];

const partialKeyPatterns = [/^mask$/i];

export function redactSensitive(input: unknown): unknown {
  return redactValue(input, new WeakSet<object>(), undefined);
}

function redactValue(
  input: unknown,
  seen: WeakSet<object>,
  key: string | undefined,
): unknown {
  if (key && sensitiveKeyPatterns.some((pattern) => pattern.test(key))) {
    return "[REDACTED]";
  }
  if (key && partialKeyPatterns.some((pattern) => pattern.test(key))) {
    return typeof input === "string" ? redactMask(input) : "[REDACTED]";
  }
  if (input === null || typeof input !== "object") {
    return input;
  }
  if (seen.has(input)) {
    return "[Circular]";
  }
  seen.add(input);
  if (input instanceof Error) {
    return {
      name: input.name,
      message: input.message,
      stack: process.env.NODE_ENV === "production" ? undefined : input.stack,
    };
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  const serializable = input as { toJSON?: () => unknown };
  if (typeof serializable.toJSON === "function") {
    try {
      return redactValue(serializable.toJSON(), seen, undefined);
    } catch {
      return "[Unserializable]";
    }
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactValue(item, seen, undefined));
  }

  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(
      ([entryKey, value]) => [entryKey, redactValue(value, seen, entryKey)],
    ),
  );
}

function redactMask(value: string): string {
  if (value.length <= 2) {
    return "[REDACTED]";
  }
  return `**${value.slice(-2)}`;
}
