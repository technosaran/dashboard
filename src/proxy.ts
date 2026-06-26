import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = new Set(["/", "/login", "/reset-password", "/reset-password/update"]);

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

function createSecurityHeaders(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const cspHeaderParts = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://logos.hunter.io https://companyenrich.com https://www.google.com https://icons.duckduckgo.com https://*.yahoo.com https://*.yahooapis.com https://logo.clearbit.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.yahoo.com https://*.yahooapis.com https://api.mfapi.in https://www.alphavantage.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
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
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  return response;
}

function createPassThroughResponse(requestHeaders: Headers) {
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const securityHeaders = createSecurityHeaders(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", securityHeaders.csp);

  let supabaseResponse = createPassThroughResponse(requestHeaders);

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.has(pathname) || pathname.startsWith("/auth/");

  if (!user && !isPublicRoute) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), securityHeaders);
  }

  if (user && pathname === "/login") {
    return applySecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)), securityHeaders);
  }

  return applySecurityHeaders(supabaseResponse, securityHeaders);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg|manifest\\.webmanifest|manifest\\.json|icons/).*)"],
};
