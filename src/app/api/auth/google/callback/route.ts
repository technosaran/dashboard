import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=" + encodeURIComponent(errorParam), req.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=no_code", req.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=missing_server_credentials", req.url));
    }

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin).replace(/\/$/, "");
    const redirectUri = `${siteUrl}/api/auth/google/callback`;

    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.refresh_token) {
      console.error("Google token exchange failed:", tokenData);
      return NextResponse.redirect(
        new URL("/dashboard/settings?gmail=error&reason=" + encodeURIComponent(tokenData.error_description || tokenData.error || "token_exchange_failed"), req.url)
      );
    }

    const refreshToken = tokenData.refresh_token;

    // 2. Fetch authenticated Supabase client using request cookies
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=unauthenticated", req.url));
    }

    // 3. Save the refresh token to the database
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ gmail_refresh_token: refreshToken })
      .eq("id", user.id);

    if (dbError) {
      console.error("Failed to save Gmail refresh token:", dbError);
      return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=db_write_failed", req.url));
    }

    // 4. Redirect the user back to settings with success status
    return NextResponse.redirect(new URL("/dashboard/settings?gmail=success", req.url));
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Gmail OAuth callback exception:", err);
    return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=exception", req.url));
  }
}
