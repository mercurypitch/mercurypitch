// ============================================================
// RhythmDrum — the rhythm drills' instrument.
//
// Contour's drum, turned to time: a rhythm staff across the paper —
// one line, because nothing written here is pitched — with a beat
// lamp per beat along the top that steps with the click, and the
// player's own row under it. What is written is real notation: heads,
// stems, beams, dots and rests, read off the pattern's onsets by
// `rhythm-notation.ts`, so The Chart is sight-reading and not a row
// of ticks.
//
// For Pulse the paper stays blank during the call — an onset drawn as
// it sounds would hand the eye what the ear is meant to hold, and the
// subdivision guides would say how fine the grid is before the player
// has worked it out. The Chart is the opposite drill, so it writes
// the pattern and its guides from the start (`score`, `grid`) and the
// player taps what they read.
//
// Once the take is running the bar carries it: a line sweeps the
// paper, each written note lights as the line reaches it, and the
// player's taps land on the lower row live rather than only at the
// reveal. The reveal writes both rows — the pattern as notation,
// brass where an onset was met and garnet where it was missed, and
// the taps under it, muted for one that served no onset.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { beamGroups, gridFractions, readRhythm, tupletSpans, } from '@/lib/ear/rhythm-notation'
import type { Subdivision } from '@/lib/ear/rhythm-take'
import styles from './EarInstruments.module.css'
import { RhythmScore, ScorePreface } from './RhythmScore'

export type DrumBar = 'count' | 'call' | 'response' | null

export interface DrumReveal {
  /** The call's onsets, in beats of the bar. */
  onsets: readonly number[]
  met: readonly boolean[]
  /** The player's taps that met an onset, in beats. */
  taps: readonly number[]
  /** Taps that served no onset, in beats. */
  extras: readonly number[]
  correct: boolean
}

interface RhythmDrumProps {
  bar: DrumBar
  /** 1-based beat of the bar sounding now; 0 for none. */
  beat: number
  reveal: DrumReveal | null
  /** Beats across the paper; 4 unless the pattern spans two bars. */
  beats?: number
  /** Onsets written on the staff during the take — The Chart's score.
   *  Pulse leaves it unset and the paper stays blank. */
  score?: readonly number[] | null
  /** The grid the pattern sits on, drawn as faint guides inside each
   *  beat. A drill that dictates only sets it at the reveal: the
   *  guides say how fine the pattern is, which is half its answer. */
  grid?: Subdivision | null
  /** The player's taps so far, in beats, while the take runs. */
  liveTaps?: readonly number[] | null
  /** What the written row is called, for the spoken label; 'call'
   *  unless said. The paper itself carries a clef and a metre rather
   *  than a word for it. */
  upperWord?: string
  /** The player's bar, once their first tap has started it: where in
   *  the bar the anchor stood and how long is left to run. The fill is
   *  animated in CSS from those two numbers, so no frame loop is
   *  needed and a hidden tab cannot leave it stuck part way. */
  run?: { from: number; durationMs: number } | null
  /** The bar is the player's and waiting for the tap that starts it. */
  waiting?: boolean
}

const BAR_LEFT = 132
const BAR_RIGHT = 436
/** The staff runs from behind the clef to the outer edge of the final
 *  barline, the way a printed one does — the preface stands on it,
 *  not beside it, and the thick stroke terminates it. */
const PAPER_LEFT = 83
const PAPER_RIGHT = 442.8
/** A barline stands just before the beat it opens, so the downbeat's
 *  note has air after it instead of sitting on the line. */
const BARLINE_LEAD = 9
const LAMP_Y = 40
const STAFF_Y = 112
const TAKE_Y = 172
const DIV_TOP = 64
const DIV_BOTTOM = 196

const BAR_WORD: Record<Exclude<DrumBar, null>, string> = {
  count: 'Count-in',
  call: 'The call',
  response: 'Yours',
}

export function RhythmDrum(props: RhythmDrumProps): JSX.Element {
  const beats = () => props.beats ?? 4
  /** Two bars of notation on the same paper are written smaller. */
  const scale = () => (beats() === 8 ? 0.82 : 1)
  const beatX = (beat: number): number =>
    BAR_LEFT + (beat / beats()) * (BAR_RIGHT - BAR_LEFT)
  /** Barlines lead their beat; the one that closes the bar does not,
   *  because nothing is written after it. */
  const barlineX = (beat: number): number =>
    beat === beats() ? beatX(beat) : beatX(beat) - BARLINE_LEAD
  /** Where a tap is drawn. The take is judged a tolerance and a grace
   *  after the last beat, so a tap can land past the end of the bar —
   *  it is pinned to the barline rather than drawn off the paper. */
  const tapX = (beat: number): number =>
    beatX(Math.max(0, Math.min(beats(), beat)))

  /** The pattern as a score: the reveal's if there is one, else what
   *  the drill wrote for the player to read. */
  const written = createMemo(() => {
    const onsets = props.reveal?.onsets ?? props.score
    if (!onsets || onsets.length === 0) return null
    const symbols = readRhythm(onsets, beats())
    const groups = beamGroups(symbols)
    return { symbols, groups, tuplets: tupletSpans(symbols, groups) }
  })

  /** Every guide mark across the paper, beat by beat. */
  const guides = createMemo(() => {
    const grid = props.grid
    if (!grid) return []
    const fractions = gridFractions(grid)
    return Array.from({ length: beats() }, (_, beat) => beat).flatMap((beat) =>
      fractions.map((fraction) => beat + fraction),
    )
  })

  const label = () => {
    if (props.reveal) {
      const missed = props.reveal.met.filter((m) => !m).length
      return props.reveal.correct
        ? `Rhythm drum: every onset of the ${props.upperWord ?? 'call'} met`
        : `Rhythm drum: ${missed} onset${missed === 1 ? '' : 's'} missed, ${props.reveal.extras.length} extra tap${props.reveal.extras.length === 1 ? '' : 's'}`
    }
    if (props.waiting === true) return 'Rhythm drum, your bar — tap to start it'
    return props.bar
      ? `Rhythm drum, ${BAR_WORD[props.bar].toLowerCase()}, beat ${props.beat}`
      : `Rhythm drum, ${beats() === 8 ? 'two bars' : 'one bar'} of four beats, nothing written yet`
  }

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 260"
      role="img"
      aria-label={label()}
      data-instrument="drum"
    >
      <rect
        x="70"
        y="50"
        width="380"
        height="160"
        rx="18"
        class={styles.drum}
        data-part="drum"
      />
      {/* The player's own lane, washed in the colour their taps land
          in. It says whose row it is without a word for it, and it is
          there before the first tap so they know where to look. */}
      <rect
        x={barlineX(0)}
        y={TAKE_Y - 21}
        width={beatX(beats()) - barlineX(0)}
        height="42"
        rx="12"
        class={styles.takeLane}
        data-part="take-lane"
      />
      {/* the rhythm staff, and the row the player's take lands on */}
      <line
        x1={PAPER_LEFT}
        y1={STAFF_Y}
        x2={PAPER_RIGHT}
        y2={STAFF_Y}
        class={styles.staffLine}
        data-part="staff"
      />
      <line
        x1={PAPER_LEFT}
        y1={TAKE_Y}
        x2={PAPER_RIGHT}
        y2={TAKE_Y}
        class={styles.drumRule}
        data-part="take-rule"
      />
      <ScorePreface staffY={STAFF_Y} takeY={TAKE_Y} beatsPerBar={4} />
      {/* the grid inside each beat: where a gallop's second note goes */}
      <For each={guides()}>
        {(at) => (
          <line
            x1={beatX(at)}
            y1={STAFF_Y - 18}
            x2={beatX(at)}
            y2={STAFF_Y + 18}
            class={styles.subdivisionGuide}
            data-part="grid-mark"
          />
        )}
      </For>
      {/* Beat divisions are dashed and barlines are solid, through
          both rows the way a system's are; the last is the score's
          final barline, thin then thick. */}
      <For each={Array.from({ length: beats() + 1 }, (_, i) => i)}>
        {(beat) => (
          <>
            <line
              x1={barlineX(beat)}
              y1={DIV_TOP}
              x2={barlineX(beat)}
              y2={DIV_BOTTOM}
              class={beat % 4 === 0 ? styles.barline : styles.drumRule}
              stroke-dasharray={beat % 4 === 0 ? undefined : '2 5'}
              data-part={beat % 4 === 0 ? 'barline' : 'beat-division'}
            />
            <Show when={beat === beats()}>
              <rect
                x={barlineX(beat) + 3.4}
                y={DIV_TOP}
                width="3.4"
                height={DIV_BOTTOM - DIV_TOP}
                class={styles.barlineThick}
                data-part="final-barline"
              />
            </Show>
          </>
        )}
      </For>
      {/* The take's progress rail: a line through the lamps that fills
          left to right from the tap that started the bar, and the same
          run drawn down the paper as a playhead. */}
      <Show when={props.run}>
        {(run) => (
          <>
            <line
              x1={beatX(0)}
              y1={LAMP_Y}
              x2={beatX(beats())}
              y2={LAMP_Y}
              class={styles.progressTrack}
              data-part="progress-track"
            />
            {/* A rect, not a line: `transform-box: fill-box` needs a
                box with real height, and a horizontal line has none. */}
            <rect
              x={beatX(0)}
              y={LAMP_Y - 1.25}
              width={beatX(beats()) - beatX(0)}
              height="2.5"
              rx="1.25"
              class={styles.progressFill}
              data-part="progress-fill"
              style={{
                '--fill-from': String(run().from),
                '--fill-run': `${Math.max(0, run().durationMs)}ms`,
              }}
            />
            <line
              x1={beatX(0)}
              y1={DIV_TOP}
              x2={beatX(0)}
              y2={DIV_BOTTOM}
              class={styles.playhead}
              data-part="playhead"
              style={{
                '--head-from': String(run().from),
                '--head-span': `${beatX(beats()) - beatX(0)}px`,
                '--fill-run': `${Math.max(0, run().durationMs)}ms`,
              }}
            />
          </>
        )}
      </Show>
      {/* the beat lamps */}
      <For each={Array.from({ length: beats() }, (_, i) => i + 1)}>
        {(beat) => (
          <circle
            cx={beatX(beat - 1)}
            cy={LAMP_Y}
            r="4"
            class={styles.beatLamp}
            classList={{
              [styles.beatLampLit]: props.bar !== null && props.beat === beat,
              [styles.beatLampPassed]: props.run != null && beat <= props.beat,
            }}
            data-part="beat-lamp"
            data-lit={props.bar !== null && props.beat === beat}
            data-passed={props.run != null && beat <= props.beat}
          />
        )}
      </For>

      <Show when={written()}>
        {(score) => (
          <>
            <RhythmScore
              symbols={score().symbols}
              groups={score().groups}
              tuplets={score().tuplets}
              x={beatX}
              y={STAFF_Y}
              beats={beats()}
              scale={scale()}
              met={props.reveal?.met ?? null}
              run={props.reveal ? null : props.run}
              notePart={props.reveal ? 'onset' : 'score-onset'}
            />
          </>
        )}
      </Show>

      {/* the take, landing under the score as it happens */}
      <Show when={!props.reveal && props.liveTaps?.length}>
        <For each={props.liveTaps ?? []}>
          {(tap) => (
            <line
              x1={tapX(tap)}
              y1={TAKE_Y - 11}
              x2={tapX(tap)}
              y2={TAKE_Y + 11}
              class={`${styles.tapMark} ${styles.tapMarkLive}`}
              data-part="live-tap"
            />
          )}
        </For>
      </Show>

      <Show when={props.reveal}>
        {(reveal) => (
          <>
            <For each={reveal().taps}>
              {(tap) => (
                <line
                  x1={tapX(tap)}
                  y1={TAKE_Y - 12}
                  x2={tapX(tap)}
                  y2={TAKE_Y + 12}
                  class={styles.tapMark}
                  data-part="tap"
                />
              )}
            </For>
            <For each={reveal().extras}>
              {(tap) => (
                <line
                  x1={tapX(tap)}
                  y1={TAKE_Y - 9}
                  x2={tapX(tap)}
                  y2={TAKE_Y + 9}
                  class={`${styles.tapMark} ${styles.tapMarkExtra}`}
                  data-part="extra"
                />
              )}
            </For>
            <text
              x="260"
              y="244"
              class={`${styles.nameplate} ${
                reveal().correct
                  ? styles.nameplateSignal
                  : styles.nameplateGarnet
              }`}
              text-anchor="middle"
              data-part="verdict"
            >
              {reveal().correct ? 'Clean' : 'Not quite'}
            </text>
          </>
        )}
      </Show>
      <Show when={!props.reveal && props.bar}>
        {(bar) => (
          <text x="260" y="244" class={styles.nameplate} text-anchor="middle">
            {props.waiting === true ? 'Yours — tap to start' : BAR_WORD[bar()]}
          </text>
        )}
      </Show>
    </svg>
  )
}
