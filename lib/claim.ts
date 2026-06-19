import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Result returned by claimOrdersForUser.
 */
export interface ClaimResult {
  orders: number;
  event_tickets: number;
  vip_members: number;
  bookings: number;
  course_enrollments: number;
}

/**
 * Link all historical purchases (orders, tickets, memberships, bookings,
 * course enrolments) to a newly-verified buyer by matching on their email.
 *
 * SAFETY RULES:
 *  - Only runs when `verified` is true (caller must confirm email_confirmed_at
 *    is non-null before calling, or pass it explicitly).
 *  - Uses the service-role admin client so it can write across all tenants
 *    without a user session (RLS is bypassed intentionally here).
 *  - Idempotent: WHERE buyer_id IS NULL means re-running is a complete no-op
 *    for rows already claimed.
 *  - Never logs the email or userId to avoid leaking PII into server logs.
 *
 * @param userId  The Supabase auth.users UUID of the verified buyer.
 * @param email   The buyer's email (will be lower-cased for comparison).
 * @param verified Must be true; if false the function returns all-zero counts
 *                 without touching any data.
 */
export async function claimOrdersForUser(
  userId: string,
  email: string,
  verified: boolean,
): Promise<ClaimResult> {
  const zero: ClaimResult = {
    orders: 0,
    event_tickets: 0,
    vip_members: 0,
    bookings: 0,
    course_enrollments: 0,
  };

  // Hard gate: never claim for an unverified email.
  if (!verified || !userId || !email) return zero;

  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();

  // Run all five table updates in parallel — they are independent.
  const [ordersRes, ticketsRes, vipRes, bookingsRes, coursesRes] =
    await Promise.all([
      admin
        .from("orders")
        .update({ buyer_id: userId })
        .is("buyer_id", null)
        .not("buyer_email", "is", null)
        .ilike("buyer_email", normalizedEmail)
        .select("id"),

      admin
        .from("event_tickets")
        .update({ buyer_id: userId })
        .is("buyer_id", null)
        .not("buyer_email", "is", null)
        .ilike("buyer_email", normalizedEmail)
        .select("id"),

      admin
        .from("vip_members")
        .update({ buyer_id: userId })
        .is("buyer_id", null)
        .not("buyer_email", "is", null)
        .ilike("buyer_email", normalizedEmail)
        .select("id"),

      admin
        .from("bookings")
        .update({ buyer_id: userId })
        .is("buyer_id", null)
        .not("buyer_email", "is", null)
        .ilike("buyer_email", normalizedEmail)
        .select("id"),

      admin
        .from("course_enrollments")
        .update({ buyer_id: userId })
        .is("buyer_id", null)
        .not("buyer_email", "is", null)
        .ilike("buyer_email", normalizedEmail)
        .select("id"),
    ]);

  return {
    orders: ordersRes.data?.length ?? 0,
    event_tickets: ticketsRes.data?.length ?? 0,
    vip_members: vipRes.data?.length ?? 0,
    bookings: bookingsRes.data?.length ?? 0,
    course_enrollments: coursesRes.data?.length ?? 0,
  };
}
