/** The tags typed in a form as they will be saved: trimmed, without blanks or repeats. */
export function toTags(text: string) {
  const tags = text
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return [...new Set(tags)];
}

/** The typed tags with `tag` added, unless the form already has it in any case. */
export function addTag(text: string, tag: string) {
  const tags = toTags(text);
  const taken = tags.some((other) => other.toLowerCase() === tag.toLowerCase());
  return taken ? tags.join(", ") : [...tags, tag].join(", ");
}
