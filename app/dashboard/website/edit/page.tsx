import { redirect } from "next/navigation";

// The builder now lives at /studio/website (full-screen, no dashboard chrome).
export default function WebsiteEditRedirect() {
  redirect("/studio/website");
}
