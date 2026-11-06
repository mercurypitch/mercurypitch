// ============================================================
// Lesson 19 rhythm views — what each step's rhythm bar writes and plays
// ============================================================
//
// The bars of each step's state (WEB-SPEC, Toys 1, 5 and 6), pure: Step 1's
// six eighths, one bar of 6/8 or of 3/4 over six pads, on Subdivide's drums
// (FACTS 18, 65); Step 2's two tunes on the learner's staff, four bars each,
// on one system where the figure is wide and on two of two bars on a phone
// (FACTS 30); Step 3's bar of 4/4, its beat 3 two eighths or a triplet
// (FACTS 41); and Step 4's, its third note on 3 or moved to "2 and", tied
// through beat 3 (FACTS 43). Each view is named for what it shows
// (kit/rhythm-words.ts), so the figure's group says what is drawn.

import type { DrumHit } from '@/features/lessons/kit/drum-hits'
import { DRUM_LEVEL, drumsOf } from '@/features/lessons/kit/drum-hits'
import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import type { PlayPart, RhythmView } from '@/features/lessons/kit/rhythm-bar'
import type { RhythmRow } from '@/features/lessons/kit/rhythm-layout'
import { placeRow } from '@/features/lessons/kit/rhythm-layout'
import type { Bar, Metre, NoteValue, PlacedSymbol, Written, } from '@/features/lessons/kit/rhythm-model'
import { beatQuarters, metreText, SIX_EIGHT, soundsOf, THREE_FOUR, } from '@/features/lessons/kit/rhythm-model'
import { figureWords } from '@/features/lessons/kit/rhythm-words'
import type { Clef } from '@/features/lessons/kit/staff-places'
import type { DrumVoiceId } from '@/lib/drum-voices'
import { patternOf } from '@/lib/ear/metre'

const n = (value: NoteValue, more: Partial<Written> = {}): Written => ({
  kind: 'note',
  value,
  ...more,
})
const times = (k: number, w: Written): Written[] =>
  Array.from({ length: k }, () => w)

/** The rhythm bar's four states, one a step. */
export type StepState = 'metre' | 'tunes' | 'triplet' | 'sync'

export const STATE_OF: Readonly<Record<number, StepState>> = {
  1: 'metre',
  2: 'tunes',
  3: 'triplet',
  4: 'sync',
}

/** Each step's caption (WEB-SPEC, Toys 6). */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> The same six eighths, written as 6/8 or 3/4',
  2: '<span class="fig">Fig. 2</span> A tune in 6/8 and a tune in 3/4, on your staff',
  3: '<span class="fig">Fig. 3</span> Beat 3 split in two, or in three',
  4: '<span class="fig">Fig. 4</span> The note on 3, or moved to “2 and”',
}

/** Steps 3 and 4 play at 60 BPM, a beat a second (FACTS 65). */
export const STEP_BPM = 60

/** The six eighths' tempo: 90 quarter notes a minute, so an eighth lasts a third of a second and a bar of 6/8 or 3/4 two (FACTS 18, 65). */
export const SIX_BPM = 90

/** Step 1's and Step 2's switch: the bar's metre, or the tune's. */
export type MetreKey = '6-8' | '3-4'

export const METRES: Readonly<Record<MetreKey, Metre>> = {
  '6-8': SIX_EIGHT,
  '3-4': THREE_FOUR,
}

/** The six eighths, Step 1's bar and the hero's. */
export const SIX_EIGHTHS: Bar = times(6, n(0.5))

const hit = (voice: DrumVoiceId, level = DRUM_LEVEL): DrumHit => ({
  voice,
  level,
})

/** A bar of Subdivide's, as its hits. */
function subdivide(itemId: string): DrumHit[] {
  const pattern = patternOf(itemId)
  if (pattern === undefined) throw new Error(`no Subdivide bar ${itemId}`)
  return drumsOf(pattern)
}

/**
 * Each metre's drums, one an eighth (FACTS 18): 6/8 in threes, Subdivide's
 * first 6/8 bar, the kick on 1 and the snare on 4; 3/4 in twos on the same
 * rule, the kick on 1 and the snare on 3 and 5, the hi-hat between. The
 * first hit full, the rest at 0.7.
 */
export const DRUMS: Readonly<Record<MetreKey, readonly DrumHit[]>> = {
  '6-8': subdivide('metre:6-8:a'),
  '3-4': [
    hit('kick', 1),
    hit('hh-closed'),
    hit('snare'),
    hit('hh-closed'),
    hit('snare'),
    hit('hh-closed'),
  ],
}

/** The quick check's second bar, Subdivide's second 6/8: a kick on 1 and 4 (FACTS 68). */
export const SECOND_SIX_EIGHT: readonly DrumHit[] = subdivide('metre:6-8:b')

const GROUPS: Readonly<Record<MetreKey, string>> = {
  '6-8': 'in two groups of three',
  '3-4': 'in three groups of two',
}

/** Step 1's bar: the six eighths as a bar of 6/8 or of 3/4, over six pads, an arc under each group. */
export function sixView(key: MetreKey): RhythmView {
  return {
    scene: {
      staff: 'line',
      rows: [{ bars: [SIX_EIGHTHS], bpm: SIX_BPM, metre: METRES[key] }],
      padEvery: 0.5,
      arcs: true,
      strip: false,
    },
    label: `One bar of ${metreText(METRES[key])}: six eighth notes, ${GROUPS[key]}, on one line`,
    pads: null,
  }
}

/** Step 1's play: the bar on its drums, with no click. */
export const sixPart = (view: RhythmView, key: MetreKey): PlayPart => ({
  view,
  bpm: () => SIX_BPM,
  click: false,
  drums: DRUMS[key],
})

/** A tune: its bars, and its notes by letter, all in C (FACTS 30). */
interface Tune {
  readonly bars: readonly Bar[]
  readonly letters: readonly Letter[]
}

/**
 * The two tunes, written for this lesson, four bars and 8 s each (FACTS
 * 30). 6/8: do re mi so, mi re do re, do re mi mi re do, do. 3/4: do re
 * mi, so mi, do re mi mi re do in pairs, do.
 */
export const TUNES: Readonly<Record<MetreKey, Tune>> = {
  '6-8': {
    bars: [
      [n(0.5), n(0.5), n(0.5), n(1, { dotted: true })],
      [n(0.5), n(0.5), n(0.5), n(1, { dotted: true })],
      times(6, n(0.5)),
      [n(2, { dotted: true })],
    ],
    letters: [
      'C',
      'D',
      'E',
      'G',
      'E',
      'D',
      'C',
      'D',
      'C',
      'D',
      'E',
      'E',
      'D',
      'C',
      'C',
    ],
  },
  '3-4': {
    bars: [
      [n(1), n(1), n(1)],
      [n(2), n(1)],
      times(6, n(0.5)),
      [n(2, { dotted: true })],
    ],
    letters: ['C', 'D', 'E', 'G', 'E', 'C', 'D', 'E', 'E', 'D', 'C', 'C'],
  },
}

/** A tune's notes on a clef: C3 up on the bass staff, C4 up on the treble (FACTS 61). */
export const tuneNotes = (key: MetreKey, clef: Clef): Spelled[] =>
  TUNES[key].letters.map((letter) => ({
    letter,
    alter: 0,
    octave: clef === 'treble' ? 4 : 3,
  }))

/** How many sounds a run of bars makes: a tied run is one. */
const soundCount = (bars: readonly Bar[], metre: Metre): number =>
  soundsOf(placeRow({ bars, bpm: SIX_BPM, metre })).length

/**
 * Step 2's staff: a tune on the clef's staff, its beats lit under it, on one
 * system of four bars, or on two of two bars, the second carrying on the
 * first (WEB-SPEC, Toys 5). Until it has played, only the clef and the time
 * signature show.
 */
export function tuneView(
  key: MetreKey,
  clef: Clef,
  systems: 1 | 2,
): RhythmView {
  const { bars } = TUNES[key]
  const metre = METRES[key]
  const notes = tuneNotes(key, clef)
  const row = (
    from: number,
    to: number,
    more: Partial<RhythmRow> = {},
  ): RhythmRow => {
    const first = soundCount(bars.slice(0, from), metre)
    const last = first + soundCount(bars.slice(from, to), metre)
    return {
      bars: bars.slice(from, to),
      bpm: SIX_BPM,
      metre,
      notes: notes.slice(first, last),
      ...more,
    }
  }
  return {
    scene: {
      staff: clef,
      rows:
        systems === 1
          ? [row(0, 4)]
          : [row(0, 2), row(2, 4, { continues: true })],
      padEvery: beatQuarters(metre),
      strip: false,
      metreFirst: true,
    },
    label: figureWords(bars, clef, metre),
    laneLabel: figureWords(bars, 'lanes', metre),
    pads: null,
  }
}

/** Step 2's play: each system of the tune in turn, its beats lit, no click (WEB-SPEC, Toys 5). */
export const tuneParts = (view: RhythmView): PlayPart[] =>
  view.scene.rows.map((_, row) => ({
    view,
    row,
    bpm: () => SIX_BPM,
    click: false,
  }))

/** Step 3's switch: beat 3 in two eighths, or a triplet. */
export type Split = 'eighths' | 'triplet'

/** Step 3's bar: a quarter, two eighths, beat 3, a quarter (FACTS 41). */
export function tripletBar(split: Split): Bar {
  const three =
    split === 'triplet' ? times(3, n(0.5, { triplet: true })) : times(2, n(0.5))
  return [n(1), n(0.5), n(0.5), ...three, n(1)]
}

/** Step 4's switch: the third note on 3, or moved to "2 and". */
export type Move = 'on-3' | 'on-2-and'

/** Step 4's bar: four quarters, or a quarter, an eighth, an eighth tied to a quarter, and a quarter (FACTS 43). */
export const syncBar = (move: Move): Bar =>
  move === 'on-3'
    ? times(4, n(1))
    : [n(1), n(0.5), n(0.5, { tie: true }), n(1), n(1)]

/** A bar of 4/4 on one line over four pads, at 60 BPM: Steps 3 and 4. */
export function lineView(bar: Bar): RhythmView {
  return {
    scene: {
      staff: 'line',
      rows: [{ bars: [bar], bpm: STEP_BPM }],
      strip: false,
    },
    label: figureWords([bar], 'line'),
    pads: null,
  }
}

/**
 * Which symbols of `after` stay written as a switch redraws the bar: each
 * written the same at the same beat in `before` and heard there; a tied-to
 * note waits for the note that ties into it. A switched beat's notes wait
 * for their sound.
 */
export function keptWritten(
  before: readonly PlacedSymbol[],
  heard: readonly boolean[],
  after: readonly PlacedSymbol[],
): boolean[] {
  const kept = after.map((p) =>
    before.some(
      (o, i) =>
        heard[i] === true &&
        Math.abs(o.beat - p.beat) < 1e-6 &&
        o.beats === p.beats &&
        o.kind === p.kind &&
        o.value === p.value &&
        o.dotted === p.dotted &&
        o.tie === p.tie &&
        o.tuplet === p.tuplet,
    ),
  )
  return kept.map((k, i) => k && !(i > 0 && after[i - 1].tie && !kept[i - 1]))
}
