import type messages from "../../messages/en.json";
import type { Locale } from "@/lib/locale";

// Types every `t()` key against the English catalog, so a wrong key fails the build.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
