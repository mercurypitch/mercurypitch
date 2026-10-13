// ============================================================
// Example song links — which `?song=<slug>` names which example
// ============================================================
//
// `?session=karaoke-night-demo%3Anothing-in-the-dark` stages a song, but
// nobody can read it aloud or type it. A song link names the example by its
// manifest slug instead: `/karaoke-night?song=nothing-in-the-dark`.
//
// One exception. The original demo's manifest slug is `karaoke-night`
// (LEGACY_SLUG), so its link would read `/karaoke-night?song=karaoke-night`
// and say nothing about the song. Its link slug is `goodbye-to-spring`, the
// name its R2 folder and the native bundle's folder already use. The legacy
// slug still resolves, so neither spelling is a dead link.
//
// That alias is tied to the legacy row, not to the title: if the studio ever
// put a different song in that row, `goodbye-to-spring` would follow the row.
// A real manifest slug always beats the alias.
//
// Pure: no db, no store, no DOM.

import { DEMO_SESSION_ID, demoSessionId, LEGACY_SLUG, } from '@/lib/example-session'
import type { DemoSongManifest } from './demo-song'
import { demoIsPlayable } from './demo-song'

/** The link slug of the original demo (manifest slug `karaoke-night`). */
export const LEGACY_LINK_SLUG = 'goodbye-to-spring'

const isLegacy = (manifest: Pick<DemoSongManifest, 'slug'>): boolean =>
  demoSessionId(manifest.slug) === DEMO_SESSION_ID

/** The slug a song link uses for this example. */
export function exampleLinkSlug(
  manifest: Pick<DemoSongManifest, 'slug'>,
): string {
  return isLegacy(manifest) ? LEGACY_LINK_SLUG : (manifest.slug ?? '').trim()
}

/**
 * The playable example a song link names, or null.
 *
 * Null covers a slug nobody published, an example the studio has parked and
 * one whose stems are not filled in yet: in every case the page opens as if
 * the link had no song in it.
 */
export function findExampleBySongSlug(
  slug: string | null,
  manifests: readonly DemoSongManifest[],
): DemoSongManifest | null {
  if (slug === null) return null
  const playable = manifests.filter(demoIsPlayable)
  const exact = playable.find(
    (manifest) => !isLegacy(manifest) && (manifest.slug ?? '').trim() === slug,
  )
  if (exact !== undefined) return exact
  if (slug !== LEGACY_LINK_SLUG && slug !== LEGACY_SLUG) return null
  return playable.find(isLegacy) ?? null
}
