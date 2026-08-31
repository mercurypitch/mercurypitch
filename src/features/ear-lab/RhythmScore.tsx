// ============================================================
// RhythmScore — a pattern drawn as notation on a one-line staff.
//
// Unpitched rhythm, so one line rather than five: heads sit on it,
// stems go up, beams ride over the top, rests straddle it. The values
// come from `rhythm-notation.ts`; everything here is geometry.
//
// A note lights when the take's line reaches it. That is an animation
// delay per note rather than a frame loop — the drum is handed a
// start and a duration and the browser does the rest, so a hidden tab
// cannot leave the paper half lit. The colour travels on `color`,
// which animates; the glyphs paint themselves in `currentColor`.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { BeamGroup, BeamSegment, RhythmSymbol, TupletSpan, } from '@/lib/ear/rhythm-notation'
import styles from './EarInstruments.module.css'

export interface RhythmScoreProps {
  symbols: readonly RhythmSymbol[]
  groups: readonly BeamGroup[]
  tuplets: readonly TupletSpan[]
  /** Where a beat of the pattern sits across the paper. */
  x: (beat: number) => number
  /** The staff line the heads sit on. */
  y: number
  /** Beats across the paper, for placing a note inside the run. */
  beats: number
  /** Glyph scale: a two-bar pattern is written smaller. */
  scale: number
  /** Per-onset verdict at the reveal; absent while the take runs. */
  met?: readonly boolean[] | null
  /** The player's bar once it is running, so each note lights as the
   *  line reaches it. Absent before the first tap, and at the reveal. */
  run?: { from: number; durationMs: number } | null
  /** `data-part` for a note, so the drills and the audit can count
   *  onsets whether they are written ahead or revealed after. */
  notePart: string
}

export function RhythmScore(props: RhythmScoreProps): JSX.Element {
  /** Glyph metrics, scaled. Read inside attributes, so a change of
   *  bar width redraws instead of freezing the first pattern's size. */
  const m = () => {
    const s = props.scale
    return {
      headRx: 4.9 * s,
      headRy: 3.7 * s,
      stem: 30 * s,
      stemW: 1.6 * s,
      beamH: 3.6 * s,
      beamGap: 5.6 * s,
      stub: 8 * s,
      dot: 1.7 * s,
      s,
    }
  }

  /** The stem hugs the head's right side, as an up-stem does. */
  const stemX = (beat: number): number =>
    props.x(beat) + m().headRx - m().stemW / 2
  const stemTop = (): number => props.y - m().stem

  const beamedIndices = createMemo(
    () => new Set(props.groups.flatMap((group) => group.members)),
  )

  const verdict = (symbol: RhythmSymbol): boolean | undefined => {
    const met = props.met
    if (!met || symbol.onset === null) return undefined
    return met[symbol.onset]
  }

  /** Whether a symbol is still waiting for the running line — a note
   *  under a verdict is being read, not run past. */
  const running = (symbol: RhythmSymbol): boolean =>
    props.run != null && verdict(symbol) === undefined

  /** When the running line reaches a note, in ms from the tap that
   *  started the bar. Negative for a note the anchor already stands
   *  past, which lights it at once — what a negative delay does. */
  const lightAt = (beat: number): number => {
    const run = props.run
    if (!run) return 0
    const left = 1 - run.from
    if (left <= 0) return 0
    return ((beat / props.beats - run.from) / left) * run.durationMs
  }

  const beamLeft = (segment: BeamSegment): number => {
    const at = stemX(props.symbols[segment.from].beat)
    return segment.stub === 'left' ? at - m().stub : at - m().stemW / 2
  }

  const beamRight = (segment: BeamSegment): number => {
    const at = stemX(props.symbols[segment.to].beat)
    return segment.stub === 'right' ? at + m().stub : at + m().stemW / 2
  }

  return (
    <g data-part="score">
      {/* beams first, so a head drawn over one keeps its edge */}
      <For each={props.groups}>
        {(group) => (
          <g
            class={styles.scoreNote}
            classList={{ [styles.scoreNoteRunning]: props.run != null }}
            style={
              props.run
                ? {
                    '--note-at': `${lightAt(
                      props.symbols[group.members[0]].beat,
                    )}ms`,
                  }
                : undefined
            }
          >
            <For each={group.segments}>
              {(segment) => (
                <rect
                  x={beamLeft(segment)}
                  y={stemTop() + (segment.level - 1) * m().beamGap}
                  width={beamRight(segment) - beamLeft(segment)}
                  height={m().beamH}
                  class={styles.noteBeam}
                  data-part="beam"
                  data-level={segment.level}
                  data-stub={segment.stub ?? undefined}
                />
              )}
            </For>
          </g>
        )}
      </For>

      <For each={props.symbols}>
        {(symbol, index) => (
          <Show
            when={symbol.kind === 'note'}
            fallback={
              <g
                class={styles.restMark}
                data-part="rest"
                data-value={symbol.value}
              >
                <RestGlyph
                  symbol={symbol}
                  cx={props.x(symbol.beat)}
                  y={props.y}
                  scale={props.scale}
                />
                <Show when={symbol.dotted}>
                  <circle
                    cx={props.x(symbol.beat) + 8 * m().s}
                    cy={props.y - 4.5 * m().s}
                    r={m().dot}
                    class={styles.noteDot}
                  />
                </Show>
              </g>
            }
          >
            <g
              class={styles.scoreNote}
              classList={{
                [styles.scoreNoteRunning]: running(symbol),
                [styles.scoreNoteMissed]: verdict(symbol) === false,
              }}
              style={
                running(symbol)
                  ? { '--note-at': `${lightAt(symbol.beat)}ms` }
                  : undefined
              }
              data-part={props.notePart}
              data-met={verdict(symbol)}
              data-beat={symbol.beat}
              data-flags={symbol.flags}
            >
              <ellipse
                cx={props.x(symbol.beat)}
                cy={props.y}
                rx={m().headRx}
                ry={m().headRy}
                transform={`rotate(-22 ${props.x(symbol.beat)} ${props.y})`}
                class={
                  symbol.value >= 2 ? styles.noteHeadOpen : styles.noteHead
                }
                data-part="note-head"
              />
              <Show when={symbol.value < 4}>
                <line
                  x1={stemX(symbol.beat)}
                  y1={props.y - m().s}
                  x2={stemX(symbol.beat)}
                  y2={stemTop()}
                  class={styles.noteStem}
                  data-part="stem"
                />
              </Show>
              {/* a flag only where no beam already carries the value */}
              <Show when={symbol.flags > 0 && !beamedIndices().has(index())}>
                <For each={Array.from({ length: symbol.flags }, (_, k) => k)}>
                  {(k) => (
                    <path
                      d={flagPath(
                        stemX(symbol.beat),
                        stemTop() + k * 6.4 * m().s,
                        m().s,
                      )}
                      class={styles.noteFlag}
                      data-part="flag"
                    />
                  )}
                </For>
              </Show>
              <Show when={symbol.dotted}>
                <circle
                  cx={props.x(symbol.beat) + m().headRx + 4 * m().s}
                  cy={props.y - 4.5 * m().s}
                  r={m().dot}
                  class={styles.noteDot}
                  data-part="dot"
                />
              </Show>
            </g>
          </Show>
        )}
      </For>

      <For each={props.tuplets}>
        {(span) => (
          <>
            <Show when={!span.beamed}>
              <path
                d={bracketPath(
                  props.x(props.symbols[span.from].beat),
                  props.x(props.symbols[span.to].beat),
                  stemTop() - 3 * m().s,
                  m().s,
                )}
                class={styles.tupletBracket}
                data-part="tuplet-bracket"
              />
            </Show>
            <text
              x={
                (props.x(props.symbols[span.from].beat) +
                  props.x(props.symbols[span.to].beat)) /
                2
              }
              y={stemTop() - 6 * m().s}
              class={styles.tupletMark}
              text-anchor="middle"
              data-part="tuplet"
            >
              {span.number}
            </text>
          </>
        )}
      </For>
    </g>
  )
}

/** A rest, drawn for the value it stands for: a whole hangs under the
 *  line, a half sits on it, and the shorter ones are the engraver's
 *  zigzag and its flagged cousins. */
function RestGlyph(props: {
  symbol: RhythmSymbol
  cx: number
  y: number
  scale: number
}): JSX.Element {
  const s = () => props.scale
  return (
    <>
      <Show when={props.symbol.value >= 2}>
        <rect
          x={props.cx - 7 * s()}
          y={props.symbol.value >= 4 ? props.y : props.y - 5 * s()}
          width={14 * s()}
          height={5 * s()}
          class={styles.restBlock}
        />
      </Show>
      <Show when={props.symbol.value === 1}>
        <path
          d={
            `M ${props.cx - 3.4 * s()} ${props.y - 11 * s()}` +
            ` L ${props.cx + 3.2 * s()} ${props.y - 4.2 * s()}` +
            ` L ${props.cx - 3 * s()} ${props.y + 1.8 * s()}` +
            ` L ${props.cx + 3.8 * s()} ${props.y + 8.6 * s()}`
          }
          class={styles.restStroke}
        />
      </Show>
      <Show when={props.symbol.value < 1}>
        <path
          d={
            `M ${props.cx + 3.4 * s()} ${props.y - 9.4 * s()}` +
            ` L ${props.cx - 3 * s()} ${props.y + 8.4 * s()}`
          }
          class={styles.restStroke}
        />
        <For
          each={Array.from(
            { length: props.symbol.value < 0.5 ? 2 : 1 },
            (_, k) => k,
          )}
        >
          {(k) => (
            <circle
              cx={props.cx + (1 - k * 2.1) * s()}
              cy={props.y + (-7 + k * 6.2) * s()}
              r={2.2 * s()}
              class={styles.restDot}
            />
          )}
        </For>
      </Show>
    </>
  )
}

/** The flag hanging off an unbeamed stem: out from the stem top and
 *  back in, the way an engraved eighth flag falls. */
function flagPath(x: number, y: number, s: number): string {
  return (
    `M ${x} ${y}` +
    ` c ${5.4 * s} ${1.6 * s}, ${7.4 * s} ${5.4 * s}, ${1.6 * s} ${10.6 * s}` +
    ` c ${2.2 * s} ${-5.4 * s}, ${0.4 * s} ${-8.2 * s}, ${-1.6 * s} ${-9.4 * s}` +
    ' z'
  )
}

/** The bracket over a tuplet no beam already joins. */
function bracketPath(from: number, to: number, y: number, s: number): string {
  const drop = 4 * s
  return `M ${from} ${y + drop} L ${from} ${y} L ${to} ${y} L ${to} ${y + drop}`
}
