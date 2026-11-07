import { notFound } from "next/navigation";

import { itemTypeFromSegment } from "@/lib/item-type-ui";

interface ItemsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ type: string }>;
}

/**
 * Checks the type above `loading.tsx`. Below it the response has already started
 * streaming with a 200, so an unknown type could no longer answer with a real 404.
 */
export default async function ItemsLayout({ children, params }: ItemsLayoutProps) {
  if (!itemTypeFromSegment((await params).type)) notFound();

  return children;
}
