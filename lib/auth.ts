import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Store = {
  id: string;
  owner_id: string;
  store_name: string | null;
  subdomain: string | null;
  category_id: string | null;
  onboarding_step: "otp" | "store_name" | "subdomain" | "category" | "billing" | "done";
  onboarding_completed: boolean;
  billing: Record<string, unknown>;
};

/** Current authenticated user (or null). Verified against the auth server. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Require a logged-in user; redirect to /login otherwise. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/** The signed-in user's store (RLS-scoped to the owner). Null if none yet. */
export async function getStore(): Promise<Store | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("stores")
    .select(
      "id, owner_id, store_name, subdomain, category_id, onboarding_step, onboarding_completed, billing",
    )
    .eq("owner_id", user.id)
    .maybeSingle();

  return (data as Store | null) ?? null;
}
