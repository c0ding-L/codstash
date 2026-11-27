"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { getErrors } from "@/i18n/errors-server";
import { getPlanStatus } from "@/lib/db/billing";
import { countShares, getShareTarget, saveShare, type ShareTarget } from "@/lib/db/share";
import { containsSecrets } from "@/lib/secrets";
import { SECRET_TITLES_SHOWN, sharePath, type ShareKind } from "@/lib/share";
import { FREE_LIMITS, LimitReachedError, canShare } from "@/lib/usage-limits";

/** What the share dialog shows. */
export interface ShareStatus {
  /** Null while not shared. */
  shareId: string | null;
  /** The public page's path, `/s/...`; the dialog prefixes its own origin. */
  path: string | null;
  indexable: boolean;
  showOwner: boolean;
  /** Public links on, collections and items together; `max` is null for Pro. */
  usage: { used: number; max: number | null };
  /** Items the public page leaves out because they now look like secrets (an item: 0 or 1). */
  hiddenCount: number;
}

export type ShareResult = { success: true; data: ShareStatus; error: null } | { success: false; data: null; error: string };

const targetSchema = z.object({
  kind: z.enum(["collection", "item"]),
  id: z.string().trim().min(1).max(100),
});

const setSharingSchema = targetSchema.extend({
  shared: z.boolean(),
  indexable: z.boolean().optional(),
  showOwner: z.boolean().optional(),
  /** A new link, so the old one stops working. Only while sharing stays on. */
  resetLink: z.boolean().optional(),
});

export type ShareTargetInput = z.input<typeof targetSchema>;
export type SetSharingInput = z.input<typeof setSharingSchema>;

type Errors = Awaited<ReturnType<typeof getErrors>>;

function notFound(e: Errors, kind: ShareKind) {
  return e.message(kind === "item" ? "items.notFound" : "collections.notFound");
}

function hiddenCount(target: ShareTarget) {
  return target.shareId ? target.scanned.filter((item) => containsSecrets(item)).length : 0;
}

async function status(
  userId: string,
  isPro: boolean,
  kind: ShareKind,
  target: ShareTarget,
): Promise<ShareStatus> {
  return {
    shareId: target.shareId,
    path: target.shareId ? sharePath(kind, target.shareId) : null,
    indexable: target.indexable,
    showOwner: target.showOwner,
    usage: { used: await countShares(userId), max: isPro ? null : FREE_LIMITS.shared },
    hiddenCount: hiddenCount(target),
  };
}

/** Why sharing is refused for this target, or null. Files are left out in v1; secrets block it. */
function refusal(e: Errors, kind: ShareKind, target: ShareTarget): string | null {
  if (target.contentType !== "text") return e.message("share.fileItem");
  const flagged = target.scanned.filter((item) => containsSecrets(item));
  if (flagged.length === 0) return null;
  if (kind === "item") return e.message("share.itemSecret");

  const titles = flagged
    .slice(0, SECRET_TITLES_SHOWN)
    .map((item) => e.message("share.quotedTitle", { title: item.title }))
    .join(", ");
  const more = flagged.length - SECRET_TITLES_SHOWN;
  return e.message("share.collectionSecrets", {
    titles: more > 0 ? e.message("share.titlesMore", { titles, count: more }) : titles,
  });
}

/** The share settings of one of the user's collections or items, for the dialog. */
export async function getSharing(input: ShareTargetInput): Promise<ShareResult> {
  const e = await getErrors();
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return { success: false, data: null, error: e.message("invalidInput") };
  const { kind, id } = parsed.data;

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };
    const userId = session.user.id;

    const [target, plan] = await Promise.all([getShareTarget(userId, kind, id), getPlanStatus(userId)]);
    if (!target) return { success: false, data: null, error: notFound(e, kind) };
    return { success: true, data: await status(userId, plan.isPro, kind, target), error: null };
  } catch (error) {
    console.error("[share] getSharing failed:", error);
    return { success: false, data: null, error: e.message("share.failed") };
  }
}

/**
 * Turns a public link on or off, resets it, or changes its toggles. Turning it on is refused for
 * a file or image item, for anything holding a likely secret (A6), and on Free past
 * `FREE_LIMITS.shared` links. Turning it off kills the link at once.
 */
export async function setSharing(input: SetSharingInput): Promise<ShareResult> {
  const e = await getErrors();
  const parsed = setSharingSchema.safeParse(input);
  if (!parsed.success) return { success: false, data: null, error: e.message("invalidInput") };
  const { kind, id, shared, resetLink = false } = parsed.data;

  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, data: null, error: e.message("notSignedIn") };
    const userId = session.user.id;

    // The query filters on the owner, so another user's collection or item is not found either.
    const [target, plan] = await Promise.all([getShareTarget(userId, kind, id), getPlanStatus(userId)]);
    if (!target) return { success: false, data: null, error: notFound(e, kind) };

    const indexable = parsed.data.indexable ?? target.indexable;
    const showOwner = parsed.data.showOwner ?? target.showOwner;

    if (shared) {
      // Re-checked on every save while on: a toggle or a reset must not keep a link to a secret.
      const refused = refusal(e, kind, target);
      if (refused) return { success: false, data: null, error: refused };

      // Early check for a clear message; `saveShare` re-counts under a lock.
      if (!target.shareId && !canShare(plan, await countShares(userId))) {
        return { success: false, data: null, error: e.message("limits.shared", { max: FREE_LIMITS.shared }) };
      }
    }

    const saved = await saveShare(
      userId,
      kind,
      id,
      { shared, indexable, showOwner, newLink: shared && resetLink, currentShareId: target.shareId },
      { maxShares: plan.isPro ? undefined : FREE_LIMITS.shared },
    );
    if (!saved.found) return { success: false, data: null, error: notFound(e, kind) };

    revalidatePath("/", "layout");
    const updated: ShareTarget = { ...target, shareId: saved.shareId, indexable, showOwner };
    return { success: true, data: await status(userId, plan.isPro, kind, updated), error: null };
  } catch (error) {
    if (error instanceof LimitReachedError) {
      return { success: false, data: null, error: e.message("limits.shared", { max: FREE_LIMITS.shared }) };
    }
    console.error("[share] setSharing failed:", error);
    return { success: false, data: null, error: e.message("share.failed") };
  }
}
