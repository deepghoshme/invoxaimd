import { redirect } from "next/navigation";

// The canonical bio builder is now at /studio/bio (full-screen studio shell
// with accordion + live preview). Redirect any old deep-links here.
export default function BioEditRedirect() {
  redirect("/studio/bio");
}
