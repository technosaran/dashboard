import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createClient as createPublicClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    let userId: string;
    let refreshToken: string;
    let defaultAccounts: Record<string, string | null> = {};

    // 1. Resolve Auth (either active browser session OR secure cron token)
    const { searchParams } = new URL(req.url);
    const cronSecret = searchParams.get("secret");
    const expectedSecret = process.env.GMAIL_SYNC_SECRET;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

    if (expectedSecret && cronSecret === expectedSecret) {
      // Cron-triggered background execution for all users
      // To query all users securely, we will query via a public supabase client
      // (Assuming RLS allows or we look up profiles with valid tokens)
      const publicSupabase = createPublicClient(supabaseUrl, supabaseKey);
      const { data: profiles, error: pError } = await publicSupabase
        .from("profiles")
        .select("id, gmail_refresh_token, default_accounts, sms_sync_token")
        .not("gmail_refresh_token", "is", null);

      if (pError || !profiles || profiles.length === 0) {
        return NextResponse.json({ message: "No users with linked Gmail accounts found" });
      }

      // Sync for all users concurrently
      const results = await Promise.all(
        profiles.map(async (prof) => {
          try {
            return await syncUserGmail(
              prof.id,
              prof.gmail_refresh_token!,
              (prof.default_accounts as Record<string, string | null>) || {},
              prof.sms_sync_token
            );
          } catch (err: unknown) {
            const error = err as Error;
            return { userId: prof.id, success: false, error: error.message };
          }
        })
      );

      return NextResponse.json({ results });
    } else {
      // On-demand execution for the active logged-in browser session
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("gmail_refresh_token, default_accounts, sms_sync_token")
        .eq("id", user.id)
        .single();

      if (profileError || !profile || !profile.gmail_refresh_token) {
        return NextResponse.json({ error: "Gmail integration is not linked for this user" }, { status: 400 });
      }

      userId = user.id;
      refreshToken = profile.gmail_refresh_token;
      defaultAccounts = (profile.default_accounts as Record<string, string | null>) || {};

      const syncResult = await syncUserGmail(userId, refreshToken, defaultAccounts, profile.sms_sync_token);
      return NextResponse.json(syncResult);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Gmail sync general error:", err);
    return NextResponse.json({ error: err.message || "An unexpected error occurred" }, { status: 500 });
  }
}

// Perform sync logic for a single user
async function syncUserGmail(
  userId: string,
  refreshToken: string,
  defaultAccounts: Record<string, string | null>,
  smsSyncToken: string | null
) {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth credentials in environment");
  }

  // 1. Refresh access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Google token refresh failed: ${tokenData.error_description || tokenData.error}`);
  }

  const accessToken = tokenData.access_token;

  // 2. Fetch unread transaction-related emails from last 7 days
  const query = 'is:unread (subject:debited OR subject:credited OR subject:spent OR subject:received OR subject:alert OR subject:transaction OR subject:successful OR subject:confirmed OR "GPay" OR "Amazon Pay" OR "Paytm" OR "payment" OR "recharge" OR "debited" OR "credited" OR "spent" OR "₹" OR "Rs")';
  console.log("[Gmail Sync Debug] Running search with query:", query);
  
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=15`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const listData = await listRes.json();
  if (!listRes.ok) {
    console.error("[Gmail Sync Debug] Fetch list failed:", listData);
    throw new Error(`Gmail fetch message list failed: ${listData.error?.message || "Unknown"}`);
  }

  const messages = listData.messages || [];
  console.log("[Gmail Sync Debug] Total unread emails found matching criteria:", messages.length, messages);
  
  if (messages.length === 0) {
    return { userId, success: true, count: 0, message: "No unread transaction emails found" };
  }

  // 3. Setup database client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createPublicClient(supabaseUrl, supabaseKey);

  // Fetch user accounts once to resolve bank ending card digits
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, notes")
    .eq("user_id", userId);

  let processedCount = 0;

  // 4. Process each message
  for (const msgRef of messages) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      const message = await msgRes.json();

      if (!msgRes.ok) {
        console.error(`[Gmail Sync Debug] Failed to fetch details for msg ${msgRef.id}`);
        continue;
      }

      const subject = message.payload?.headers?.find((h: any) => h.name?.toLowerCase() === 'subject')?.value;
      console.log(`\n[Gmail Sync Debug] Processing message: ${msgRef.id}`);
      console.log(`[Gmail Sync Debug] Subject: "${subject}"`);
      console.log(`[Gmail Sync Debug] Snippet: "${message.snippet}"`);

      // Extract email body text
      let bodyText = message.snippet || "";
      if (message.payload) {
        const payloadData = getBodyFromPayload(message.payload);
        if (payloadData) {
          bodyText += "\n" + payloadData;
        }
      }

      // Parse email content
      const parsed = parseEmailText(bodyText);
      console.log("[Gmail Sync Debug] Parser outcome:", parsed);
      
      if (!parsed) {
        console.log("[Gmail Sync Debug] Extraction failed. Raw preview:", bodyText.substring(0, 180).replace(/\s+/g, " ") + "...");
      }

      if (parsed) {
        const { amount, type, merchant, accountEnding, category } = parsed;

        // Resolve bank account ending digits
        let resolvedAccountId: string | null = null;
        if (accounts && accounts.length > 0) {
          if (accountEnding) {
            const matched = accounts.find(
              (acc) =>
                acc.name.includes(accountEnding) ||
                (acc.notes && acc.notes.includes(accountEnding))
            );
            if (matched) resolvedAccountId = matched.id;
          }

          // Fallback to defaults
          if (!resolvedAccountId) {
            const defaultId = type === "expense" ? defaultAccounts.expenses : defaultAccounts.income;
            if (defaultId && accounts.some((acc) => acc.id === defaultId)) {
              resolvedAccountId = defaultId;
            }
          }

          // Ultimate fallback: First account
          if (!resolvedAccountId) {
            resolvedAccountId = accounts[0].id;
          }
        }

        // Log transaction via postgres security definer bypass triggers
        const rpcName = type === "expense" ? "record_expense_by_sms" : "record_income_by_sms";
        const cleanDate = new Date().toISOString().split("T")[0];

        if (smsSyncToken) {
          const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
            p_token: smsSyncToken,
            p_description: merchant,
            p_amount: amount,
            p_category: category,
            p_date: cleanDate,
            p_account_id: resolvedAccountId,
          });

          if (!rpcError && (!rpcData || rpcData.success !== false)) {
            processedCount++;
          }
        }
      }

      // 5. Mark message as read (remove UNREAD label)
      await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgRef.id}/batchModify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            removeLabelIds: ["UNREAD"],
          }),
        }
      );
    } catch (err) {
      console.error(`Error processing email message ${msgRef.id}:`, err);
    }
  }

  return {
    userId,
    success: true,
    count: processedCount,
    message: `Processed ${processedCount} new transactions from Gmail successfully`,
  };
}

// Decode base64url text content from Gmail parts
function decodeBase64(str: string) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

// Recursively traverse Gmail payload parts to extract body content
function getBodyFromPayload(payload: any): string {
  let body = "";
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body && part.body.data) {
        body += "\n" + decodeBase64(part.body.data);
      } else if (part.mimeType === "text/html" && part.body && part.body.data) {
        // Strip basic html tags for cleaner regex parsing
        const decodedHtml = decodeBase64(part.body.data);
        body += "\n" + decodedHtml.replace(/<[^>]*>/g, " ");
      } else if (part.parts) {
        body += "\n" + getBodyFromPayload(part);
      }
    }
  } else if (payload.body && payload.body.data) {
    body += "\n" + decodeBase64(payload.body.data);
  }
  return body;
}

// Parse email transaction receipt body structures
function parseEmailText(text: string) {
  // Ignore OTP or password reset emails
  if (/otp|verification|verification code|password|one time password/i.test(text)) {
    return null;
  }

  // Ignore non-transactional alerts (reminders, hold removals, security, nominees, promotions)
  if (/due today|due tomorrow|bill payment is due|earn up to|reward|gift card|hold for|hold of|nominee|security alert|sign-in|verification/i.test(text)) {
    return null;
  }

  // Ignore failed/declined transactions
  if (/declined|failed|failed to|rejected|unsuccessful/i.test(text)) {
    return null;
  }

  // 1. Amount Extraction
  const amountRegex = /(?:Rs\.?|INR|debited by|credited by|spent|amount of|₹)\s*([\d,]+(?:\.\d{2})?)/i;
  const amountMatch = text.match(amountRegex);
  if (!amountMatch) return null;
  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));

  if (isNaN(amount) || amount <= 0) return null;

  // 2. Type Extraction (debit vs credit)
  let type: "expense" | "income" = "expense";
  if (
    /credited|received|deposited|added|refunded/i.test(text) &&
    !/spent|debited|withdrawn/i.test(text)
  ) {
    type = "income";
  }

  // 3. Merchant / Source Extraction
  let merchant = "Online Transaction";
  const merchantRegex = /(?:at|to|vpa|transfer to|spent on|payment to)\s+([A-Za-z0-9\s*#&-]+?)(?:\s+on|\s+using|\s+vpa|Ref|Ref\.?|UPI|ending|A\/c|\.|\d{2}-\d{2}-\d{4})/i;
  const merchantMatch = text.match(merchantRegex);
  if (merchantMatch && merchantMatch[1].trim().length > 0) {
    merchant = merchantMatch[1].trim();
  } else if (/amazon/i.test(text)) {
    merchant = "Amazon Pay";
  } else if (/sbi|state bank/i.test(text)) {
    merchant = "SBI Bank";
  } else if (/airtel/i.test(text)) {
    merchant = "Airtel";
  } else if (/zomato/i.test(text)) {
    merchant = "Zomato";
  } else if (/swiggy/i.test(text)) {
    merchant = "Swiggy";
  } else if (/uber/i.test(text)) {
    merchant = "Uber";
  } else if (/ola/i.test(text)) {
    merchant = "Ola";
  } else if (/netflix/i.test(text)) {
    merchant = "Netflix";
  } else if (/spotify/i.test(text)) {
    merchant = "Spotify";
  } else if (/youtube/i.test(text)) {
    merchant = "YouTube";
  }

  // Limit merchant name to a clean string
  if (merchant.length > 50) {
    merchant = merchant.substring(0, 50) + "...";
  }

  // 4. Account ending digits
  let accountEnding: string | null = null;
  const accountRegex = /(?:A\/c|account|card|ending|ending in|ending with|ending ending|xx|x)\s*(\d{4})/i;
  const accountMatch = text.match(accountRegex);
  if (accountMatch) {
    accountEnding = accountMatch[1];
  }

  // 5. Category Resolution
  let category = type === "expense" ? "Food" : "Salary";
  if (type === "expense") {
    if (/zomato|swiggy|restaurant|eat|food|dining|deli|pizza|burger/i.test(text)) {
      category = "Food";
    } else if (/uber|ola|ride|cab|taxi|metro|fuel|petrol|diesel|bus|train/i.test(text)) {
      category = "Transport";
    } else if (/netflix|spotify|youtube|apple|game|playstation|movie|show|entertainment/i.test(text)) {
      category = "Entertainment";
    } else if (/rent|home|room|housing/i.test(text)) {
      category = "Housing";
    } else if (/electricity|water|gas|broadband|wifi|recharge|mobile|bill|airtel|jio|vi\s|bsnl/i.test(text)) {
      category = "Utilities";
    } else {
      category = "Other";
    }
  }

  return {
    amount,
    type,
    merchant,
    accountEnding,
    category
  };
}
