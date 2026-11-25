import { Check, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { Reveal } from "./Reveal";

/** Keys of `home.ai.capabilities`, in display order. */
const capabilities = ["tagging", "summaries", "explain", "optimize"] as const;

const tags = ["react", "hooks", "typescript", "debounce", "performance"];

const kw = (text: string) => <span className="text-violet-400">{text}</span>;
const fn = (text: string) => <span className="text-blue-400">{text}</span>;

/** Hand-highlighted, so the page needs no highlighter for one static sample. */
const code: ReactNode[] = [
  <>
    {kw("export function")} {fn("useDebounce")}&lt;T&gt;(value: T, delay = 300) {"{"}
  </>,
  <>
    {"  "}
    {kw("const")} [v, setV] = {fn("useState")}(value);
  </>,
  <>
    {"  "}
    {fn("useEffect")}(() =&gt; {"{"}
  </>,
  <>
    {"    "}
    {kw("const")} id = {fn("setTimeout")}(() =&gt; setV(value), delay);
  </>,
  <>
    {"    "}
    {kw("return")} () =&gt; clearTimeout(id);
  </>,
  <>{"  }, [value, delay]);"}</>,
  <>
    {"  "}
    {kw("return")} v;
  </>,
  <>{"}"}</>,
];

/** Pro's AI features: the checklist on one side, a snippet with generated tags on the other. */
export async function AiSection() {
  const t = await getTranslations("home.ai");

  return (
    <section className="border-t border-border px-4 py-28 sm:px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2 [&>*]:min-w-0">
        <Reveal>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-400">
            <Sparkles className="size-3.5" aria-hidden />
            {t("badge")}
          </span>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight text-balance">{t("title")}</h2>
          <p className="mt-4 text-muted-foreground">{t("subtitle")}</p>
          <ul className="mt-8 space-y-3">
            {capabilities.map((capability) => (
              <li key={capability} className="flex items-center gap-3 text-sm">
                <span className="grid size-5 place-items-center rounded-full bg-emerald-400/10">
                  <Check className="size-3 text-emerald-400" aria-hidden />
                </span>
                {t(`capabilities.${capability}`)}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={150}>
          <figure className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-black/50">
            <figcaption className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="size-3 rounded-full bg-neutral-700" />
              <span className="size-3 rounded-full bg-neutral-700" />
              <span className="size-3 rounded-full bg-neutral-700" />
              <span className="ml-3 font-mono text-xs text-muted-foreground">useDebounce.ts</span>
            </figcaption>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-neutral-300">
              {code.map((line, index) => (
                <div key={index}>{line}</div>
              ))}
            </pre>
            <div className="border-t border-border bg-amber-400/[0.04] px-5 py-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
                <Sparkles className="size-3.5" aria-hidden />
                {t("generatedTags")}
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-md border border-border bg-background/60 px-2 py-0.5 font-mono text-xs text-neutral-300"
                  >
                    #{tag}
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
