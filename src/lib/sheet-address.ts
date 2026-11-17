// ============================================================
// Sheet address — the key and scale `#/singing/sheet` names
// ============================================================
//
// `#/singing/sheet` opens the Singing tab on its sheet view (the route is
// in hash-router.ts), and may say which key to read it in:
//
//   #/singing/sheet?key=G                      G major
//   #/singing/sheet?key=Bb                     B flat major
//   #/singing/sheet?key=A&scale=harmonic-minor A harmonic minor
//
// `key` is the key's do, in the names a Sight-Singing launch uses (`G`,
// `Bb`, `F#`; slug-map.ts) and read by the same parser (key-names.ts).
// `scale` is one of the app's scale types (`major`, `natural-minor`,
// `harmonic-minor`, `dorian`…), or `minor` for the natural minor. A key
// with no scale is a major key, as it is for a launch. A word that cannot
// be read is dropped, never guessed at: a misspelt key opens the sheet in
// the key the tab already has.
//
// Pure: no page, no store.

import { keyNameFor, parseKeyName } from '@/lib/key-names'
import { SCALE_DEFINITIONS } from '@/lib/scale-data'

export interface SheetKey {
  /** The key's do, one of the twelve of its scale type; null to leave the tab's own. */
  readonly key: string | null
  /** The scale type; null to leave the tab's own. */
  readonly scale: string | null
}

/** What a sheet address's `key` and `scale` name, from its own words (null for a word it lacks). */
export function sheetKeyOf(key: string | null, scale: string | null): SheetKey {
  const asked = scale === 'minor' ? 'natural-minor' : scale
  const named =
    asked !== null && Object.hasOwn(SCALE_DEFINITIONS, asked) ? asked : null
  if (key === null || parseKeyName(key) === null) {
    return { key: null, scale: named }
  }
  const scaleType = named ?? 'major'
  return { key: keyNameFor(key, scaleType), scale: scaleType }
}
