"use client";

import { useState } from "react";

import { faviconUrl } from "@/lib/link-url";

/**
 * The site's logo in the link row's square, with the domain's first letter until
 * it has loaded, and for good when the site has none (DuckDuckGo answers 404).
 */
export function LinkLogo({ url, letter }: { url: string; letter: string }) {
  const src = faviconUrl(url);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showLogo = src !== null && !failed;

  return (
    <span
      className="relative hidden size-9 shrink-0 items-center justify-center rounded-md bg-lime-400/10 font-mono text-sm font-semibold text-lime-400 uppercase sm:flex"
      aria-hidden
    >
      {showLogo && loaded ? null : letter}
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          referrerPolicy="no-referrer"
          // An image that settled before hydration fires no event: read its state here.
          ref={(img) => {
            if (!img?.complete) return;
            if (img.naturalWidth > 0) setLoaded(true);
            else setFailed(true);
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={loaded ? "size-5 rounded-sm" : "absolute size-5 opacity-0"}
        />
      ) : null}
    </span>
  );
}
