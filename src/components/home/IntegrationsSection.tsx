import { Globe, Plug, Terminal, Unplug } from "lucide-react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { appOrigin, cursorConfig } from "@/lib/mcp-setup";

import { Reveal } from "./Reveal";

/** Keys of `home.integrations.items`, in display order, with their icons. */
const integrations = [
  { key: "api", icon: Globe, comingSoon: false },
  { key: "mcp", icon: Unplug, comingSoon: false },
  { key: "cli", icon: Terminal, comingSoon: true },
] as const;

/** The MCP server's tools (`src/lib/mcp-server.ts`), as an assistant lists them. */
const tools = ["search_items", "get_item", "list_collections", "get_collection_context", "create_item"];

/**
 * The REST API, the MCP server and the CLI (roadmap § C): the list on one side, the Cursor config
 * of Settings › API tokens on the other, pointed at this deployment.
 */
export async function IntegrationsSection() {
  const [t, requestHeaders] = await Promise.all([getTranslations("home.integrations"), headers()]);
  const config = cursorConfig(appOrigin({ AUTH_URL: process.env.AUTH_URL }, requestHeaders));

  return (
    <section className="border-t border-border px-4 py-28 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 [&>*]:min-w-0">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-400">
            <Plug className="size-3.5" aria-hidden />
            {t("badge")}
          </span>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight text-balance">{t("title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("subtitle")}</p>
          <ul className="mt-8 space-y-5">
            {integrations.map(({ key, icon: Icon, comingSoon }) => (
              <li key={key} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10">
                  <Icon className="size-4 text-neutral-200" aria-hidden />
                </span>
                <div>
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {t(`items.${key}.title`)}
                    {comingSoon ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                        {t("comingSoon")}
                      </span>
                    ) : null}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`items.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted-foreground">{t("plans")}</p>
        </Reveal>

        <Reveal delay={150}>
          <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/50">
            <figcaption className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="size-3 rounded-full bg-neutral-700" />
              <span className="size-3 rounded-full bg-neutral-700" />
              <span className="size-3 rounded-full bg-neutral-700" />
              <span className="ml-3 font-mono text-xs text-muted-foreground">.cursor/mcp.json</span>
            </figcaption>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-neutral-300">{config}</pre>
            <div className="border-t border-border bg-sky-400/[0.04] px-5 py-4">
              <p className="font-mono text-xs text-sky-400">{t("toolsLabel")}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {tools.map((tool) => (
                  <li
                    key={tool}
                    className="rounded-md border border-border bg-background/60 px-2 py-0.5 font-mono text-xs text-neutral-300"
                  >
                    {tool}
                  </li>
                ))}
              </ul>
            </div>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
