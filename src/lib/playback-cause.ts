// ============================================================
// Playback cause — who paused or played a song, for its log line
// ============================================================
//
// Every play and pause of a Karaoke song reaches one function of its
// player (the stem mixer's handlePlay and handlePause), and that function
// cannot see who called it. On the owner's iPhone, with the sound on a TV
// over AirPlay, the song paused itself a second or two after Play, and
// nothing in the console said who had paused it (3 Nov 2026).
//
// So the caller says. `asPlaybackCause('media-session(pause)', pause)` runs
// the pause as the lock screen's doing, and the player's line names the
// innermost cause still running (`playbackCause`). A caller that names
// none leaves the player's fallback, which says so (`UNNAMED_CAUSE`): a
// path nobody named shows up in a log instead of passing for another.
//
// Synchronous on purpose. A press plays or pauses in the same task as the
// press, so the cause is set for exactly that call and put back after it,
// a throw included. Anything that plays later (a timer, a promise) names
// its own cause when it runs.

/** What a play or pause no caller named says it was by. */
export const UNNAMED_CAUSE = 'unknown'

let current: string | null = null

/** Run `act` as `cause`'s doing: a play or pause it makes is said as theirs. */
export function asPlaybackCause<T>(cause: string, act: () => T): T {
  const outer = current
  current = cause
  try {
    return act()
  } finally {
    current = outer
  }
}

/** Who is playing or pausing now: the innermost cause, or `fallback`. */
export function playbackCause(fallback: string = UNNAMED_CAUSE): string {
  return current ?? fallback
}
