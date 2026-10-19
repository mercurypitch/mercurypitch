// ============================================================
// Lesson 2 step bars — the size of each step heard, drawn under the keys
// ============================================================
//
// Two keys played one after the other draw a bar between them, a notch per
// semitone and its number of semitones on it: "1" for B to C, "2" for C to
// D, and "3" and up the same way (DECISIONS 16), so a step's size reads with
// the sound off. Bars take one of two rows under the keyboard, so B to C and
// C to D can stand one above the other for comparison; a new bar goes on the
// first row it fits without crossing a bar already there, and the oldest
// bars give way when neither row has room.

/** One bar: the two notes (MIDI), the row it sits on, and when it appeared. */
export interface StepBar {
  readonly from: number
  readonly to: number
  readonly row: 0 | 1
  readonly at: number
}

export interface BarList {
  /** Adds the bar for a step from `from` to `to` (nothing for a repeated note). */
  add(from: number, to: number, now: number): StepBar | null
  /** A note heard on its own: a bar from the note before it, if that was within the pairing window. */
  note(midi: number, now: number): StepBar | null
  readonly bars: readonly StepBar[]
  clear(): void
}

/** Two notes heard further apart than this are not one step. */
export const PAIR_WINDOW_MS = 4000

/** The number of semitones a bar spans: its label. */
export const barSize = (b: StepBar): number => Math.abs(b.to - b.from)

const span = (from: number, to: number): [number, number] => [
  Math.min(from, to),
  Math.max(from, to),
]

/** True when two spans share more than an end point. */
function crosses(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1]
}

export function barList(): BarList {
  let bars: StepBar[] = []
  let last: { midi: number; at: number } | null = null

  function fits(row: 0 | 1, s: [number, number]): boolean {
    return bars
      .filter((b) => b.row === row)
      .every((b) => !crosses(span(b.from, b.to), s))
  }

  function add(from: number, to: number, now: number): StepBar | null {
    if (from === to) return null
    const s = span(from, to)
    let row: 0 | 1 | null = fits(0, s) ? 0 : fits(1, s) ? 1 : null
    if (row === null) {
      // the row whose newest bar is oldest gives way
      const newest = (r: 0 | 1): number =>
        Math.max(-1, ...bars.filter((b) => b.row === r).map((b) => b.at))
      row = newest(0) <= newest(1) ? 0 : 1
      const cleared = row
      bars = bars.filter((b) => b.row !== cleared)
    }
    const bar: StepBar = { from, to, row, at: now }
    bars.push(bar)
    last = { midi: to, at: now }
    return bar
  }

  return {
    add,
    note(midi, now) {
      const prev = last
      last = { midi, at: now }
      if (prev === null || now - prev.at > PAIR_WINDOW_MS) return null
      return add(prev.midi, midi, now)
    },
    get bars() {
      return bars
    },
    clear() {
      bars = []
      last = null
    },
  }
}
