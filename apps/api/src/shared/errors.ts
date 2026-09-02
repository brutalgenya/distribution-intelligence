export type ApplicationErrorCategory =
  | "validation"
  | "authorization"
  | "not_found"
  | "conflict"
  | "retryable_external"
  | "external"
  | "internal";

export class ApplicationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly category: ApplicationErrorCategory;
  public readonly retryable: boolean;
  public readonly details?: unknown;

  public constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
    options?: { category?: ApplicationErrorCategory; retryable?: boolean },
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.category = options?.category ?? "internal";
    this.retryable = options?.retryable ?? false;
    this.details = details;
  }
}

export class BadRequestError extends ApplicationError {
  public constructor(message: string, details?: unknown) {
    super(400, "bad_request", message, details, {
      category: "validation",
    });
  }
}

export class UnauthorizedError extends ApplicationError {
  public constructor(message = "Authentication is required.") {
    super(401, "unauthorized", message, undefined, {
      category: "authorization",
    });
  }
}

export class ForbiddenError extends ApplicationError {
  public constructor(message = "You do not have permission to perform this action.") {
    super(403, "forbidden", message, undefined, {
      category: "authorization",
    });
  }
}

export class NotFoundError extends ApplicationError {
  public constructor(message: string) {
    super(404, "not_found", message, undefined, {
      category: "not_found",
    });
  }
}

export class ConflictError extends ApplicationError {
  public constructor(message: string, details?: unknown) {
    super(409, "conflict", message, details, {
      category: "conflict",
    });
  }
}

export class EntitlementLimitExceededError extends ApplicationError {
  public constructor(message: string, details?: unknown) {
    super(402, "billing_limit_exceeded", message, details, {
      category: "conflict",
    });
  }
}

export class PayloadTooLargeError extends ApplicationError {
  public constructor(message = "Request payload exceeds the configured limit.", details?: unknown) {
    super(413, "payload_too_large", message, details, {
      category: "validation",
    });
  }
}

export class TooManyRequestsError extends ApplicationError {
  public constructor(message = "Rate limit exceeded.", details?: unknown) {
    super(429, "rate_limit_exceeded", message, details, {
      category: "conflict",
      retryable: true,
    });
  }
}

export class RetryableExternalError extends ApplicationError {
  public constructor(message: string, details?: unknown) {
    super(503, "retryable_external_error", message, details, {
      category: "retryable_external",
      retryable: true,
    });
  }
}

export class ExternalDependencyError extends ApplicationError {
  public constructor(message: string, details?: unknown) {
    super(502, "external_dependency_error", message, details, {
      category: "external",
    });
  }
}

export class InternalServerError extends ApplicationError {
  public constructor(message = "An unexpected error occurred.", details?: unknown) {
    super(500, "internal_server_error", message, details, {
      category: "internal",
    });
  }
}
