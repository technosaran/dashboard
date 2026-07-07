/**
 * CSRF (Cross-Site Request Forgery) Protection Utilities
 * 
 * Implements double-submit cookie pattern for CSRF protection:
 * 1. Server generates a cryptographically secure random token
 * 2. Token is stored in an httpOnly cookie
 * 3. Client includes the token in requests (header or form field)
 * 4. Server validates that cookie and request token match
 */

import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const CSRF_TOKEN_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

/**
 * Generates a cryptographically secure random CSRF token
 */
export function generateCsrfToken(): string {
  // Use Web Crypto API for secure random generation
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Sets CSRF token in an httpOnly cookie
 * Should be called on page load for protected routes
 */
export async function setCsrfToken(token?: string): Promise<string> {
  const csrfToken = token || generateCsrfToken();
  const cookieStore = await cookies();
  
  cookieStore.set(CSRF_TOKEN_NAME, csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CSRF_COOKIE_MAX_AGE,
    path: "/",
  });

  return csrfToken;
}

/**
 * Retrieves the CSRF token from cookies
 */
export async function getCsrfToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_TOKEN_NAME)?.value;
}

/**
 * Validates CSRF token from request against cookie
 * Used in API routes and server actions
 */
export async function validateCsrfToken(requestToken: string | null | undefined): Promise<boolean> {
  if (!requestToken) {
    return false;
  }

  const cookieToken = await getCsrfToken();
  
  if (!cookieToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return timingSafeEqual(requestToken, cookieToken);
}

/**
 * Middleware to validate CSRF tokens for state-changing HTTP methods
 * Should be used in middleware.ts for API routes
 */
export async function csrfMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const method = request.method;
  
  // Only validate state-changing methods
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return null;
  }

  // Skip CSRF check for API routes that use other auth mechanisms
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/sync")) {
    // Sync endpoint uses Bearer token authentication
    return null;
  }

  // Get token from header or form data
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  
  // For form submissions, check the request body
  let formToken: string | null = null;
  if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
    try {
      const formData = await request.formData();
      formToken = formData.get("csrf_token") as string | null;
    } catch {
      // If we can't parse form data, continue with header token only
    }
  }

  const requestToken = headerToken || formToken;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_TOKEN_NAME)?.value;

  if (!cookieToken || !requestToken || !timingSafeEqual(requestToken, cookieToken)) {
    return NextResponse.json(
      { error: "Invalid or missing CSRF token" },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Validates CSRF token for server actions
 * Server actions should call this function before processing mutations
 */
export async function validateServerActionCsrf(
  csrfToken: string | undefined
): Promise<{ valid: boolean; error?: string }> {
  if (!csrfToken) {
    return { valid: false, error: "CSRF token is required" };
  }

  const isValid = await validateCsrfToken(csrfToken);
  
  if (!isValid) {
    return { valid: false, error: "Invalid CSRF token" };
  }

  return { valid: true };
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Server component helper to get CSRF token for forms
 * Usage in server components:
 * 
 * const csrfToken = await getCsrfTokenForForm();
 * return <form><input type="hidden" name="csrf_token" value={csrfToken} />...</form>
 */
export async function getCsrfTokenForForm(): Promise<string> {
  let token = await getCsrfToken();
  
  // If no token exists, create one
  if (!token) {
    token = await setCsrfToken();
  }

  return token;
}

/**
 * Client-side utility to get CSRF token from meta tag or cookie
 * This should be used in client components to include token in fetch requests
 */
export function getClientCsrfToken(): string | null {
  // Try to get from meta tag first
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag) {
    return metaTag.getAttribute("content");
  }

  // Fallback: parse from cookies (for non-httpOnly scenario)
  // Note: In production, tokens should be httpOnly, so this is a fallback
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === CSRF_TOKEN_NAME) {
      return value;
    }
  }

  return null;
}
