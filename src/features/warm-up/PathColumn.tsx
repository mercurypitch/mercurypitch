// ============================================================
// The Warm-up path's column: the night, the lit path, the stops and Merc
// ============================================================
//
// DESIGN-warm-up.md §4's layers, bottom to top: the sky plate (its floor's
// line on the path's floor), the floor's pools of light, the night's
// points, the path (one S-curve per pair of stops, resting violet to cyan,
// lit white-cyan), the stops (an orb sprite per state, its glyph, its name
// and result beside it) and Merc. Every place comes from path-layout.ts in
// W units, at the screen's one scale.
//
// The end (§5.8) adds the song's burst as it lights, and the points the
// end has over the rest grow in with it; on the song Merc is drawn at
// screen 3's size, scaled about his feet (MERC_SONG_SCALE).
//
// The stops are an ordered list in the plan's order, bottom stop first, so
// a screen reader hears the path as it climbs: "Lip roll, done, 86% lit",
// "Ng slides, next", "Long note, waiting".

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { MERC_FEET, MercView } from '@/components/room-kit/MercView'
import { PlateImage } from '@/components/room-kit/PlateImage'
import { SILENT_VOICE } from '@/components/room-kit/room-constants'
import type { MercState } from '@/lib/merc/constants'
import { ORB_SPRITES, SKY_FALLBACK, SKY_FLOOR, SKY_PLATE, SKY_PX, } from './path-art'
import type { PathFrame, PathMode, StopPlace } from './path-layout'
import type { MercSpot } from './path-layout'
import { columnX, columnY, MERC_CANVAS_W, MERC_SONG_SCALE, mercFeet, NAME_GAP_W, ORB_BOX_W, RIM_W, segmentD, sparkleCount, sparkles, stopPlaces, } from './path-layout'
import type { StopView } from './path-view'
import { PATH_WORDS } from './path-view'
import { PathGlyph } from './PathGlyph'
import styles from './WarmUpPath.module.css'

/** A name's size: 0.049 W, never under 15 px (§1.2). */
const NAME_W = 0.049
const NAME_MIN_PX = 15

export interface PathColumnProps {
  frame: PathFrame
  mode: PathMode
  stops: readonly StopView[]
  /** Segments lit from the bottom: up to this stop's index. */
  litTo: number
  /** The newest lit segment is still drawing in. */
  trailIn: boolean
  /** The stop just finished, still drawn as it was (next). */
  unlit: number | null
  /** At the end, how many finished stops have brightened, the song last. */
  brightened: number
  /** The end has lit: its points have grown in. */
  endLit: boolean
  /** The song's burst plays as it lights. */
  burst: boolean
  /** The stop whose ring pulses: the one opening. */
  pulsing: number | null
  merc: MercSpot
  mercState: MercState
  hopping: boolean
  /** Faded out between two spots: reduced motion's crossfade. */
  mercFaded: boolean
  still: boolean
  /** The song stop at the end: what Sing a song does. */
  onSong?: () => void
  /** The sky is on screen, or failed. */
  onSkySettled?: () => void
}

interface Placed {
  readonly view: StopView
  readonly place: StopPlace
  readonly x: number
  readonly y: number
}

/**
 * The orb a stop shows now. The motion holds a just-finished stop back as
 * it was (next); at the end the finished stops brighten one by one, bottom
 * up, and the song lights after them.
 */
function orbShown(
  props: PathColumnProps,
  stop: StopView,
  order: number,
  total: number,
): StopView['orb'] {
  if (props.unlit === stop.index) return 'next'
  if (stop.orb !== 'lit') return stop.orb
  if (stop.song) return props.brightened > total ? 'lit' : 'waiting'
  return order < props.brightened ? 'lit' : 'done'
}

function Stop(props: {
  column: PathColumnProps
  stop: Placed
  /** The orb it shows now (orbShown). */
  orb: StopView['orb']
}): JSX.Element {
  const unit = (): number => props.column.frame.unit
  const box = (): number => ORB_BOX_W * unit()
  const glyph = (): number => 0.2 * unit()
  const orb = (): StopView['orb'] => props.orb
  const songOpens = (): boolean =>
    props.stop.view.song &&
    props.stop.view.orb === 'lit' &&
    props.column.onSong !== undefined
  const label = (): JSX.CSSProperties => {
    const gap = `${NAME_GAP_W * unit()}px`
    const size = `${Math.max(NAME_MIN_PX, NAME_W * unit())}px`
    return props.stop.place.side === 'right'
      ? { left: gap, 'font-size': size }
      : { right: gap, 'font-size': size, 'text-align': 'right' }
  }
  return (
    <li
      class={styles.stop}
      style={{ transform: `translate(${props.stop.x}px, ${props.stop.y}px)` }}
      data-orb={orb()}
      data-testid={`warm-up-stop-${props.stop.view.index}`}
      aria-label={props.stop.view.said}
    >
      <img
        class={styles.orb}
        src={ORB_SPRITES[orb()]}
        alt=""
        draggable={false}
        style={{
          width: `${box()}px`,
          height: `${box()}px`,
          margin: `${-box() / 2}px 0 0 ${-box() / 2}px`,
        }}
      />
      <span
        class={styles.ring}
        classList={{
          [styles.pulse]: props.column.pulsing === props.stop.view.index,
        }}
        style={{
          width: `${2 * RIM_W * unit()}px`,
          height: `${2 * RIM_W * unit()}px`,
          margin: `${-RIM_W * unit()}px 0 0 ${-RIM_W * unit()}px`,
        }}
        aria-hidden="true"
      />
      <PathGlyph
        glyph={props.stop.view.glyph}
        class={styles.glyph}
        style={{
          width: `${glyph()}px`,
          height: `${glyph()}px`,
          margin: `${-glyph() / 2}px 0 0 ${-glyph() / 2}px`,
        }}
      />
      <span class={styles.label} style={label()} aria-hidden="true">
        <span class={styles.name}>{props.stop.view.name}</span>
        <Show when={props.stop.view.line}>
          {(line) => (
            <span
              class={styles.result}
              classList={{ [styles.skipped]: line() === PATH_WORDS.skipped }}
            >
              {line()}
            </span>
          )}
        </Show>
      </span>
      {/* The song's burst as the end lights it (§5.8): a flare of light,
          by transform and opacity, gone once it has played. */}
      <Show when={props.stop.view.song && props.column.burst}>
        <span
          class={styles.burst}
          style={{
            width: `${4 * RIM_W * unit()}px`,
            height: `${4 * RIM_W * unit()}px`,
            margin: `${-2 * RIM_W * unit()}px 0 0 ${-2 * RIM_W * unit()}px`,
          }}
          aria-hidden="true"
          data-testid="warm-up-burst"
        />
      </Show>
      <Show when={songOpens()}>
        <button
          type="button"
          class={styles.songTap}
          style={{
            width: `${2 * RIM_W * unit()}px`,
            height: `${2 * RIM_W * unit()}px`,
            margin: `${-RIM_W * unit()}px 0 0 ${-RIM_W * unit()}px`,
          }}
          onClick={() => props.column.onSong?.()}
          aria-label={PATH_WORDS.sing}
          data-testid="warm-up-song-stop"
        />
      </Show>
    </li>
  )
}

/** The path between each pair of stops, and which of them are lit. */
function Trail(props: {
  column: PathColumnProps
  placed: readonly Placed[]
}): JSX.Element {
  const segments = createMemo(() =>
    props.placed.slice(1).map((to, i) => ({
      d: segmentD(props.placed[i]!, to),
      lit: i < props.column.litTo,
      drawing: i === props.column.litTo - 1 && !props.column.trailIn,
    })),
  )
  const unit = (): number => props.column.frame.unit
  return (
    <svg
      class={styles.trail}
      width={props.column.frame.column}
      height={props.column.frame.height}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="warm-trail" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#b39dfc" />
          <stop offset="1" stop-color="#9cf7fe" />
        </linearGradient>
      </defs>
      <For each={segments()}>
        {(segment) => (
          <g>
            <path
              d={segment.d}
              class={styles.trailGlow}
              stroke-width={0.085 * unit()}
            />
            <path
              d={segment.d}
              class={styles.trailCore}
              stroke-width={0.02 * unit()}
            />
            <Show when={segment.lit}>
              <path
                d={segment.d}
                class={styles.litGlow}
                classList={{ [styles.drawing]: segment.drawing }}
                pathLength="1"
                stroke-width={0.11 * unit()}
              />
              <path
                d={segment.d}
                class={styles.litCore}
                classList={{ [styles.drawing]: segment.drawing }}
                pathLength="1"
                stroke-width={0.03 * unit()}
              />
            </Show>
          </g>
        )}
      </For>
    </svg>
  )
}

/** The pools of light on the floor: under the bottom stop, and Merc's feet. */
function Pools(props: {
  column: PathColumnProps
  placed: readonly Placed[]
}): JSX.Element {
  const unit = (): number => props.column.frame.unit
  const first = (): StopView['orb'] | null => props.placed[0]?.view.orb ?? null
  const pool = (
    x: number,
    tint: 'next' | 'done' | 'merc',
  ): JSX.CSSProperties => {
    const w = 0.5 * unit()
    const h = 0.09 * unit()
    return {
      width: `${w}px`,
      height: `${h}px`,
      transform: `translate(${x - w / 2}px, ${props.column.frame.floor - h / 2}px)`,
      '--pool': tint === 'done' ? '77, 203, 213' : '90, 218, 240',
    }
  }
  return (
    <>
      <Show
        when={first() === 'next' || first() === 'done' || first() === 'lit'}
      >
        <span
          class={styles.pool}
          style={pool(
            props.placed[0]?.x ?? 0,
            first() === 'next' ? 'next' : 'done',
          )}
          aria-hidden="true"
        />
      </Show>
      <Show when={props.column.merc.at === 'floor'}>
        <span
          class={styles.pool}
          style={pool(
            columnX(mercFeet([], { at: 'floor' }).x, props.column.frame),
            'merc',
          )}
          aria-hidden="true"
        />
      </Show>
    </>
  )
}

function Merc(props: {
  column: PathColumnProps
  places: readonly StopPlace[]
}): JSX.Element {
  const size = (): number => MERC_CANVAS_W * props.column.frame.unit
  const at = (): JSX.CSSProperties => {
    const feet = mercFeet(props.places, props.column.merc)
    const left = columnX(feet.x, props.column.frame) - size() / 2
    const top = columnY(feet.y, props.column.frame) - MERC_FEET * size()
    // On the song, screen 3's size (option B), about his feet.
    const scale =
      props.column.merc.at === 'on' ? ` scale(${MERC_SONG_SCALE})` : ''
    return {
      width: `${size()}px`,
      height: `${size()}px`,
      transform: `translate(${left}px, ${top}px)${scale}`,
      'transform-origin': `50% ${MERC_FEET * 100}%`,
    }
  }
  return (
    <MercView
      state={() => props.column.mercState}
      voice={() => SILENT_VOICE}
      still={() => props.column.still}
      class={
        props.column.mercFaded
          ? `${styles.merc} ${styles.mercFaded}`
          : styles.merc
      }
      style={{
        ...at(),
        // Between hops he does not glide; a crossfade still fades.
        transition: props.column.hopping ? undefined : 'opacity 150ms linear',
      }}
      testId="warm-up-merc"
    />
  )
}

export function PathColumn(props: PathColumnProps): JSX.Element {
  const places = createMemo(() => stopPlaces(props.stops.length, props.mode))
  const placed = createMemo((): Placed[] =>
    props.stops.map((view, i) => {
      const place = places()[i]!
      return {
        view,
        place,
        x: columnX(place.x, props.frame),
        y: columnY(place.y, props.frame),
      }
    }),
  )
  /** The orb each stop shows now: the end lights the finished ones in turn. */
  const shown = createMemo(() => {
    let total = 0
    const order = props.stops.map((stop) =>
      stop.orb === 'lit' && !stop.song ? total++ : -1,
    )
    return props.stops.map((stop, i) => orbShown(props, stop, order[i]!, total))
  })
  const plateHeight = (): number =>
    (props.frame.column * SKY_PX.height) / SKY_PX.width
  const area = (): number => props.frame.column * props.frame.height
  /** The points the rest shows: the end's own come after them. */
  const restPoints = (): number => sparkleCount(area(), 'rest')
  return (
    <div
      class={styles.column}
      style={{
        width: `${props.frame.column}px`,
        height: `${props.frame.height}px`,
      }}
    >
      <div class={styles.skyWindow}>
        <PlateImage
          spec={SKY_PLATE}
          fallback={SKY_FALLBACK}
          class={styles.sky}
          style={{
            top: `${props.frame.floor - SKY_FLOOR * plateHeight()}px`,
            height: `${plateHeight()}px`,
          }}
          testId="warm-up-sky"
          onSettled={() => props.onSkySettled?.()}
        />
      </div>
      <Pools column={props} placed={placed()} />
      <div
        class={styles.sparkles}
        data-grown={props.mode === 'end' && !props.endLit ? 'false' : 'true'}
        aria-hidden="true"
      >
        <For each={sparkles(area(), props.mode)}>
          {(point, i) => (
            <span
              class={styles.spark}
              data-tint={point.tint}
              data-extra={i() >= restPoints() ? 'true' : undefined}
              style={{
                left: `${point.x * 100}%`,
                top: `${point.y * (props.frame.floor / props.frame.height) * 100}%`,
                width: `${point.size}px`,
                height: `${point.size}px`,
                'animation-delay': `${-point.delay}s`,
                // The end's own points grow in one after another.
                'transition-delay':
                  i() >= restPoints()
                    ? `${(i() - restPoints()) * 30}ms`
                    : undefined,
              }}
            />
          )}
        </For>
      </div>
      <Trail column={props} placed={placed()} />
      <ol class={styles.stops} aria-label={PATH_WORDS.stops}>
        <For each={placed()}>
          {(stop, i) => (
            <Stop column={props} stop={stop} orb={shown()[i()] ?? 'waiting'} />
          )}
        </For>
      </ol>
      <Merc column={props} places={places()} />
    </div>
  )
}
