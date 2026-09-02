export interface ApiErrorOptions {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  correlationId: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: unknown;
  public readonly correlationId: string;

  public constructor(options: ApiErrorOptions) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.correlationId = options.correlationId;
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;
