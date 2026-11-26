/**
 * Caps on what one item can hold. Without them only the 1 MB action body limits a
 * field, and every tag is its own upsert in the same write.
 */
export const ITEM_LIMITS = {
  title: 200,
  description: 2_000,
  content: 100_000,
  language: 50,
  tag: 50,
  tags: 20,
  collections: 20,
} as const;

/** Caps on a custom item type. The template pre-fills an item's content, so it stays well under it. */
export const CUSTOM_TYPE_LIMITS = {
  name: 40,
  template: 10_000,
} as const;
