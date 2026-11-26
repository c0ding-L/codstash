import { notFound } from "next/navigation";
import { connection } from "next/server";

import { auth } from "@/auth";
import { resolveTypeSegment } from "@/lib/db/item-types";
import { itemTypeFromSegment } from "@/lib/item-type-ui";

interface ItemsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ type: string }>;
}

/**
 * Checks the type above `loading.tsx`. Below it the response has already started
 * streaming with a 200, so an unknown type could no longer answer with a real 404.
 * A system plural is known without the database; anything else is looked up as the
 * user's custom slug (the proxy already keeps anonymous requests out).
 */
export default async function ItemsLayout({ children, params }: ItemsLayoutProps) {
  const segment = (await params).type;
  if (itemTypeFromSegment(segment)) return children;

  await connection();
  const session = await auth();
  if (!session?.user?.id || !(await resolveTypeSegment(session.user.id, segment))) notFound();

  return children;
}
