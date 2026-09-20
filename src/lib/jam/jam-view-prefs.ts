// ── Jam view preferences ─────────────────────────────────────────────
// How one person wants to look at a song room, remembered on their own
// device.
//
// None of this is room state and none of it crosses the wire. How far a
// singer zooms their lanes, whether they want the words centred, how big
// they need them, and how they split the stage between lyrics and lanes
// are all the same kind of choice: broadcasting any of them would make
// one person's eyesight everybody's layout. The room store holds what the
// band must agree on; this holds what it must not.
//
// Each value carries a validator, because localStorage is an untyped
// input -- an old build, a hand-edited key or a half-written value all
// arrive here as `unknown`, and a NaN split share is a room with no
// lyrics in it.

import { clampJamZoom, isJamZoom, JAM_ZOOM_MIN } from '@/lib/jam/jam-lane-zoom'
import { clampJamLyricsScale, isJamLyricsScale, JAM_LYRICS_SCALE_DEFAULT, } from '@/lib/jam/jam-lyrics-scale'
import { createPersistedSignal } from '@/lib/storage'

// ── Lyric alignment ──────────────────────────────────────────────────

/**
 * Structurally the stem mixer's `LyricsAlign`, declared here rather than
 * imported so a lyric column in a jam room does not pull a mixer module
 * into its graph. The two are deliberately the same three values, so the
 * shared alignment controls (the mixer's `LyricsAlignSelect` chip, the
 * room's `LyricsAlignButtons`) fit either signal without a mapping.
 */
export type JamLyricsAlign = 'left' | 'center' | 'right'

/** Its own key, so the room and the mixer never fight over one setting. */
export const JAM_LYRICS_ALIGN_KEY = 'pitchperfect_jam_lyrics_align'

export function isJamLyricsAlign(value: unknown): value is JamLyricsAlign {
  return value === 'left' || value === 'center' || value === 'right'
}

/**
 * Centred by default.
 *
 * A room's lyric column is read the way a teleprompter is read -- eyes
 * parked in one place while the words move under them -- and on a wide
 * desktop a left-aligned column puts the words against one edge with a
 * hand's width of nothing beside them.
 */
export const [jamLyricsAlign, setJamLyricsAlign] =
  createPersistedSignal<JamLyricsAlign>(JAM_LYRICS_ALIGN_KEY, 'center', {
    validator: isJamLyricsAlign,
  })

// ── Lyric size ───────────────────────────────────────────────────────

/** Its own key, like the alignment's: the stem editor's lyric size is its own. */
export const JAM_LYRICS_SCALE_KEY = 'pitchperfect_jam_lyrics_scale'

const [lyricsScale, setLyricsScale] = createPersistedSignal<number>(
  JAM_LYRICS_SCALE_KEY,
  JAM_LYRICS_SCALE_DEFAULT,
  { validator: isJamLyricsScale },
)

/** A multiplier on the lyric column's font size. 1 is the shipped size. */
export const jamLyricsScale = lyricsScale

/**
 * Clamped in the setter, so no call site has to remember the range.
 *
 * Three things write this -- the buttons, a wheel and a pinch -- and the
 * last two overshoot as a matter of course. A value outside the range
 * would also fail its own validator on the next load and silently reset
 * the viewer to 100%.
 */
export function setJamLyricsScale(next: number): number {
  const clamped = clampJamLyricsScale(next)
  setLyricsScale(clamped)
  return clamped
}

// ── Extra playback controls ──────────────────────────────────────────

export const JAM_MORE_CONTROLS_KEY = 'pitchperfect_jam_more_controls'

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/**
 * Whether the playback bar keeps its extra controls open.
 *
 * Folded away by default: the tempo and the room's mode are set once and
 * then left alone, and the width they took is width the song's timeline
 * wants. Remembered, because a host who does reach for them between every
 * take should open them once, not once per visit -- the same deal the
 * practice bars make with their own More button.
 */
export const [jamMoreControlsPinned, setJamMoreControlsPinned] =
  createPersistedSignal<boolean>(JAM_MORE_CONTROLS_KEY, false, {
    validator: isBoolean,
  })

// ── Lane zoom ────────────────────────────────────────────────────────

export const JAM_LANE_ZOOM_KEY = 'pitchperfect_jam_lane_zoom'

const [laneZoom, setLaneZoom] = createPersistedSignal<number>(
  JAM_LANE_ZOOM_KEY,
  JAM_ZOOM_MIN,
  { validator: isJamZoom },
)

export const jamLaneZoom = laneZoom

/** Clamped in the setter, so no call site has to remember the range. */
export function setJamLaneZoom(next: number): number {
  const clamped = clampJamZoom(next)
  setLaneZoom(clamped)
  return clamped
}

// ── Stage split ──────────────────────────────────────────────────────
//
// Two shares, not one. Side by side the handle trades WIDTH between the
// words and the lanes; stacked it trades HEIGHT, and the comfortable
// answer is different -- a phone wants most of the screen to be words,
// a desktop can afford to halve it. One shared number would have the
// phone inherit whatever was set on a monitor.

export const JAM_SPLIT_WIDE_KEY = 'pitchperfect_jam_split_wide'
export const JAM_SPLIT_STACKED_KEY = 'pitchperfect_jam_split_stacked'

/** Percent of the stage the lyric column takes, side by side. */
export const JAM_SPLIT_WIDE_DEFAULT = 50
export const JAM_SPLIT_WIDE_MIN = 25
export const JAM_SPLIT_WIDE_MAX = 75

/** ...and stacked, where the words need more of the screen to stay read. */
export const JAM_SPLIT_STACKED_DEFAULT = 60
export const JAM_SPLIT_STACKED_MIN = 30
export const JAM_SPLIT_STACKED_MAX = 80

function isShare(min: number, max: number) {
  return (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
}

export const isJamWideShare = isShare(JAM_SPLIT_WIDE_MIN, JAM_SPLIT_WIDE_MAX)
export const isJamStackedShare = isShare(
  JAM_SPLIT_STACKED_MIN,
  JAM_SPLIT_STACKED_MAX,
)

const [wideShare, setWideShare] = createPersistedSignal<number>(
  JAM_SPLIT_WIDE_KEY,
  JAM_SPLIT_WIDE_DEFAULT,
  { validator: isJamWideShare },
)

const [stackedShare, setStackedShare] = createPersistedSignal<number>(
  JAM_SPLIT_STACKED_KEY,
  JAM_SPLIT_STACKED_DEFAULT,
  { validator: isJamStackedShare },
)

export const jamSplitWideShare = wideShare
export const jamSplitStackedShare = stackedShare

/**
 * Rounded to a hundredth of a percent on the way in.
 *
 * A drag produces a full-precision ratio of two pixel measurements, and
 * persisting `32.230885311871226` says the seam is placed to a hundred
 * thousandth of a pixel, which it is not. A hundredth of a percent is
 * a tenth of a pixel on a thousand-pixel stage -- finer than the drag
 * can resolve, so nothing about the feel changes.
 */
function clampShare(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100
}

export function setJamSplitWideShare(next: number): number {
  const clamped = clampShare(next, JAM_SPLIT_WIDE_MIN, JAM_SPLIT_WIDE_MAX)
  setWideShare(clamped)
  return clamped
}

export function setJamSplitStackedShare(next: number): number {
  const clamped = clampShare(next, JAM_SPLIT_STACKED_MIN, JAM_SPLIT_STACKED_MAX)
  setStackedShare(clamped)
  return clamped
}

/** The bounds and the default of whichever split is on screen. */
export interface JamSplitBounds {
  min: number
  max: number
  fallback: number
}

export function jamSplitBounds(stacked: boolean): JamSplitBounds {
  return stacked
    ? {
        min: JAM_SPLIT_STACKED_MIN,
        max: JAM_SPLIT_STACKED_MAX,
        fallback: JAM_SPLIT_STACKED_DEFAULT,
      }
    : {
        min: JAM_SPLIT_WIDE_MIN,
        max: JAM_SPLIT_WIDE_MAX,
        fallback: JAM_SPLIT_WIDE_DEFAULT,
      }
}

/** Read whichever share the current layout uses. */
export function jamSplitShare(stacked: boolean): number {
  return stacked ? stackedShare() : wideShare()
}

/** Write whichever share the current layout uses, clamped to its own range. */
export function setJamSplitShare(stacked: boolean, next: number): number {
  return stacked ? setJamSplitStackedShare(next) : setJamSplitWideShare(next)
}

/** Back to the shipped balance -- the double-click and the Escape hatch. */
export function resetJamSplitShare(stacked: boolean): number {
  return setJamSplitShare(stacked, jamSplitBounds(stacked).fallback)
}
