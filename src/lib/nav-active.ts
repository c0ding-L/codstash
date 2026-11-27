/**
 * Whether a sidebar link points at the current page. A prefix match only counts on a whole
 * segment, so `/items/notes` does not light up on `/items/notes-archive`.
 */
export function isNavActive(pathname: string, href: string, exact = false): boolean {
  if (pathname === href) return true;
  if (exact) return false;
  return pathname.startsWith(`${href}/`);
}
