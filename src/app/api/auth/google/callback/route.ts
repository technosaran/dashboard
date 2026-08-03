import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");
    const state = searchParams.get("state") || "";
    const storedState = req.cookies.get("gmail_oauth_state")?.value;

    // Helper to build redirect response preserving cookies
    const makeRedirect = (url: URL) => {
      const res = NextResponse.redirect(url);
      req.cookies.getAll().forEach((c) => {
        res.cookies.set(c.name, c.value, { path: "/", sameSite: "lax" });
      });
      return res;
    };

    if (errorParam) {
      return makeRedirect(new URL("/dashboard/settings?gmail=error&reason=" + encodeURIComponent(errorParam), req.url));
    }

    // Parse state: "userId:randomState" or "randomState"
    let userIdFromState = "";
    let randomState = state;
    if (state.includes(":")) {
      const parts = state.split(":");
      userIdFromState = parts[0];
      randomState = parts[1];
    }

    if (!state || !storedState || randomState !== storedState) {
      return makeRedirect(new URL("/dashboard/settings?gmail=error&reason=csrf_state_mismatch", req.url));
    }

    if (!code) {
      return makeRedirect(new URL("/dashboard/settings?gmail=error&reason=no_code", req.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return makeRedirect(new URL("/dashboard/settings?gmail=error&reason=missing_server_credentials", req.url));
    }

    const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const isEnvLocalhost = !rawSiteUrl || rawSiteUrl.includes("localhost");
    const isReqRemote = !req.nextUrl.origin.includes("localhost");
    const siteUrl = (isEnvLocalhost && isReqRemote ? req.nextUrl.origin : (rawSiteUrl || req.nextUrl.origin)).replace(/\/$/, "");
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
      return makeRedirect(
        new URL("/dashboard/settings?gmail=error&reason=" + encodeURIComponent(tokenData.error_description || tokenData.error || "token_exchange_failed"), req.url)
      );
    }

    const refreshToken = tokenData.refresh_token;

    // 2. Fetch authenticated Supabase client using request cookies
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || (userIdFromState && user.id !== userIdFromState)) {
      return makeRedirect(new URL("/dashboard/settings?gmail=error&reason=unauthenticated", req.url));
    }

    // 3. Save the refresh token to the database
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ gmail_refresh_token: refreshToken })
      .eq("id", user.id);


    if (dbError) {
      console.error("Failed to save Gmail refresh token:", dbError);
      return makeRedirect(new URL("/dashboard/settings?gmail=error&reason=db_write_failed", req.url));
    }

    // 4. Redirect the user back to settings with success status while preserving cookies
    return makeRedirect(new URL("/dashboard/settings?gmail=success", req.url));
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Gmail OAuth callback exception:", err);
    return NextResponse.redirect(new URL("/dashboard/settings?gmail=error&reason=exception", req.url));
  }
}
