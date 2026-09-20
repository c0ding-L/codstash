"use client";

import Link from "next/link";
import { ChevronsUpDown, LogOut } from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { UserAvatar } from "@/components/auth/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";

interface UserMenuProps {
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Sidebar footer. The avatar links to the profile; the name opens the menu
 * that holds Sign out.
 */
export function UserMenu({ name, email, image }: Readonly<UserMenuProps>) {
  const label = name ?? email ?? "Account";

  return (
    <div className="flex items-center gap-1">
      <SidebarMenuButton
        size="lg"
        tooltip="Profile"
        aria-label="Profile"
        className="w-auto shrink-0 group-data-[collapsible=icon]:w-8"
        render={<Link href="/profile" />}
      >
        <UserAvatar name={name} email={email} image={image} />
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<SidebarMenuButton size="lg" className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden" />}
        >
          <span className="grid flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium">{label}</span>
            {email && name ? (
              <span className="truncate text-xs text-sidebar-foreground/70">{email}</span>
            ) : null}
          </span>
          <ChevronsUpDown aria-hidden className="ml-auto" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-48">
          <DropdownMenuItem onClick={() => signOutAction()}>
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
