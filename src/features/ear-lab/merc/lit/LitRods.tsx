// ============================================================
// The Grid's instrument in the room: six glass rods on a steady lattice
// (docs/plans/ear-lab-native-look.md).
//
// Each click lands as a ring on its own rod, on the grid and never where
// it was nudged: the drill lights the rods to the lattice (GridDrill.tsx),
// so the eye cannot answer for the ear. The reveal slides the off rod out
// of line, early or late, leaves its ghost where it should have stood,
// and writes how far.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { EscapementLatticeProps } from '@/features/ear-lab/EscapementLattice'
import { arrivalAge, useArrivals, useStageClock } from './clock'
import { easeInOut, hundredth, lerp, lineD, progress, tenth } from './draw'
import { Glow, LitDefs, litIds, paint, Ring, TEAL, TEAL_PALE } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over a row of four pads. */
const HEIGHT = 425
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const RODS = [0, 1, 2, 3, 4, 5]
const TOP = 104
const BOTTOM = 272
const RAIL_Y = BOTTOM + 24
const BRACKET_Y = RAIL_Y + 28
/** How far the off rod slides at the reveal. */
const SLIDE = 26
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

const rodX = (i: number): number => 46 + i * 59.6

export function LitRods(props: EscapementLatticeProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const arrivals = useArrivals(() => (props.running ? props.lit : 0), clock)
  const revealed = (): number =>
    props.reveal === null ? 0 : easeInOut(progress(clock.t(), 150, 800))
  /** Where the off rod has slid to, from its place on the lattice. */
  const slide = (): number =>
    props.reveal === null
      ? 0
      : (props.reveal.early ? -1 : 1) * SLIDE * revealed()
  const off = (): number => props.reveal?.index ?? -1
  const howFar = (): string => {
    const reveal = props.reveal
    if (reveal === null) return ''
    const way = reveal.early ? 'early' : 'late'
    return reveal.ms === undefined ? way : `${Math.round(reveal.ms)} ms ${way}`
  }

  /** Ms since rod `i`'s click sounded, while the clicks play. */
  const age = (i: number): number | null =>
    props.running && props.reveal === null
      ? arrivalAge(arrivals(), i, clock)
      : null

  /** A rod's light and its halo, by where the question is. */
  const light = (i: number): { body: number; halo: number } => {
    if (props.reveal !== null) {
      if (i === off()) return { body: 1, halo: 0.32 * revealed() }
      return { body: i >= 2 ? 0.42 : 0.28, halo: 0 }
    }
    if (props.running) {
      const since = age(i)
      if (since === null) return { body: 0.16, halo: 0 }
      const p = progress(since, 0, 700)
      return { body: lerp(1, 0.42, p), halo: (1 - p) * 0.5 }
    }
    return { body: i >= 2 ? 0.55 : 0.3, halo: 0 }
  }

  const arrowD = (): string => {
    const x = rodX(off())
    const y = TOP + (BOTTOM - TOP) * 0.5
    const tip = x + slide()
    const back = props.reveal?.early === true ? -6 : 6
    return `${lineD(x, y, tip, y)}M${tenth(tip - back)} ${tenth(y - 5)}L${tenth(tip)} ${tenth(y)}L${tenth(tip - back)} ${tenth(y + 5)}`
  }

  const label = (): string =>
    props.reveal !== null
      ? `Six rods on a lattice: the ${ORDINALS[props.reveal.index]} click was ${howFar()}`
      : 'Six rods on a lattice; one of the last four is off the grid'

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="grid-rods"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <For each={RODS}>
        {(i) => (
          <text
            x={rodX(i)}
            y={TOP - 22}
            class={i >= 2 ? styles.name : styles.label}
            text-anchor="middle"
          >
            {i + 1}
          </text>
        )}
      </For>
      <Glow
        d={lineD(22, RAIL_Y, 368, RAIL_Y)}
        width={1.3}
        stroke="rgb(200 205 235 / 40%)"
      />
      <For each={RODS}>
        {(i) => (
          <>
            <line
              x1={rodX(i)}
              x2={rodX(i)}
              y1={RAIL_Y - 7}
              y2={RAIL_Y + 7}
              stroke="rgb(200 205 235 / 60%)"
              stroke-width="1.5"
            />
            <Show when={i < 5}>
              <For each={[1, 2, 3]}>
                {(quarter) => (
                  <line
                    x1={tenth(rodX(i) + (quarter * 59.6) / 4)}
                    x2={tenth(rodX(i) + (quarter * 59.6) / 4)}
                    y1={RAIL_Y - 3}
                    y2={RAIL_Y + 3}
                    stroke="rgb(200 205 235 / 25%)"
                  />
                )}
              </For>
            </Show>
          </>
        )}
      </For>
      <Glow
        d={`M${tenth(rodX(2) - 18)} ${BRACKET_Y - 7}V${BRACKET_Y}H${tenth(rodX(5) + 18)}V${BRACKET_Y - 7}`}
        width={1.2}
        stroke="rgb(200 205 235 / 38%)"
      />
      <text
        x={tenth((rodX(2) + rodX(5)) / 2)}
        y={BRACKET_Y + 20}
        class={styles.caption}
        text-anchor="middle"
      >
        the last four: one is off
      </text>

      <Show when={props.reveal}>
        <rect
          x={tenth(rodX(off()) - 7)}
          y={TOP}
          width="14"
          height={BOTTOM - TOP}
          rx="7"
          fill="none"
          stroke="rgb(143 245 227 / 75%)"
          stroke-dasharray="4 4"
          opacity={hundredth(revealed())}
          data-part="ghost"
        />
      </Show>
      <For each={RODS}>
        {(i) => {
          const isOff = (): boolean => i === off()
          return (
            <g
              transform={isOff() ? `translate(${tenth(slide())} 0)` : undefined}
              data-rod={i + 1}
              data-off={isOff() ? '' : undefined}
              data-sounded={age(i) !== null ? '' : undefined}
            >
              <rect
                x={tenth(rodX(i) - 15)}
                y={TOP - 8}
                width="30"
                height={BOTTOM - TOP + 16}
                rx="15"
                fill={paint(ids.down)}
                opacity={hundredth(light(i).halo)}
              />
              <rect
                x={tenth(rodX(i) - 7)}
                y={TOP}
                width="14"
                height={BOTTOM - TOP}
                rx="7"
                fill={paint(ids.down)}
                opacity={hundredth(light(i).body)}
              />
              <rect
                x={tenth(rodX(i) - 7)}
                y={TOP}
                width="14"
                height={BOTTOM - TOP}
                rx="7"
                fill="none"
                stroke={isOff() ? TEAL : 'rgb(255 255 255 / 20%)'}
              />
            </g>
          )
        }}
      </For>
      <For each={RODS}>
        {(i) => (
          <Ring
            x={rodX(i)}
            y={TOP - 4}
            t={age(i) ?? -1}
            ms={520}
            from={6}
            to={34}
          />
        )}
      </For>
      <Show when={props.reveal}>
        <text
          x={tenth(rodX(off()) + slide() / 2)}
          y={TOP - 46}
          class={`${styles.name} ${styles.teal} ${styles.edged}`}
          text-anchor="middle"
          opacity={hundredth(revealed())}
          data-part="offset"
        >
          {howFar()}
        </text>
        <Glow
          d={revealed() > 0.05 ? arrowD() : ''}
          width={1.8}
          stroke={TEAL_PALE}
          opacity={revealed()}
        />
      </Show>
    </svg>
  )
}
