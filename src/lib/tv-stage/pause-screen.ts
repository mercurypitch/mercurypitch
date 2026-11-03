// ============================================================
// TV stage paused screen — what it says, and where it goes
// ============================================================
//
// While the song stands still the stage shows a paused screen over itself,
// after the TV's own player paused (the tvOS transport bar, YouTube on a
// TV): the stage stays behind, dimmed, a scrim rises from the bottom, the
// song's title sits large at the bottom left, and a bar across the screen
// shows the place, the time sung at its left beside a pause mark and the
// time left at its right. Karaoke adds one thing a video player has not:
// the line to sing next, so a singer coming back knows where they come in.
// Before the first play, with the song standing at its start, the same
// screen says the song is ready and to press play on the phone, with a play
// mark beside the time in place of the pause mark.
//
// It comes and goes with the `playing` the frames carry, fading over a
// quarter of a second from the moment the song stopped or started
// (model.ts, `turn`); fading out, it shows the place where the song
// started, not a bar already running. The song's length comes with the
// song; with none known yet the bar is left out and only the time sung
// shows.
//
// This module is plain data: what the screen says and where it goes, so it
// can be tested without a canvas. pause-paint.ts draws it.
//
// Tests: src/lib/tv-stage/pause-screen.test.ts.

import type { LyricWindowSegment } from '@/lib/lyric-window-script'
import type { TvStageBox, TvStageLayout } from './layout'
import type { TvStageState } from './model'
import { tvStagePosition } from './model'

/** How long the screen takes to fade in or out, in ms. */
export const PAUSE_FADE_MS = 250

/** A place this close to the start, in seconds, is the start: ready, not paused. */
const START_SEC = 0.05

/** What the paused screen says. */
export interface PauseScreen {
  /** Paused part way, or ready at the start before the first play. */
  readonly kind: 'paused' | 'ready'
  /** How far in it has faded, 0 to 1, eased. */
  readonly shown: number
  readonly title: string
  /** Seconds into the song. */
  readonly elapsed: number
  /** The song's length in seconds; 0 while it is not known. */
  readonly duration: number
  /** The line to sing next as the song carries on, or null for none. */
  readonly next: string | null
}

/** Smoothstep: eased in and out. */
const ease = (t: number): number => {
  const share = Math.min(1, Math.max(0, t))
  return share * share * (3 - 2 * share)
}

/** Whether every timed word of a sung line has lit by `time`. */
function sungThrough(segment: LyricWindowSegment, time: number): boolean {
  return segment.words.every(([, lit]) => lit <= time)
}

/** A segment's sung line as text, or null in a rest. */
const lineOf = (segment: LyricWindowSegment): string | null =>
  segment.current.length > 0 ? segment.current.join(' ') : null

/**
 * The line a singer comes back in on at `time`: the line being sung, if
 * part of it is still to come, else the one after it.
 */
export function lineToSing(
  lyrics: readonly LyricWindowSegment[],
  time: number,
): string | null {
  let found: LyricWindowSegment | undefined
  for (const segment of lyrics) {
    if (segment.at > time) break
    found = segment
  }
  if (found === undefined) {
    const first = lyrics[0] as LyricWindowSegment | undefined
    return first === undefined ? null : (lineOf(first) ?? first.next)
  }
  const current = lineOf(found)
  if (current !== null && !sungThrough(found, time)) return current
  return found.next
}

/** The paused screen at `nowMs`, or null while the song plays and it has faded. */
export function pauseScreenOf(
  state: TvStageState,
  nowMs: number,
): PauseScreen | null {
  const song = state.song
  if (song === null) return null
  const playing = state.clock?.playing ?? false
  const faded = ease((nowMs - state.turn.at) / PAUSE_FADE_MS)
  const shown = playing ? 1 - faded : faded
  if (shown <= 0) return null
  // Fading out, it shows where the song started from; standing, where it is.
  const elapsed = playing ? state.turn.position : tvStagePosition(state, nowMs)
  return {
    kind: elapsed < START_SEC ? 'ready' : 'paused',
    shown,
    title: song.title,
    elapsed,
    duration: song.duration,
    next: lineToSing(song.lyrics, elapsed),
  }
}

/** Whole seconds as a clock: 1:09, 19:50, 1:02:05. */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const s = whole % 60
  const m = Math.floor(whole / 60) % 60
  const h = Math.floor(whole / 3600)
  const ss = String(s).padStart(2, '0')
  return h > 0
    ? `${String(h)}:${String(m).padStart(2, '0')}:${ss}`
    : `${String(m)}:${ss}`
}

/**
 * The time sung and the time left, as the bar's ends show them. Both count
 * whole seconds of the song's whole-second length, so they always add up to
 * it; the time left carries a minus sign.
 */
export function pauseTimes(
  elapsed: number,
  duration: number,
): { readonly sung: string; readonly left: string | null } {
  const sung = formatClock(elapsed)
  if (!(duration > 0)) return { sung, left: null }
  const total = Math.floor(duration)
  const past = Math.min(total, Math.max(0, Math.floor(elapsed)))
  return { sung, left: `−${formatClock(total - past)}` }
}

/** Where the paused screen's parts go, in pixels, on this screen. */
export interface PauseLayout {
  /** The scrim: the whole safe area, darkening toward its foot. */
  readonly scrim: TvStageBox
  /** The small label over the title: "Paused", "Ready to sing". */
  readonly label: {
    readonly x: number
    readonly y: number
    readonly px: number
  }
  readonly title: {
    readonly x: number
    readonly y: number
    readonly px: number
    readonly width: number
  }
  /** The line under the title: the next line, or what to do. */
  readonly line: {
    readonly x: number
    readonly y: number
    readonly px: number
    readonly width: number
  }
  /** The bar's track: its ends, and its middle's height. */
  readonly bar: {
    readonly x0: number
    readonly x1: number
    readonly y: number
    readonly height: number
  }
  /** The knob's radius and the glow's reach beyond it. */
  readonly knob: { readonly radius: number; readonly reach: number }
  /** The mark's centre and radius (pause, or play when ready), and the times' line. */
  readonly mark: {
    readonly x: number
    readonly y: number
    readonly radius: number
  }
  readonly times: { readonly y: number; readonly px: number }
  /** How far the screen rises as it fades in, in pixels. */
  readonly rise: number
}

/**
 * The paused screen laid out on this screen, from the foot of the safe area
 * up: the times, the bar, the line, the title and the label. Sizes are in
 * units of 1080 lines; no text under the lyrics' 32 px floor, and the
 * knob's glow kept inside the inset at either end of the bar.
 */
export function pauseLayout(layout: TvStageLayout): PauseLayout {
  const { safe, unit } = layout
  const u = (units: number): number => units * unit
  const left = safe.x
  const right = safe.x + safe.w
  const timesY = safe.y + safe.h - u(26)
  const barY = timesY - u(56)
  const lineY = barY - u(66)
  const titleY = lineY - u(74)
  const labelY = titleY - u(68)
  const knob = { radius: u(15), reach: u(30) }
  return {
    scrim: safe,
    label: { x: left, y: labelY, px: u(36) },
    title: { x: left, y: titleY, px: u(80), width: safe.w },
    line: { x: left, y: lineY, px: u(36), width: safe.w },
    bar: {
      x0: left + knob.reach,
      x1: right - knob.reach,
      y: barY,
      height: u(10),
    },
    knob,
    mark: { x: left + u(24), y: timesY, radius: u(24) },
    times: { y: timesY, px: u(36) },
    rise: u(14),
  }
}

/** The x of the knob for a place `share` of the way through the song. */
export function knobX(bar: PauseLayout['bar'], share: number): number {
  const kept = Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0))
  return bar.x0 + (bar.x1 - bar.x0) * kept
}
