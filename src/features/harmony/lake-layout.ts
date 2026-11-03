// ============================================================
// The lake's layout — where the lamps, Merc, the jetty and the trail go
// ============================================================
//
// One measurement of the room and the line place everything. Each note is
// a lamp at its pitch's height, Merc's line in teal and the harmony a
// third from it in gold, both lines across the lake from just past the
// jetty to near the far edge, a lamp a note. The two lines share one
// semitone scale, over the water: their lowest note just above the dock
// (the mic, and "Hear Merc again" over it), so neither covers a lamp on a
// short phone, and their highest under the far shore, a short phone's
// lines drawn on a smaller scale to fit;
// up is higher, as everywhere a voice is drawn in the app. Merc stands on
// the jetty at the lower left, and his bubble floats just over the highest
// lamp (`lampsTop`), as the room's mock-ups have it, clear of the head. At
// the result the jetty stands low, just over the dock, as Leap's ledges
// do: the lines' card needs the room above it, and Merc's line goes beside
// him.
//
// The voice's trail walks the lamps: its place along the line is a
// note's position (harmony-ear.ts), which `xOf` turns into px across, and
// its pitch is read on the lamps' own scale (`yOf`).
//
// Pure, in px, so a test can hold the places to the room's size.

import { degreeMidi } from './harmony-line'

/** The lamps' lowest: over the dock, this share of the height up, at least this many px. */
const DOCK_SHARE = 0.25
const DOCK_MIN = 200
/** The lamps' highest: on the water, this far under the shore, px. */
const UNDER_SHORE = 10
/** Px a semitone, at most and at least. */
const SEMITONE_MAX = 16
const SEMITONE_MIN = 7
/** The first lamp this share of the width across, at least this many px. */
const FIRST_SHARE = 0.36
const FIRST_MIN = 128
/** The last lamp this share of the width from the right, at least this many px. */
const LAST_SHARE = 0.1
const LAST_MIN = 34
/** The far shore: this share of the height down. */
const SHORE = 0.51
/** The jetty's deck: this share of the height up, at least this many px. */
const DECK_SHARE = 0.23
const DECK_MIN = 190
/** At the result, the deck this share of the height up, at least this many px. */
const LOW_SHARE = 0.17
const LOW_MIN = 136
/** A lamp's radius, px (LakeScene.tsx draws it). */
const LAMP_R = 8
/**
 * The harmony's first note's name over its lamp (LakeScene.tsx): its
 * baseline this far over the lamp's centre, px, and its top this far over
 * the baseline (13 px type).
 */
export const NAME_RISE = 16
const NAME_CAP = 10
/** Merc's canvas: a share of the width, capped by a share of the height. */
const MERC_W = 0.24
const MERC_H = 0.115
const MERC_MIN = 64
const MERC_MAX = 104

export interface LakeLayout {
  readonly width: number
  readonly height: number
  /** The far shore, where the water starts, px down. */
  readonly shore: number
  /** Each lamp's x, px across, a lamp a note. */
  readonly lampX: readonly number[]
  /** Px a semitone. */
  readonly semitone: number
  /** The pitch at the lines' middle, MIDI, and its height, px down. */
  readonly midMidi: number
  readonly midY: number
  /** The highest lamp's top, px down: Merc's bubble floats over it. */
  readonly lampsTop: number
  /** The jetty's deck: its right end and its top, px. */
  readonly jetty: { readonly right: number; readonly top: number }
  /** Merc's canvas: left, top and size, px. His feet are on the deck. */
  readonly merc: {
    readonly left: number
    readonly top: number
    readonly size: number
  }
}

/** Both lines' notes. */
export interface LakeLines {
  readonly merc: readonly number[]
  readonly harmony: readonly number[]
}

/**
 * The line the lake shows at rest, `notes` long: G3 A3 B3 A3 under B3 C4
 * D4 C4 at Singer, as the room's mock-ups have it.
 */
export function restingLines(notes: number): LakeLines {
  const shape = [0, 1, 2, 1, 0].slice(0, notes)
  return {
    merc: shape.map((d) => degreeMidi(48, 4 + d)),
    harmony: shape.map((d) => degreeMidi(48, 6 + d)),
  }
}

/**
 * The lake for a room `width` x `height` px and `lines`; `mercFeet` is
 * MercView's. `atResult` stands the jetty low, just over the dock, for
 * the result.
 */
export function layoutLake(
  width: number,
  height: number,
  lines: LakeLines,
  mercFeet: number,
  atResult = false,
): LakeLayout {
  const all = [...lines.merc, ...lines.harmony]
  const low = Math.min(...all)
  const high = Math.max(...all)
  const shore = height * SHORE
  /** The lowest lamp's centre and the highest's, at most: a lamp's edge on each line. */
  const lowY = height - Math.max(height * DOCK_SHARE, DOCK_MIN) - LAMP_R
  const topY = shore + UNDER_SHORE + LAMP_R
  const semitone = Math.min(
    SEMITONE_MAX,
    Math.max(SEMITONE_MIN, (lowY - topY) / Math.max(1, high - low)),
  )
  const midMidi = (low + high) / 2
  const notes = Math.max(1, lines.harmony.length)
  const first = Math.max(FIRST_MIN, width * FIRST_SHARE)
  const last = width - Math.max(LAST_MIN, width * LAST_SHARE)
  const gap = notes === 1 ? 0 : (last - first) / (notes - 1)
  const deckTop = atResult
    ? height - Math.max(height * LOW_SHARE, LOW_MIN)
    : height - Math.max(height * DECK_SHARE, DECK_MIN)
  const size = Math.min(
    MERC_MAX,
    Math.max(MERC_MIN, Math.min(width * MERC_W, height * MERC_H)),
  )
  return {
    width,
    height,
    shore,
    lampX: Array.from({ length: notes }, (_, i) => first + gap * i),
    semitone,
    midMidi,
    midY: lowY - (midMidi - low) * semitone,
    lampsTop: lowY - (high - low) * semitone - LAMP_R,
    jetty: { right: Math.max(first - 10, width * 0.3), top: deckTop },
    merc: { left: 14, top: deckTop - size * mercFeet, size },
  }
}

/**
 * The painted jetty (./art/, docs/plans/ear-rooms.md): its own size, px,
 * and its deck's right end, px across it. Its deck's top is its top edge;
 * its posts fade into the water below.
 */
export const JETTY_PLATE = {
  width: 1200,
  height: 570,
  deckRight: 1198.5,
} as const

/** The painted jetty's box in the jetty's group (the deck's top at y 0), px. */
export interface JettyBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * Where the painted jetty goes, in the group the jetty moves in: its deck
 * from the room's left edge to the jetty's right end, its top on the deck.
 */
export function jettyBox(layout: LakeLayout): JettyBox {
  const scale = layout.jetty.right / JETTY_PLATE.deckRight
  return {
    x: 0,
    y: 0,
    width: JETTY_PLATE.width * scale,
    height: JETTY_PLATE.height * scale,
  }
}

/** A pitch's height on the lamps' scale, px down. */
export function yOf(layout: LakeLayout, midi: number): number {
  return layout.midY - (midi - layout.midMidi) * layout.semitone
}

/** The top of a harmony note's name, drawn over its lamp, px down: Merc's bubble clears it. */
export function nameTop(layout: LakeLayout, midi: number): number {
  return yOf(layout, midi) - NAME_RISE - NAME_CAP
}

/**
 * A place along the line, px across: a whole note at its lamp, between
 * two lamps in proportion, and past the ends at the lamps' spacing.
 */
export function xOf(layout: LakeLayout, pos: number): number {
  const xs = layout.lampX
  if (xs.length === 1) return xs[0]
  const gap = xs[1] - xs[0]
  if (pos <= 0) return xs[0] + pos * gap
  const last = xs.length - 1
  if (pos >= last) return xs[last] + (pos - last) * gap
  const i = Math.floor(pos)
  return xs[i] + (xs[i + 1] - xs[i]) * (pos - i)
}

/**
 * A line's path through its lamps, as the mock-ups draw it: a level run
 * at each lamp, `half` px either side, the runs joined by short slants.
 */
export function stepsPath(
  layout: LakeLayout,
  notes: readonly number[],
): string {
  const xs = layout.lampX
  const gap = xs.length > 1 ? xs[1] - xs[0] : 60
  const half = Math.min(26, gap * 0.43)
  return notes
    .map((midi, i) => {
      const y = yOf(layout, midi).toFixed(1)
      const from = (xs[i] - half).toFixed(1)
      const to = (xs[i] + half).toFixed(1)
      return `${i === 0 ? 'M' : 'L'}${from} ${y}H${to}`
    })
    .join('')
}
