import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimOrdersForUser } from "@/lib/claim";

/**
 * POST /api/buyer/claim
 *
 * Authenticated endpoint — claims all historical orders/purchases that match
 * the current user's verified email.  The /account page (or any buyer surface)
 * should POST here once on first load so that guest purchases are retroactively
 * linked to the logged-in buyer.
 *
 * Security:
 *  - Reads the session server-side from cookies; never trusts any client-
 *    supplied userId or email.
 *  - Verifies email_confirmed_at via the admin client before claiming.
 *  - claimOrdersForUser is idempotent (WHERE buyer_id IS NULL), so calling this
 *    multiple times is harmless.
 *
 * Response: { claimed: { orders, event_tickets, vip_members, bookings,
 *                         course_enrollments } }  on success
 *           { error: string }  on auth / verification failure (HTTP 401/403)
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!user.email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  // Confirm email_confirmed_at server-side via the admin client.
  // Never rely on data the client passed in for the verified flag.
  const admin = createAdminClient();
  const { data: authUserData, error: adminErr } =
    await admin.auth.admin.getUserById(user.id);

  if (adminErr || !authUserData?.user) {
    return NextResponse.json(
      { error: "Could not verify user" },
      { status: 500 },
    );
  }

  const verified = !!authUserData.user.email_confirmed_at;
  if (!verified) {
    return NextResponse.json(
      { error: "Email not verified" },
      { status: 403 },
    );
  }

  const claimed = await claimOrdersForUser(user.id, user.email, verified);
  return NextResponse.json({ claimed });
}
