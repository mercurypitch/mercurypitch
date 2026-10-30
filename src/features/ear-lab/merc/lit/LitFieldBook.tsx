// ============================================================
// The Field Book's page in the room: the song's own timeline on a glass
// sheet (docs/plans/ear-lab-native-look.md, phase 3).
//
// While the song is read, the sheet says what the reading is doing and
// fills its bar. Once it is read, the timeline fills in from the left:
// the landings, the phrases and the root motions each on a row of its
// own, counted at the right, over the song's minutes. It shows when the
// items come and never what they are: no pitch is drawn, since a
// phrase's shape or a landing's height is what the drills ask.
// ============================================================

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { FieldBookPageProps } from '@/features/ear-lab/FieldBookPage'
import type { WildBook, WildHomeItem } from '@/lib/ear/wild'
import { WILD_LIMITS } from '@/lib/ear/wild'
import { useEntryClock } from './clock'
import { easeInOut, lerp, lineD, progress, tenth } from './draw'
import { Glow, LitDefs, litIds, paint, WHITE } from './kit'
import styles from './lit.module.css'

/** The sheet's height, inside the stage over the three drills' tiles. */
const HEIGHT = 300
/** The stage it lights, Merc's bubble under the sheet included. */
const STAGE_H = HEIGHT + 140
const TOP = 10
const BOTTOM = HEIGHT - 6
const LEFT = 32
const RIGHT = 358
const LANDINGS_Y = TOP + 100
const PHRASES_Y = TOP + 156
const ROOTS_Y = TOP + 212
const AXIS_Y = BOTTOM - 22
/** How long the timeline takes to fill in once the song is read. */
const FILL_MS = 1200
const ROOT = '#c9bcff'

/** "4:12". */
function clockTime(seconds: number): string {
  const whole = Math.round(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The timeline once read, drawn as it fills in from the left. */
function ReadTimeline(props: {
  book: WildBook
  x: (seconds: number) => number
}): JSX.Element {
  const ids = litIds()
  const clock = useEntryClock(FILL_MS)
  const reached = (): number =>
    lerp(LEFT - 6, RIGHT + 6, easeInOut(progress(clock.t(), 0, FILL_MS)))
  const clip = `${ids.across}-fill`
  /** Where a landing's held note ends: the landing. */
  const landingAt = (item: WildHomeItem): number =>
    props.x(item.endS - WILD_LIMITS.homeTailS)

  return (
    <g data-part="timeline">
      <LitDefs ids={ids} height={STAGE_H} />
      <clipPath id={clip}>
        <rect x="0" y="0" width={tenth(reached())} height={HEIGHT} />
      </clipPath>
      <g clip-path={`url(#${clip})`}>
        <For each={props.book.home}>
          {(item) => (
            <circle
              cx={tenth(landingAt(item))}
              cy={LANDINGS_Y}
              r="4"
              fill={WHITE}
              data-part="landing"
            />
          )}
        </For>
        <For each={props.book.echo}>
          {(item) => (
            <rect
              x={tenth(props.x(item.startS))}
              y={PHRASES_Y - 5}
              width={tenth(
                Math.max(4, props.x(item.endS) - props.x(item.startS)),
              )}
              height="10"
              rx="5"
              fill={paint(ids.across)}
              opacity="0.85"
              data-part="phrase"
            />
          )}
        </For>
        <For each={props.book.bassline}>
          {(item) => {
            const at = (): number => props.x(item.startS + item.switchS)
            return (
              <path
                d={`M${tenth(at())} ${ROOTS_Y - 5}l5 5l-5 5l-5 -5z`}
                fill={ROOT}
                data-part="root"
              />
            )
          }}
        </For>
      </g>
    </g>
  )
}

export function LitFieldBook(props: FieldBookPageProps): JSX.Element {
  const ids = litIds()
  const pct = (): number => Math.min(100, Math.max(0, props.pct ?? 0))
  const book = (): FieldBookPageProps['book'] =>
    props.pct === null ? (props.book ?? null) : null
  /** The song's length: as the session knows it, or as far as the book
   *  reaches. */
  const length = (): number | null => {
    if (props.duration !== undefined && props.duration !== null) {
      return props.duration
    }
    const read = book()
    if (read === null || read === undefined) return null
    const ends = [...read.home, ...read.echo, ...read.bassline].map(
      (item) => item.endS,
    )
    return ends.length === 0 ? null : Math.max(...ends)
  }
  const x = (seconds: number): number => {
    const song = length()
    if (song === null || song <= 0) return LEFT
    return LEFT + (Math.min(song, Math.max(0, seconds)) / song) * (RIGHT - LEFT)
  }
  /** The minutes along the axis, any too close to the end's own label
   *  left out. */
  const minutes = (): number[] => {
    const song = length()
    if (song === null) return []
    const marks: number[] = []
    for (let s = 0; s < song; s += 60) {
      if (s === 0 || x(s) < RIGHT - 34) marks.push(s)
    }
    return marks
  }
  const heading = (): string => {
    if (props.pct !== null) return `Reading: ${props.phase ?? 'the song'}`
    const song = length()
    const key = props.keyName ?? 'the song'
    return song === null ? `Read: ${key}` : `Read: ${key} · ${clockTime(song)}`
  }
  const rows = [
    { label: 'Landings', y: LANDINGS_Y, kind: 'home' },
    { label: 'Phrases', y: PHRASES_Y, kind: 'echo' },
    { label: 'Root motions', y: ROOTS_Y, kind: 'bassline' },
  ] as const
  const label = (): string => {
    const counts = props.counts
    if (props.pct !== null) return `The song's timeline: reading, ${props.pct}%`
    if (counts === null) return "The song's timeline"
    return `The song's timeline: ${props.keyName ?? 'read'}; ${counts.home} landings, ${counts.echo} phrases, ${counts.bassline} root motions`
  }

  return (
    <svg
      class={styles.instrument}
      viewBox={`0 0 390 ${HEIGHT}`}
      role="img"
      aria-label={label()}
      data-instrument="song-timeline"
    >
      <LitDefs ids={ids} height={STAGE_H} />
      <rect
        x="16"
        y={TOP}
        width="358"
        height={BOTTOM - TOP}
        rx="24"
        fill="rgb(8 12 32 / 62%)"
      />
      <rect
        x="16"
        y={TOP}
        width="358"
        height={BOTTOM - TOP}
        rx="24"
        fill={paint(ids.glass)}
        class={styles.glass}
      />
      <text x={LEFT} y={TOP + 28} class={styles.caption} data-part="heading">
        {heading()}
      </text>
      <Show when={props.pct !== null}>
        <text
          x={RIGHT}
          y={TOP + 28}
          class={styles.name}
          text-anchor="end"
          data-part="pct"
        >
          {pct()}%
        </text>
        <line
          x1={LEFT}
          x2={RIGHT}
          y1={TOP + 40}
          y2={TOP + 40}
          stroke="rgb(255 255 255 / 10%)"
          stroke-width="3"
          stroke-linecap="round"
        />
        <Glow
          d={lineD(
            LEFT,
            TOP + 40,
            LEFT + ((RIGHT - LEFT) * pct()) / 100,
            TOP + 40,
          )}
          width={3}
          stroke={paint(ids.across)}
        />
      </Show>

      <For each={rows}>
        {(row) => (
          <>
            <text x={LEFT} y={row.y - 14} class={styles.caption}>
              {row.label}
            </text>
            <Show when={props.pct === null ? props.counts : null}>
              {(counts) => (
                <text
                  x={RIGHT}
                  y={row.y - 14}
                  class={styles.name}
                  text-anchor="end"
                  data-part="count"
                  data-kind={row.kind}
                >
                  {counts()[row.kind]}
                </text>
              )}
            </Show>
          </>
        )}
      </For>
      <line
        x1={LEFT}
        x2={RIGHT}
        y1={ROOTS_Y}
        y2={ROOTS_Y}
        stroke="rgb(255 255 255 / 18%)"
        stroke-dasharray="3 6"
      />
      <Show when={props.pct === null && props.counts?.bassline === 0}>
        <text
          x="195"
          y={ROOTS_Y + 22}
          class={styles.caption}
          text-anchor="middle"
        >
          none found in this song
        </text>
      </Show>

      <Show when={book()}>
        {(read) => (
          <Show when={length()}>
            <ReadTimeline book={read()} x={x} />
          </Show>
        )}
      </Show>

      <Show when={length() !== null}>
        <line
          x1={LEFT}
          x2={RIGHT}
          y1={AXIS_Y - 10}
          y2={AXIS_Y - 10}
          stroke="rgb(255 255 255 / 10%)"
        />
        <For each={minutes()}>
          {(s) => (
            <>
              <line
                x1={tenth(x(s))}
                x2={tenth(x(s))}
                y1={AXIS_Y - 14}
                y2={AXIS_Y - 6}
                stroke="rgb(255 255 255 / 30%)"
              />
              <text
                x={tenth(x(s))}
                y={AXIS_Y + 8}
                class={styles.small}
                text-anchor={s === 0 ? 'start' : 'middle'}
              >
                {s / 60}:00
              </text>
            </>
          )}
        </For>
        <text
          x={RIGHT}
          y={AXIS_Y + 8}
          class={styles.small}
          text-anchor="end"
          data-part="length"
        >
          {clockTime(length() ?? 0)}
        </text>
      </Show>
    </svg>
  )
}
