import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RateLimiter, RATE_LIMIT_PRESETS } from "@/lib/rate-limiter";
import { csrfMiddleware } from "@/lib/csrf";
import { SecurityLogger } from "@/lib/security-logger";

const syncRateLimiter = new RateLimiter(RATE_LIMIT_PRESETS.sync);
const reportsRateLimiter = new RateLimiter(RATE_LIMIT_PRESETS.reports);
const authRateLimiter = new RateLimiter(RATE_LIMIT_PRESETS.auth);
const generalRateLimiter = new RateLimiter(RATE_LIMIT_PRESETS.general);

const PUBLIC_ROUTES = new Set(["/", "/login", "/reset-password", "/reset-password/update"]);

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

/**
 * Creates comprehensive security headers including CSP with nonce
 * Implements OWASP best practices for web application security
 */
function createSecurityHeaders(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  
  // Content Security Policy - Prevents XSS attacks
  const cspHeaderParts = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://logos.hunter.io https://companyenrich.com https://www.google.com https://icons.duckduckgo.com https://*.yahoo.com https://*.yahooapis.com https://logo.clearbit.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.yahoo.com https://*.yahooapis.com https://api.mfapi.in https://www.alphavantage.co https://va.vercel-scripts.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  if (!isDev) {
    cspHeaderParts.push("upgrade-insecure-requests");
  }

  return {
    csp: cspHeaderParts.join("; "),
    nonce,
  };
}

/**
 * Applies comprehensive security headers to the response
 * Headers follow OWASP security best practices and meet requirements 1.7 and 1.12
 */
function applySecurityHeaders(response: NextResponse, headers: ReturnType<typeof createSecurityHeaders>) {
  // Content Security Policy - Prevents XSS, injection attacks
  response.headers.set("Content-Security-Policy", headers.csp);
  response.headers.set("x-nonce", headers.nonce);
  
  // X-Frame-Options - Prevents clickjacking attacks
  response.headers.set("X-Frame-Options", "DENY");
  
  // X-Content-Type-Options - Prevents MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  
  // X-XSS-Protection - Legacy XSS protection (for older browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");
  
  // Strict-Transport-Security - Enforces HTTPS
  // max-age=31536000 (1 year), includeSubDomains, preload eligible
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  
  // Referrer-Policy - Controls referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions-Policy - Restricts browser features
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self), usb=(), magnetometer=(), gyroscope=(), accelerometer=()");
  
  // Cross-Origin-Opener-Policy - Prevents cross-origin attacks
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  
  // Cross-Origin-Resource-Policy - Restricts resource loading
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  
  // Cross-Origin-Embedder-Policy - Prevents cross-origin resource embedding
  response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  
  return response;
}

function createPassThroughResponse(requestHeaders: Headers) {
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Next.js proxy middleware for authentication and security headers
 * - Handles Supabase authentication
 * - Applies comprehensive security headers
 * - Manages route protection
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip proxy for static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Generate nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const securityHeaders = createSecurityHeaders(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", securityHeaders.csp);

  // 1. Rate Limiting Check
  const ip = (request as any).ip || request.headers.get("x-forwarded-for") || "anonymous";
  let rateLimitResult = null;

  if (pathname.startsWith("/api/")) {
    let limiter = generalRateLimiter;
    if (pathname.startsWith("/api/sync")) {
      limiter = syncRateLimiter;
    } else if (pathname.startsWith("/api/reports")) {
      limiter = reportsRateLimiter;
    }
    
    rateLimitResult = await limiter.check(ip);
    if (!rateLimitResult.allowed) {
      SecurityLogger.logRateLimitViolation(ip, pathname);
      const res = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
      res.headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
      res.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
      res.headers.set("X-RateLimit-Reset", rateLimitResult.resetAt.toISOString());
      res.headers.set("Retry-After", Math.ceil(limiter["windowMs"] / 1000).toString());
      return applySecurityHeaders(res, securityHeaders);
    }
  } else if ((pathname.startsWith("/login") || pathname.startsWith("/reset-password")) && request.method === "POST") {
    const rateLimitResult = await authRateLimiter.check(ip);
    if (!rateLimitResult.allowed) {
      SecurityLogger.logRateLimitViolation(ip, pathname);
      const res = NextResponse.redirect(new URL("/login?error=Too%20many%20login%20attempts", request.url));
      res.headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
      res.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
      res.headers.set("X-RateLimit-Reset", rateLimitResult.resetAt.toISOString());
      return applySecurityHeaders(res, securityHeaders);
    }
  }

  // 2. CSRF Protection Check
  if (pathname.startsWith("/api/")) {
    const csrfResponse = await csrfMiddleware(request);
    if (csrfResponse) {
      SecurityLogger.logEvent({
        type: "csrf_validation_failure",
        ip,
        path: pathname,
        details: { ip, method: request.method },
      });
      return applySecurityHeaders(csrfResponse, securityHeaders);
    }
  }

  let supabaseResponse = createPassThroughResponse(requestHeaders);

  // Initialize Supabase client for authentication
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = createPassThroughResponse(requestHeaders);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check authentication status
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.has(pathname) || pathname.startsWith("/auth/") || pathname === "/api/transactions/telegram-sync" || pathname === "/api/run-migration";

  let finalResponse: NextResponse;

  // Redirect to login if not authenticated
  if (!user && !isPublicRoute) {
    finalResponse = NextResponse.redirect(new URL("/login", request.url));
  } else if (user && pathname === "/login") {
    // Redirect to dashboard if authenticated user tries to access login
    finalResponse = NextResponse.redirect(new URL("/dashboard", request.url));
  } else {
    finalResponse = supabaseResponse;
  }

  // Attach Rate Limit headers to successful API response
  if (rateLimitResult && finalResponse) {
    finalResponse.headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
    finalResponse.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
    finalResponse.headers.set("X-RateLimit-Reset", rateLimitResult.resetAt.toISOString());
  }

  return applySecurityHeaders(finalResponse, securityHeaders);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg|manifest\\.webmanifest|manifest\\.json|icons/).*)"],
};
