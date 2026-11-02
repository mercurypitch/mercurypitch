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
// While a song should be playing this looks at the clock four times a
// second. Once it has seen the clock move, a clock that then moves less
// than MOVED_SECONDS in STALL_MS has stalled: one warning, `clock-stall`,
// with what the room says was true (`facts`: the clock's state, the route,
// whether the stream has sound queued), and one try to get it going
// (`recover`). Still standing STALL_MS later, `clock-stall-stop` and
// `giveUp`, which stops the song. A clock that moves again is said once
// more, `clock-moving`, with how long it stood.
//
// What it leaves alone, so it never cries wolf:
//   - a song paused, ended or at its end, which `watching` says;
//   - a hidden page, where iOS parks Web Audio and timers are throttled;
//   - an 'interrupted' clock: the system's, which the room pauses for and
//     nothing here may resume (MISTAKES.md, "Never resume an AudioContext
//     that iOS interrupted");
//   - a clock not yet seen to move since watching began: a press of play
//     that never starts, or a way back to the app that does not, is the
//     start and return checks' (playback-return-watch.ts);
//   - a seek or a loop going round: the clock runs on through both, and
//     only the song's place jumps.

import type { AudioReport } from '@/lib/audio-diagnostics'

/** How long a clock may stand still while a song plays. */
export const STALL_MS = 1500
/** How often the clock is looked at. */
export const WATCH_EVERY_MS = 250
/** Less than this over STALL_MS is a clock that is not running. */
export const MOVED_SECONDS = 0.25

export interface ClockWatchdogOptions {
  /** The song's clock, or null before it has one. */
  readonly clock: () => BaseAudioContext | null
  /** The song should be sounding: playing, and short of its end. */
  readonly watching: () => boolean
  readonly report: AudioReport
  /** What the record says beside a stall: state, route, feed, place. */
  readonly facts: () => Record<string, unknown>
  /** The clock has stood still: one try to get it going. */
  readonly recover: () => void
  /** Still standing after `recover`: stop the song. */
  readonly giveUp: () => void
  /** Wall time in ms; Date.now unless a test says otherwise. */
  readonly now?: () => number
  readonly stallMs?: number
  readonly everyMs?: number
}

/** Where the clock was last seen to move, by the wall clock and its own. */
interface Mark {
  readonly of: BaseAudioContext
  readonly wall: number
  readonly clock: number
}

/** A stall under way: since when, when the clock was asked back, and done. */
interface Stall {
  readonly since: number
  readonly asked: number
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
 * Watch the clock until the stop it returns is called. A room starts one
 * with each press of play and stops it with each pause.
 */
export function watchSongClock(options: ClockWatchdogOptions): () => void {
  const now = options.now ?? Date.now
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

  const moved = (clock: BaseAudioContext, wall: number): void => {
    if (stall !== null) {
      options.report('clock-moving', {
        ...options.facts(),
        stoodMs: Math.round(wall - stall.since),
      })
    }
    stall = null
    armed = true
    mark = { of: clock, wall, clock: clock.currentTime }
  }

  const stoodStill = (since: Mark, wall: number): void => {
    const stoodMs = Math.round(wall - since.wall)
    if (stall === null) {
      if (stoodMs < stallMs) return
      stall = { since: since.wall, asked: wall, stopped: false }
      options.report('clock-stall', { ...options.facts(), stoodMs }, true)
      options.recover()
      return
    }
    if (stall.stopped || wall - stall.asked < stallMs) return
    stall.stopped = true
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
    const wall = now()
    if (mark === null || mark.of !== clock || clock.currentTime < mark.clock) {
      // The first look, or a clock made since: start from here, unarmed.
      forget()
      mark = { of: clock, wall, clock: clock.currentTime }
    } else if (clock.currentTime - mark.clock >= MOVED_SECONDS) {
      moved(clock, wall)
    } else if (armed) {
      stoodStill(mark, wall)
    }
  }

  const next = (): void => {
    timer = setTimeout(() => {
      timer = undefined
      try {
        look()
      } finally {
        // A give-up stops the song, and with it, this watch.
        if (!over) next()
      }
    }, everyMs)
  }
  next()

  return () => {
    over = true
    clearTimeout(timer)
    timer = undefined
  }
}
