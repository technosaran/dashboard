/**
 * Structured Security Event Logger.
 * Implements requirement 1.11: Structured security event logging (login, rate limit, validations).
 */

import { Logger } from "@/lib/logger";

const logger = new Logger({ module: "Security" });

export type SecurityEventType =
  | "auth_login_success"
  | "auth_login_failure"
  | "auth_logout"
  | "auth_token_refresh"
  | "auth_session_expired"
  | "authorization_failure"
  | "rate_limit_exceeded"
  | "csrf_validation_failure"
  | "input_validation_failure"
  | "suspicious_activity";

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export class SecurityLogger {
  /**
   * Logs a generic security event to the structured logger with appropriate category tags.
   */
  public static logEvent(event: Omit<SecurityEvent, "timestamp">): void {
    const timestamp = new Date().toISOString();
    const logPayload = {
      ...event,
      timestamp,
      category: "security",
    };

    // Determine log level based on severity
    if (
      event.type === "auth_login_failure" ||
      event.type === "authorization_failure" ||
      event.type === "rate_limit_exceeded" ||
      event.type === "csrf_validation_failure" ||
      event.type === "input_validation_failure" ||
      event.type === "suspicious_activity"
    ) {
      logger.warn(`[SECURITY] ${event.type}: ${JSON.stringify(event.details || {})}`, logPayload);
    } else {
      logger.info(`[SECURITY] ${event.type}`, logPayload);
    }
  }

  /**
   * Specifically logs authentication attempts (success/failures).
   */
  public static logAuthAttempt(
    success: boolean,
    userId?: string,
    details?: Record<string, unknown>
  ): void {
    this.logEvent({
      type: success ? "auth_login_success" : "auth_login_failure",
      userId,
      details,
    });
  }

  /**
   * Logs when rate limit is tripped by an IP address.
   */
  public static logRateLimitViolation(ip: string, path: string): void {
    this.logEvent({
      type: "rate_limit_exceeded",
      ip,
      path,
      details: { ip, path },
    });
  }

  /**
   * Logs validation failures (Zod, input parameters).
   */
  public static logValidationFailure(path: string, errors: Record<string, string>): void {
    this.logEvent({
      type: "input_validation_failure",
      path,
      details: { errors },
    });
  }
}
