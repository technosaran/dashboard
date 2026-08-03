import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { logoResolver } from "@/lib/logo-engine/resolver";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access. Session required." }, { status: 401 });
    }

    const body = await request.json();
    const { merchant, domain, category } = body || {};

    const query = merchant || domain;
    if (!query) {
      return NextResponse.json({ error: "Field 'merchant' or 'domain' is required in request body" }, { status: 400 });
    }

    const updatedRecord = await logoResolver.resolve(query, { forceRefresh: true, category });

    if (!updatedRecord) {
      return NextResponse.json({ error: "Failed to refresh logo from provider pipeline" }, { status: 502 });
    }

    return NextResponse.json({
      message: "Logo successfully refreshed",
      record: updatedRecord,
    });
  } catch (err: any) {
    console.error("Logo refresh failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

