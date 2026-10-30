// ============================================================
// Pulse's and The Chart's instrument in the room: one glass lane with
// the beat lamps along its top, the call's line and the player's under
// it (docs/plans/ear-lab-native-look.md).
//
// The lamps flash with the count-in and the call. Pulse leaves the call's
// line blank, because the ear holds the call; The Chart writes its bar
// there from the start, in real notation (RhythmScore), for the player to
// read. The player's first tap starts the sweep, each written note lights
// as it passes and each tap lands on the lower line as it is played. The
// reveal writes the call over the taps and links each onset to the tap
// that met it, teal; an onset missed is a red ring.
// ============================================================

import type { JSX } from 'solid-js'
import { createEffect, createMemo, createSignal, For, on, Show, untrack, } from 'solid-js'
import type { RhythmDrumProps } from '@/features/ear-lab/RhythmDrum'
import { RhythmScore } from '@/features/ear-lab/RhythmScore'
import { beamGroups, readRhythm, tupletSpans } from '@/lib/ear/rhythm-notation'
import { arrivalAge, useArrivals, useStageClock } from './clock'
import { clamp, easeOut, hundredth, lineD, progress, tenth } from './draw'
import { Glow, LitDefs, litIds, paint, TEAL } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over the tap pad. */
const HEIGHT = 393
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const TOP = 12
const BOTTOM = HEIGHT - 14
const LEFT_X = 70
const RIGHT_X = 350
const LAMP_Y = TOP + 32
const CALL_Y = TOP + 128
const YOUR_Y = BOTTOM - 74
/** How long a beat lamp flashes. */
const FLASH_MS = 230

export function LitRhythm(props: RhythmDrumProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const beatTimes = useArrivals(() => props.beat, clock)
  const beats = (): number => props.beats ?? 4
  const beatX = (beat: number): number =>
    LEFT_X + (beat / beats()) * (RIGHT_X - LEFT_X)
  /** A tap judged a little past the bar is pinned to its end. */
  const tapX = (beat: number): number =>
    beatX(Math.max(0, Math.min(beats(), beat)))

  /** The Chart names its written row; Pulse's is the call. */
  const chart = (): boolean => props.upperWord !== undefined
  const rowName = (): string => {
    const word = (props.upperWord ?? 'call').split(' ').pop() ?? 'call'
    return word.charAt(0).toUpperCase() + word.slice(1)
  }
  const revealed = (): number =>
    props.reveal === null ? 0 : easeOut(progress(clock.t(), 100, 700))

  const stat = (): string => {
    if (props.reveal !== null)
      return chart()
        ? `Your bar against ${props.upperWord ?? 'the chart'}`
        : 'The call, written over yours'
    if (props.waiting === true || props.bar === 'response') return 'Yours'
    if (props.bar === 'count') return 'Count-in'
    if (props.bar === 'call') return 'The call'
    return ''
  }

  /** The lamp of the beat sounding flashes as it lands. */
  const lampOn = (beat: number): boolean => {
    if (props.bar === null || props.beat !== beat) return false
    const times = beatTimes()
    const since = arrivalAge(times, times.length - 1, clock)
    return since !== null && since < FLASH_MS
  }

  /** The pattern as a score: the reveal's, else what the drill wrote. */
  const written = createMemo(() => {
    const onsets = props.reveal?.onsets ?? props.score
    if (!onsets || onsets.length === 0) return null
    const symbols = readRhythm(onsets, beats())
    const groups = beamGroups(symbols)
    return { symbols, groups, tuplets: tupletSpans(symbols, groups) }
  })

  /** When the player's bar started running, in the clock's ambient ms. */
  const [runAt, setRunAt] = createSignal(0)
  createEffect(
    on(
      () => props.run,
      (run) => {
        if (run) setRunAt(untrack(clock.ambient))
      },
    ),
  )
  const sweepX = (): number | null => {
    const run = props.run
    if (!run || props.reveal !== null) return null
    if (clock.reduced) return beatX(Math.max(0, props.beat - 1))
    const since = clock.ambient() - runAt()
    if (since > run.durationMs + 80) return null
    const at = run.from + (1 - run.from) * clamp(since / run.durationMs, 0, 1)
    return beatX(at * beats())
  }

  /** Each met onset and the tap that met it, in order. */
  const links = (): Array<{ onset: number; tap: number }> => {
    const reveal = props.reveal
    if (!reveal) return []
    const out: Array<{ onset: number; tap: number }> = []
    let next = 0
    reveal.onsets.forEach((onset, i) => {
      if (reveal.met[i] !== true) return
      const tap = reveal.taps[next]
      next += 1
      if (tap !== undefined) out.push({ onset, tap })
    })
    return out
  }

  const label = (): string => {
    const reveal = props.reveal
    if (reveal) {
      const missed = reveal.met.filter((met) => !met).length
      return reveal.correct
        ? `A bar of rhythm: every onset of the ${props.upperWord ?? 'call'} met`
        : `A bar of rhythm: ${missed} onset${missed === 1 ? '' : 's'} missed, ${reveal.extras.length} extra tap${reveal.extras.length === 1 ? '' : 's'}`
    }
    if (props.waiting === true) return 'A bar of rhythm, yours: tap to start it'
    return props.bar
      ? `A bar of rhythm, ${stat().toLowerCase()}, beat ${props.beat}`
      : 'A bar of rhythm, nothing played yet'
  }

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="rhythm-lane"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <rect
        x="16"
        y={TOP}
        width="358"
        height={BOTTOM - TOP}
        rx="24"
        fill={paint(ids.glass)}
        class={styles.glass}
      />
      <For each={Array.from({ length: beats() }, (_, i) => i + 1)}>
        {(beat) => (
          <circle
            cx={tenth(beatX(beat - 1))}
            cy={LAMP_Y}
            r={lampOn(beat) ? 7.5 : 6.5}
            fill={lampOn(beat) ? '#ffffff' : 'rgb(255 255 255 / 14%)'}
            data-part="beat-lamp"
            data-lit={lampOn(beat) ? '' : undefined}
          />
        )}
      </For>
      <text
        x="358"
        y={TOP + 37}
        class={styles.caption}
        text-anchor="end"
        data-part="lane-word"
      >
        {stat()}
      </text>
      <For each={Array.from({ length: beats() + 1 }, (_, i) => i)}>
        {(beat) => (
          <line
            x1={tenth(beatX(beat))}
            x2={tenth(beatX(beat))}
            y1={TOP + 58}
            y2={BOTTOM - 34}
            stroke={
              beat % 4 === 0
                ? 'rgb(255 255 255 / 15%)'
                : 'rgb(255 255 255 / 6%)'
            }
            stroke-dasharray={beat % 4 === 0 ? undefined : '2 5'}
            data-part={beat % 4 === 0 ? 'barline' : 'beat-division'}
          />
        )}
      </For>

      <text x="30" y={CALL_Y - 46} class={styles.small}>
        {rowName()}
      </text>
      <line
        x1="48"
        x2="360"
        y1={CALL_Y}
        y2={CALL_Y}
        stroke="rgb(255 255 255 / 22%)"
      />
      <text x="30" y={YOUR_Y - 32} class={styles.small}>
        Yours
      </text>
      <line
        x1="48"
        x2="360"
        y1={YOUR_Y}
        y2={YOUR_Y}
        stroke="rgb(255 255 255 / 22%)"
      />

      <Show when={props.reveal}>
        <g opacity={hundredth(0.8 * revealed())}>
          <For each={links()}>
            {(link) => (
              <line
                x1={tenth(beatX(link.onset))}
                y1={CALL_Y + 9}
                x2={tenth(tapX(link.tap))}
                y2={YOUR_Y - 15}
                stroke={TEAL}
                stroke-width="1.3"
                stroke-dasharray="3 4"
                data-part="link"
              />
            )}
          </For>
        </g>
      </Show>

      <Show when={written()}>
        {(score) => (
          <g class={styles.score} opacity={chart() ? 1 : hundredth(revealed())}>
            <RhythmScore
              symbols={score().symbols}
              groups={score().groups}
              tuplets={score().tuplets}
              x={beatX}
              y={CALL_Y}
              beats={beats()}
              scale={beats() === 8 ? 0.95 : 1.4}
              met={props.reveal?.met ?? null}
              run={props.reveal ? null : props.run}
              notePart={props.reveal ? 'onset' : 'score-onset'}
            />
          </g>
        )}
      </Show>

      <For each={props.reveal ? [] : (props.liveTaps ?? [])}>
        {(tap) => <TapMark x={tapX(tap)} part="live-tap" />}
      </For>
      <Show when={props.reveal}>
        {(reveal) => (
          <>
            <For each={reveal().taps}>
              {(tap) => <TapMark x={tapX(tap)} part="tap" />}
            </For>
            <For each={reveal().extras}>
              {(tap) => <TapMark x={tapX(tap)} part="extra" faint />}
            </For>
          </>
        )}
      </Show>

      <Show when={sweepX()}>
        {(x) => (
          <g data-part="playhead">
            <Glow
              d={lineD(x(), TOP + 52, x(), BOTTOM - 30)}
              width={2}
              stroke="var(--room-a, #9a87f0)"
            />
          </g>
        )}
      </Show>
    </svg>
  )
}

/** A tap on the player's line: a tick and a bead of light. */
function TapMark(props: {
  x: number
  part: string
  faint?: boolean
}): JSX.Element {
  return (
    <g data-part={props.part} opacity={props.faint === true ? 0.45 : 1}>
      <line
        x1={tenth(props.x)}
        x2={tenth(props.x)}
        y1={YOUR_Y - 13}
        y2={YOUR_Y + 13}
        stroke="#e4dcff"
        stroke-width="2.4"
        stroke-linecap="round"
      />
      <circle cx={tenth(props.x)} cy={YOUR_Y} r="4.2" fill="#ffffff" />
    </g>
  )
}
