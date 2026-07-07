/**
 * Global Error Handler Service.
 * Implements requirement 2.2 and 2.4: consistent error handling and operational vs programmer errors distinction.
 */

import { Logger } from "@/lib/logger";
import { AppError, DatabaseError, toErrorResponse } from "./errors";

const logger = new Logger({ module: "ErrorHandler" });

export interface RequestContext {
  requestId: string;
  userId?: string;
  path: string;
  method: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
    requestId?: string;
  };
}

export class ErrorHandler {
  /**
   * Processes an unknown error, logs it appropriately, and formats a client response.
   */
  public static handleError(
    error: unknown,
    context: RequestContext
  ): { response: ErrorResponse; statusCode: number } {
    let appError: AppError;

    if (error instanceof AppError) {
      appError = error;
    } else if (error instanceof Error) {
      // Map native JS/ORM/Database errors
      if (
        error.message.includes("postgres") ||
        error.message.includes("db") ||
        error.message.includes("drizzle") ||
        error.message.includes("relation") ||
        error.message.includes("connection")
      ) {
        appError = new DatabaseError(error.message);
      } else {
        appError = new AppError(error.message, "INTERNAL_ERROR", 500, false);
      }
      // Attach the original stack to the new error
      appError.stack = error.stack;
    } else {
      appError = new AppError(
        typeof error === "string" ? error : "An unexpected error occurred",
        "INTERNAL_ERROR",
        500,
        false
      );
    }

    // Log the error
    const logPayload = {
      requestId: context.requestId,
      userId: context.userId,
      path: context.path,
      method: context.method,
      statusCode: appError.statusCode,
      code: appError.code,
      err: appError,
    };

    if (appError.isOperational) {
      logger.warn(appError.message, logPayload);
    } else {
      logger.error(`[CRITICAL] Non-operational error: ${appError.message}`, logPayload);
    }

    // Format final client payload
    const formatted = toErrorResponse(appError) as ErrorResponse;
    // Add request ID for tracking
    formatted.error.requestId = context.requestId;

    return {
      response: formatted,
      statusCode: appError.statusCode,
    };
  }

  /**
   * Helper to check if a thrown error is an operational (expected) error
   */
  public static isOperationalError(error: unknown): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }
}
