import { describe, it, expect } from "vitest";
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  isAppError,
  toErrorResponse,
} from "@/lib/errors";
import { ErrorHandler } from "@/lib/error-handler";

describe("Error Classes", () => {
  it("should create AppError correct properties", () => {
    const error = new AppError("Test message", "TEST_CODE", 400, true);
    expect(error.message).toBe("Test message");
    expect(error.code).toBe("TEST_CODE");
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.name).toBe("AppError");
  });

  it("should instantiate ValidationError correctly", () => {
    const fields = { email: "Invalid email format" };
    const error = new ValidationError("Validation failed", fields);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.fields).toEqual(fields);
    expect(error.isOperational).toBe(true);
  });

  it("should instantiate AuthenticationError correctly", () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHENTICATED");
  });

  it("should instantiate AuthorizationError correctly", () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("should instantiate NotFoundError correctly", () => {
    const error = new NotFoundError("Transaction");
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.resource).toBe("Transaction");
  });

  it("should instantiate DatabaseError correctly", () => {
    const error = new DatabaseError();
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("DATABASE_ERROR");
    expect(error.isOperational).toBe(false);
  });

  it("should detect AppError instances", () => {
    const appError = new AppError("Oops", "ERR", 500);
    const standardError = new Error("Standard error");
    expect(isAppError(appError)).toBe(true);
    expect(isAppError(standardError)).toBe(false);
    expect(isAppError("string")).toBe(false);
  });

  it("should format error response correctly in development/test", () => {
    const error = new ValidationError("Invalid field", { name: "Required" });
    const response = toErrorResponse(error);
    expect(response.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Invalid field",
      details: { name: "Required" },
    });
  });
});

describe("ErrorHandler Service", () => {
  const context = {
    requestId: "req-123",
    userId: "user-456",
    path: "/api/test",
    method: "POST",
  };

  it("should handle operational AppErrors", () => {
    const error = new NotFoundError("Account");
    const { response, statusCode } = ErrorHandler.handleError(error, context);
    
    expect(statusCode).toBe(404);
    expect(response.error.code).toBe("NOT_FOUND");
    expect(response.error.message).toBe("Account not found");
    expect(response.error.requestId).toBe("req-123");
  });

  it("should handle non-operational native errors as DatabaseError", () => {
    const nativeError = new Error("postgres query failed");
    const { response, statusCode } = ErrorHandler.handleError(nativeError, context);

    expect(statusCode).toBe(500);
    expect(response.error.code).toBe("DATABASE_ERROR");
  });

  it("should classify operational errors correctly", () => {
    const appErr = new NotFoundError("Item");
    const dbErr = new DatabaseError("Crash");
    const stdErr = new Error("General crash");

    expect(ErrorHandler.isOperationalError(appErr)).toBe(true);
    expect(ErrorHandler.isOperationalError(dbErr)).toBe(false);
    expect(ErrorHandler.isOperationalError(stdErr)).toBe(false);
  });
});
