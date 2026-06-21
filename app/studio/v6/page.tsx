import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BuilderV6 from "@/components/builder/v6/BuilderV6";
import { createSection } from "@/lib/builder/registry";
import { DEFAULT_THEME_ID } from "@/lib/builder/themes";
import type { PageDoc } from "@/lib/builder/types";
import "../../dashboard/dx.css";
import "./v6.css";

export const dynamic = "force-dynamic";

// Page Builder v6 — editor shell (Phase 2). In-memory only; persistence in Phase 5.
export default async function StudioV6() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  // Starter landing page (in-memory). Phase 5 will load/save this from `pages`.
  const starter: PageDoc = {
    id: "demo",
    ownerId: user.id,
    type: "landing",
    slug: "untitled",
    title: "Untitled page",
    themeId: DEFAULT_THEME_ID,
    pageBg: "none",
    status: "draft",
    updatedAt: new Date().toISOString(),
    sections: [
      createSection("navbar"),
      createSection("hero"),
      createSection("logos"),
      createSection("features"),
      createSection("pricing"),
      createSection("faq"),
      createSection("footer"),
    ],
  };

  return <BuilderV6 initial={starter} />;
}
