// ============================================================
// Blob-URL ownership
// ============================================================
//
// `URL.createObjectURL` pins its blob for the life of the DOCUMENT, not of the
// component that called it. Nothing garbage-collects it; somebody has to say
// when it is done, and that somebody has to be whoever minted it or received
// it. A four-minute separated stem is 20-60 MB, so a handful of forgotten URLs
// is a few hundred megabytes alive for the rest of the tab's life.
//
// This is the bookkeeping half of that, kept out of the components so the two
// rules that are easy to get wrong are testable on their own:
//
//   - revoke each url ONCE (a second revoke is a silent no-op in browsers, so
//     a double-release bug hides until the day it is a use-after-revoke)
//   - never revoke a url you were not given — an `https:` stem from R2 or a
//     runtime url still held by a store must pass straight through
//
// Related but different: `uvr-stem-lease.ts` MINTS urls from durable rows and
// hands back a lease. This one takes custody of urls minted elsewhere.

export interface BlobUrlOwner {
  /** Take custody of a url. Non-blob urls are ignored, not an error. */
  own(url: string): void
  /** Release one url now, if it is owned. Safe to call twice. */
  release(url: string): void
  /** Release everything held. Safe to call twice — wire it to onCleanup. */
  releaseAll(): void
  /** How many urls are currently held. For assertions and diagnostics. */
  readonly size: number
}

/** True for a url this module is willing to revoke. */
function isOwnable(url: string): boolean {
  return url.startsWith('blob:')
}

/**
 * Revoke a url nobody took custody of — a mint whose consumer refused it.
 *
 * Separate from `own` + `release` because that pair reads as though the url
 * was kept for a while, and this case is "hand back what was just made".
 * No-op for anything that is not a blob url.
 */
export function revokeBlobUrl(url: string): void {
  if (isOwnable(url)) URL.revokeObjectURL(url)
}

/**
 * Custody of a set of object URLs.
 *
 * `initial` is the handover case: a caller that minted urls and is passing
 * responsibility on with them. Anything in it that is not a blob url is
 * dropped rather than rejected, so a mixed list of local blobs and remote
 * https stems can be handed over wholesale.
 */
export function createBlobUrlOwner(
  initial: Iterable<string> = [],
): BlobUrlOwner {
  const held = new Set<string>()
  for (const url of initial) {
    if (isOwnable(url)) held.add(url)
  }

  return {
    own(url: string): void {
      if (isOwnable(url)) held.add(url)
    },
    release(url: string): void {
      // Delete first: if revoke throws (jsdom without the stub, a hostile
      // polyfill), the url must not stay in the set to be revoked again by
      // releaseAll.
      if (!held.delete(url)) return
      URL.revokeObjectURL(url)
    },
    releaseAll(): void {
      const urls = [...held]
      held.clear()
      for (const url of urls) URL.revokeObjectURL(url)
    },
    get size(): number {
      return held.size
    },
  }
}
