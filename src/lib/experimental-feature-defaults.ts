// ============================================================
// Experimental features on in production — the ones every web build turns on, mercurypitch.com included
// ============================================================
//
// An experimental feature starts off on mercurypitch.com. Its default is the
// build's (VITE_EXPERIMENTAL_FEATURES, tools/experimental-features.ts): on
// for dev.mercurypitch.com, PR previews, `pnpm dev` and the e2e bundle, off
// for the production web build. A feature named here is on by default in
// every web build, the production one included, and the production build
// lists its page as it lists any room: the nav links in the static pages and
// the 404, the sitemap, llms.txt, and a page that asks to be indexed.
//
// It keeps its runtime switch. The owner can still switch it off for an
// environment from his console, and clearing the switch hands it back to
// this default: on. What a switch cannot move is the listing, which is
// written into the files at build time. Graduating the feature is still
// deleting it from EXPERIMENTAL_FEATURES and the gates that ask for it, and
// its line here with them.
//
// The native app has every experimental feature off, these included: its
// entry never reads the owner's switches, so a feature on there could not be
// switched off (src/stores/experimental-features-store.ts).
//
// Read by the build (tools/experimental-features.ts, which plain Node also
// loads for the dist check and IndexNow, so this file imports types alone),
// by the store and by the owner's console. Kept out of
// src/lib/experimental-features.ts on purpose: the db-worker compiles that
// file in and has no use for a default.

import type { ExperimentalFeature } from './experimental-features'

/** Every experimental feature on by default in production. Studio: the owner's call of 19 Nov 2026. */
export const ON_IN_PRODUCTION: readonly ExperimentalFeature[] = ['studio']

/**
 * Whether feature `name` is on by default in the production web build. Any
 * name: the console lists what the db-worker does, which can be ahead of
 * this build, and a feature this build does not know is off there.
 */
export function onInProduction(name: string): boolean {
  return (ON_IN_PRODUCTION as readonly string[]).includes(name)
}
