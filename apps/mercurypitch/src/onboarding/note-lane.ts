// ============================================================
// The note lane: the voice as a line, flowing in to the head (pure)
// ============================================================
//
// The first note has no target, so the lane is the singer's own: its middle
// is the note being held (the median of the last REF_SEC of voice), and
// SPAN_CENTS either side of it fill the lane. The newest voice is at the
// head (HEAD_AT across), and older voice flows away to the left, broken
// where the voice stopped, as in every room (room-kit GlideRibbon.tsx).
//
// The demonstration line (S7b beat 2, REQ-NFL-019) is drawn the same way
// from frames made up here: a short scoop up to A3 and a held note with a
// little vibrato. It is silent, and the screen labels it (REQ-NFL-021).

import type { StrokePoint } from '@/components/room-kit/GlideRibbon'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import { CONF_MIN } from '@/lib/pitch-measurements/f0'

/** The head of the line, as a share of the lane's width. */
export const HEAD_AT = 0.66
/** Cents from the lane's middle to its edge. */
export const SPAN_CENTS = 600
/**
 * A gap between two frames longer than this breaks the line, s. A silence
 * breaks it anyway (its frames are unheard); this is for frames that never
 * came, the page hidden. The pitch stream reads once a screen frame, so it
 * is long enough for a screen drawing four frames a second: at 0.12 a
 * headless iPad-sized page at six drew no line at all.
 */
export const GAP_SEC = 0.25
/** Quieter than this is the room, not the singer (the web's AUDIBLE_RMS). */
export const AUDIBLE_RMS = 0.006
/** The voice the lane's middle follows, s back from the newest frame. */
export const REF_SEC = 1.5
/** The demo's held note: A3. */
export const DEMO_MIDI = 57
/** The demo line's length, s. */
export const DEMO_SEC = 2.6
/** The demo's loop: the line, then a rest before it draws again, s. */
export const DEMO_LOOP_SEC = 4.2

export interface LaneBox {
  readonly width: number
  readonly height: number
  /** Where the newest voice is drawn, px from the lane's left. */
  readonly headX: number
  /** The held note's height, px from the lane's top. */
  readonly midY: number
  /** SPAN_CENTS above or below the middle, px. */
  readonly half: number
  /** How fast the line flows away from the head, px a second. */
  readonly pxPerSec: number
}

/** The lane in a box of this size, px. */
export function laneFor(width: number, height: number): LaneBox {
  return {
    width,
    height,
    headX: Math.round(width * HEAD_AT),
    midY: height / 2,
    half: Math.max(8, height / 2 - 12),
    pxPerSec: Math.min(140, Math.max(60, width * 0.22)),
  }
}

/** Fractional MIDI of a frequency. */
export function midiOf(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440)
}

function heard(frame: PitchFrame): boolean {
  return frame.f0 > 0 && frame.conf >= CONF_MIN && frame.rms >= AUDIBLE_RMS
}

/**
 * The note the lane is centred on: the median of the voice in the last
 * REF_SEC, fractional MIDI. Null before any voice.
 */
export function laneReference(frames: readonly PitchFrame[]): number | null {
  if (frames.length === 0) return null
  const from = frames[frames.length - 1].t - REF_SEC
  const notes: number[] = []
  for (let i = frames.length - 1; i >= 0 && frames[i].t >= from; i--) {
    if (heard(frames[i])) notes.push(midiOf(frames[i].f0))
  }
  if (notes.length === 0) return null
  notes.sort((a, b) => a - b)
  const mid = notes.length >> 1
  return notes.length % 2 === 1 ? notes[mid] : (notes[mid - 1] + notes[mid]) / 2
}

/**
 * The voice on screen at `now` (s, on the frames' clock), as unbroken
 * strokes around `ref` (fractional MIDI).
 */
export function voiceStrokes(
  frames: readonly PitchFrame[],
  now: number,
  lane: LaneBox,
  ref: number,
): StrokePoint[][] {
  const strokes: StrokePoint[][] = []
  let stroke: StrokePoint[] = []
  let last = Number.NEGATIVE_INFINITY
  const close = (): void => {
    if (stroke.length > 1) strokes.push(stroke)
    stroke = []
  }
  for (const frame of frames) {
    const x = lane.headX - (now - frame.t) * lane.pxPerSec
    if (x < -8 || !heard(frame)) {
      close()
      continue
    }
    if (frame.t - last > GAP_SEC) close()
    last = frame.t
    const cents = (midiOf(frame.f0) - ref) * 100
    const lift = Math.min(1, Math.max(-1, cents / SPAN_CENTS))
    stroke.push({ x, y: lane.midY - lift * lane.half, filling: true })
  }
  close()
  return strokes
}

const DEMO_FPS = 60

/** The demo's voice from its start to `at` s: a scoop up to A3, then held. */
export function demoFrames(at: number): PitchFrame[] {
  const frames: PitchFrame[] = []
  const end = Math.min(at, DEMO_SEC)
  for (let i = 0; i / DEMO_FPS <= end; i++) {
    const t = i / DEMO_FPS
    const scoop = t < 0.5 ? -250 * (1 - t / 0.5) ** 2 : 0
    const vibrato = t > 0.9 ? 12 * Math.sin(2 * Math.PI * 5 * (t - 0.9)) : 0
    const midi = DEMO_MIDI + (scoop + vibrato) / 100
    frames.push({
      t,
      f0: 440 * 2 ** ((midi - 69) / 12),
      conf: 0.95,
      rms: 0.08,
    })
  }
  return frames
}

/** Where the demo line is at `elapsed` s since it began: its own clock. */
export function demoClock(elapsed: number): number {
  return Math.min(DEMO_SEC, elapsed % DEMO_LOOP_SEC)
}
