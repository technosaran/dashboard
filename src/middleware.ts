import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ── Optimized & Secure User Check ────────────────────────
  // getUser() is the secure way to verify user auth in middleware
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't need auth
  const isPublicRoute = pathname === "/login" || pathname === "/";
  const isStaticAsset = pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".");

  if (isStaticAsset) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from login
  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // ── Dynamic CSP with Nonce ───────────────────────────────
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`, // unsafe-inline for Tailwind/CSS-in-JS if needed
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://logos.hunter.io https://companyenrich.com https://www.google.com https://icons.duckduckgo.com https://*.yahoo.com https://*.yahooapis.com https://logo.clearbit.com",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.yahoo.com https://*.yahooapis.com https://api.mfapi.in https://www.alphavantage.co`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; ");

  const response = supabaseResponse;
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("x-nonce", nonce);

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy — restrict dangerous APIs
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)"
  );
  // Strict Transport Security (force HTTPS)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  // Cross-Origin-Opener-Policy for stronger tab isolation
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg|manifest\\.json|icons/).*)"],
};
