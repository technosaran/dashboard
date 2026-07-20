import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth Client ID is not configured on the server" }, { status: 500 });
  }

  // Construct target redirect URI using NEXT_PUBLIC_SITE_URL
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
  const redirectUri = `${siteUrl}/api/auth/google/callback`;

  // Scopes requested (Gmail read-only to fetch transaction alerts)
  const scope = "https://www.googleapis.com/auth/gmail.readonly";

  const googleOAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleOAuthUrl.searchParams.append("client_id", clientId);
  googleOAuthUrl.searchParams.append("redirect_uri", redirectUri);
  googleOAuthUrl.searchParams.append("response_type", "code");
  googleOAuthUrl.searchParams.append("scope", scope);
  googleOAuthUrl.searchParams.append("access_type", "offline"); // Crucial to obtain a refresh token
  googleOAuthUrl.searchParams.append("prompt", "consent"); // Force consent to guarantee a new refresh token
  
  // CSRF Protection: Generate a state token and store it in a cookie
  const state = crypto.randomUUID();
  googleOAuthUrl.searchParams.append("state", state);

  const response = NextResponse.redirect(googleOAuthUrl.toString());
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}
