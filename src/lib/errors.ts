/**
 * Custom Error Classes for structured, type-safe error handling.
 * Implements requirement 2.2: explicit error handling with typed error objects.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public readonly fields: Record<string, string>;

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message, "VALIDATION_ERROR", 400, true);
    this.fields = fields;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHENTICATED", 401, true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Permission denied") {
    super(message, "UNAUTHORIZED", 403, true);
  }
}

export class NotFoundError extends AppError {
  public readonly resource: string;

  constructor(resource: string, message?: string) {
    super(message || `${resource} not found`, "NOT_FOUND", 404, true);
    this.resource = resource;
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database operation failed") {
    // Database errors are generally programmer/system errors, not operational
    super(message, "DATABASE_ERROR", 500, false);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(message, "RATE_LIMIT_EXCEEDED", 429, true);
  }
}

export class CsrfError extends AppError {
  constructor(message = "Invalid or missing CSRF token") {
    super(message, "CSRF_ERROR", 403, true);
  }
}

/**
 * Type guard to check if an unknown error is an instance of AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Formats an AppError into a standard JSON response payload
 */
export function toErrorResponse(error: AppError) {
  const isProd = process.env.NODE_ENV === "production";
  
  // Clean message for non-operational or internal errors in production
  const message = (isProd && !error.isOperational)
    ? "An unexpected error occurred"
    : error.message;

  return {
    error: {
      code: error.code,
      message,
      ...(error instanceof ValidationError && { details: error.fields }),
    },
  };
}
