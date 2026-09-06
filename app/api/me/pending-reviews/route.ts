import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { pendingPickupReviews } from "@/lib/social/pickup-reviews";
export async function GET() {
  try {
  const client = await createServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ reviews: [] }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ reviews: await pendingPickupReviews(user.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Reviews are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
