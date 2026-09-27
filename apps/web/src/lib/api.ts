import { NextResponse } from "next/server";

import { AppError } from "@fixbondhu/core";

/**
 * Uniform JSON responses for API routes.
 *
 * Every failure leaves through handleApiError so that a client can rely on one
 * shape, and so an unexpected exception becomes a generic 500 rather than a
 * stack trace. Unexpected errors are logged server-side with their cause and
 * returned to the client without detail.
 */

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export async function handleApiError(
  error: unknown,
  context: string,
): Promise<NextResponse> {
  if (error instanceof AppError) {
    return fail(error.code, error.message, error.status, error.details);
  }

  // A Prisma unique violation is a legitimate conflict, not a crash. Surfacing
  // it as a 500 would tell a user their account "broke" when the real answer is
  // that the number is taken.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  ) {
    return fail("CONFLICT", "That mobile number is already registered.", 409);
  }

  console.error(`[api] ${context} failed:`, error);
  return fail(
    "INTERNAL",
    "Something went wrong. Please try again.",
    500,
  );
}
