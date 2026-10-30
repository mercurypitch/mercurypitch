// ============================================================
// The plate's staircases (docs/plans/ear-lab-native-look.md), on a log
// scale with its grid lines named at the edge:
//
//   - A practice run's (`LitStaircase`): its way drawn while the plate's
//     number counts along it, each turn in violet and each miss in red
//     as the line passes it, then the reading as a teal line across.
//   - A calibration's (`LitTracks`): its three tracks in the station's
//     light, each named with its own reading.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import type { TracePoint } from '@/features/ear-lab/stage-room'
import { easeInOut, lerp, lineD, partialD, progress, tenth } from './draw'
import { Glow, LitDefs, litIds, paint, RED, TEAL_PALE } from './kit'
import styles from './lit.module.css'
import { logDomain, logPlace, logTicks } from './staircase'

/** The drawings' width: the plate's. */
const W = 342
const STAIRS_H = 136
const TRACKS_H = 116
/** When the practice run's way draws, and when its reading settles. */
export const STAIRS_MS = { from: 300, to: 2700, settled: 3200 } as const
/** When a calibration's tracks draw. */
export const TRACKS_MS = { from: 200, to: 2400 } as const
const TURN = '#c9bcff'
/** The three tracks' light: the station's two, then cyan. */
const TRACK_LIGHT = [
  'var(--room-a, #9a87f0)',
  'var(--room-b, #5d8cff)',
  '#7fdcf5',
] as const

/**
 * The number the plate shows `t` ms in: the level the way has reached
 * while it draws, then easing onto the reading.
 */
export function countedLevel(
  points: readonly TracePoint[],
  reading: number,
  t: number,
): number {
  if (points.length === 0) return reading
  const p = progress(t, STAIRS_MS.from, STAIRS_MS.to)
  const tip = points[Math.round(p * (points.length - 1))].level
  const settle = progress(t, STAIRS_MS.to, STAIRS_MS.settled)
  return settle > 0 ? lerp(tip, reading, easeInOut(settle)) : tip
}

function stairsWords(points: readonly TracePoint[]): string {
  const turns = points.filter((point) => point.turn).length
  const misses = points.filter((point) => point.correct === false).length
  return `The staircase: ${points.length} answers, ${turns} turn${
    turns === 1 ? '' : 's'
  }, ${misses} miss${misses === 1 ? '' : 'es'}`
}

export function LitStaircase(props: {
  points: readonly TracePoint[]
  reading: number
  /** Printed after each grid line's value: "¢", " dB". */
  unitShort: string
  /** Ms since the plate came on. */
  t: number
}): JSX.Element {
  const ids = litIds()
  const left = 6
  const right = W - 6
  const top = 8
  const bottom = STAIRS_H - 8
  const domain = createMemo(() =>
    logDomain([...props.points.map((point) => point.level), props.reading]),
  )
  const y = (value: number): number =>
    bottom - logPlace(value, domain()[0], domain()[1]) * (bottom - top)
  const at = createMemo(() => {
    const last = Math.max(1, props.points.length - 1)
    return props.points.map(
      (point, i) =>
        [left + (i * (right - left)) / last, y(point.level)] as const,
    )
  })
  const drawn = (): ReturnType<typeof partialD> =>
    partialD(at(), progress(props.t, STAIRS_MS.from, STAIRS_MS.to))
  const settle = (): number =>
    easeInOut(progress(props.t, STAIRS_MS.to, STAIRS_MS.settled))

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 ${W} ${STAIRS_H}`}
      role="img"
      aria-label={stairsWords(props.points)}
      data-instrument="plate-staircase"
    >
      <LitDefs ids={ids} height={STAIRS_H} />
      <For each={logTicks(domain()[0], domain()[1])}>
        {(value) => (
          <>
            <line
              x1={left}
              x2={right}
              y1={tenth(y(value))}
              y2={tenth(y(value))}
              stroke="rgb(255 255 255 / 7%)"
            />
            <text
              x={right}
              y={tenth(y(value) - 4)}
              class={styles.small}
              text-anchor="end"
            >
              {value}
              {props.unitShort}
            </text>
          </>
        )}
      </For>
      <Glow d={drawn().d} width={2.2} stroke={paint(ids.across)} />
      <For each={props.points}>
        {(point, i) => {
          const missed = point.correct === false
          return (
            <Show when={missed || point.turn}>
              <circle
                cx={tenth(at()[i()][0])}
                cy={tenth(at()[i()][1])}
                r={missed ? 4.2 : 3}
                fill={missed ? RED : TURN}
                opacity={i() <= drawn().reached ? 1 : 0}
                data-part={missed ? 'miss' : 'turn'}
              />
            </Show>
          )
        }}
      </For>
      <Show when={settle() > 0}>
        <path
          d={lineD(
            left,
            y(props.reading),
            left + (right - left) * settle(),
            y(props.reading),
          )}
          fill="none"
          stroke={TEAL_PALE}
          stroke-width="1.4"
          stroke-dasharray="4 4"
          opacity={tenth(settle())}
          data-part="reading"
        />
      </Show>
    </svg>
  )
}

export function LitTracks(props: {
  /** Each track's points, in track order. */
  tracks: readonly (readonly TracePoint[])[]
  /** Each track's reading as printed, or null for none. */
  readings: readonly (string | null)[]
  unitShort: string
  t: number
}): JSX.Element {
  const ids = litIds()
  const left = 6
  const right = 276
  const top = 8
  const bottom = TRACKS_H - 8
  const domain = createMemo(() =>
    logDomain(props.tracks.flatMap((track) => track.map((p) => p.level))),
  )
  const y = (value: number): number =>
    bottom - logPlace(value, domain()[0], domain()[1]) * (bottom - top)
  const drawn = (): number => progress(props.t, TRACKS_MS.from, TRACKS_MS.to)
  const lineOf = (track: readonly TracePoint[]): string => {
    const last = Math.max(1, track.length - 1)
    const places = track.map(
      (point, i) =>
        [left + 10 + (i * (right - left - 10)) / last, y(point.level)] as const,
    )
    return partialD(places, drawn()).d
  }
  const words = (): string =>
    `The three tracks: ${props.readings
      .map(
        (reading, i) =>
          `${String.fromCharCode(65 + i)} ${reading ?? 'no reading'}`,
      )
      .join(', ')}`

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 ${W} ${TRACKS_H}`}
      role="img"
      aria-label={words()}
      data-instrument="plate-tracks"
    >
      <LitDefs ids={ids} height={TRACKS_H} />
      <For each={logTicks(domain()[0], domain()[1], 3)}>
        {(value) => (
          <>
            <line
              x1={left}
              x2={right}
              y1={tenth(y(value))}
              y2={tenth(y(value))}
              stroke="rgb(255 255 255 / 7%)"
            />
            <text x={left} y={tenth(y(value) - 4)} class={styles.small}>
              {value}
              {props.unitShort}
            </text>
          </>
        )}
      </For>
      <For each={props.tracks}>
        {(track, i) => (
          <>
            <Glow
              d={lineOf(track)}
              width={1.8}
              stroke={TRACK_LIGHT[i() % TRACK_LIGHT.length]}
            />
            <circle
              cx={right + 14}
              cy={30 + i() * 18}
              r="4"
              fill={TRACK_LIGHT[i() % TRACK_LIGHT.length]}
            />
            <text
              x={right + 22}
              y={34 + i() * 18}
              class={styles.caption}
              data-part="track"
            >
              {String.fromCharCode(65 + i())} {props.readings[i()] ?? '–'}
            </text>
          </>
        )}
      </For>
    </svg>
  )
}
