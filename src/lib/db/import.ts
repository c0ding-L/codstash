import { roomBelowLimit } from "@/lib/db/billing";
import { createCollection } from "@/lib/db/collections";
import { createCustomType, isCustomTypeNameTaken, type CustomTypeData } from "@/lib/db/item-types";
import {
  checkCandidate,
  countRefused,
  emptyImportResult,
  fallbackTypeTag,
  sameCollectionName,
  type ImportCandidate,
  type ImportCollectionDef,
  type ImportConflict,
  type ImportResult,
  type ImportSystemType,
} from "@/lib/import";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { collectionSchema } from "@/lib/item-schemas";
import { itemTypeSchema } from "@/lib/item-type-schema";
import { isReservedTypeSlug, slugify } from "@/lib/item-type-ui";
import { prisma } from "@/lib/prisma";
import { LimitReachedError } from "@/lib/usage-limits";

/** Items written per transaction. */
export const IMPORT_CHUNK_SIZE = 50;
/** Fifty nested creates with tag upserts can outlast Prisma's 5 s default on a cold database. */
const CHUNK_TIMEOUT_MS = 30_000;

export interface ImportOptions {
  conflict: ImportConflict;
  /** The Free item limit, re-checked under a lock per chunk; omitted for Pro. */
  maxItems?: number;
  /** The Free collection limit for collections the import creates; omitted for Pro. */
  maxCollections?: number;
  /** Pro: custom-type items keep (or recreate) their type. Free: they become tagged notes. */
  customTypes: boolean;
  /** Definitions from the export, to recreate a missing custom type. Unchecked input. */
  types?: unknown[];
  /** Descriptions from the export, used when a collection is created. Unchecked input. */
  collections?: unknown[];
}

type Resolved = Omit<ImportCandidate, "type"> & { typeId: string };

/**
 * Writes imported items for `userId`. Each raw candidate is checked again here with the
 * `createItem` rules (`checkCandidate`), whatever the browser mapped. Custom types are resolved
 * or fall back to a note tagged `type:<slug>`, collections are matched by name or created
 * within the limit, and items go in chunks of `IMPORT_CHUNK_SIZE`, each in a transaction that
 * re-counts the Free limit under a lock. Hitting the limit stops the import; the rest are
 * counted as `limit`.
 */
export async function importCandidates(userId: string, raw: unknown[], options: ImportOptions): Promise<ImportResult> {
  const result = emptyImportResult();

  const candidates: ImportCandidate[] = [];
  for (const entry of raw) {
    const checked = checkCandidate(entry);
    if (checked.ok) candidates.push(checked.candidate);
    else countRefused(result, checked);
  }
  if (candidates.length === 0) return result;

  const typed = await resolveTypes(userId, candidates, options);
  const kept = await dropConflicts(userId, typed, options.conflict, result);
  if (kept.length === 0) return result;

  // Already at the Free limit: report it before creating any collection for items that cannot
  // be written. The locked re-count in each chunk still decides the actual writes.
  if (options.maxItems !== undefined && (await prisma.item.count({ where: { userId } })) >= options.maxItems) {
    result.skipped.limit += kept.length;
    return result;
  }

  const collectionIds = await resolveCollections(userId, kept, options, result);

  for (let start = 0; start < kept.length; start += IMPORT_CHUNK_SIZE) {
    const chunk = kept.slice(start, start + IMPORT_CHUNK_SIZE);
    const written = await prisma.$transaction(
      async (tx) => {
        const room =
          options.maxItems === undefined ? chunk.length : await roomBelowLimit(tx, userId, "items", options.maxItems);
        const toWrite = chunk.slice(0, room).map((candidate) => ({ ...candidate, id: newItemId() }));
        if (toWrite.length > 0) await writeChunk(tx, userId, toWrite, collectionIds);
        return toWrite.length;
      },
      { timeout: CHUNK_TIMEOUT_MS },
    );
    result.created += written;
    if (written < chunk.length) {
      result.skipped.limit += kept.length - start - written;
      break;
    }
  }

  // Links to a collection that could not be created, counted for the items actually written.
  result.collectionLinksDropped = kept
    .slice(0, result.created)
    .reduce((sum, c) => sum + c.collectionNames.filter((name) => !collectionIds.has(name.toLowerCase().trim())).length, 0);
  return result;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Writes one chunk with bulk statements: the items, the user's missing tags, then the tag and
 * collection links. A few queries per chunk rather than several per item (each nested tag
 * upsert is its own round trip), which kept a 50-item chunk past the transaction timeout.
 */
async function writeChunk(tx: Tx, userId: string, items: (Resolved & { id: string })[], collectionIds: Map<string, string>) {
  await tx.item.createMany({
    data: items.map((item) => ({
      id: item.id,
      userId,
      typeId: item.typeId,
      title: item.title,
      description: item.description ?? null,
      content: item.content ?? null,
      url: item.url ?? null,
      language: item.language ?? null,
      isFavorite: item.isFavorite ?? false,
      isPinned: item.isPinned ?? false,
    })),
  });

  const names = [...new Set(items.flatMap((item) => item.tags))];
  if (names.length > 0) {
    await tx.tag.createMany({ data: names.map((name) => ({ name, userId })), skipDuplicates: true });
    const tags = await tx.tag.findMany({ where: { userId, name: { in: names } }, select: { id: true, name: true } });
    const tagIds = new Map(tags.map((tag) => [tag.name, tag.id]));
    await tx.itemTag.createMany({
      data: items.flatMap((item) => [...new Set(item.tags)].flatMap((name) => {
        const tagId = tagIds.get(name);
        return tagId ? [{ itemId: item.id, tagId }] : [];
      })),
    });
  }

  const links = items.flatMap((item) =>
    [...new Set(item.collectionNames.flatMap((name) => collectionIds.get(name.toLowerCase().trim()) ?? []))].map(
      (collectionId) => ({ itemId: item.id, collectionId }),
    ),
  );
  if (links.length > 0) await tx.itemCollection.createMany({ data: links });
}

/**
 * An id in the shape of Prisma's `cuid()` (25 characters, starting with "c", a timestamp then
 * random characters): bulk inserts need the ids up front to link tags and collections, and
 * `createManyAndReturn` does not promise its rows come back in input order.
 */
export function newItemId(): string {
  const random = crypto.getRandomValues(new Uint8Array(16));
  const tail = Array.from(random, (byte) => (byte % 36).toString(36)).join("");
  return `c${Date.now().toString(36).padStart(9, "0")}${tail}`.slice(0, 25);
}

/** The ids of the system types an import writes, by slug. */
async function systemTypeIds(slugs: ImportSystemType[]): Promise<Map<string, string>> {
  const types = await prisma.itemType.findMany({
    where: { slug: { in: [...new Set(slugs)] }, userId: null, isSystem: true },
    select: { id: true, slug: true },
  });
  return new Map(types.map((type) => [type.slug, type.id]));
}

/**
 * Gives each candidate a type id. A custom slug uses the user's type of that slug, or (Pro,
 * under the cap) one recreated from the export's definition; otherwise the item becomes a note
 * tagged `type:<slug>`, the tag left out when the item already has the most tags allowed.
 */
async function resolveTypes(userId: string, candidates: ImportCandidate[], options: ImportOptions): Promise<Resolved[]> {
  const customSlugs = [...new Set(candidates.flatMap((c) => (typeof c.type === "string" ? [] : [c.type.customSlug])))];
  const custom = options.customTypes && customSlugs.length > 0 ? await customTypeIds(userId, customSlugs, options.types ?? []) : new Map<string, string>();

  const withFallback = candidates.map((candidate) => {
    if (typeof candidate.type === "string") return { candidate, system: candidate.type, customId: null };
    const customId = custom.get(candidate.type.customSlug);
    if (customId) return { candidate, system: null, customId };
    const tag = fallbackTypeTag(candidate.type.customSlug);
    const tags = candidate.tags.includes(tag) || candidate.tags.length >= ITEM_LIMITS.tags || tag.length > ITEM_LIMITS.tag
      ? candidate.tags
      : [...candidate.tags, tag];
    // A note has no language: drop it, as the note schema would.
    const rest: ImportCandidate = { ...candidate, tags };
    delete rest.language;
    return { candidate: rest, system: "note" as const, customId: null };
  });

  const system = await systemTypeIds(withFallback.flatMap((entry) => (entry.system ? [entry.system] : [])));
  return withFallback.flatMap(({ candidate, system: slug, customId }) => {
    const typeId = customId ?? (slug ? system.get(slug) : undefined);
    if (!typeId) throw new Error(`No system item type "${slug}".`);
    const fields: Omit<ImportCandidate, "type"> & { type?: ImportCandidate["type"] } = { ...candidate };
    delete fields.type;
    return [{ ...fields, typeId }];
  });
}

/** The user's custom types for these slugs, creating the missing ones from valid definitions. */
async function customTypeIds(userId: string, slugs: string[], rawTypes: unknown[]): Promise<Map<string, string>> {
  const existing = await prisma.itemType.findMany({
    where: { userId, isSystem: false, slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const ids = new Map(existing.map((type) => [type.slug, type.id]));
  const definitions = rawTypes.flatMap((raw) => {
    const def = validTypeDef(raw);
    return def ? [def] : [];
  });

  for (const slug of slugs) {
    if (ids.has(slug)) continue;
    const def = definitions.find((candidate) => candidate.slug === slug);
    if (!def || (await isCustomTypeNameTaken(userId, def.name))) continue;
    try {
      const created = await createCustomType(userId, def);
      ids.set(created.slug, created.id);
    } catch (error) {
      if (error instanceof LimitReachedError) continue;
      // Another batch created it meanwhile (the `[userId, slug]` unique): use that one.
      if (isUniqueViolation(error)) {
        const type = await prisma.itemType.findFirst({ where: { userId, isSystem: false, slug }, select: { id: true } });
        if (type) ids.set(slug, type.id);
        continue;
      }
      throw error;
    }
  }
  return ids;
}

/** A definition from an export, checked with the type dialog's rules; its slug must be its name's. */
function validTypeDef(raw: unknown): CustomTypeData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const slug = "slug" in raw && typeof raw.slug === "string" ? raw.slug : null;
  const parsed = itemTypeSchema.safeParse(raw);
  if (!slug || !parsed.success) return null;
  const derived = slugify(parsed.data.name);
  if (derived !== slug || isReservedTypeSlug(slug)) return null;
  return { slug, name: parsed.data.name, icon: parsed.data.icon, color: parsed.data.color, template: parsed.data.template ?? null };
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * With "skip", leaves out a candidate whose title and type the user already has, or that an
 * earlier candidate of this batch has. "duplicate" keeps everything.
 */
async function dropConflicts(
  userId: string,
  candidates: Resolved[],
  conflict: ImportConflict,
  result: ImportResult,
): Promise<Resolved[]> {
  if (conflict === "duplicate") return candidates;
  const existing = await prisma.item.findMany({
    where: { userId, title: { in: [...new Set(candidates.map((c) => c.title))] } },
    select: { title: true, typeId: true },
  });
  const seen = new Set(existing.map((item) => `${item.typeId}\u0000${item.title}`));
  return candidates.filter((candidate) => {
    const key = `${candidate.typeId}\u0000${candidate.title}`;
    if (seen.has(key)) {
      result.skipped.duplicate += 1;
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * The ids of the collections the candidates name, by lowercased name: the user's own of that
 * name, else one created (with the export's description, when valid) while the Free limit
 * allows. A name left out of the map could not be created; its links are dropped.
 */
async function resolveCollections(
  userId: string,
  candidates: Resolved[],
  options: ImportOptions,
  result: ImportResult,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const wanted: string[] = [];
  for (const name of candidates.flatMap((c) => c.collectionNames)) {
    if (!wanted.some((seen) => sameCollectionName(seen, name))) wanted.push(name);
  }
  if (wanted.length === 0) return ids;

  const owned = await prisma.collection.findMany({ where: { userId }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  for (const collection of owned) {
    const key = collection.name.toLowerCase().trim();
    if (!ids.has(key)) ids.set(key, collection.id);
  }

  const descriptions = (options.collections ?? []).flatMap((raw) => {
    const parsed = collectionSchema.safeParse(raw);
    return parsed.success ? [{ name: parsed.data.name, description: parsed.data.description ?? null }] : [];
  }) satisfies ImportCollectionDef[];

  let limitReached = false;
  for (const name of wanted) {
    const key = name.toLowerCase().trim();
    if (ids.has(key) || limitReached) continue;
    const description = descriptions.find((def) => sameCollectionName(def.name, name))?.description ?? null;
    try {
      const created = await createCollection(userId, { name, description }, { maxCollections: options.maxCollections });
      ids.set(key, created.id);
      result.collectionsCreated += 1;
    } catch (error) {
      if (!(error instanceof LimitReachedError)) throw error;
      limitReached = true;
    }
  }
  return ids;
}

/** The GitHub OAuth token of the user's linked account, if any, for the gist calls. */
export async function getGithubAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github", access_token: { not: null } },
    select: { access_token: true },
  });
  return account?.access_token ?? null;
}
