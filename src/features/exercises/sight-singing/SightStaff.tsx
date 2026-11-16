// ============================================================
// SightStaff: Sight-Singing's line on the singer's staff
// ============================================================
//
// The drill's figure, on the same staff Sing It in Time writes its tunes on
// (note-reading/StaffFrame.tsx): the singer's clef, the key's signature,
// and the line as plain noteheads with no stems, since the drill reads
// pitch and not rhythm. Each note's sign stands before it where its letter
// differs from the key (sight-line.ts), and its name sits under it, a
// letter or a syllable, unless the names are off.
//
// During a run the note to sing is lit, and where the voice sits now rides
// beside it on the staff's own heights, folded into its octave as the run
// hears it. A note passed is marked: held in tune, or moved on from at the
// limit, with or without a voice heard. A line too long for the sheet
// scrolls sideways and keeps the lit note in view.

import type { JSX } from 'solid-js'
import { createEffect, createMemo, For, Show } from 'solid-js'
import { foldCents } from '@/lib/pitch-measurements'
import { FLAT_PATH, ledgersOf, NOTEHEAD_PATH, NOTO_GLYPHS, SHARP_PATH, } from '../note-reading/staff-kit'
import { StaffFrame, staffMeasures } from '../note-reading/StaffFrame'
import type { SightLine, SightNames } from './sight-line'
import { lineWords, nameUnder } from './sight-line'
import styles from './SightSinging.module.css'

/** The distance between two staff lines, as Sing It in Time draws it. */
const SPACE = 11
const BOTTOM_Y = 100
const CLEF_X = 6
const KEY_X = 38
/** From one note to the next, and the room before the first. */
const NOTE_STEP = 36
const FIRST_GAP = 22
const RIGHT_PAD = 14
/** The places every line's box keeps room for: two ledger lines each way. */
const LOW = -4
const HIGH = 12

const STAFF = staffMeasures(SPACE, BOTTOM_Y)
const { k: K, yOf, at } = STAFF
const HEAD_HALF = ((NOTO_GLYPHS.head.width - 50) / 2) * K
/** The room between a sign's right edge and its head. */
const SIGN_GAP = 2.2

/**
 * U+266E MUSIC NATURAL SIGN, drawn in Noto Music's units beside its sharp
 * and flat (the kit has those two only): two stems and two rising bars,
 * centred on the notehead's height.
 */
const NATURAL_PATH =
  'M50 -470H82V45H50ZM186 -335H218V205H186ZM50 -285L218 -330V-245L50 -200ZM50 -45L218 -90V-5L50 40Z'
/** U+1D12A MUSIC DOUBLE SHARP SIGN: a thick x a space wide. */
const DOUBLE_SHARP_PATH =
  'M50 -194L80 -224L230 -74L200 -44ZM200 -224L230 -194L80 -44L50 -74Z'

/** Each sign's outline and its right edge, in font units. */
function signGlyphs(sign: number): { d: string; right: number }[] {
  if (sign === 1) return [{ d: SHARP_PATH, right: NOTO_GLYPHS.sharp }]
  if (sign === -1) return [{ d: FLAT_PATH, right: NOTO_GLYPHS.flat }]
  if (sign === 0) return [{ d: NATURAL_PATH, right: 218 }]
  if (sign === 2) return [{ d: DOUBLE_SHARP_PATH, right: 230 }]
  // a double flat: two flats, side by side
  return [
    { d: FLAT_PATH, right: NOTO_GLYPHS.flat + 185 },
    { d: FLAT_PATH, right: NOTO_GLYPHS.flat },
  ]
}

/** How a note is drawn: waiting, the one to sing, or how it went. */
export type SightTone = 'ink' | 'next' | 'now' | 'held' | 'moved' | 'not-heard'

/** How a passed note went, as the run marks it (use-sight-singing-controller.ts). */
export interface SightMark {
  readonly held: boolean
  readonly heard: boolean
}

export interface SightStaffProps {
  line: SightLine
  names: SightNames
  /** The note to sing now, by its place in the line; absent before a run. */
  current?: number
  /** How each passed note went. */
  marks?: readonly (SightMark | undefined)[]
  /** The voice now, Hz; null or absent with no voice. */
  voiceHz?: number | null
}

/** The box's width for a line of `count` notes after a key of `signs` signs. */
function layout(signs: number, count: number) {
  const firstX = KEY_X + signs * STAFF.signW + FIRST_GAP
  const xOf = (i: number): number => firstX + i * NOTE_STEP
  const width = xOf(Math.max(count, 1) - 1) + HEAD_HALF + RIGHT_PAD
  return { xOf, width: Math.max(width, 200) }
}

export function SightStaff(props: SightStaffProps): JSX.Element {
  let scroller: HTMLDivElement | undefined
  const box = createMemo(() =>
    layout(props.line.key.sig.count, props.line.notes.length),
  )
  /** The box's top and bottom: two ledger lines each way, more for a note further out. */
  const span = createMemo(() => {
    const places = props.line.notes.map((n) => n.place)
    const hi = Math.max(HIGH, ...places)
    const lo = Math.min(LOW, ...places)
    const top = yOf(hi) - 8
    const nameY = yOf(lo) + 15
    const bottom = props.names === 'off' ? yOf(lo) + 8 : nameY + 4
    return { top, bottom, nameY }
  })
  const toneOf = (i: number): SightTone => {
    const mark = props.marks?.[i]
    if (mark !== undefined)
      return mark.held ? 'held' : mark.heard ? 'moved' : 'not-heard'
    const now = props.current
    if (now === undefined) return 'ink'
    return i === now ? 'now' : i > now ? 'next' : 'ink'
  }
  /** The voice now, on the staff's heights, folded onto the lit note. */
  const voice = createMemo(() => {
    const hz = props.voiceHz
    const i = props.current
    if (hz === null || hz === undefined || hz <= 0 || i === undefined)
      return null
    const n = props.line.notes[i]
    if (n === undefined) return null
    const cents = foldCents(1200 * Math.log2(hz / 440) + 6900 - n.midi * 100)
    // a semitone is about seven twelfths of a letter
    const place = n.place + (cents / 100) * (7 / 12)
    return {
      x: box().xOf(i) + HEAD_HALF + 9,
      y: yOf(place),
      on: Math.abs(cents) <= 60,
    }
  })

  // Keep the lit note in view when the line is wider than the sheet.
  createEffect(() => {
    const i = props.current
    const el = scroller
    if (i === undefined || el === undefined) return
    if (el.scrollWidth <= el.clientWidth) return
    const scale = el.scrollWidth / box().width
    const left = box().xOf(i) * scale - el.clientWidth / 2
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
    } else {
      el.scrollLeft = Math.max(0, left)
    }
  })

  return (
    <div
      ref={scroller}
      class={`sight-singing-staff-container ${styles.scroller}`}
    >
      <svg
        class={`sight-singing-staff ${styles.staff}`}
        viewBox={`0 ${span().top} ${box().width} ${span().bottom - span().top}`}
        style={{
          '--staff-w': `${box().width}px`,
          '--staff-ratio': (box().width / (span().bottom - span().top)).toFixed(
            3,
          ),
        }}
        role="img"
        aria-label={lineWords(props.line, props.names)}
        data-testid="sight-staff"
        data-clef={props.line.clef}
        data-key={props.line.key.name}
      >
        <Show when={props.current !== undefined ? props.current : null}>
          {(i) => (
            <rect
              class={styles.lit}
              x={box().xOf(i()) - NOTE_STEP / 2 + 2}
              y={yOf(9.5)}
              width={NOTE_STEP - 4}
              height={yOf(-1.5) - yOf(9.5)}
              rx={6}
            />
          )}
        </Show>
        <StaffFrame
          clef={props.line.clef}
          sig={props.line.key.sig}
          space={SPACE}
          bottomY={BOTTOM_Y}
          left={2}
          right={box().width - 2}
          clefX={CLEF_X}
          keyX={KEY_X}
          lineClass={styles.line}
          glyphClass={styles.glyph}
          signTestId="sight-key-sign"
        />
        <For each={props.line.notes}>
          {(n, i) => {
            const x = () => box().xOf(i())
            const y = () => yOf(n.place)
            return (
              <g
                class={styles.note}
                data-tone={toneOf(i())}
                data-testid="sight-note"
                data-place={n.place}
                data-midi={n.midi}
                data-sign={n.sign ?? ''}
              >
                <For each={ledgersOf(n.place, props.line.clef)}>
                  {(place) => (
                    <line
                      class={styles.ledger}
                      x1={x() - HEAD_HALF - 4}
                      x2={x() + HEAD_HALF + 4}
                      y1={yOf(place)}
                      y2={yOf(place)}
                    />
                  )}
                </For>
                {/* A natural's sign is 0, so the test is against null. */}
                <Show when={n.sign !== null}>
                  <For each={signGlyphs(n.sign ?? 0)}>
                    {(g) => (
                      <path
                        class={styles.head}
                        data-testid="sight-sign"
                        d={g.d}
                        transform={at(
                          x() - HEAD_HALF - SIGN_GAP - g.right * K,
                          y() + NOTO_GLYPHS.head.cy * K,
                        )}
                      />
                    )}
                  </For>
                </Show>
                <path
                  class={styles.head}
                  d={NOTEHEAD_PATH}
                  transform={at(
                    x() - NOTO_GLYPHS.head.cx * K,
                    y() + NOTO_GLYPHS.head.cy * K,
                  )}
                />
                <Show when={nameUnder(n, props.names)}>
                  {(name) => (
                    <text
                      class={styles.name}
                      data-testid="sight-name"
                      x={x()}
                      y={span().nameY}
                      text-anchor="middle"
                      aria-hidden="true"
                    >
                      {name()}
                    </text>
                  )}
                </Show>
              </g>
            )
          }}
        </For>
        <Show when={voice()}>
          {(v) => (
            <circle
              class={styles.voice}
              classList={{ [styles.voiceOn]: v().on }}
              data-testid="sight-voice"
              cx={v().x}
              cy={v().y}
              r={3.6}
            />
          )}
        </Show>
      </svg>
    </div>
  )
}
