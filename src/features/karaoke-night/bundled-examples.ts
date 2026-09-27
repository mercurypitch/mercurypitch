// ============================================================
// The example songs the native app carries inside it
// ============================================================
//
// The web app learns its examples from the server (`demo-song.ts`) and
// streams them from R2. The native app ships three of them in the bundle
// (plan S8 §8, decision D13 A), so a first launch with no network already
// has a library to sing from: the manifest at `BUNDLED_EXAMPLES_URL` names
// them and carries their lyrics, and their stems are packaged files beside
// it (apps/mercurypitch/native-only/, staged by the native build).
//
// Going online later changes only what the server knows better; the rules
// are `mergeExampleManifests` in examples-library.ts, the decision layer.
//
// Native-only in effect: every caller asks behind IS_NATIVE_BUILD, so the web
// bundle never fetches this manifest.

import { fetchAssetRead } from '@irchiinnuss/mobile-runtime/asset-fetch'
import type { DemoSongManifest } from './demo-song-manifest'

/** Where the bundle's manifest is served, at the app's own origin root. */
export const BUNDLED_EXAMPLES_URL = '/karaoke/examples/manifest.json'

/** A bundled song always has its slug and both stems. */
export type BundledExample = DemoSongManifest & {
  slug: string
  stems: { vocal: string; instrumental: string }
  /**
   * Its notes, as the mixer's analysis would store them: a phone cannot
   * analyse a streamed vocal (audit K1). See `bundled-notes.ts`.
   */
  notes?: string
}

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== ''

function isBundledExample(value: unknown): value is BundledExample {
  if (typeof value !== 'object' || value === null) return false
  const song = value as Partial<BundledExample>
  return (
    nonEmpty(song.slug) &&
    nonEmpty(song.title) &&
    typeof song.artist === 'string' &&
    typeof song.attribution === 'object' &&
    song.attribution !== null &&
    typeof song.stems === 'object' &&
    song.stems !== null &&
    nonEmpty(song.stems.vocal) &&
    nonEmpty(song.stems.instrumental)
  )
}

/**
 * The songs the bundle carries, in the bundle's order.
 *
 * Read through `fetchAssetRead`, not `fetch().ok`: inside the iOS WebView a
 * packaged file answers status 0 with its bytes (audit K2). Quiet on every
 * failure — an unreadable manifest means no bundled examples this launch,
 * never a broken room — and a malformed song is dropped, not the list.
 */
export async function loadBundledExamples(): Promise<BundledExample[]> {
  try {
    const read = await fetchAssetRead(BUNDLED_EXAMPLES_URL)
    const parsed = JSON.parse(new TextDecoder().decode(read.bytes)) as {
      version?: unknown
      songs?: unknown
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.songs)) return []
    return parsed.songs.filter(isBundledExample)
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn('[Examples] the bundled manifest could not be read:', err)
    return []
  }
}
