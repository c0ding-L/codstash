import { isWebUrl } from "@/lib/utils";

/**
 * A link as the link list shows it: the domain (port kept, `www.` dropped) and the
 * rest of the address, decoded for reading. A URL that is not a web address, or
 * does not parse, comes back whole as the domain with no path.
 */
export function parseLinkUrl(url: string): { domain: string; path: string } {
  if (!isWebUrl(url)) return { domain: url, path: "" };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { domain: url, path: "" };
  }

  const rest = parsed.pathname + parsed.search + parsed.hash;
  return {
    domain: parsed.host.replace(/^www\./, ""),
    path: rest === "/" ? "" : decodeForReading(rest),
  };
}

/** Decoded when the escapes are valid, left as it is when they are not. */
function decodeForReading(text: string) {
  try {
    return decodeURI(text);
  } catch {
    return text;
  }
}

/**
 * The site's logo as DuckDuckGo serves it, for a web URL; null for anything else.
 * Only the hostname goes out (no port, path or query), and DuckDuckGo answers 404
 * when the site has no logo, so the caller can fall back to a letter.
 */
export function faviconUrl(url: string): string | null {
  if (!isWebUrl(url)) return null;

  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!hostname) return null;
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico`;
}
