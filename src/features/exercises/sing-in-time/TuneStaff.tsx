// ============================================================
// TuneStaff: a tune's two bars on the staff, with its beat grid under it
// ============================================================
//
// The drill's figure, and its feedback (the stage's rule for every drill):
// the singer's clef, the key's signature and the 4/4, two bars of notes
// engraved as the lessons engrave them (kit/rhythm-glyphs.ts's heads, stems
// and beams: an oval head tilted 22 degrees, open for a half note, an eighth
// pair under one beam), each note's syllable under it while the names are
// on, and under those the beat grid Lesson 17 counts with: a box for every
// beat, "(2)" where a note is held into it and "&" where an eighth pair
// splits it.
//
// During a run the cursor moves on at tempo and the note under it is lit;
// each note is marked once its window has closed, in tune, off or not
// heard, and its beat's box shows when the voice arrived on it, early to
// the left of the box's middle and late to the right. Where the singer's
// voice sits now rides the cursor, on the staff's own heights.
//
// The picture is drawn whole on every change of the run's state, never per
// frame: only the cursor and the voice move every frame, and both are
// single attributes.

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { foldCents } from '@/lib/mirror/metrics'
import { keyWords, ledgersOf } from '../note-reading/staff-kit'
import { StaffFrame, staffMeasures } from '../note-reading/StaffFrame'
import { metrics, stemEnd, stemX } from './in-time-kit'
import styles from './SingInTime.module.css'
import type { NoteVerdict } from './take-judge'
import type { Tune, TuneNote } from './tune-plan'
import { BAR_BEATS, gridOf, noteAt, TUNE_BEATS } from './tune-plan'

/** The picture's box, in its own units. */
const WIDTH = 340
const HEIGHT = 158
/** The distance between two staff lines. */
const SPACE = 11
const TOP_Y = 32
const BOTTOM_Y = TOP_Y + 4 * SPACE
const LEFT = 2
const RIGHT = WIDTH - 3
const CLEF_X = 5
const KEY_X = 36
/** The syllables' baseline, the beat grid's boxes, and the timing ticks under them. */
const NAME_Y = 118
const BOX_TOP = 125
const BOX_H = 21
const TICK_TOP = BOX_TOP + BOX_H + 3
const TICK_H = 6
/** The room a bar line takes between the bars. */
const BAR_GAP = 8
/** A head sits this far into its beat: the cursor reaches it as the beat comes. */
const HEAD_IN = 0.36
/** An open head's rim (the stylesheet's `.open` stroke): drawn inside the solid head's outline. */
const OPEN_RIM = 1.9

const M = metrics(SPACE)
/** The staff's heights and its key signature's spacing (StaffFrame.tsx). */
const STAFF = staffMeasures(SPACE, BOTTOM_Y)
const { yOf } = STAFF

/** How a note is drawn: waiting, under the cursor, or judged. */
export type NoteTone = 'ink' | 'next' | 'now' | 'in-tune' | 'off' | 'not-heard'

export interface TuneStaffProps {
  tune: Tune
  /** The syllables under the notes. */
  names: boolean
  /** Beats from bar 1's first beat as heard; null with no cursor. */
  beat?: number | null
  /** Each note's verdict once its window has closed. */
  marks?: readonly (NoteVerdict | null)[]
  /** The sung pitch now, Hz, riding the cursor; null or absent with no voice. */
  voiceHz?: number | null
  /** A run is under way: notes not yet reached are dimmed. */
  running?: boolean
}

/** The x of the left edge of each beat's cell, the bars' gap counted. */
function layout(signs: number) {
  const signW = STAFF.signW * (signs > 0 ? 1 : 0)
  const metreX = KEY_X + signs * signW + (signs > 0 ? 7 : 6)
  const from = metreX + 22
  const bw = (RIGHT - 6 - from - BAR_GAP) / TUNE_BEATS
  const cell = (b: number): number =>
    from + b * bw + (b >= BAR_BEATS ? BAR_GAP : 0)
  const head = (b: number): number => {
    const whole = Math.floor(b + 1e-9)
    return cell(whole) + (HEAD_IN + (b - whole)) * bw
  }
  return { signW, metreX, from, bw, cell, head }
}

/** The cursor's x at a fractional beat: on each head as its beat comes, the bar line passed between. */
function cursorX(head: (b: number) => number, beat: number): number {
  const b = Math.max(0, Math.min(TUNE_BEATS - 0.001, beat))
  const whole = Math.floor(b)
  return head(whole) + (b - whole) * (head(whole + 1) - head(whole))
}

/** What a screen reader hears: the staff, the key, the metre and the tune. */
export function tuneWords(tune: Tune, names: boolean): string {
  const clef = tune.clef === 'treble' ? 'Treble' : 'Bass'
  const said = (n: TuneNote): string => {
    const length = n.beats >= 2 ? ' held' : n.beats < 1 ? ' short' : ''
    return `${names ? n.syllable : n.written.letter + (n.written.alter > 0 ? ' sharp' : n.written.alter < 0 ? ' flat' : '')}${length}`
  }
  const bar = (k: number): string =>
    tune.notes
      .filter((n) => Math.floor(n.beat / BAR_BEATS) === k)
      .map(said)
      .join(', ')
  return `${clef} staff in ${tune.key.name} major, ${keyWords(tune.key.sig).toLowerCase()}, four four time. Bar 1: ${bar(0)}. Bar 2: ${bar(1)}.`
}

export function TuneStaff(props: TuneStaffProps): JSX.Element {
  const box = createMemo(() => layout(props.tune.key.sig.count))
  /** The note under the cursor, while it is on the bars. */
  const current = createMemo(() => {
    const b = props.beat
    if (b === null || b === undefined || b < 0 || b >= TUNE_BEATS) return -1
    return noteAt(props.tune, b)
  })
  const toneOf = (i: number): NoteTone => {
    const mark = props.marks?.[i] ?? null
    if (mark !== null) return mark.pitch
    if (i === current()) return 'now'
    const b = props.beat
    const reached =
      b !== null && b !== undefined && props.tune.notes[i].beat <= b
    if (props.running === true && !reached) return 'next'
    return 'ink'
  }
  const grid = createMemo(() => gridOf(props.tune))
  /** The eighth pairs: the first of each pair's index. */
  const pairs = createMemo(() =>
    props.tune.notes.flatMap((n, i) =>
      n.beats < 1 && n.beat % 1 === 0 ? [i] : [],
    ),
  )
  /** Whether a note's stem goes down: from the middle line up, or a pair's average. */
  const stemDown = (i: number): boolean => {
    const n = props.tune.notes[i]
    if (n.beats < 1) {
      const first = n.beat % 1 === 0 ? i : i - 1
      const a = props.tune.notes[first]
      const b = props.tune.notes[first + 1]
      return (a.place + (b?.place ?? a.place)) / 2 >= 4
    }
    return n.place >= 4
  }
  /** Where a pair's beam lies: flat, a stem's length past the head nearer it. */
  const beamY = (first: number): number => {
    const a = props.tune.notes[first]
    const b = props.tune.notes[first + 1] ?? a
    const down = stemDown(first)
    return down
      ? Math.max(yOf(a.place), yOf(b.place)) + M.stem
      : Math.min(yOf(a.place), yOf(b.place)) - M.stem
  }
  const spotOf = (i: number) => {
    const n = props.tune.notes[i]
    return {
      x: box().head(n.beat),
      y: yOf(n.place),
      place: n.place,
      down: stemDown(i),
    }
  }
  const stemTo = (i: number): number => {
    const n = props.tune.notes[i]
    if (n.beats >= 1) return stemEnd(spotOf(i), M)
    return beamY(n.beat % 1 === 0 ? i : i - 1)
  }
  /** The voice now, as a height on the staff: folded onto the note under the cursor. */
  const voiceY = createMemo(() => {
    const hz = props.voiceHz
    const k = current()
    if (hz === null || hz === undefined || hz <= 0 || k < 0) return null
    const n = props.tune.notes[k]
    const cents = foldCents(1200 * Math.log2(hz / 440) + 6900 - n.midi * 100)
    // a semitone is about seven twelfths of a letter
    const place = n.place + (cents / 100) * (7 / 12)
    return { y: yOf(place), on: Math.abs(cents) <= 60 }
  })
  const cursor = () => {
    const b = props.beat
    return b === null || b === undefined ? null : cursorX(box().head, b)
  }

  return (
    <svg
      class={styles.staff}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={tuneWords(props.tune, props.names)}
      data-testid="tune-staff"
      data-clef={props.tune.clef}
      data-key={props.tune.key.name}
    >
      {/* the beat grid: a box for every beat */}
      <For each={grid()}>
        {(g, b) => {
          const x = () => box().cell(b()) + 2
          const w = () => box().bw - 4
          const mark = () => props.marks?.[g.note] ?? null
          const first = () => props.tune.notes[g.note].beat >= b() - 1e-9
          const state = () => {
            const at = props.beat
            if (at === null || at === undefined || at < 0) return 'ahead'
            if (at >= b() + 1) return 'past'
            if (at >= b()) return 'now'
            return 'ahead'
          }
          return (
            <g class={styles.box} data-state={state()} data-testid="tune-beat">
              <rect x={x()} y={BOX_TOP} width={w()} height={BOX_H} rx={5} />
              <text
                class={styles.count}
                x={x() + w() / 2}
                y={BOX_TOP + 14.5}
                text-anchor="middle"
              >
                {g.kind === 'held'
                  ? `(${g.count})`
                  : g.kind === 'split'
                    ? `${g.count}&`
                    : g.count}
              </text>
              <Show when={first() && mark()?.offset != null ? mark() : null}>
                {(m) => (
                  <line
                    class={styles.tick}
                    data-timing={m().timing ?? ''}
                    x1={
                      x() +
                      w() / 2 +
                      Math.max(-0.5, Math.min(0.5, m().offset ?? 0)) * (w() - 6)
                    }
                    x2={
                      x() +
                      w() / 2 +
                      Math.max(-0.5, Math.min(0.5, m().offset ?? 0)) * (w() - 6)
                    }
                    y1={TICK_TOP}
                    y2={TICK_TOP + TICK_H}
                  />
                )}
              </Show>
            </g>
          )
        }}
      </For>

      {/* the cursor, under the notes */}
      <Show when={cursor()}>
        {(x) => (
          <line
            class={styles.cursor}
            data-testid="tune-cursor"
            x1={x()}
            x2={x()}
            y1={6}
            y2={BOX_TOP + BOX_H}
          />
        )}
      </Show>

      {/* the staff, its clef, its key and its metre */}
      <StaffFrame
        clef={props.tune.clef}
        sig={props.tune.key.sig}
        space={SPACE}
        bottomY={BOTTOM_Y}
        left={LEFT}
        right={RIGHT}
        clefX={CLEF_X}
        keyX={KEY_X}
        lineClass={styles.line}
        glyphClass={styles.glyph}
        signTestId="tune-key-sign"
      />
      <line
        class={styles.barLine}
        x1={box().cell(BAR_BEATS) - BAR_GAP / 2}
        x2={box().cell(BAR_BEATS) - BAR_GAP / 2}
        y1={TOP_Y}
        y2={BOTTOM_Y}
      />
      <line
        class={styles.barLine}
        x1={RIGHT - 5}
        x2={RIGHT - 5}
        y1={TOP_Y}
        y2={BOTTOM_Y}
      />
      <line
        class={styles.finalLine}
        x1={RIGHT - 1.5}
        x2={RIGHT - 1.5}
        y1={TOP_Y}
        y2={BOTTOM_Y}
      />
      <text
        class={styles.metre}
        x={box().metreX + 7}
        y={TOP_Y + SPACE * 1.92}
        text-anchor="middle"
      >
        4
      </text>
      <text
        class={styles.metre}
        x={box().metreX + 7}
        y={TOP_Y + SPACE * 3.92}
        text-anchor="middle"
      >
        4
      </text>

      {/* the notes */}
      <For each={props.tune.notes}>
        {(n, i) => {
          const spot = () => spotOf(i())
          const open = n.beats >= 2
          return (
            <g
              class={styles.note}
              data-tone={toneOf(i())}
              data-testid="tune-note"
              data-place={n.place}
              data-midi={n.midi}
              data-value={open ? 'half' : n.beats < 1 ? 'eighth' : 'quarter'}
            >
              <For each={ledgersOf(n.place, props.tune.clef)}>
                {(place) => (
                  <line
                    class={styles.ledger}
                    x1={spot().x - M.headRx * 1.7}
                    x2={spot().x + M.headRx * 1.7}
                    y1={yOf(place)}
                    y2={yOf(place)}
                  />
                )}
              </For>
              <line
                class={styles.stem}
                stroke-width={M.stemW}
                x1={stemX(spot(), M)}
                x2={stemX(spot(), M)}
                y1={spot().y + (spot().down ? M.s : -M.s)}
                y2={stemTo(i())}
              />
              <ellipse
                class={styles.head}
                classList={{ [styles.open]: open }}
                cx={spot().x}
                cy={spot().y}
                rx={open ? M.headRx - OPEN_RIM / 2 : M.headRx}
                ry={open ? M.headRy - OPEN_RIM / 2 : M.headRy}
                transform={`rotate(-22 ${spot().x.toFixed(2)} ${spot().y.toFixed(2)})`}
              />
              <Show when={props.names}>
                <text
                  class={styles.name}
                  x={spot().x}
                  y={NAME_Y}
                  text-anchor="middle"
                >
                  {n.syllable}
                </text>
              </Show>
            </g>
          )
        }}
      </For>
      <For each={pairs()}>
        {(first) => {
          const a = () => spotOf(first)
          const b = () => spotOf(first + 1)
          const y = () => beamY(first)
          const h = M.beamH
          return (
            <path
              class={styles.beam}
              data-testid="tune-beam"
              data-tone={toneOf(first)}
              d={`M${stemX(a(), M) - M.stemW / 2} ${y() - (a().down ? h : 0)}H${stemX(b(), M) + M.stemW / 2}V${y() + (a().down ? 0 : h)}H${stemX(a(), M) - M.stemW / 2}Z`}
            />
          )
        }}
      </For>
      {/* the voice now, riding the cursor */}
      <Show when={cursor() !== null && voiceY() !== null ? voiceY() : null}>
        {(v) => (
          <circle
            class={styles.voice}
            classList={{ [styles.voiceOn]: v().on }}
            data-testid="tune-voice"
            cx={cursor() ?? 0}
            cy={v().y}
            r={4.2}
          />
        )}
      </Show>
    </svg>
  )
}
