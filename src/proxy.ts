import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RateLimiter, RATE_LIMIT_PRESETS } from "@/lib/rate-limiter";
import { csrfMiddleware } from "@/lib/csrf";
import { SecurityLogger } from "@/lib/security-logger";

const syncRateLimiter = new RateLimiter(RATE_LIMIT_PRESETS.sync);
const reportsRateLimiter = new RateLimiter(RATE_LIMIT_PRESETS.reports);
const authRateLimiter = new RateLimiter(RATE_LIMIT_PRESETS.auth);
const generalRateLimiter = new RateLimiter(RATE_LIMIT_PRESETS.general);

const PUBLIC_ROUTES = new Set(["/", "/login", "/reset-password", "/reset-password/update", "/privacy", "/terms"]);

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
  
  const cspHeaderParts = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://* https://assets.groww.in https://cdn.jsdelivr.net https://raw.githubusercontent.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://*.yahoo.com https://*.yahooapis.com https://api.mfapi.in https://www.alphavantage.co https://va.vercel-scripts.com",
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

function applySecurityHeaders(response: NextResponse, headers: ReturnType<typeof createSecurityHeaders>) {
  response.headers.set("Content-Security-Policy", headers.csp);
  response.headers.set("x-nonce", headers.nonce);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
  
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
  }
  
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
 * Next.js Proxy middleware for authentication and security headers
 */
export async function proxy(request: NextRequest) {
  const rawPathname = request.nextUrl.pathname;
  const pathname = rawPathname.length > 1 && rawPathname.endsWith("/") ? rawPathname.slice(0, -1) : rawPathname;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

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
    if (pathname.startsWith("/api/sync") || pathname.includes("-sync")) {
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
    rateLimitResult = await authRateLimiter.check(ip);
    if (!rateLimitResult.allowed) {
      SecurityLogger.logRateLimitViolation(ip, pathname);
      const res = NextResponse.redirect(new URL("/login?error=Too%20many%20login%20attempts", request.url), 303);
      res.headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
      res.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
      res.headers.set("X-RateLimit-Reset", rateLimitResult.resetAt.toISOString());
      return applySecurityHeaders(res, securityHeaders);
    }
  }

  // 2. CSRF Protection Check
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/accounts/") &&
    !pathname.startsWith("/api/bots/") &&
    !pathname.startsWith("/api/mcp") &&
    !pathname.startsWith("/api/bank-parser") &&
    !pathname.startsWith("/api/cas-parser") &&
    pathname !== "/api/transactions/telegram-sync" &&
    pathname !== "/api/transactions/sms-sync" &&
    pathname !== "/api/run-migration" &&
    !pathname.startsWith("/api/cron/")
  ) {
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

  const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30; // 30 days persistent session

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

          const updatedCookies = request.cookies
            .getAll()
            .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
            .join("; ");
          requestHeaders.set("cookie", updatedCookies);

          supabaseResponse = createPassThroughResponse(requestHeaders);
          
          cookiesToSet.forEach(({ name, value, options }) => {
            const isDeleting = value === "" || options?.maxAge === 0;
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: isDeleting ? 0 : (options?.maxAge ?? THIRTY_DAYS_IN_SECONDS),
              sameSite: options?.sameSite ?? "lax",
              path: options?.path ?? "/",
            });
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.has(pathname) || pathname.startsWith("/auth/") || pathname.startsWith("/api/auth/google") || pathname.startsWith("/api/bots/") || pathname === "/api/transactions/telegram-sync" || pathname === "/api/transactions/sms-sync" || pathname.startsWith("/api/cron/");

  let finalResponse: NextResponse;

  if (!user && !isPublicRoute) {
    if (pathname.startsWith("/api/")) {
      finalResponse = NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    } else {
      finalResponse = NextResponse.redirect(new URL("/login", request.url));
    }
  } else if (user && pathname === "/login") {
    finalResponse = NextResponse.redirect(new URL("/dashboard", request.url));
  } else {
    finalResponse = supabaseResponse;
  }


  if (finalResponse !== supabaseResponse) {
    supabaseResponse.cookies.getAll().forEach((cookie: { name: string; value: string; maxAge?: number }) => {
      const isDeleting = cookie.value === "" || cookie.maxAge === 0;
      finalResponse.cookies.set(cookie.name, cookie.value, {
        ...cookie,
        maxAge: isDeleting ? 0 : (cookie.maxAge ?? THIRTY_DAYS_IN_SECONDS),
        sameSite: "lax",
        path: "/",
      });
    });
  }

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

