// ============================================================
// Clock watchdog — a playing song whose clock stopped, said and answered
// ============================================================
//
// A Karaoke song is Web Audio. Its stems are buffers scheduled on the
// AudioContext's clock, and the transport reads that clock too (where play
// started, plus how far the clock has moved). So a clock that stops
// advancing stops everything at once and raises nothing: the song sits
// "playing" at one place, silent, and a streamed stem stops feeding as
// well, because its next window waits for one to end and none ends on a
// clock that does not move (streaming-stem-voice.ts, waitForRoom). The
// owner's song did just that with its sound on a TV over AirPlay (2 Nov
// 2026: "the tv is stuck song is stuck on karaoke ... no errors").
//
// ONE STARTING POINT, ONE LINE. The watch reads the clock as it starts,
// where the press of play left it, and again as the page comes back into
// view, which is where the start and return checks read it too
// (playback-return-watch.ts). It arms once the clock has moved
// STUCK_BELOW_SECONDS from there, the line those checks pass a clock on. So
// a clock they let pass is one it watches: a clock that ran half a second
// after play and stood was caught by neither once (review, 2 Nov).
//
// Armed, a clock that then moves less than that in STALL_MS has stalled:
// one warning, `clock-stall`, with what the room says was true (`facts`:
// the clock's state, the route, whether the stream has sound queued), and
// one try to get it going (`recover`). Still standing STALL_MS after that
// try is done, `clock-stall-stop` and `giveUp`, which stops the song; a try
// that never finishes is given RESTART_LIMIT_MS. A clock that moves again
// is said once more, `clock-moving`, with how long it stood.
//
// Its time is the page's own monotonic clock (performance.now): a wall
// clock set forward (network time, a hand on the settings) is not a stall.
//
// What it leaves alone, so it never cries wolf:
//   - a song paused, ended or at its end, which `watching` says;
//   - a hidden page, where iOS parks Web Audio: the watch stops looking
//     until the page is back, and starts again from a fresh reading;
//   - an 'interrupted' clock: the system's, which the room pauses for and
//     nothing here may resume (MISTAKES.md, "Never resume an AudioContext
//     that iOS interrupted");
//   - a clock not yet seen to move since play or the return: the start and
//     return checks' own;
//   - a new route (`fresh`): AirPlay picked mid-song takes a moment to set
//     up, so the window starts over from the change, armed as it was;
//   - a seek or a loop going round: the clock runs on through both, and
//     only the song's place jumps.

import type { AudioReport } from '@/lib/audio-diagnostics'
import { STUCK_BELOW_SECONDS } from './playback-return-watch'

/** How long a clock may stand still while a song plays. */
export const STALL_MS = 1500
/** How often the clock is looked at, while the page is in view. */
export const WATCH_EVERY_MS = 250
/** Less than this over STALL_MS is a clock that is not running. */
export const MOVED_SECONDS = STUCK_BELOW_SECONDS
/**
 * A try to get the clock going (a suspend, then a resume) that has not
 * finished by now is a clock that will not come back: the song stops,
 * rather than waiting on it for ever.
 */
export const RESTART_LIMIT_MS = 5000

export interface ClockWatchdogOptions {
  /** The song's clock, or null before it has one. */
  readonly clock: () => BaseAudioContext | null
  /** The song should be sounding: playing, and short of its end. */
  readonly watching: () => boolean
  readonly report: AudioReport
  /** What the record says beside a stall: state, route, feed, place. */
  readonly facts: () => Record<string, unknown>
  /** The clock has stood still: one try to get it going, settled when done. */
  readonly recover: () => Promise<unknown> | undefined
  /** Still standing after that try: stop the song. */
  readonly giveUp: () => void
  /** Monotonic time in ms; performance.now unless a test says otherwise. */
  readonly now?: () => number
  readonly stallMs?: number
  readonly everyMs?: number
}

/** A watch under way. */
export interface SongClockWatch {
  /** A new route: the window starts over from here, armed as it was. */
  fresh(): void
  stop(): void
}

/** Where the clock was last seen to move: which clock, when, and its time. */
interface Mark {
  readonly of: BaseAudioContext
  readonly at: number
  readonly clock: number
}

/** A stall under way: since when, the try asked and done, and the stop. */
interface Stall {
  readonly since: number
  readonly asked: number
  restarted: number | null
  stopped: boolean
}

const pageHidden = (): boolean =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden'

/**
 * Whether the stream was feeding, for a stall's line: `yes` while every
 * streamed stem has sound queued past the clock (the clock stopped on its
 * own), `no` once one has run dry, `buffered` for a song decoded whole,
 * where nothing streams. `queued` is the least any stem has, in seconds.
 */
export function streamFeed(
  voices: readonly { queuedSeconds(): number }[],
): Record<string, unknown> {
  if (voices.length === 0) return { feeding: 'buffered' }
  const queued = Math.min(...voices.map((voice) => voice.queuedSeconds()))
  return {
    feeding: queued > 0 ? 'yes' : 'no',
    queued: Math.round(queued * 1000) / 1000,
  }
}

/**
 * Watch the clock until the watch is stopped. A room starts one with each
 * press of play and stops it with each pause.
 */
export function watchSongClock(options: ClockWatchdogOptions): SongClockWatch {
  const now = options.now ?? (() => performance.now())
  const stallMs = options.stallMs ?? STALL_MS
  const everyMs = options.everyMs ?? WATCH_EVERY_MS
  let mark: Mark | null = null
  let armed = false
  let stall: Stall | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let over = false

  const forget = (): void => {
    mark = null
    armed = false
    stall = null
  }

  /** Read the clock where it is: the window starts here. */
  const readFrom = (keepArmed: boolean): void => {
    const clock = options.clock()
    const wasArmed = armed
    forget()
    if (clock === null) return
    mark = { of: clock, at: now(), clock: clock.currentTime }
    armed = keepArmed && wasArmed
  }

  const moved = (clock: BaseAudioContext, at: number): void => {
    if (stall !== null) {
      options.report('clock-moving', {
        ...options.facts(),
        stoodMs: Math.round(at - stall.since),
      })
    }
    stall = null
    armed = true
    mark = { of: clock, at, clock: clock.currentTime }
  }

  /** The try is over: done STALL_MS ago, or never done in the limit. */
  const tryIsOver = (episode: Stall, at: number): boolean =>
    episode.restarted === null
      ? at - episode.asked >= RESTART_LIMIT_MS
      : at - episode.restarted >= stallMs

  const beginStall = (since: Mark, at: number): void => {
    const episode: Stall = {
      since: since.at,
      asked: at,
      restarted: null,
      stopped: false,
    }
    stall = episode
    const stoodMs = Math.round(at - since.at)
    options.report('clock-stall', { ...options.facts(), stoodMs }, true)
    const done = (): void => {
      if (stall === episode) episode.restarted = now()
    }
    void Promise.resolve(options.recover()).then(done, done)
  }

  const stoodStill = (since: Mark, at: number): void => {
    if (stall === null) {
      if (at - since.at >= stallMs) beginStall(since, at)
      return
    }
    if (stall.stopped || !tryIsOver(stall, at)) return
    stall.stopped = true
    const stoodMs = Math.round(at - since.at)
    options.report('clock-stall-stop', { ...options.facts(), stoodMs }, true)
    options.giveUp()
  }

  const sounding = (clock: BaseAudioContext): boolean =>
    options.watching() && !pageHidden() && String(clock.state) !== 'interrupted'

  const look = (): void => {
    const clock = options.clock()
    if (clock === null || !sounding(clock)) {
      forget()
      return
    }
    const at = now()
    if (mark === null || mark.of !== clock || clock.currentTime < mark.clock) {
      // No reading yet, or a clock made since: start from here, unarmed.
      readFrom(false)
    } else if (clock.currentTime - mark.clock >= MOVED_SECONDS) {
      moved(clock, at)
    } else if (armed) {
      stoodStill(mark, at)
    }
  }

  const stopLooking = (): void => {
    clearTimeout(timer)
    timer = undefined
  }
  const next = (): void => {
    timer = setTimeout(() => {
      timer = undefined
      try {
        look()
      } finally {
        // A give-up stops the song, and with it, this watch.
        if (!over && !pageHidden()) next()
      }
    }, everyMs)
  }

  const onVisibility = (): void => {
    stopLooking()
    if (over) return
    if (pageHidden()) {
      forget()
      return
    }
    // Back in view: from where the clock is now, as the return check reads it.
    readFrom(false)
    next()
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility)
  }

  // Where the press of play left the clock, as the start check reads it.
  if (!pageHidden()) {
    readFrom(false)
    next()
  }

  return {
    fresh: () => {
      if (mark !== null) readFrom(true)
    },
    stop: () => {
      over = true
      stopLooking()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    },
  }
}
