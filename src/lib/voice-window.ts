// ============================================================
// Voice window — two octaves of rows that follow the singer
// ============================================================
//
// A free pitch trace (no melody to fit the view to) is read against a window
// of exactly two octaves. It opens on the singer's declared voice type, the
// `lowMidi..highMidi` band of `VOCAL_RANGES`, and moves only when the voice
// has SETTLED outside it: a held note past the top or bottom row for
// `VOICE_WINDOW_SETTLE_MS`. Two things must never move it:
//
//   silence       a frame with no pitch clears a pending move. Gaps never add
//                 up, so a run of short blips with rests between them is
//                 still nothing.
//   octave blips  a detector that jumps twelve up for a few frames lands
//                 outside the window, but not for long enough. A frame back
//                 inside (or on the other side) restarts the clock.
//
// A move is in whole semitones and leaves `VOICE_WINDOW_HEADROOM` between the
// note that caused it and the edge, so the next phrase is not drawn on the
// border. The canvas eases between windows (`easeMidiWindow`).
//
// The span and the fallback are the ones Zen already frames its canvas with
// (`fitZenViewport`, `DEFAULT_ZEN_VIEWPORT_SPAN`): two octaves, C3 to C5 when
// nothing says otherwise. The limits are `PitchCanvas`'s own C1 to C7.

/** A vertical view, in MIDI notes. `maxMidi - minMidi` is the span. */
export interface MidiWindow {
  minMidi: number
  maxMidi: number
}

/** Two octaves. */
export const VOICE_WINDOW_SPAN = 24

/** C3 to C5: the window when no voice type has been chosen. */
export const DEFAULT_VOICE_WINDOW: MidiWindow = { minMidi: 48, maxMidi: 72 }

/** C1 to C7, the furthest `PitchCanvas` will show. */
export const VOICE_WINDOW_LIMITS: MidiWindow = { minMidi: 24, maxMidi: 96 }

/**
 * How long the voice must stay outside the window before it moves.
 *
 * Twice the end card's "held" rule (`RANGE_HOLD_MS`, 150 ms): long enough that
 * an onset scoop or a detector's octave error is over before it counts, short
 * enough that a held note is on screen before the singer wonders where it
 * went.
 */
export const VOICE_WINDOW_SETTLE_MS = 300

/** Semitones left between the note that moved the window and its edge. */
export const VOICE_WINDOW_HEADROOM = 3

/** A quarter of a semitone past the edge row is still on it. */
const EDGE_TOLERANCE = 0.25

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/** Two octaves inside the canvas limits, with `minMidi` as the anchor. */
function windowFrom(minMidi: number): MidiWindow {
  const min = clamp(
    Math.round(minMidi),
    VOICE_WINDOW_LIMITS.minMidi,
    VOICE_WINDOW_LIMITS.maxMidi - VOICE_WINDOW_SPAN,
  )
  return { minMidi: min, maxMidi: min + VOICE_WINDOW_SPAN }
}

/**
 * The window a voice type opens on: its comfortable band, two octaves.
 *
 * Every preset's band is already two octaves, so this is that band. A band of
 * any other width is centred, and no band at all is `DEFAULT_VOICE_WINDOW`.
 */
export function voiceWindowFor(
  range: { lowMidi: number; highMidi: number } | null | undefined,
): MidiWindow {
  if (
    range === null ||
    range === undefined ||
    !Number.isFinite(range.lowMidi) ||
    !Number.isFinite(range.highMidi)
  ) {
    return { ...DEFAULT_VOICE_WINDOW }
  }
  const centre = (range.lowMidi + range.highMidi) / 2
  return windowFrom(centre - VOICE_WINDOW_SPAN / 2)
}

export interface VoiceWindowFollower {
  /**
   * One detection frame. `midi` is fractional (a sung pitch is rarely on a
   * row), or null for a frame that heard no pitch. Returns the window after
   * this frame.
   */
  push: (atMs: number, midi: number | null) => MidiWindow
  window: () => MidiWindow
  /** Back to `home`, or to the home it was made with. Drops a pending move. */
  reset: (home?: MidiWindow) => void
}

export function createVoiceWindowFollower(
  home: MidiWindow,
  options: { settleMs?: number; headroom?: number } = {},
): VoiceWindowFollower {
  const settleMs = options.settleMs ?? VOICE_WINDOW_SETTLE_MS
  const headroom = options.headroom ?? VOICE_WINDOW_HEADROOM
  let homeWindow = windowFrom(home.minMidi)
  let current = homeWindow
  /** The voice outside the window: which side, since when, how far out. */
  let pending: { side: 1 | -1; sinceMs: number; extreme: number } | null = null

  const push = (atMs: number, midi: number | null): MidiWindow => {
    if (midi === null || !Number.isFinite(midi) || !Number.isFinite(atMs)) {
      pending = null
      return current
    }
    const side =
      midi > current.maxMidi + EDGE_TOLERANCE
        ? 1
        : midi < current.minMidi - EDGE_TOLERANCE
          ? -1
          : 0
    if (side === 0) {
      pending = null
      return current
    }
    if (pending?.side !== side) {
      pending = { side, sinceMs: atMs, extreme: midi }
      return current
    }
    pending.extreme =
      side === 1
        ? Math.max(pending.extreme, midi)
        : Math.min(pending.extreme, midi)
    if (atMs - pending.sinceMs < settleMs) return current

    current =
      side === 1
        ? windowFrom(Math.ceil(pending.extreme) + headroom - VOICE_WINDOW_SPAN)
        : windowFrom(Math.floor(pending.extreme) - headroom)
    pending = null
    return current
  }

  return {
    push,
    window: () => current,
    reset(next) {
      if (next !== undefined) homeWindow = windowFrom(next.minMidi)
      current = homeWindow
      pending = null
    },
  }
}

/**
 * Where the view is `t` of the way from one window to the next (0 to 1).
 *
 * Ease-out cubic: the move is mostly done in the first third, so the line
 * that caused it is back on screen at once and the rest is the rows settling.
 */
export function easeMidiWindow(
  from: MidiWindow,
  to: MidiWindow,
  t: number,
): MidiWindow {
  const p = clamp(t, 0, 1)
  const eased = 1 - (1 - p) ** 3
  return {
    minMidi: from.minMidi + (to.minMidi - from.minMidi) * eased,
    maxMidi: from.maxMidi + (to.maxMidi - from.maxMidi) * eased,
  }
}
