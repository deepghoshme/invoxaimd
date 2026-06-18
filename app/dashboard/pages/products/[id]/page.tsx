import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The product editor now lives full-screen at /studio/product/[id] (store-builder style).
export default async function ProductEditorRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/studio/product/${id}`);
}
