// ============================================================
// StylusTrace — Contour's instrument.
//
// A drum recorder: the stylus draws the first tone as a level line
// and then waits — the second segment's direction is the answer, so
// it stays undrawn until the reveal, when it goes up, down or level
// in signal green with a garnet ghost for a wrong pick.
//
// The stylus is a pen carriage on a rail inside the drum, its nib
// straight down to the paper. It used to be a lever arm pivoted
// outside the drum, which on the answer screen was a brass line
// rising to the upper right — a slope on the one screen that asks
// which way the tone went. Nothing about the pen may slope.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './EarInstruments.module.css'

export type ContourDirection = 'up' | 'down' | 'same'

interface StylusTraceProps {
  /** Which tone is sounding: 1, 2, or 0. */
  sounding: 0 | 1 | 2
  /** The answer phase: both tones have sounded, the first segment
   *  stays drawn and the stylus waits at its end. */
  armed: boolean
  reveal: { direction: ContourDirection; wrong: ContourDirection | null } | null
}

const BASE_Y = 130
const START_X = 120
const MID_X = 250
const END_X = 380
const RULES = [70, 90, 110, 130, 150, 170, 190]
/** The carriage rail, between the drum's top edge and the first rule. */
const RAIL_Y = 58
/** Where the nib leaves the carriage. */
const NIB_TOP = RAIL_Y + 6

function endY(direction: ContourDirection): number {
  if (direction === 'up') return BASE_Y - 50
  if (direction === 'down') return BASE_Y + 50
  return BASE_Y
}

const WORD: Record<ContourDirection, string> = {
  up: 'up',
  down: 'down',
  same: 'level',
}

export function StylusTrace(props: StylusTraceProps): JSX.Element {
  /** Anything on the drum yet: from the first tone to the reveal. */
  const traced = () =>
    props.sounding >= 1 || props.armed || props.reveal !== null
  const tip = () => ({
    x: props.reveal ? END_X : traced() ? MID_X : START_X,
    y: props.reveal ? endY(props.reveal.direction) : BASE_Y,
  })

  const label = () =>
    props.reveal
      ? `Stylus trace: the second tone went ${WORD[props.reveal.direction]}`
      : 'Stylus trace on a drum recorder, the second segment not yet drawn'

  return (
    <svg
      class={styles.instrument}
      viewBox="0 0 520 260"
      role="img"
      aria-label={label()}
      data-instrument="stylus"
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
      <For each={RULES}>
        {(y) => <line x1="80" y1={y} x2="440" y2={y} class={styles.drumRule} />}
      </For>

      {/* the first segment: level, drawn as the first tone sounds */}
      <Show when={traced()}>
        <line
          x1={START_X}
          y1={BASE_Y}
          x2={MID_X}
          y2={BASE_Y}
          class={styles.trace}
          classList={{ [styles.traceDrawing]: props.sounding === 1 }}
        />
      </Show>

      {/* the ghost of a wrong pick, then the truth */}
      <Show when={props.reveal?.wrong}>
        {(wrong) => (
          <line
            x1={MID_X}
            y1={BASE_Y}
            x2={END_X}
            y2={endY(wrong())}
            class={`${styles.trace} ${styles.traceGhost}`}
          />
        )}
      </Show>
      <Show when={props.reveal}>
        {(reveal) => (
          <line
            x1={MID_X}
            y1={BASE_Y}
            x2={END_X}
            y2={endY(reveal().direction)}
            class={`${styles.trace} ${styles.traceTrue}`}
          />
        )}
      </Show>

      {/* the pen: a carriage on its rail, the nib straight down */}
      <line
        x1="84"
        y1={RAIL_Y}
        x2="436"
        y2={RAIL_Y}
        class={styles.stylusRail}
        data-part="rail"
      />
      <rect
        x={tip().x - 7}
        y={RAIL_Y - 6}
        width="14"
        height="12"
        rx="3"
        class={styles.stylusCarriage}
        data-part="carriage"
      />
      <rect
        x={tip().x - 1.1}
        y={NIB_TOP}
        width="2.2"
        height={tip().y - NIB_TOP}
        rx="1.1"
        class={styles.stylus}
        data-part="nib"
        data-tip-x={tip().x}
        data-tip-y={tip().y}
      />
      <circle
        cx={tip().x}
        cy={tip().y}
        r="3"
        class={styles.stylusTip}
        data-part="tip"
      />

      <Show when={props.reveal}>
        {(reveal) => (
          <text
            x="260"
            y="244"
            class={`${styles.nameplate} ${styles.nameplateSignal}`}
            text-anchor="middle"
          >
            {WORD[reveal().direction] === 'level'
              ? 'The same'
              : WORD[reveal().direction] === 'up'
                ? 'Up'
                : 'Down'}
          </text>
        )}
      </Show>
    </svg>
  )
}
