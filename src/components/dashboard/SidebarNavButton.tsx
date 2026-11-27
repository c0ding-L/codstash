"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { isNavActive } from "@/lib/nav-active";

/**
 * A sidebar link that highlights itself on its own page. `AppSidebar` renders on the server,
 * so the current path is read here, in a client leaf. On phones and tablets the sidebar is a
 * slide-out sheet, which closes once a link is picked.
 */
export function SidebarNavButton({
  href,
  exact = false,
  tooltip,
  children,
}: {
  href: string;
  /** Match the path exactly instead of as a prefix (`/collections` vs `/collections/{id}`). */
  exact?: boolean;
  tooltip: string;
  children: ReactNode;
}) {
  const active = isNavActive(usePathname(), href, exact);
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <SidebarMenuButton
      tooltip={tooltip}
      isActive={active}
      aria-current={active ? "page" : undefined}
      onClick={isMobile ? () => setOpenMobile(false) : undefined}
      render={<Link href={href} />}
    >
      {children}
    </SidebarMenuButton>
  );
}
