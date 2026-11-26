import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Whether a stored URL is safe to use as a link: `url` is free text, and could be `javascript:`. */
export function isWebUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

/**
 * A short form of an id for file names and listings: its **last** 8 characters. Ids are
 * `cuid()` v1, which start with a timestamp, so items created together share their first
 * characters; the end is the random part.
 */
export function shortId(id: string) {
  return id.slice(-8);
}
