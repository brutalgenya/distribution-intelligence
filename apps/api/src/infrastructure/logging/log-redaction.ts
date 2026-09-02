const SENSITIVE_KEY_PATTERN =
  /(authorization|password|secret|token|api[-_]?key|credential|signature|cookie|session|client[-_]?secret)/i;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_LENGTH = 25;

const truncateString = (value: string): string =>
  value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}...` : value;

const sanitizeError = (error: Error) => ({
  name: error.name,
  message: truncateString(error.message),
  ...(typeof (error as unknown as { code?: unknown }).code === "string"
    ? { code: (error as unknown as { code: string }).code }
    : {}),
});

export const sanitizeForLogging = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_LENGTH).map(sanitizeForLogging);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeForLogging(nestedValue),
      ]),
    );
  }

  return String(value);
};
