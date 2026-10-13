// ============================================================
// Store listings — the one place the native app's store pages are named
// ============================================================
//
// The web links to the App Store and Google Play from here and nowhere else.
// Each listing has a live flag and the ID its link is built from, so no
// hand-typed store URL can drift, and no link reaches a page before its
// listing exists. Link builders and ID checks follow Beside Cue's
// (disjoint-colliders, packages/beside-cue/src/stores.ts).
//
// THREE STATES, one listing at a time:
//
//   1. Not live (today, 2026-10-09). The web shows the app's own text chip,
//      "Coming soon" plus the store name, linked to STORE_PREVIEW_VIDEO_URL.
//      No store artwork: Apple licenses its badge only for apps "available
//      for download on the App Store", and Google says not to use the Play
//      icon in marketing materials. The plain words are fine.
//
//   2. Pre-order / pre-registration (not built). Both stores have a badge of
//      their own for it: Apple's "Pre-order on the App Store" and Google's
//      "Pre-register on Google Play". When either opens, fetch that badge
//      from the official source, add it to public/stores/ unaltered, and add
//      a state here for it; this file does not have one yet.
//
//   3. Live. The chip becomes the store's official badge (public/stores/,
//      Apple's SVG and Google's PNG, fetched 2026-09-11 and unaltered),
//      linked to the listing.
//
// GOING LIVE, per store, once it has approved and published the listing:
//   - App Store: set `appleId` to the numeric Apple ID (App Store Connect >
//     App Information > Apple ID), then `live: true`.
//   - Google Play: set `live: true`. The package name is already the
//     permanent one; store-listings.test.ts checks it against the Android
//     build (apps/mercurypitch/android/app/build.gradle).
// A live listing with a malformed ID fails store-listings.test.ts, and on the
// page it falls back to the chip rather than linking to a 404.
//
// Never rendered inside the native app: see StoreChips.tsx.

/** One entry per store. `live` flips when the store publishes the listing. */
export interface StoreListings {
  appStore: { live: boolean; appleId: string }
  googlePlay: { live: boolean; packageName: string }
}

export const STORE_LISTINGS: StoreListings = {
  appStore: { live: false, appleId: '' },
  googlePlay: { live: false, packageName: 'com.irchiinnuss.mercurypitch' },
}

/**
 * Where a "Coming soon" chip leads while its store is not live: the YouTube
 * video "MercuryPitch: karaoke that keeps playing, with floating lyrics",
 * recorded on an Android tablet. Both chips open it; the caption beside them
 * says what it shows (StoreChips.tsx), so change the two together.
 */
export const STORE_PREVIEW_VIDEO_URL =
  'https://www.youtube.com/watch?v=NSK9kc_0-dw'

export interface StoreLinks {
  appStore?: string
  googlePlay?: string
}

/** The ID-only form. Apple's share link adds a country and a slug made from
 *  the app's name; the slug changes with a rename, the ID never does. */
export const appStoreUrl = (appleId: string): string =>
  `https://apps.apple.com/app/id${appleId}`

/** Play links by package name, which is fixed at the first upload. */
export const googlePlayUrl = (packageName: string): string =>
  `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`

const APPLE_ID = /^\d+$/u
const PACKAGE_NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/u

const appStoreOk = (s: StoreListings): boolean =>
  APPLE_ID.test(s.appStore.appleId)
const googlePlayOk = (s: StoreListings): boolean =>
  PACKAGE_NAME.test(s.googlePlay.packageName)

/** What is wrong with a live listing's ID, one line per store. Empty when
 *  every live listing can be linked. */
export function storeListingProblems(
  stores: StoreListings = STORE_LISTINGS,
): string[] {
  const problems: string[] = []
  if (stores.appStore.live && !appStoreOk(stores)) {
    problems.push(
      'appStore.appleId must be the numeric Apple ID (App Store Connect > App Information)',
    )
  }
  if (stores.googlePlay.live && !googlePlayOk(stores)) {
    problems.push(
      'googlePlay.packageName must be the Android package name, e.g. com.irchiinnuss.mercurypitch',
    )
  }
  return problems
}

/** A link for each listing that is live and has a well-formed ID. */
export function storeLinks(stores: StoreListings = STORE_LISTINGS): StoreLinks {
  return {
    ...(stores.appStore.live && appStoreOk(stores)
      ? { appStore: appStoreUrl(stores.appStore.appleId) }
      : {}),
    ...(stores.googlePlay.live && googlePlayOk(stores)
      ? { googlePlay: googlePlayUrl(stores.googlePlay.packageName) }
      : {}),
  }
}
