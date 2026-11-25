"use client";

import Link from "next/link";
import { ChevronsUpDown, Languages, LogOut, Settings, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { signOutAction } from "@/actions/auth";
import { UserAvatar } from "@/components/auth/UserAvatar";
import { useChangeLocale } from "@/components/i18n/use-change-locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { isLocale, LOCALES } from "@/lib/locale";

interface UserMenuProps {
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Sidebar footer. The avatar links to the profile; the name opens the menu
 * that holds Profile, Settings, the interface language and Sign out.
 */
export function UserMenu({ name, email, image }: Readonly<UserMenuProps>) {
  const t = useTranslations();
  const { locale, change, pending } = useChangeLocale();
  const label = name ?? email ?? t("userMenu.account");

  return (
    <div className="flex items-center gap-1">
      <SidebarMenuButton
        size="lg"
        tooltip={t("userMenu.profile")}
        aria-label={t("userMenu.profile")}
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
          <DropdownMenuItem render={<Link href="/profile" />}>
            <UserRound aria-hidden />
            {t("userMenu.profile")}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/settings" />}>
            <Settings aria-hidden />
            {t("userMenu.settings")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={pending}>
              <Languages aria-hidden />
              {t("userMenu.language")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={locale} onValueChange={(next) => isLocale(next) && change(next)}>
                {LOCALES.map((value) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {t(`locales.${value}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOutAction()}>
            <LogOut aria-hidden />
            {t("userMenu.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
