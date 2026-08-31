// ============================================================
// rhythm-notation — a bank pattern read as a score.
//
// The banks hold a rhythm as onset positions in beats, which is what
// the ear and the tap ledger care about. Notation needs values, and a
// value is a gap: a note lasts until the next onset, or to the end of
// the pattern for the last one. That gap is matched to the longest
// written value that fits without crossing a barline, and anything
// left over becomes rests. A pattern that starts off the beat gets
// its rest first.
//
// Flagged notes inside one beat are beamed together, with the partial
// beams a gallop needs; a run of thirds carries its 3.
//
// Pure: onsets in, symbols out. `RhythmScore` draws them and nothing
// here knows about SVG.
// ============================================================

import type { Subdivision } from './rhythm-take'

const EPSILON = 1e-6

/** Beats in a written bar. A pattern spanning two draws a barline. */
export const WRITTEN_BAR = 4

export interface RhythmSymbol {
  kind: 'note' | 'rest'
  /** Where it starts, in beats of the pattern. */
  beat: number
  /** How long it lasts, in beats. */
  beats: number
  /** The plain value behind it: 4 a whole, 1 a quarter, 0.25 a 16th.
   *  The dot and the tuplet are what turn it into `beats`. */
  value: number
  dotted: boolean
  /** The tuplet it belongs to — 3 for triplets — or null. */
  tuplet: number | null
  /** Beams or flags: 0 for a quarter and longer, 1 an eighth, 2 a
   *  sixteenth. */
  flags: number
  /** The onset it was read from, so a verdict can be hung on it;
   *  null for a rest. */
  onset: number | null
}

interface ValueSpec {
  beats: number
  value: number
  dotted: boolean
  tuplet: number | null
  flags: number
}

/** Every value the drills can write, longest first — the order the
 *  greedy match walks. Nothing shorter than a triplet sixteenth is
 *  written, which is finer than any bank pattern. */
const VALUES: readonly ValueSpec[] = [
  { beats: 4, value: 4, dotted: false, tuplet: null, flags: 0 },
  { beats: 3, value: 2, dotted: true, tuplet: null, flags: 0 },
  { beats: 2, value: 2, dotted: false, tuplet: null, flags: 0 },
  { beats: 1.5, value: 1, dotted: true, tuplet: null, flags: 0 },
  { beats: 1, value: 1, dotted: false, tuplet: null, flags: 0 },
  { beats: 0.75, value: 0.5, dotted: true, tuplet: null, flags: 1 },
  { beats: 2 / 3, value: 1, dotted: false, tuplet: 3, flags: 0 },
  { beats: 0.5, value: 0.5, dotted: false, tuplet: null, flags: 1 },
  { beats: 0.375, value: 0.25, dotted: true, tuplet: null, flags: 2 },
  { beats: 1 / 3, value: 0.5, dotted: false, tuplet: 3, flags: 1 },
  { beats: 0.25, value: 0.25, dotted: false, tuplet: null, flags: 2 },
  { beats: 1 / 6, value: 0.25, dotted: false, tuplet: 3, flags: 2 },
]

const SHORTEST = VALUES[VALUES.length - 1]

const crossesBarline = (start: number, beats: number): boolean =>
  Math.floor((start + EPSILON) / WRITTEN_BAR) !==
  Math.floor((start + beats - EPSILON) / WRITTEN_BAR)

const crossesBeat = (start: number, beats: number): boolean =>
  Math.floor(start + EPSILON) !== Math.floor(start + beats - EPSILON)

/** The beat a symbol belongs to, for beaming. */
export const beatOf = (beat: number): number => Math.floor(beat + EPSILON)

/** The longest note that fits the gap and stays inside its bar. A
 *  note may run through a beat — that is what a dotted quarter is
 *  for — but never through a barline. */
function pickNote(start: number, span: number): ValueSpec {
  for (const spec of VALUES) {
    if (spec.beats > span + EPSILON) continue
    if (crossesBarline(start, spec.beats)) continue
    return spec
  }
  return SHORTEST
}

/** The longest rest that fits. Rests are stricter than notes: one may
 *  only run through a beat when it starts on a beat and lasts whole
 *  beats, so a bar of silence reads as beats rather than a smear. */
function pickRest(start: number, span: number): ValueSpec {
  const onBeat = Math.abs(start - Math.round(start)) < EPSILON
  for (const spec of VALUES) {
    if (spec.beats > span + EPSILON) continue
    if (crossesBarline(start, spec.beats)) continue
    const wholeBeats =
      spec.beats >= 1 && Math.abs(spec.beats - Math.round(spec.beats)) < EPSILON
    if (crossesBeat(start, spec.beats) && !(onBeat && wholeBeats)) continue
    return spec
  }
  return SHORTEST
}

/** Read a pattern as a score. `onsetsBeats` are the bank's onsets, in
 *  order; `barBeats` is what `barBeats()` in rhythm-take gives for
 *  them — 4, or 8 when the pattern crosses the barline. */
export function readRhythm(
  onsetsBeats: readonly number[],
  barBeats: number,
): RhythmSymbol[] {
  const symbols: RhythmSymbol[] = []

  const push = (spec: ValueSpec, beat: number, onset: number | null): void => {
    symbols.push({
      kind: onset === null ? 'rest' : 'note',
      beat,
      beats: spec.beats,
      value: spec.value,
      dotted: spec.dotted,
      tuplet: spec.tuplet,
      flags: spec.flags,
      onset,
    })
  }

  const fillRests = (from: number, to: number): void => {
    let at = from
    // The shortest value bounds the walk; a sliver finer than it is
    // left unwritten rather than spun on.
    for (let guard = 0; guard < 64 && to - at > EPSILON; guard++) {
      const spec = pickRest(at, to - at)
      push(spec, at, null)
      at += spec.beats
    }
  }

  let cursor = 0
  onsetsBeats.forEach((start, index) => {
    if (start - cursor > EPSILON) fillRests(cursor, start)
    const until = onsetsBeats[index + 1] ?? barBeats
    const spec = pickNote(start, until - start)
    push(spec, start, index)
    if (until - (start + spec.beats) > EPSILON) {
      fillRests(start + spec.beats, until)
    }
    cursor = Math.max(cursor, until)
  })
  if (barBeats - cursor > EPSILON) fillRests(cursor, barBeats)

  return symbols
}

export interface BeamSegment {
  /** 1 is the eighth beam, 2 the sixteenth beam. */
  level: number
  /** The symbols it spans; the same index twice for a stub. */
  from: number
  to: number
  /** A stub beam points back at the note it belongs with — left for
   *  the sixteenth of a gallop, right when it comes first. */
  stub: 'left' | 'right' | null
}

export interface BeamGroup {
  /** Symbol indices under one beam, in order. */
  members: number[]
  segments: BeamSegment[]
}

function segmentsFor(
  symbols: readonly RhythmSymbol[],
  members: readonly number[],
): BeamSegment[] {
  const segments: BeamSegment[] = [
    { level: 1, from: members[0], to: members[members.length - 1], stub: null },
  ]
  const deepest = Math.max(...members.map((index) => symbols[index].flags))
  for (let level = 2; level <= deepest; level++) {
    let start = -1
    for (let k = 0; k <= members.length; k++) {
      const carries = k < members.length && symbols[members[k]].flags >= level
      if (carries && start === -1) start = k
      if (carries || start === -1) continue
      const end = k - 1
      segments.push(
        end > start
          ? { level, from: members[start], to: members[end], stub: null }
          : {
              level,
              from: members[start],
              to: members[start],
              stub: start > 0 ? 'left' : 'right',
            },
      )
      start = -1
    }
  }
  return segments
}

/** Beam the flagged notes that share a beat. A rest, a quarter or a
 *  new beat ends the group; a lone flagged note keeps its flag. */
export function beamGroups(symbols: readonly RhythmSymbol[]): BeamGroup[] {
  const groups: BeamGroup[] = []
  let run: number[] = []

  const flush = (): void => {
    if (run.length > 1) {
      groups.push({ members: run, segments: segmentsFor(symbols, run) })
    }
    run = []
  }

  symbols.forEach((symbol, index) => {
    if (symbol.kind !== 'note' || symbol.flags === 0) {
      flush()
      return
    }
    const last = run.length > 0 ? symbols[run[run.length - 1]] : null
    if (
      last !== null &&
      (beatOf(last.beat) !== beatOf(symbol.beat) ||
        last.tuplet !== symbol.tuplet)
    ) {
      flush()
    }
    run.push(index)
  })
  flush()

  return groups
}

export interface TupletSpan {
  /** The numeral written over the run. */
  number: number
  from: number
  to: number
  /** True when a beam already joins the run and only the numeral is
   *  wanted; false when it needs a bracket of its own. */
  beamed: boolean
}

/** The runs that carry a tuplet numeral: neighbours in the same beat
 *  belonging to the same tuplet. */
export function tupletSpans(
  symbols: readonly RhythmSymbol[],
  groups: readonly BeamGroup[],
): TupletSpan[] {
  const spans: TupletSpan[] = []
  let run: number[] = []

  const flush = (): void => {
    if (run.length > 1) {
      const from = run[0]
      const to = run[run.length - 1]
      spans.push({
        number: symbols[from].tuplet ?? 3,
        from,
        to,
        beamed: groups.some(
          (group) =>
            group.members[0] === from &&
            group.members[group.members.length - 1] === to,
        ),
      })
    }
    run = []
  }

  symbols.forEach((symbol, index) => {
    if (symbol.tuplet === null) {
      flush()
      return
    }
    const last = run.length > 0 ? symbols[run[run.length - 1]] : null
    if (
      last !== null &&
      (beatOf(last.beat) !== beatOf(symbol.beat) ||
        last.tuplet !== symbol.tuplet)
    ) {
      flush()
    }
    run.push(index)
  })
  flush()

  return spans
}

/** Where the faint guides fall inside a beat, for the grid a pattern
 *  sits on. Quarters need none — the beat divisions are the grid. */
export function gridFractions(subdivision: Subdivision): number[] {
  switch (subdivision) {
    case 'eighths':
      return [0.5]
    case 'triplets':
      return [1 / 3, 2 / 3]
    case 'sixteenths':
      return [0.25, 0.5, 0.75]
    default:
      return []
  }
}
