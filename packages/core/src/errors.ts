/**
 * Typed application errors.
 *
 * Every error the API can return deliberately maps to one of these. Route
 * handlers throw, and a single error boundary turns the code into a status and
 * a safe message. Anything not modelled here surfaces as a 500 with no internal
 * detail, because an unexpected error leaking a stack trace to a customer is
 * an information leak, not a helpful error.
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INVALID_STATE"
  | "PAYMENT_FAILED"
  | "PAYMENT_NOT_VERIFIED"
  | "UPLOAD_REJECTED"
  | "NOT_IMPLEMENTED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INVALID_STATE: 409,
  PAYMENT_FAILED: 402,
  PAYMENT_NOT_VERIFIED: 409,
  UPLOAD_REJECTED: 415,
  NOT_IMPLEMENTED: 501,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Field-level detail for VALIDATION_FAILED. Never contains internals. */
  readonly details?: unknown;
  /** Correlation id echoed in the response and written to the log. */
  readonly correlationId?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: unknown; correlationId?: string; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = options?.details;
    this.correlationId = options?.correlationId;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details !== undefined ? { details: this.details } : {}),
        ...(this.correlationId ? { correlationId: this.correlationId } : {}),
      },
    };
  }
}

export const unauthenticated = (message = "Please sign in to continue.") =>
  new AppError("UNAUTHENTICATED", message);

export const forbidden = (message = "You do not have access to this resource.") =>
  new AppError("FORBIDDEN", message);

export const notFound = (what = "Resource") =>
  new AppError("NOT_FOUND", `${what} was not found.`);

export const conflict = (message: string) => new AppError("CONFLICT", message);

export const invalidState = (message: string) => new AppError("INVALID_STATE", message);

export const validationFailed = (details: unknown, message = "Please check the form and try again.") =>
  new AppError("VALIDATION_FAILED", message, { details });

export const rateLimited = (message = "Too many requests. Please wait a moment.") =>
  new AppError("RATE_LIMITED", message);

export const paymentNotVerified = (
  message = "Payment has not been verified by the gateway.",
) => new AppError("PAYMENT_NOT_VERIFIED", message);

export const internal = (message = "Something went wrong. Please try again.") =>
  new AppError("INTERNAL", message);

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
