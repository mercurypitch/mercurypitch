// ============================================================
// Voice Mirror entry intent — truthful copy for each search landing.
// ============================================================
//
// The vocal-range route shares the local analysis engine with Voice Mirror,
// but leads with the range result visitors asked for. Keep the distinction in
// app state as well as static metadata so the visible H1 matches the URL.
//
// The voice-type test and the singer match are doors of their own for the
// same reason. They fell through to the Mirror's own door, so once the app
// was up all three pages read as one, word for word (SEO audit, 6 Nov 2026).

import { entryPath } from '@/lib/entry-path'

export type MirrorEntryIntent =
  | 'voice-mirror'
  | 'vocal-range'
  | 'voice-type'
  | 'singer-match'
  | 'free-sing'

/** The dedicated doors, by the path their document is served at. */
const DOORS: ReadonlyMap<string, MirrorEntryIntent> = new Map<
  string,
  MirrorEntryIntent
>([
  ['/vocal-range-test', 'vocal-range'],
  ['/voice-type-test', 'voice-type'],
  ['/which-singer-has-my-vocal-range', 'singer-match'],
  ['/free-sing', 'free-sing'],
])

/** Resolve both the clean production path and Vite's explicit HTML path.
 *
 *  `/free-sing` is deliberately unlinked from the landing: the open-take mode
 *  used to sit beside the guided one as a second button, which split the
 *  decision at the worst possible moment. It keeps an address so a brief or a
 *  campaign can send someone straight to it. */
export function mirrorEntryIntent(pathname: string): MirrorEntryIntent {
  return DOORS.get(entryPath(pathname)) ?? 'voice-mirror'
}

/** The query flag Home's weekly Check-up card opens the Mirror with. */
export const CHECKUP_PARAM = 'checkup'

/**
 * Whether this visit is the weekly Check-up (`/mirror?checkup=1`, from Home's
 * card). It changes only what the landing says: the run is the same guided
 * run, so every take compares with every other (REQ-GVC-060). It sits beside
 * the `?v=` of a shared voiceprint without touching it.
 */
export function isCheckupVisit(search: string): boolean {
  try {
    return new URLSearchParams(search).get(CHECKUP_PARAM) === '1'
  } catch {
    return false
  }
}
