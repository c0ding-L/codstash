import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getCollection } from "@/lib/db/collections";

interface CollectionLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

/**
 * Checks the collection is the user's above `loading.tsx`. Below it the response has
 * already started streaming with a 200, so a missing one could no longer answer 404.
 */
export default async function CollectionLayout({ children, params }: CollectionLayoutProps) {
  const { id } = await params;

  // The proxy already guards `/collections`; this also narrows the session's type.
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/collections/${encodeURIComponent(id)}`);

  if (!(await getCollection(session.user.id, id))) notFound();

  return children;
}
