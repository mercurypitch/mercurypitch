// ============================================================
// The phrase drills' instrument in the room: a ladder of rungs and a
// chain of beads of light, for Span, Echo and Bassline (and the Wild
// Echo), as the mock-ups draw them (docs/plans/ear-lab-native-look.md).
//
// While the phrase sounds the beads stand on one level line above the
// ladder and light in turn: their heights would draw the contour for the
// eye, and the ear is meant to hold it. Echo's cadence lights its four
// lamps first; Bassline's tonic glows under the lowest rung while it is
// held. At the reveal each bead drops onto its rung and the line is drawn
// through them; a matched note is ringed teal, and a missed one leaves a
// dashed red ring on the rung that was tapped, the first slip named.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { BeadChainProps } from '@/features/ear-lab/BeadChain'
import { degreeSolfege } from '@/lib/ear/phrase'
import { romanOf } from '@/lib/ear/progressions'
import { arrivalAge, useArrivals, useStageClock } from './clock'
import type { Point } from './draw'
import { easeOutBack, hundredth, lerp, partialD, progress, tenth } from './draw'
import { Glow, LitDefs, litIds, Orb, paint, RED, Ring, TEAL, TEAL_PALE, } from './kit'
import styles from './lit.module.css'

/** The instrument's height: the stage over the phrase strip and keys. */
const HEIGHT = 381
/** The stage it lights, Merc's bubble under the instrument included. */
const STAGE_H = HEIGHT + 100
const CADENCE = ['I', 'IV', 'V', 'I']
const LAMP_W = 50
const LAMP_GAP = 10
const R = 12

export function LitChain(props: BeadChainProps): JSX.Element {
  const ids = litIds()
  const clock = useStageClock()
  const arrivals = useArrivals(() => props.sounding, clock)
  const chords = useArrivals(() => props.cadence ?? 0, clock)

  const roots = (): boolean => props.ladder === 'roots'
  const rungs = (): number => (roots() ? 7 : 8)
  const step = (): number => (roots() ? 38 : 33)
  const rungY = (degree: number): number => HEIGHT - 50 - (degree - 1) * step()
  const word = (degree: number): string =>
    roots() ? romanOf(degree) : (props.words ?? degreeSolfege)(degree)
  const withLamps = (): boolean => props.cadence !== undefined
  const stageY = (): number => (withLamps() ? 66 : 40)

  const count = (): number =>
    Math.max(1, props.reveal?.expected.length ?? props.count)
  const beadX = (i: number): number =>
    count() <= 1 ? 230 : 112 + (i * 236) / (count() - 1)
  const listening = (): boolean =>
    props.reveal === null && (props.sounding > 0 || clock.beat() === 'listen')
  const age = (i: number): number | null =>
    listening() ? arrivalAge(arrivals(), i, clock) : null

  /** Where bead `i` stands: on the level line, or dropping onto its rung. */
  const beadY = (i: number): number => {
    const degree = props.reveal?.expected[i]
    if (degree === undefined) return stageY()
    const drop = easeOutBack(progress(clock.t(), 100 + i * 100, 700 + i * 100))
    return lerp(stageY(), rungY(degree), drop)
  }
  /** How far the verdict rings have come in, for bead `i`. */
  const marked = (i: number): number =>
    props.reveal === null
      ? 0
      : progress(clock.t(), 700 + i * 100, 1000 + i * 100)
  const lineD = (): string => {
    if (props.reveal === null) return ''
    const points: Point[] = Array.from({ length: count() }, (_, i) => [
      beadX(i),
      beadY(i),
    ])
    return partialD(points, progress(clock.t(), 500, 1400)).d
  }
  const slip = (): number => props.reveal?.perNote.indexOf(false) ?? -1

  /** A cadence lamp's light: full while its chord sounds, low once it has
   *  sounded or the phrase is past, dark before. */
  const lampLight = (j: number): number => {
    if (!listening()) return 0.35
    if (props.cadence === j + 1) return 1
    return j < chords().length ? 0.35 : 0
  }

  const label = (): string => {
    const reveal = props.reveal
    if (reveal) {
      const missed = reveal.perNote.filter((ok) => !ok).length
      return missed === 0
        ? `A chain of ${reveal.expected.length} beads on the ladder, all matched`
        : `A chain of ${reveal.expected.length} beads on the ladder, ${missed} off`
    }
    return props.sounding > 0
      ? `A chain of ${count()} beads, note ${props.sounding} sounding`
      : `A chain of ${count()} beads, their heights not yet shown`
  }

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="bead-ladder"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <For each={Array.from({ length: rungs() }, (_, i) => i + 1)}>
        {(degree) => (
          <>
            <line
              x1="70"
              x2="362"
              y1={rungY(degree)}
              y2={rungY(degree)}
              stroke={
                degree === 1 || degree === 8
                  ? 'rgb(255 255 255 / 11%)'
                  : 'rgb(255 255 255 / 6%)'
              }
            />
            <text
              x="58"
              y={rungY(degree) + 4}
              class={styles.caption}
              text-anchor="end"
            >
              {word(degree)}
            </text>
          </>
        )}
      </For>
      <Show when={roots()}>
        <rect
          x="70"
          y={rungY(1) - 9}
          width="292"
          height="18"
          rx="9"
          fill={paint(ids.across)}
          opacity={hundredth(
            listening() && !clock.reduced
              ? 0.3 + 0.15 * Math.sin(clock.ambient() * 0.006)
              : 0.22,
          )}
          data-part="held"
        />
        <text x="362" y={rungY(1) + 26} class={styles.small} text-anchor="end">
          I held under the line
        </text>
      </Show>
      <line
        x1="96"
        x2="350"
        y1={stageY()}
        y2={stageY()}
        stroke="rgb(255 255 255 / 14%)"
        stroke-dasharray="2 6"
      />
      <Show when={withLamps()}>
        <For each={CADENCE}>
          {(chord, j) => {
            const x = (): number =>
              223 -
              (CADENCE.length * LAMP_W + (CADENCE.length - 1) * LAMP_GAP) / 2 +
              j() * (LAMP_W + LAMP_GAP)
            const q = (): number => lampLight(j())
            return (
              <g
                data-part="cadence-lamp"
                data-lit={props.cadence === j() + 1 ? '' : undefined}
              >
                <rect
                  x={x()}
                  y="12"
                  width={LAMP_W}
                  height="26"
                  rx="13"
                  fill={`color-mix(in srgb, var(--room-a, #9a87f0) ${Math.round(8 + 40 * q())}%, transparent)`}
                  stroke={
                    q() > 0
                      ? `color-mix(in srgb, var(--room-a, #9a87f0) ${Math.round(40 + 50 * q())}%, transparent)`
                      : 'rgb(255 255 255 / 14%)'
                  }
                />
                <text
                  x={x() + LAMP_W / 2}
                  y="29.5"
                  class={styles.name}
                  text-anchor="middle"
                >
                  {chord}
                </text>
              </g>
            )
          }}
        </For>
      </Show>

      <Glow d={lineD()} width={2.2} stroke={TEAL_PALE} opacity={0.9} />
      <For each={Array.from({ length: count() }, (_, i) => i)}>
        {(i) => {
          const light = (): { body: number; glow: number } => {
            if (props.reveal !== null) return { body: 1, glow: 0 }
            if (!listening()) return { body: 0.5, glow: 0 }
            if (age(i) === null) return { body: 0.3, glow: 0 }
            return props.sounding === i + 1
              ? { body: 1, glow: 0.85 }
              : { body: 0.7, glow: 0 }
          }
          const matched = (): boolean => props.reveal?.perNote[i] === true
          const tapped = (): number | undefined => props.reveal?.answered[i]
          return (
            <g
              data-bead={i + 1}
              data-sounding={props.sounding === i + 1 ? '' : undefined}
              data-matched={
                props.reveal === null ? undefined : matched() ? 'true' : 'false'
              }
            >
              <Show when={props.reveal !== null && !matched() && tapped()}>
                {(degree) => (
                  <circle
                    cx={tenth(beadX(i))}
                    cy={rungY(degree())}
                    r={R}
                    fill="none"
                    stroke={RED}
                    stroke-width="2"
                    stroke-dasharray="3 3"
                    opacity={hundredth(marked(i))}
                    data-part="miss"
                  />
                )}
              </Show>
              <Orb
                ids={ids}
                x={beadX(i)}
                y={beadY(i)}
                r={R}
                teal={props.reveal !== null}
                lit={hundredth(light().body)}
                glow={hundredth(light().glow)}
              />
              <Show when={props.reveal !== null && matched()}>
                <circle
                  cx={tenth(beadX(i))}
                  cy={tenth(beadY(i))}
                  r="17"
                  fill="none"
                  stroke={TEAL}
                  stroke-width="1.6"
                  opacity={hundredth(marked(i))}
                  data-part="match"
                />
              </Show>
              <Ring
                x={beadX(i)}
                y={stageY()}
                t={age(i) ?? -1}
                ms={460}
                from={R}
                to={30}
                width={1.6}
              />
            </g>
          )
        }}
      </For>
      <Show when={props.reveal !== null && slip() >= 0}>
        <text
          x={tenth(beadX(slip()))}
          y={tenth(
            rungY(
              Math.min(
                props.reveal?.expected[slip()] ?? 1,
                props.reveal?.answered[slip()] ?? 1,
              ),
            ) + 28,
          )}
          class={`${styles.caption} ${styles.red} ${styles.edged}`}
          text-anchor="middle"
          opacity={hundredth(progress(clock.t(), 1200, 1600))}
          data-part="slip"
        >
          first slip at note {slip() + 1}
        </text>
      </Show>
    </svg>
  )
}
