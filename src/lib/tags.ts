/** The tags typed in a form as they will be saved: trimmed, without blanks or repeats. */
export function toTags(text: string) {
  const tags = text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(tags)];
}
