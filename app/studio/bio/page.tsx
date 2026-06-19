import { redirect } from "next/navigation";

// The bio builder lives at /dashboard/pages/bio/edit. Keep /studio/bio as a
// stable alias so deep links (e.g. from the SEO page) don't 404, and the builder
// entry points stay consistent with the other /studio/* builders.
export default function StudioBioRedirect() {
  redirect("/dashboard/pages/bio/edit");
}
