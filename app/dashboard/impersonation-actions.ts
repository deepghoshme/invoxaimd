"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IMP_COOKIE } from "@/lib/impersonation";

/**
 * Clear the impersonation cookie and redirect to admin sellers.
 * Called from the dashboard banner "Exit" button.
 * No admin check needed here — clearing a cookie is always safe.
 */
export async function exitImpersonation(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(IMP_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // expire immediately
  });
  redirect("/admin/sellers");
}
