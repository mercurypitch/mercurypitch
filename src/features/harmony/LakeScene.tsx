// ============================================================
// LakeScene — a lake at night, two lines of lamps across it
// ============================================================
//
// Harmony's world. Merc stands on the jetty at the lower left; across the
// water run two lines of lamps, a lamp a note at its pitch's height: his
// line in teal, the harmony a third from it in gold. His lamps light one by
// one as he sings them. The harmony's lamps wait: an outline while he
// calls (shown at Learning and Singer, hidden at Professional until sung),
// a soft glow where he sings them first (Learning), lit gold where the
// voice holds the note, a grey ring where it missed. After a miss, his note
// and the third from it are drawn as he sings the pair.
//
// THE PAINTING. The lake at dusk is painted (docs/plans/ear-rooms.md has
// how): an upright plate and its landscape twin in ./art/, pinned at the
// shore, so the water under the lamps is the layout's on any screen, and
// the jetty painted apart from it, so it moves with Merc to the dock at the
// result. They fold away with the room in a build without it
// (vite.config.ts, PREMIUM_IMAGES). The painting shows once both have
// loaded, and the drawing stays as its stand-in until then: every shape in
// flat colour, drawn from one measurement (lake-layout.ts). The lines, the
// lamps and the trail are drawn over either: they are the exercise. At the
// result the painting steps back behind the numbers, as the drawn moon
// and its light do.
//
// The trail is drawn every frame of the turn, so it is not a signal: the
// room hands its path, head and hold ring to the controller's sink, which
// writes them.

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, Index, onMount, Show } from 'solid-js'
import type { RoomPlates } from '@/components/room-kit/RoomPainting'
import { RoomPainting } from '@/components/room-kit/RoomPainting'
import { midiToNoteNameOctave } from '@/lib/note-utils'
import lakeJetty from './art/lake-jetty.webp'
import lakeLandscape from './art/lake-landscape.webp'
import lakePortrait from './art/lake-portrait.webp'
import type { HarmonyLampState } from './harmony-controller-contract'
import type { LakeLayout } from './lake-layout'
import { jettyBox, NAME_RISE, stepsPath, yOf } from './lake-layout'
import styles from './LakeScene.module.css'

/** The lake's painting: its plates and the jetty. */
export interface LakeArt {
  readonly plates: RoomPlates
  readonly jetty: string
}

/** The painting the room ships with. */
export const LAKE_ART: LakeArt = {
  plates: { portrait: lakePortrait, landscape: lakeLandscape },
  jetty: lakeJetty,
}

/**
 * Both plates' shore, 51% down as the layout's is, and their moon over its
 * light on the water: the crop keeps them in place.
 */
const PLATE_PIN = '61% 51%'

/** Each part of the painting, as a bit: both loaded paints the room. */
const PLATE = 1
const JETTY = 2
const ALL = PLATE | JETTY

export interface LakeSceneProps {
  layout: LakeLayout
  /** Merc's line and the harmony, MIDI: the run's line, or the lake's at rest. */
  merc: readonly number[]
  harmony: readonly number[]
  /** Merc's lamps lit: as he sings each one. */
  mercLit: number
  /** The harmony's lamps, one each; empty at rest. */
  lamps: readonly HarmonyLampState[]
  /** The harmony's lamps show before they are sung (Learning and Singer). */
  showsHarmony: boolean
  /** A line of the run is on the lake: the names show. */
  live: boolean
  /** The singer sings: the harmony's line turns solid, the trail shows. */
  turn: boolean
  /** After a miss, the note whose pair Merc sings; null for none. */
  answering: number | null
  /**
   * The result is up: the lamps leave the lake, and the moon and its light
   * step back behind the numbers (the Harmony mock-ups' result).
   */
  away: boolean
  /** The trail's path, head and hold ring, for the controller's sink. */
  trailRef: (
    path: SVGPathElement,
    head: SVGCircleElement,
    ring: SVGCircleElement,
  ) => void
  /** Nothing moves (reduced motion, the fixtures). */
  still?: boolean
  /** The painting; LAKE_ART by default, null for the drawing alone. */
  art?: LakeArt | null
}

/** A seeded spread of stars over the sky, the same on every visit. */
function stars(
  width: number,
  height: number,
): { x: number; y: number; r: number }[] {
  let seed = 17
  const next = (): number => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  return Array.from({ length: 38 }, () => ({
    x: next() * width,
    y: next() * height * 0.42,
    r: 0.5 + next() * 1.1,
  }))
}

export function LakeScene(props: LakeSceneProps): JSX.Element {
  let trailEl: SVGPathElement | undefined
  let headEl: SVGCircleElement | undefined
  let ringEl: SVGCircleElement | undefined
  onMount(() => {
    if (trailEl !== undefined && headEl !== undefined && ringEl !== undefined) {
      props.trailRef(trailEl, headEl, ringEl)
    }
  })
  const art = (): LakeArt | null =>
    props.art === undefined ? LAKE_ART : props.art
  /** The parts of the painting loaded so far; a part that failed keeps the drawing. */
  const [loaded, setLoaded] = createSignal(0)
  const [failed, setFailed] = createSignal(false)
  const heard =
    (part: number) =>
    (ok: boolean): void => {
      if (ok) setLoaded((bits) => bits | part)
      else setFailed(true)
    }
  /** The painting is the backdrop, and the drawing rests. */
  const painted = (): boolean => art() !== null && !failed() && loaded() === ALL
  const jetty = createMemo(() => jettyBox(props.layout))
  const L = () => props.layout
  const sky = createMemo(() => stars(L().width, L().shore))
  const moon = () => ({
    x: L().width * 0.77,
    y: L().height * 0.18,
    r: Math.min(22, Math.max(12, Math.min(L().width, L().height) * 0.05)),
  })
  /** The far hills along the shore. */
  const hills = () => {
    const { width: w, shore: s } = L()
    const tops = [0, 0.04, 0.11, 0.02, 0.24, 0.06, 0.37, 0.09, 0.5]
    const points = [0, 0.11, 0.24, 0.37, 0.51, 0.65, 0.78, 0.91, 1].map(
      (x, i) =>
        `${(x * w).toFixed(1)} ${(s - 40 * tops[i % tops.length]).toFixed(1)}`,
    )
    return `M${points.join('L')}V${s}H0Z`
  }
  const harmonyState = (i: number): HarmonyLampState =>
    props.lamps[i] ?? 'waiting'
  /** A harmony lamp shows: lit or missed always, waiting where the level shows it. */
  const harmonyShows = (i: number): boolean =>
    props.showsHarmony ||
    harmonyState(i) === 'lit' ||
    harmonyState(i) === 'missed'
  /** After a miss: his note, then up (or down) to the third, drawn as he sings. */
  const pairPath = (): string => {
    const at = props.answering
    if (at === null) return ''
    const x = L().lampX[at]
    const from = yOf(L(), props.merc[at])
    const to = yOf(L(), props.harmony[at])
    return `M${(x - 26).toFixed(1)} ${from.toFixed(1)}H${(x - 4).toFixed(1)}C${(x + 4).toFixed(1)} ${from.toFixed(1)} ${(x + 4).toFixed(1)} ${to.toFixed(1)} ${(x + 12).toFixed(1)} ${to.toFixed(1)}H${(x + 30).toFixed(1)}`
  }

  return (
    <div
      class={styles.scene}
      classList={{
        [styles.live]: props.live,
        [styles.turn]: props.turn,
        [styles.answering]: props.answering !== null,
        [styles.away]: props.away,
        [styles.still]: props.still === true,
        [styles.painted]: painted(),
      }}
      data-testid="harmony-scene"
      data-art={painted() ? 'painting' : 'drawing'}
    >
      <svg
        class={styles.backdrop}
        width={L().width}
        height={L().height}
        viewBox={`0 0 ${L().width} ${L().height}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="harmony-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#050816" />
            <stop offset="0.5" stop-color="#121842" />
            <stop offset="0.86" stop-color="#2a2459" />
            <stop offset="1" stop-color="#3a2b5f" />
          </linearGradient>
          <linearGradient id="harmony-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#1b1f4e" />
            <stop offset="0.35" stop-color="#0d1233" />
            <stop offset="1" stop-color="#060918" />
          </linearGradient>
          <radialGradient id="harmony-moon-glow">
            <stop offset="0" stop-color="#e9e4ff" stop-opacity="0.34" />
            <stop offset="1" stop-color="#e9e4ff" stop-opacity="0" />
          </radialGradient>
          <mask id="harmony-crescent">
            <circle cx={moon().x} cy={moon().y} r={moon().r} fill="#fff" />
            <circle
              cx={moon().x + moon().r * 0.45}
              cy={moon().y - moon().r * 0.3}
              r={moon().r * 0.9}
              fill="#000"
            />
          </mask>
        </defs>
        <rect width={L().width} height={L().shore} fill="url(#harmony-sky)" />
        <For each={sky()}>
          {(star) => (
            <circle cx={star.x} cy={star.y} r={star.r} class={styles.star} />
          )}
        </For>
        <g class={styles.moonlight}>
          <circle
            cx={moon().x}
            cy={moon().y}
            r={moon().r * 3.5}
            fill="url(#harmony-moon-glow)"
          />
          <circle
            cx={moon().x}
            cy={moon().y}
            r={moon().r}
            class={styles.moon}
            mask="url(#harmony-crescent)"
          />
        </g>
        <path d={hills()} class={styles.hills} />
        <rect
          y={L().shore}
          width={L().width}
          height={L().height - L().shore}
          fill="url(#harmony-water)"
        />
        <path d={`M0 ${L().shore}H${L().width}`} class={styles.shoreLine} />
        {/* The moon's light on the water. */}
        <path
          class={`${styles.shimmer} ${styles.moonlight}`}
          d={[16, 32, 50, 68, 86]
            .map(
              (dy, i) =>
                `M${(moon().x - 12 + (i % 2) * 4).toFixed(1)} ${(L().shore + dy).toFixed(1)}h${16 + ((i * 7) % 12)}`,
            )
            .join('')}
        />
      </svg>

      <Show when={art()}>
        {(painting) => (
          <RoomPainting
            plates={painting().plates}
            pin={PLATE_PIN}
            shown={painted()}
            onLoad={heard(PLATE)}
            class={styles.painting}
            testId="harmony-painting"
          />
        )}
      </Show>

      {/* The jetty, moved as Merc is: down to the dock at the result. Painted
          once the painting has loaded, drawn until then. */}
      <svg
        class={styles.jettyLayer}
        width={L().width}
        height={L().height}
        viewBox={`0 0 ${L().width} ${L().height}`}
        aria-hidden="true"
      >
        <g
          class={styles.jetty}
          style={{ transform: `translateY(${L().jetty.top.toFixed(1)}px)` }}
        >
          <g class={styles.drawn}>
            <rect
              x={0}
              y={0}
              width={L().jetty.right}
              height={10}
              rx={2}
              class={styles.deck}
            />
            <rect x={18} y={10} width={8} height={64} class={styles.post} />
            <rect
              x={L().jetty.right - 28}
              y={10}
              width={8}
              height={64}
              class={styles.post}
            />
          </g>
          <Show when={art()}>
            {(painting) => (
              <image
                href={painting().jetty}
                x={jetty().x}
                y={jetty().y}
                width={jetty().width}
                height={jetty().height}
                preserveAspectRatio="none"
                class={styles.paintedJetty}
                onLoad={() => heard(JETTY)(true)}
                onError={() => heard(JETTY)(false)}
                data-testid="harmony-jetty"
              />
            )}
          </Show>
        </g>
      </svg>
      <div class={styles.paintingShade} aria-hidden="true" />

      {/* The exercise: both lines of lamps, the missed pair and the trail. */}
      <svg
        class={styles.overlay}
        width={L().width}
        height={L().height}
        viewBox={`0 0 ${L().width} ${L().height}`}
        aria-hidden="true"
      >
        <path d={stepsPath(L(), props.merc)} class={styles.mercLine} />
        <Show when={props.showsHarmony}>
          <path d={stepsPath(L(), props.harmony)} class={styles.harmonyLine} />
        </Show>
        <Index each={props.merc}>
          {(midi, i) => (
            <circle
              cx={L().lampX[i]}
              cy={yOf(L(), midi())}
              r={8}
              class={styles.mercLamp}
              data-lit={i < props.mercLit ? 'true' : 'false'}
              data-midi={midi()}
              data-testid="harmony-merc-lamp"
            />
          )}
        </Index>
        <Index each={props.harmony}>
          {(midi, i) => (
            <circle
              cx={L().lampX[i]}
              cy={yOf(L(), midi())}
              r={8}
              class={styles.harmonyLamp}
              data-state={harmonyState(i)}
              data-shown={harmonyShows(i) ? 'true' : 'false'}
              data-midi={midi()}
              data-testid="harmony-lamp"
            />
          )}
        </Index>
        <Show when={props.live && props.merc.length > 0}>
          <text
            x={L().lampX[0] - 10}
            y={yOf(L(), props.merc[0]) + 24}
            class={styles.mercName}
            data-testid="harmony-merc-name"
          >
            {midiToNoteNameOctave(props.merc[0])}
          </text>
          <Show when={props.showsHarmony}>
            <text
              x={L().lampX[0] - 10}
              y={yOf(L(), props.harmony[0]) - NAME_RISE}
              class={styles.harmonyName}
              data-testid="harmony-name"
            >
              {midiToNoteNameOctave(props.harmony[0])}
            </text>
          </Show>
        </Show>
        <path d={pairPath()} class={styles.pair} data-testid="harmony-pair" />
        <path ref={trailEl} class={styles.trail} d="" />
        <circle
          ref={ringEl}
          class={styles.ring}
          r={13}
          cx={-40}
          cy={-40}
          pathLength={100}
        />
        <circle ref={headEl} class={styles.head} r={6} cx={-20} cy={-20} />
      </svg>
    </div>
  )
}
