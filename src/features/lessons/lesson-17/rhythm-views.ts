// ============================================================
// Lesson 17 rhythm views — what each step's rhythm bar writes and plays
// ============================================================
//
// The bars of each step's state (WEB-SPEC, Toys 1 and 5), pure: Step 1's
// grid, from four quarters, with Play the halvings' five bars; Step 2's two
// quarters and a half note, and Play both's two rows, the same seconds
// written two ways (FACTS 17); Step 3's two bars played in turn; Step 4's
// grid with its rests, and the rest strip's five examples, each with its
// silence heard between two notes (FACTS 26a); Step 5's two bars on the
// staff, with Dot and Tie (FACTS 29); and the checkpoint's two written
// bars, tapped and then sung (FACTS 36). Each view is named for what it shows,
// written or on the pitch line (kit/rhythm-words.ts), so the figure's group
// says what is drawn; how the bar is seen, the pitch line and the counts,
// is the rhythm bar's own (kit/rhythm-bar.ts `see`).

import type { PlayPart, RhythmView } from '@/features/lessons/kit/rhythm-bar'
import type { RhythmStaff } from '@/features/lessons/kit/rhythm-layout'
import type { Bar, GridBar, NoteValue, Written, } from '@/features/lessons/kit/rhythm-model'
import { HALVINGS, writeGrid } from '@/features/lessons/kit/rhythm-model'
import { figureWords } from '@/features/lessons/kit/rhythm-words'

const n = (value: NoteValue, more: Partial<Written> = {}): Written => ({
  kind: 'note',
  value,
  ...more,
})
const rest = (value: NoteValue): Written => ({ kind: 'rest', value })
const times = (k: number, w: Written): Written[] =>
  Array.from({ length: k }, () => w)

/** The rhythm bar's five states, one a step. */
export type StepState = 'halves' | 'tempo' | 'count' | 'rests' | 'staff'

export const STATE_OF: Readonly<Record<number, StepState>> = {
  1: 'halves',
  2: 'tempo',
  3: 'count',
  4: 'rests',
  5: 'staff',
}

/** Each step's figure label (WEB-SPEC, Toys 5). */
export const FIG: Readonly<Record<number, string>> = {
  1: '<span class="fig">Fig. 1</span> A bar, halved and joined',
  2: '<span class="fig">Fig. 2</span> One bar, any tempo',
  3: '<span class="fig">Fig. 3</span> The counts under the notes',
  4: '<span class="fig">Fig. 4</span> Notes and rests',
  5: '<span class="fig">Fig. 5</span> Two bars on the staff',
}

/** Every step but Step 2 plays at 60 BPM. */
export const STEP_BPM = 60

/** Step 2's bar: two quarters and a half note. */
export const TEMPO_BAR: Bar = [n(1), n(1), n(2)]

/** Play both's rows: two eighths, a quarter, two eighths and a quarter at 60; two quarters and a half note twice at 120. */
export const BOTH_SIXTY: Bar = [n(0.5), n(0.5), n(1), n(0.5), n(0.5), n(1)]
export const BOTH_TWICE: readonly Bar[] = [TEMPO_BAR, TEMPO_BAR]

/** Step 3's two bars, played in turn: eight eighths, then a quarter, two eighths, four sixteenths and a quarter. */
export const COUNT_BARS: readonly Bar[] = [
  times(8, n(0.5)),
  [n(1), n(0.5), n(0.5), ...times(4, n(0.25)), n(1)],
]

/** The checkpoint's two written bars: two quarters and a half note, then two eighths, a quarter, two eighths and a quarter (FACTS 36). */
export const TAKE_BARS: readonly Bar[] = [
  [n(1), n(1), n(2)],
  [n(0.5), n(0.5), n(1), n(0.5), n(0.5), n(1)],
]

/** Step 5's two bars: half, quarter, quarter, then quarter, quarter, half; Dot makes a dotted half and a dotted quarter, Tie joins the bar line's two quarters. */
export function staffBars(dot: boolean, tie: boolean): Bar[] {
  const last = n(1, tie ? { tie: true } : {})
  return dot
    ? [
        [n(2, { dotted: true }), last],
        [n(1, { dotted: true }), n(0.5), n(2)],
      ]
    : [
        [n(2), n(1), last],
        [n(1), n(1), n(2)],
      ]
}

/** One rest strip example: its bars, beats and the rest's cell, the one that reads (Toys 1 and 6). */
export interface RestExample {
  readonly bars: readonly Bar[]
  readonly beats: number
  readonly cell: number
}

/** The rest strip's examples, by the rest's value, each silence heard between two notes. */
export const REST_EXAMPLES: Readonly<Record<string, RestExample>> = {
  '4': {
    bars: [times(4, n(1)), [rest(4)], [n(1)]],
    beats: 9,
    cell: 4,
  },
  '2': { bars: [[n(1), n(1), rest(2)], [n(1)]], beats: 5, cell: 2 },
  '1': { bars: [[n(1), rest(1), n(2)]], beats: 4, cell: 1 },
  '0.5': { bars: [[n(1), rest(0.5), n(0.5), n(2)]], beats: 4, cell: 1 },
  '0.25': {
    bars: [[n(1), rest(0.25), n(0.25), n(0.5), n(2)]],
    beats: 4,
    cell: 1,
  },
}

/** A view of one row of bars, named for what it shows. */
export function rowView(
  bars: readonly Bar[],
  bpm: number,
  staff: RhythmStaff,
  pads: RhythmView['pads'] = null,
  more: { beats?: number; reads?: (i: number) => boolean } = {},
): RhythmView {
  return {
    scene: { staff, rows: [{ bars, bpm, ...more }] },
    label: figureWords(bars, staff),
    laneLabel: figureWords(bars, 'lanes'),
    pads,
  }
}

const BOTH_WORDS =
  'two eighth notes, a quarter note, two eighth notes and a quarter note at 60 BPM, over two quarter notes and a half note, twice, at 120 BPM'

/** Play both's view: the 60 BPM bar over the two at 120, on one time axis. */
export const BOTH_VIEW: RhythmView = {
  scene: {
    staff: 'line',
    rows: [
      { bars: [BOTH_SIXTY], bpm: 60 },
      { bars: BOTH_TWICE, bpm: 120 },
    ],
  },
  label: `Two rows on one time axis, on one line: ${BOTH_WORDS}`,
  laneLabel: `Two rows on one time axis, on the pitch line: ${BOTH_WORDS}`,
  pads: null,
}

/** Play both: the 60 BPM row, a second's silence, then the two bars at 120. */
export const BOTH_PARTS: readonly PlayPart[] = [
  { view: BOTH_VIEW, row: 0, bpm: () => 60, fresh: true },
  { view: BOTH_VIEW, row: 1, bpm: () => 120, pause: 1, fresh: true },
]

/** Play the halvings' five bars, each a view of its own with Step 1's pads. */
export const HALVING_VIEWS: readonly RhythmView[] = HALVINGS.map(
  (grid: GridBar) => rowView([writeGrid(grid)], STEP_BPM, 'line', 'choose'),
)

/** Play the halvings: the five bars at 60 BPM, each written in place of the one before (FACTS 66). */
export const HALVING_PARTS: readonly PlayPart[] = HALVING_VIEWS.map((view) => ({
  view,
  bpm: () => STEP_BPM,
  fresh: true,
}))

/** Step 3's two bars, each a view of its own. */
export const COUNT_VIEWS: readonly RhythmView[] = COUNT_BARS.map((bar) =>
  rowView([bar], STEP_BPM, 'line'),
)

/** Step 3's Play: its two bars in turn, each written and counted as it sounds. */
export const COUNT_PARTS: readonly PlayPart[] = COUNT_VIEWS.map((view) => ({
  view,
  bpm: () => STEP_BPM,
  fresh: true,
}))

/** A rest example's view: only the rest's cell reads, so a narrow rest takes its neighbours' room. */
export function restView(key: string): RhythmView | null {
  const ex = REST_EXAMPLES[key] as RestExample | undefined
  if (ex === undefined) return null
  return rowView(ex.bars, STEP_BPM, 'line', null, {
    beats: ex.beats,
    reads: (i) => i === ex.cell,
  })
}
