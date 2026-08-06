// ============================================================
// Voice Mirror entry intent — truthful copy for each search landing.
// ============================================================
//
// The vocal-range route shares the local analysis engine with Voice Mirror,
// but leads with the range result visitors asked for. Keep the distinction in
// app state as well as static metadata so the visible H1 matches the URL.

export type MirrorEntryIntent = 'voice-mirror' | 'vocal-range'

/** Resolve both the clean production path and Vite's explicit HTML path. */
export function mirrorEntryIntent(pathname: string): MirrorEntryIntent {
  const normalized = pathname.replace(/\/$/, '')
  return normalized === '/vocal-range-test' ||
    normalized === '/vocal-range-test.html'
    ? 'vocal-range'
    : 'voice-mirror'
}
