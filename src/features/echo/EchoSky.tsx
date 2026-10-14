// ============================================================
// EchoSky: the night sky over the rooftops, and what the singer lights in it
// ============================================================
//
// Layers, bottom to top (ART-FIDELITY.md 3.2):
//
//   the sky's own colour      above the plate, on a room taller than it
//   the world plate           painted, opaque, decoded before it shows
//   the result plate          the same world with the town lit, at the result
//   clouds                    the take's painted layer, in the plate's box
//                             (EchoClouds.tsx)
//   city light                the town's light per state, small layers in
//                             the plate's box (EchoCityLight.tsx)
//   the top light             the glow from the top of the screen
//   twinkles                  a few painted stars that breathe
//   rings and lines           SVG gradients: a soft core in its glow
//   the ribbon                the voice (the room passes its canvas in)
//   halos and stars           painted sprites, each over its own halo
//   the celebration star      at the result
//   Merc and anything else    the room's children
//
// Everything is placed from the layout (sky-layout.ts) and the scene
// (sky-scene.ts). Images move only by transform and opacity; the SVG is
// still between scenes.

import type { JSX } from 'solid-js'
import { createMemo, For, Show } from 'solid-js'
import { PlateImage } from '@/components/room-kit/PlateImage'
import { CelebrationStar } from './CelebrationStar'
import type { CityLightState } from './echo-art'
import { RESULT_PLATE, STAR_ART, WORLD_PLATE } from './echo-art'
import type { StrokeStyle } from './echo-geometry'
import { RESULT_FALLBACK, SKY_TOP_RGB, SPRITES, STROKES, TOP_LIGHT, TWINKLES, WORLD_FALLBACK, } from './echo-geometry'
import { EchoCityLight } from './EchoCityLight'
import type { CloudState } from './EchoClouds'
import { EchoClouds } from './EchoClouds'
import styles from './EchoSky.module.css'
import type { SkyLayout } from './sky-layout'
import { inSky, onPlate } from './sky-layout'
import type { LineStyle, RingStyle, SceneLine, SceneRing, SceneStar, SkyScene, } from './sky-scene'
import { lineGradient, ringGradient } from './sky-strokes'

const RING_STYLE: Record<RingStyle, StrokeStyle> = {
  waiting: STROKES.ringWaiting,
  active: STROKES.ringActive,
  missed: STROKES.ringMissed,
}

const LINE_STYLE: Record<LineStyle, StrokeStyle> = {
  phrase: STROKES.linePhrase,
  finished: STROKES.lineFinished,
  result: STROKES.lineResult,
}

/** The sky's colour above the plate's top row. */
export const SKY_TOP = `rgb(${SKY_TOP_RGB.join(', ')})`

/** How far the top light's Gaussian is drawn, in sigmas. */
const TOP_LIGHT_SIGMAS = 4

/**
 * The top light's CSS gradient: a Gaussian to TOP_LIGHT_SIGMAS, in stops,
 * its tail taken off so the last stop is clear. A CSS gradient paints its
 * last stop's colour on past its ending shape: a Gaussian cut at three
 * sigma (1.1 %) tinted the whole room blue.
 */
export function topLight(unit: number, left: number, width: number): string {
  const { rgb, alpha, centreYW, sigmaXW, sigmaYW } = TOP_LIGHT
  const tail = Math.exp(-0.5 * TOP_LIGHT_SIGMAS ** 2)
  const stops: string[] = []
  for (let i = 0; i <= 16; i++) {
    const rho = i / 16
    const g = Math.exp(-0.5 * (rho * TOP_LIGHT_SIGMAS) ** 2)
    const a = (alpha * (g - tail)) / (1 - tail)
    stops.push(
      `rgba(${rgb.join(', ')}, ${a.toFixed(4)}) ${(rho * 100).toFixed(1)}%`,
    )
  }
  const rx = TOP_LIGHT_SIGMAS * sigmaXW * unit
  const ry = TOP_LIGHT_SIGMAS * sigmaYW * unit
  const cx = left + width / 2
  return `radial-gradient(${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${cx.toFixed(1)}px ${(centreYW * unit).toFixed(1)}px, ${stops.join(', ')})`
}

export interface EchoSkyProps {
  layout: SkyLayout
  scene: SkyScene
  /** A fixture: no breathing, no pops, nothing moves. */
  still: boolean
  /** The world plate is on screen (or failed, and its fallback is). */
  onPlateSettled?: (state: 'ready' | 'failed') => void
  /** The take's cloud layer, over the plates and under everything drawn. */
  clouds?: CloudState
  /** The state whose city light is up, over the clouds; null at the result. */
  cityLight?: CityLightState | null
  /** The voice's canvas, drawn between the rings and the stars. */
  ribbon?: JSX.Element
  children?: JSX.Element
}

export function EchoSky(props: EchoSkyProps): JSX.Element {
  const k = (): number =>
    props.scene.result ? props.layout.kResult : props.layout.k
  const unit = (): number => props.layout.unit
  const place = (u: number, v: number) => inSky(props.layout, { u, v }, k())

  const plateBox = (): JSX.CSSProperties => {
    const { plate } = props.layout
    return {
      left: `${plate.left}px`,
      top: `${plate.top}px`,
      width: `${plate.width}px`,
      height: `${plate.height}px`,
    }
  }
  const narrow = (): boolean => props.layout.column.width < props.layout.width

  return (
    <div
      class={styles.sky}
      style={{ background: SKY_TOP }}
      data-testid="echo-sky"
      data-k={k().toFixed(3)}
      aria-hidden="true"
    >
      <Show when={narrow()}>
        <div
          class={styles.sides}
          style={{
            top: `${props.layout.plate.top}px`,
            height: `${props.layout.plate.height}px`,
            background: props.scene.result ? RESULT_FALLBACK : WORLD_FALLBACK,
          }}
        />
      </Show>
      <PlateImage
        spec={WORLD_PLATE}
        fallback={WORLD_FALLBACK}
        class={narrow() ? `${styles.plate} ${styles.feathered}` : styles.plate}
        style={plateBox()}
        testId="echo-plate"
        onSettled={(state) => props.onPlateSettled?.(state)}
      />
      <Show when={props.scene.result}>
        <PlateImage
          spec={RESULT_PLATE}
          fallback={RESULT_FALLBACK}
          class={[
            styles.plate,
            props.still ? '' : styles.resultPlate,
            narrow() ? styles.feathered : '',
          ].join(' ')}
          style={plateBox()}
          testId="echo-result-plate"
        />
      </Show>
      <Show when={props.clouds}>
        {(clouds) => (
          <EchoClouds
            state={clouds()}
            box={plateBox()}
            class={
              narrow() ? `${styles.plate} ${styles.feathered}` : styles.plate
            }
            still={props.still}
          />
        )}
      </Show>
      <Show when={props.cityLight !== undefined}>
        <EchoCityLight
          state={props.cityLight ?? null}
          plate={props.layout.plate}
          still={props.still}
        />
      </Show>
      <div
        class={styles.topLight}
        style={{
          background: topLight(
            unit(),
            props.layout.column.left,
            props.layout.column.width,
          ),
        }}
      />
      <Show when={!props.still}>
        <For each={TWINKLES}>
          {(twinkle, i) => {
            const at = () => onPlate(props.layout, twinkle)
            return (
              <span
                class={styles.twinkle}
                style={{
                  transform: `translate(${at().x.toFixed(1)}px, ${at().y.toFixed(1)}px)`,
                  'animation-delay': `${(i() * 0.73) % 3}s`,
                  'animation-duration': `${2.6 + (i() % 4) * 0.45}s`,
                  '--twinkle-peak': String(
                    Math.min(0.55, (twinkle.peakL - 80) / 36),
                  ),
                }}
              />
            )
          }}
        </For>
      </Show>
      <SkyStrokes
        width={props.layout.width}
        height={props.layout.height}
        unit={unit() * k()}
        rings={props.scene.rings}
        lines={props.scene.lines}
        still={props.still}
        place={place}
      />
      {props.ribbon}
      <div class={styles.stars}>
        <For each={props.scene.stars}>
          {(star) => (
            <SkyStar
              star={star}
              unit={unit() * k()}
              at={place(star.u, star.v)}
              still={props.still}
            />
          )}
        </For>
      </div>
      <Show when={props.scene.celebration}>
        <CelebrationStar layout={props.layout} still={props.still} />
      </Show>
      {props.children}
    </div>
  )
}

interface SkyStarProps {
  star: SceneStar
  /** px per W, at the content's scale. */
  unit: number
  at: { x: number; y: number }
  still: boolean
}

/** One star: its halo, its base sprite and its tint over it. */
function SkyStar(props: SkyStarProps): JSX.Element {
  const sprite = () => SPRITES[props.star.size]
  /** px per sprite px: the star's tip width over the sprite's. */
  const scale = () => (props.star.widthW * props.unit) / sprite().tip
  const box = (canvas: number): JSX.CSSProperties => {
    const size = canvas * scale()
    return {
      width: `${size.toFixed(2)}px`,
      height: `${size.toFixed(2)}px`,
      transform: `translate(${(props.at.x - size / 2).toFixed(2)}px, ${(props.at.y - size / 2).toFixed(2)}px)`,
    }
  }
  const art = () => STAR_ART[props.star.size]
  return (
    <div
      class={styles.star}
      classList={{ [styles.pop]: props.star.pop === true && !props.still }}
      data-testid="echo-star"
      data-size={props.star.size}
      style={{
        'transform-origin': `${props.at.x.toFixed(1)}px ${props.at.y.toFixed(1)}px`,
      }}
    >
      <img
        class={styles.sprite}
        src={art().halo}
        alt=""
        style={box(sprite().halo)}
      />
      <Show
        when={props.star.mix < 1 || props.star.tint === 'base'}
        fallback={
          <img
            class={styles.sprite}
            src={art().tints[props.star.tint]}
            alt=""
            style={box(sprite().canvas)}
          />
        }
      >
        <img
          class={styles.sprite}
          src={art().tints.base}
          alt=""
          style={box(sprite().canvas)}
        />
        <Show when={props.star.tint !== 'base' && props.star.mix > 0}>
          <img
            class={styles.sprite}
            src={art().tints[props.star.tint]}
            alt=""
            style={{ ...box(sprite().canvas), opacity: props.star.mix }}
          />
        </Show>
      </Show>
    </div>
  )
}

interface SkyStrokesProps {
  width: number
  height: number
  /** px per W, at the content's scale. */
  unit: number
  rings: readonly SceneRing[]
  lines: readonly SceneLine[]
  still: boolean
  place: (u: number, v: number) => { x: number; y: number }
}

/** The rings and lines, one SVG; each style's gradient made once. */
function SkyStrokes(props: SkyStrokesProps): JSX.Element {
  const ringStyles = createMemo(() => {
    const seen = new Map<
      string,
      ReturnType<typeof ringGradient> & { id: string }
    >()
    for (const ring of props.rings) {
      const radius = ring.rW * props.unit
      const id = `echo-ring-${ring.style}-${Math.round(radius * 10)}`
      if (!seen.has(id)) {
        seen.set(id, {
          id,
          ...ringGradient(RING_STYLE[ring.style], radius, props.unit),
        })
      }
    }
    return seen
  })
  const lineStyles = createMemo(() => {
    const seen = new Map<
      LineStyle,
      ReturnType<typeof lineGradient> & { id: string }
    >()
    for (const line of props.lines) {
      if (!seen.has(line.style)) {
        seen.set(line.style, {
          id: `echo-line-${line.style}`,
          ...lineGradient(LINE_STYLE[line.style], props.unit),
        })
      }
    }
    return seen
  })
  const ringId = (ring: SceneRing): string =>
    `echo-ring-${ring.style}-${Math.round(ring.rW * props.unit * 10)}`

  return (
    <svg
      class={styles.strokes}
      width={props.width}
      height={props.height}
      viewBox={`0 0 ${props.width} ${props.height}`}
    >
      <defs>
        <For each={[...ringStyles().values()]}>
          {(style) => (
            <radialGradient id={style.id}>
              <For each={style.stops}>
                {(stop) => (
                  <stop offset={stop.offset} stop-color={stop.colour} />
                )}
              </For>
            </radialGradient>
          )}
        </For>
        <For each={[...lineStyles().values()]}>
          {(style) => (
            <linearGradient id={style.id} x1="0" y1="0" x2="0" y2="1">
              <For each={style.stops}>
                {(stop) => (
                  <stop offset={stop.offset} stop-color={stop.colour} />
                )}
              </For>
            </linearGradient>
          )}
        </For>
      </defs>
      <For each={props.lines}>
        {(line) => {
          const style = () => lineStyles().get(line.style)
          const a = () => props.place(line.a[0], line.a[1])
          const b = () => props.place(line.b[0], line.b[1])
          const length = () => Math.hypot(b().x - a().x, b().y - a().y)
          const angle = () =>
            (Math.atan2(b().y - a().y, b().x - a().x) * 180) / Math.PI
          return (
            <Show when={style()}>
              {(s) => (
                <g data-testid="echo-line" data-style={line.style}>
                  <rect
                    x="0"
                    y={-s().half}
                    width={length()}
                    height={2 * s().half}
                    fill={`url(#${s().id})`}
                    transform={`translate(${a().x} ${a().y}) rotate(${angle()})`}
                  />
                </g>
              )}
            </Show>
          )
        }}
      </For>
      <For each={props.rings}>
        {(ring) => {
          const style = () => ringStyles().get(ringId(ring))
          const at = () => props.place(ring.u, ring.v)
          return (
            <Show when={style()}>
              {(s) => (
                <g
                  class={styles.ring}
                  classList={{
                    [styles.appear]:
                      ring.appearMs !== undefined && !props.still,
                  }}
                  style={{
                    'transform-origin': `${at().x}px ${at().y}px`,
                    'animation-delay': `${ring.appearMs ?? 0}ms`,
                  }}
                  data-testid="echo-ring"
                  data-style={ring.style}
                  data-radius={(ring.rW * props.unit).toFixed(1)}
                >
                  <circle
                    cx={at().x}
                    cy={at().y}
                    r={s().outer}
                    fill={`url(#${s().id})`}
                  />
                </g>
              )}
            </Show>
          )
        }}
      </For>
    </svg>
  )
}
