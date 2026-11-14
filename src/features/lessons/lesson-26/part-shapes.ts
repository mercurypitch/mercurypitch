// ============================================================
// Lesson 26 tune line states — what each step's figure draws, says and plays
// ============================================================
//
// The steps' toy is Lesson 6's tune line in four states and the hero's
// plain one (WEB-SPEC, Toys 2): this module only describes them, the shape
// each draws, the words it says when it changes, and the notes each play
// sounds and lights; part-toy.ts mounts them. Before the cold open's
// choice every state draws the hero's plain "Twinkle", since each shows
// the answer through its lanes, its brackets or its Four semitones up
// (FACTS 40). Gold lights only Step 4's chord notes as they sound; a
// passing note's bead is hollow and takes no light (FACTS 46).

import { COLOR } from '@/features/lessons/kit/notes'
import type { RunNote } from '@/features/lessons/kit/run'
import { CHORD_GAIN } from '@/features/lessons/kit/sound'
import type { TuneEvent, TuneLook, TuneShape, } from '@/features/lessons/kit/tune-line'
import type { TunePart } from '@/features/lessons/kit/tune-line-parts'
import { ABOVE3, ABOVE5, BELOW5, C_MAJOR, C4, CHORD, CHORD_PCS, KEY_COPY, letterSaid, LINE, LINES, MERC5, offLane, PAIR_SEC, SCALE, SHORT_BEAT, sizes, spoken, TAVI5, thirdAbove, TUNE3, TUNE5, TWINKLE, TWINKLE_BEAT, UP4_COPY, } from './parts'

export type StepState = 1 | 2 | 3 | 4

/** A state's settings: Step 1's pair, Step 2's switch, Step 3's switch and its duet. */
export interface Settings {
  readonly pair: number
  readonly copy: 'key' | 'up4'
  readonly side: 'above' | 'below'
  readonly duet: boolean
}

export const START: Settings = {
  pair: 0,
  copy: 'key',
  side: 'above',
  duet: false,
}

/** The global index of each line's first note on the steps' tune line. */
export const FIRSTS: readonly number[] = LINES.map((_, k) =>
  LINES.slice(0, k).reduce((n, l) => n + l.at.length, 0),
)

const BASE: TuneShape = {
  lines: [LINE.twinkle1, LINE.twinkle2],
  window: [C4, C4 + 14],
  fill: false,
  names: false,
  below: null,
  beadButtons: false,
  gapButtons: false,
  brackets: [],
  ghost: null,
}

/** The hero's state, which every step draws until the cold open's choice: "Twinkle" on plain rows. */
export const PLAIN: TuneShape = { ...BASE, dress: { house: C4 } }

/** The plain state's words (WEB-SPEC, Toys 1). */
export const PLAIN_SAID =
  '‘Twinkle’ in C major: two lines of seven notes, from C 4 up to A 4.'

const asLabels = (ns: readonly number[]): string[] => ns.map(String)

/** Step 2's copy of line k as the switch sets it: its notes, their brackets and the names off the lanes. */
function copyPart(k: 0 | 1, copy: Settings['copy']): TunePart {
  const at = (copy === 'key' ? KEY_COPY : UP4_COPY)[k]
  return {
    line: k === 0 ? LINE.twinkle1 : LINE.twinkle2,
    at,
    label: 'copy',
    brackets: asLabels(sizes(TWINKLE[k].at, at)),
    names: at.map(offLane),
  }
}

/** A step's shape, its settings applied. */
export function shapeOf(n: StepState, s: Settings): TuneShape {
  switch (n) {
    case 1: {
      const third = KEY_THIRDS
      return {
        ...BASE,
        lines: [LINE.scale],
        dress: {
          lanes: C_MAJOR,
          house: C4,
          only: FIRSTS[LINE.scale] + s.pair,
          parts: [
            {
              line: LINE.scale,
              at: third,
              label: '',
              only: s.pair,
              // the letters and the unit, since a bare 3 beside a third
              // would read as its letters (FACTS 11, 43)
              brackets: SCALE.at.map((_, i) => pairWords(i)),
            },
          ],
        },
      }
    }
    case 2:
      return {
        ...BASE,
        dress: {
          lanes: C_MAJOR,
          house: C4,
          label: 'tune',
          parts: [copyPart(0, s.copy), copyPart(1, s.copy)],
        },
      }
    case 3:
      return s.duet ? DUET : sideShape(s.side)
    case 4:
      return STEP4
  }
}

/** The key's third above each note of the scale, C4 to B4: E4 to D5 (FACTS 12). */
const KEY_THIRDS = SCALE.at.map(thirdAbove)

function sideShape(side: Settings['side']): TuneShape {
  const at = side === 'above' ? ABOVE5 : BELOW5
  return {
    ...BASE,
    lines: [LINE.tune5],
    window: [C4 - 3, C4 + 7],
    dress: {
      lanes: C_MAJOR,
      house: C4,
      label: 'tune',
      parts: [
        {
          line: LINE.tune5,
          at,
          label: 'part',
          brackets: asLabels(sizes(TUNE5.at, at)),
        },
      ],
    },
  }
}

/** Step 3's Merc and Tavi: Merc's tune in blue an octave down, Tavi's part in orange, a tenth apart (FACTS 45). */
const DUET: TuneShape = {
  ...BASE,
  lines: [LINE.merc5],
  window: [C4 - 12, C4 + 7],
  dress: {
    lanes: C_MAJOR,
    house: C4 - 12,
    label: 'Merc',
    color: COLOR.blue,
    parts: [
      {
        line: LINE.merc5,
        at: TAVI5,
        label: 'Tavi',
        color: COLOR.orange,
        brackets: ['a tenth', null, null, null, null],
      },
    ],
  },
}

/** Step 4: do re mi under mi fa so, over the C major chord, the passing notes hollow (FACTS 46). */
const STEP4: TuneShape = {
  ...BASE,
  lines: [LINE.tune3],
  window: [C4, C4 + 7],
  dress: {
    house: C4,
    label: 'tune',
    hollow: [FIRSTS[LINE.tune3] + 1],
    chord: { name: 'C major chord', pcs: CHORD_PCS },
    parts: [{ line: LINE.tune3, at: ABOVE3, label: 'part', hollow: [1] }],
  },
}

// ---------------------------------------------------------------- the words each state says

/** Step 1's bracket in words: "D up to F: 3 semitones" (FACTS 43). */
export function pairWords(pair: number): string {
  const low = C4 + SCALE.at[pair]
  const high = C4 + KEY_THIRDS[pair]
  return `${letterSaid(low)} up to ${letterSaid(high)}: ${high - low} semitones`
}

/** What a state draws, in words, when it changes. */
export function said(n: StepState, s: Settings): string {
  switch (n) {
    case 1: {
      const low = C4 + SCALE.at[s.pair]
      const high = C4 + KEY_THIRDS[s.pair]
      return `C major's lanes lit. ${spoken(low)}, and the key's note a third above it, ${spoken(high)}: ${pairWords(s.pair).replace(':', ',')}.`
    }
    case 2:
      return s.copy === 'key'
        ? '‘Twinkle’ with its copy a third above, in C major’s thirds, every note on the lanes: 4 semitones over C, F and G, 3 over D, E and A.'
        : '‘Twinkle’ with its copy four semitones up: the copy’s notes over D, E and A move up a semitone, to F sharp 4, G sharp 4 and C sharp 5, off the lanes. Every bracket reads 4.'
    case 3:
      if (s.duet)
        return "Merc's tune in blue, C 3 to E 3, and Tavi's part in orange, E 4 to G 4, a tenth above it."
      return s.side === 'above'
        ? 'Do re mi re do on C 4, and the part a third above it, mi fa so fa mi: 4, 3, 3, 3 and 4 semitones.'
        : 'Do re mi re do on C 4, and the part a third below it, la ti do ti la: 3, 3, 4, 3 and 3 semitones.'
    case 4:
      return 'Do re mi on C 4, and mi fa so above it, over the C major chord, C, E and G. Re and fa are passing notes, drawn hollow; the others are chord notes.'
  }
}

// ---------------------------------------------------------------- the plays

export type PlayId =
  | 'thirds'
  | 'pair'
  | 'copy'
  | 'above'
  | 'below'
  | 'duet'
  | 'part-chord'
  | 'tune-chord'
  | 'both'

/** A play: its notes as a run's, and how it lights the line. */
export interface Play {
  readonly notes: readonly RunNote[]
  /** Merc's "ooh" (the duet), or the soft tone. */
  readonly kind: 'merc' | 'soft'
  readonly events: readonly TuneEvent[]
  readonly look: TuneLook
  /** Step 1's walk: the pair each event shows, so the pair moves with the play. */
  readonly pairOf?: readonly number[]
}

/** A line's notes as timed events from `t0`, each lighting its own bead. */
function lineEvents(
  k: number,
  at: readonly number[],
  beat: number,
  part: number | null,
  t0 = 0,
  colors?: readonly (string | null)[],
): {
  events: TuneEvent[]
  notes: number[]
  parts: (number | null)[]
  colors: (string | null)[]
} {
  let t = t0
  const events: TuneEvent[] = []
  at.forEach((a, i) => {
    const dur = LINES[k].beats[i] * beat
    events.push({ midi: C4 + a, at: t, dur })
    t += dur
  })
  return {
    events,
    notes: at.map((_, i) => FIRSTS[k] + i),
    parts: at.map(() => part),
    // a null colour is a passing note's: no light, so it stays null
    colors: at.map((_, i) => (colors === undefined ? COLOR.chrome : colors[i])),
  }
}

/** Several lines' events as one play, note against note. */
function together(
  kind: Play['kind'],
  pieces: readonly ReturnType<typeof lineEvents>[],
  under: readonly RunNote[] = [],
): Play {
  const events = pieces.flatMap((p) => p.events)
  const notes: RunNote[] = [
    ...under,
    ...events.map((e) => ({ t: e.at, midi: e.midi, dur: e.dur })),
  ].sort((a, b) => a.t - b.t)
  return {
    notes,
    kind,
    events,
    look: {
      notes: pieces.flatMap((p) => p.notes),
      parts: pieces.flatMap((p) => p.parts),
      colors: pieces.flatMap((p) => p.colors),
    },
  }
}

/** The chord held under Step 4's plays, 3.0 s, at the kit's chord level (FACTS 77). */
const HELD: readonly RunNote[] = CHORD.map((midi) => ({
  t: 0,
  midi,
  dur: 3 * PAIR_SEC,
  gain: CHORD_GAIN,
}))

/** Gold on a chord note, none on a passing note (FACTS 46). */
const fit = (at: readonly number[]): (string | null)[] =>
  at.map((a) =>
    (CHORD_PCS as readonly number[]).includes(((a % 12) + 12) % 12)
      ? COLOR.gold
      : null,
  )

/** A play's notes and lights, with the settings it plays. */
export function playOf(id: PlayId, s: Settings): Play {
  switch (id) {
    case 'thirds': {
      // seven pairs, each together for 1.0 s, the pair walking with them
      const pieces = SCALE.at.map((a, i) => {
        const third = KEY_THIRDS[i]
        const t = i * PAIR_SEC
        return [
          single(LINE.scale, i, a, t, null),
          single(LINE.scale, i, third, t, 0),
        ]
      })
      return {
        ...together('soft', pieces.flat()),
        pairOf: SCALE.at.flatMap((_, i) => [i, i]),
      }
    }
    case 'pair':
      return together('soft', [
        single(LINE.scale, s.pair, SCALE.at[s.pair], 0, null),
        single(LINE.scale, s.pair, KEY_THIRDS[s.pair], 0, 0),
      ])
    case 'copy': {
      const copy = s.copy === 'key' ? KEY_COPY : UP4_COPY
      const t1 = 4 * 2 * TWINKLE_BEAT
      return together('soft', [
        lineEvents(LINE.twinkle1, TWINKLE[0].at, TWINKLE_BEAT, null),
        lineEvents(LINE.twinkle1, copy[0], TWINKLE_BEAT, 0),
        lineEvents(LINE.twinkle2, TWINKLE[1].at, TWINKLE_BEAT, null, t1),
        lineEvents(LINE.twinkle2, copy[1], TWINKLE_BEAT, 1, t1),
      ])
    }
    case 'above':
    case 'below':
      return together('soft', [
        lineEvents(LINE.tune5, TUNE5.at, SHORT_BEAT, null),
        lineEvents(LINE.tune5, id === 'above' ? ABOVE5 : BELOW5, SHORT_BEAT, 0),
      ])
    case 'duet':
      return together('merc', [
        lineEvents(
          LINE.merc5,
          MERC5.at,
          SHORT_BEAT,
          null,
          0,
          MERC5.at.map(() => COLOR.blue),
        ),
        lineEvents(
          LINE.merc5,
          TAVI5,
          SHORT_BEAT,
          0,
          0,
          TAVI5.map(() => COLOR.orange),
        ),
      ])
    case 'part-chord':
      return together(
        'soft',
        [lineEvents(LINE.tune3, ABOVE3, PAIR_SEC, 0, 0, fit(ABOVE3))],
        HELD,
      )
    case 'tune-chord':
      return together(
        'soft',
        [lineEvents(LINE.tune3, TUNE3.at, PAIR_SEC, null, 0, fit(TUNE3.at))],
        HELD,
      )
    case 'both':
      return together(
        'soft',
        [
          lineEvents(LINE.tune3, TUNE3.at, PAIR_SEC, null, 0, fit(TUNE3.at)),
          lineEvents(LINE.tune3, ABOVE3, PAIR_SEC, 0, 0, fit(ABOVE3)),
        ],
        HELD,
      )
  }
}

/** One note of Step 1's walk: the scale's note or its third, at `t`, for 1.0 s, lighting bead i of the scale or of its part. */
function single(
  k: number,
  i: number,
  a: number,
  t: number,
  part: number | null,
): ReturnType<typeof lineEvents> {
  return {
    events: [{ midi: C4 + a, at: t, dur: PAIR_SEC }],
    notes: [FIRSTS[k] + i],
    parts: [part],
    colors: [COLOR.chrome],
  }
}

/** The state a play belongs to, and the settings it plays with. */
export function stateOfPlay(
  id: PlayId,
  s: Settings,
): { n: StepState; s: Settings } {
  switch (id) {
    case 'thirds':
    case 'pair':
      return { n: 1, s }
    case 'copy':
      return { n: 2, s }
    case 'above':
    case 'below':
      return { n: 3, s: { ...s, side: id, duet: false } }
    case 'duet':
      return { n: 3, s: { ...s, duet: true } }
    default:
      return { n: 4, s }
  }
}
