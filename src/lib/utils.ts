import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Whether a stored URL is safe to use as a link: `url` is free text, and could be `javascript:`. */
export function isWebUrl(url: string) {
  return /^https?:\/\//i.test(url);
}
