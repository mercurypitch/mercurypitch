// ============================================================
// Voice Mirror entry intent — truthful copy for each search landing.
// ============================================================
//
// The vocal-range route shares the local analysis engine with Voice Mirror,
// but leads with the range result visitors asked for. Keep the distinction in
// app state as well as static metadata so the visible H1 matches the URL.

export type MirrorEntryIntent = 'voice-mirror' | 'vocal-range' | 'free-sing'

/** Resolve both the clean production path and Vite's explicit HTML path.
 *
 *  `/free-sing` is deliberately unlinked from the landing: the open-take mode
 *  used to sit beside the guided one as a second button, which split the
 *  decision at the worst possible moment. It keeps an address so a brief or a
 *  campaign can send someone straight to it. */
export function mirrorEntryIntent(pathname: string): MirrorEntryIntent {
  const normalized = pathname.replace(/\/$/, '')
  if (
    normalized === '/vocal-range-test' ||
    normalized === '/vocal-range-test.html'
  ) {
    return 'vocal-range'
  }
  if (normalized === '/free-sing' || normalized === '/free-sing.html') {
    return 'free-sing'
  }
  return 'voice-mirror'
}
