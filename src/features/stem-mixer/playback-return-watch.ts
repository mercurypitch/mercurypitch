// ============================================================
// The song's clock, checked on the way back to the app
// ============================================================
//
// A song a room keeps playing behind another app has to still be playing
// when the singer comes back. On an iPhone (owner, 2 Oct) it once was not:
// the music had stopped and the transport answered nothing. Nothing on the
// phone said why. This watches the page leave and come back and writes what
// it finds to the audio record (src/lib/audio-diagnostics.ts), whose Copy
// button carries it off the phone: whether the song was playing, where it
// was, the clock's state and time, how long the page was away and how far
// the clock moved meanwhile.
//
// It also acts on the one failure it can be sure of. After the return, a
// song that says it is playing on a clock that does not move is making no
// sound. The watch asks for the clock back once (`recover`); if it still
// has not moved, it stops the run (`giveUp`), so the transport says what is
// true and the next press on play, a gesture iOS accepts, starts it again.
//
// A press of play gets the same check (`watchClockMoves`): after another app
// had the sound, iOS could leave the clock reporting 'running' with nothing
// behind it (docs/plans/mobile-native/ios-audio-handoff.md).

import type { AudioReport } from '@/lib/audio-diagnostics'

/** How long after the return the clock has to have moved by. */
export const RETURN_CHECK_MS = 1500
/** How long after a press of play the clock has to have moved by. */
export const START_CHECK_MS = 700
/** Less than this over a check is a clock that is not running. */
const STUCK_BELOW_SECONDS = 0.25

/** What a check of the clock needs: `PlaybackReturnWatchOptions`' own. */
export interface ClockWatchOptions {
  readonly clock: () => BaseAudioContext | null
  readonly playing: () => boolean
  readonly report: AudioReport
  /** The clock has not moved: ask for it back. */
  readonly recover: () => void
  /** Still not moving after `recover`: stop the run. */
  readonly giveUp: () => void
  readonly checkAfterMs: number
  /** What the record says beside a stuck clock. */
  readonly facts: () => Record<string, unknown>
}

export interface PlaybackReturnWatchOptions {
  /** The run's clock, or null before it has one. */
  readonly clock: () => BaseAudioContext | null
  readonly playing: () => boolean
  /** Seconds into the song, for the record. */
  readonly position: () => number
  readonly report: AudioReport
  /** The clock has not moved since the return: ask for it back. */
  readonly recover: () => void
  /** Still not moving after `recover`: stop the run. */
  readonly giveUp: () => void
  readonly checkAfterMs?: number
}

const round = (seconds: number): number => Math.round(seconds * 1000) / 1000

/** Watches every return to the page until the stop it returns is called. */
export function watchPlaybackReturn(
  options: PlaybackReturnWatchOptions,
): () => void {
  if (typeof document === 'undefined') return () => undefined
  const checkAfterMs = options.checkAfterMs ?? RETURN_CHECK_MS
  let left: { wall: number; clock: number | null } | null = null

  const facts = (): Record<string, unknown> => {
    const clock = options.clock()
    return {
      playing: options.playing(),
      position: round(options.position()),
      state: clock?.state ?? 'none',
      clock: clock === null ? null : round(clock.currentTime),
    }
  }

  let stopCheck = (): void => undefined
  const checkClock = (from: number): void => {
    stopCheck = watchClockMoves({ ...options, checkAfterMs, facts }, from)
  }

  const onVisibility = (): void => {
    stopCheck()
    const clock = options.clock()
    const now = clock === null ? null : clock.currentTime
    if (document.visibilityState === 'hidden') {
      left = { wall: Date.now(), clock: now }
      options.report('page-hidden', facts())
      return
    }
    const away = left
    left = null
    options.report('page-visible', {
      ...facts(),
      ...(away === null
        ? {}
        : {
            awayMs: Date.now() - away.wall,
            clockMoved:
              now === null || away.clock === null
                ? null
                : round(now - away.clock),
          }),
    })
    if (now !== null && options.playing()) checkClock(now)
  }

  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    stopCheck()
  }
}

/**
 * Whether the clock has moved `checkAfterMs` after `from`, a time on it: if
 * not, `recover` once and look again, and still not, `giveUp`. Nothing while
 * the song is not playing or the page is hidden, where no check is fair.
 * Returns a stop.
 */
export function watchClockMoves(
  options: ClockWatchOptions,
  from: number,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const check = (since: number, attempt: number): void => {
    timer = setTimeout(() => {
      timer = undefined
      const clock = options.clock()
      if (clock === null || !options.playing()) return
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      )
        return
      const moved = clock.currentTime - since
      if (moved >= STUCK_BELOW_SECONDS) return
      options.report(
        'clock-stuck',
        { ...options.facts(), moved: round(moved), attempt },
        true,
      )
      if (attempt > 1) {
        options.giveUp()
        return
      }
      options.recover()
      check(clock.currentTime, attempt + 1)
    }, options.checkAfterMs)
  }
  check(from, 1)
  return () => {
    clearTimeout(timer)
    timer = undefined
  }
}
