// ============================================================
// Lantern — the storm lantern that fills with light
// ============================================================
//
// A painted lantern in two layers, one view box (lantern-geometry.ts). The
// room puts Merc's canvas between the layers, so he reads as inside the glass.
//
// The paint comes from two paintings of the same lantern, one empty and one
// full of light (Codex imagegen after the storyboard, 01-long-note.png). They
// are cut along the inside of the glass into five plates:
//
//   frame       the empty painting outside the glass's inside: handle, cap,
//               frame, base and the glass walls
//   frame-lit   the same from the full painting, lit by the liquid
//   glass       the empty painting inside the glass: its streaks and the
//               rings at the bottom of the bowl
//   liquid      the full painting inside the glass: the light itself
//   stars       the liquid's stars alone, kept bright over the deep blue a
//               half-full glass has
//
//   back   the halo, the liquid plate below the surface, the surface's
//          violet band, and the light the liquid throws up the empty glass
//   front  the veil over Merc's feet and the surface's front lip, the glass
//          plate above the surface, the frame plate with the lit frame fading
//          in over it from below, the full lantern's sparkles and dust
//
// The room draws the target line and the voice (VoiceTrace.tsx): in the glass
// behind Merc, over the frame in front.
//
// The plates never repaint while the light rises: each one sits in a window
// that slides with the surface while the plate inside slides back the same
// distance (two transforms), so only the cut moves.

import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import styles from './Lantern.module.css'
import frameUrl from './lantern-frame.webp'
import frameLitUrl from './lantern-frame-lit.webp'
import { CHIMNEY_BOTTOM, CHIMNEY_PATH, CHIMNEY_TOP, chimneyHalfWidth, LANTERN_VIEW_H, LANTERN_VIEW_W, surfaceY, } from './lantern-geometry'
import glassUrl from './lantern-glass.webp'
import liquidUrl from './lantern-liquid.webp'
import starsUrl from './lantern-stars.webp'

export interface LanternProps {
  /** How full the liquid is, 0 to 1. */
  level: () => number
  /** How brightly it glows, 0 to 1: high while the note is on target. */
  glow: () => number
  /**
   * How much it shines, 0 to 1: the halo at that strength (half of it at
   * the goal), and at 1, the brim, the sparkles and dust as well.
   */
  shine: () => number
  /** Reduced motion: the brim's sparkles and dust stay away. */
  still?: () => boolean
}

const VIEW_BOX = `0 0 ${LANTERN_VIEW_W} ${LANTERN_VIEW_H}`

/** A plate and its box in view-box units, as measured when it was cut. */
interface Plate {
  src: string
  x: number
  y: number
  w: number
  h: number
}

const FRAME: Plate = {
  src: frameUrl,
  x: 19.945,
  y: 2.624,
  w: 160.109,
  h: 368.502,
}
const FRAME_LIT: Plate = {
  src: frameLitUrl,
  x: 19.695,
  y: 2.874,
  w: 160.61,
  h: 368.252,
}
const GLASS: Plate = {
  src: glassUrl,
  x: 40.96,
  y: 115.201,
  w: 118.081,
  h: 197.385,
}
const LIQUID: Plate = {
  src: liquidUrl,
  x: 40.96,
  y: 115.201,
  w: 118.081,
  h: 197.385,
}
const STARS: Plate = {
  src: starsUrl,
  x: 49.465,
  y: 115.451,
  w: 101.069,
  h: 182.625,
}

/**
 * How far above the surface its light reaches up the frame, in view units:
 * the storyboard lights the whole frame from a half-full glass.
 */
const LIGHT_REACH = 150

/**
 * How far the liquid's light rises in the empty glass above it, in view
 * units: storyboard 2 lights the glass well above a half-full surface.
 */
const ABOVE_REACH = 110

// The sparkles round the full lantern, in view-box units: place, size (1 is
// a star 14 units across in a glow of 20), when each twinkles and its glow,
// blue-violet or, for three of them, azure. Storyboard 3's, measured off the
// painting and mirrored, since Merc lands on the other side here.
const SPARKLES = [
  { x: 6, y: 65, s: 1, d: 0, azure: false },
  { x: -12, y: 156, s: 1, d: 1.1, azure: false },
  { x: 194, y: 107, s: 1, d: 0.5, azure: false },
  { x: 166, y: 33, s: 0.9, d: 1.6, azure: true },
  { x: 205, y: 146, s: 0.9, d: 0.8, azure: true },
  { x: 3, y: 130, s: 0.75, d: 2, azure: true },
  { x: 190, y: 170, s: 0.65, d: 0.3, azure: false },
  { x: -1, y: 206, s: 0.4, d: 1.3, azure: false },
  { x: 17, y: 96, s: 0.4, d: 0.9, azure: false },
  { x: 180, y: 133, s: 0.4, d: 1.8, azure: false },
  { x: 20, y: 152, s: 0.4, d: 0.2, azure: false },
  { x: 8, y: 174, s: 0.35, d: 1.5, azure: false },
  { x: 34, y: 58, s: 0.3, d: 0.6, azure: false },
  { x: 14, y: 120, s: 0.25, d: 2.2, azure: false },
]

/**
 * A sparkle's spikes in a 24-unit box: two thin lenses through the core, the
 * upright one reaching 1.6 times as far as the box's edge and the side one
 * 1.25 times, as storyboard 3's do. The core itself is the bloom's.
 */
const STAR = 'M0 -19 Q2.4 0 0 19 Q-2.4 0 0 -19 Z M-15 0 Q0 2 15 0 Q0 -2 -15 0 Z'

// Storyboard 3's fine dust between the sparkles, found the same way: dots of
// one or two units, most of them blue, two of them white.
const DUST = [
  { x: 32, y: 23, s: 1, d: 0.4, white: false },
  { x: 28, y: 47, s: 0.7, d: 1.9, white: false },
  { x: 181, y: 60, s: 1, d: 1.2, white: false },
  { x: 169, y: 64, s: 0.8, d: 0.1, white: false },
  { x: 195, y: 68, s: 1, d: 2.1, white: false },
  { x: 29, y: 74, s: 1.2, d: 0.7, white: true },
  { x: 174, y: 77, s: 1.2, d: 1.6, white: true },
  { x: 174, y: 96, s: 0.7, d: 0.9, white: false },
  { x: -8, y: 104, s: 1, d: 1.4, white: false },
  { x: 173, y: 106, s: 0.7, d: 2.3, white: false },
  { x: 183, y: 153, s: 0.7, d: 0.5, white: false },
  { x: 6, y: 190, s: 0.9, d: 1.7, white: false },
]

const pct = (part: number, whole: number): string => `${(part / whole) * 100}%`

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** The deep blue (and the stars over it) give way to the painting as it fills. */
const depthShown = (level: number): number => 1 - smoothstep(0.7, 1, level)

/**
 * The haze round the glass: there from the first light (storyboard 2 has it
 * half full), stronger as it fills.
 */
const haloShown = (level: number): number =>
  smoothstep(0, 0.05, level) * (0.7 + 0.3 * level)

/** The surface's band and lip fade at the very bottom and under the cap. */
const surfaceShown = (level: number): number =>
  smoothstep(0, 0.03, level) * (1 - smoothstep(0.93, 1, level))

function PlateImage(props: { plate: Plate }): JSX.Element {
  return (
    <img
      class={styles.plate}
      src={props.plate.src}
      alt=""
      draggable={false}
      style={{
        left: pct(props.plate.x, LANTERN_VIEW_W),
        top: pct(props.plate.y, LANTERN_VIEW_H),
        width: pct(props.plate.w, LANTERN_VIEW_W),
        height: pct(props.plate.h, LANTERN_VIEW_H),
      }}
    />
  )
}

/**
 * A plate seen through a window whose one edge is at `edge` (view units):
 * everything below it (`keep: 'below'`) or above it. The window slides with
 * the edge and the plate inside slides back by as much, so the plate stays
 * where it is and nothing repaints.
 */
function SurfaceWindow(props: {
  edge: () => number
  keep: 'below' | 'above'
  class?: string
  opacity?: () => number
  children: JSX.Element
}): JSX.Element {
  const shift = (): number => {
    const at = (props.edge() / LANTERN_VIEW_H) * 100
    return props.keep === 'below' ? at : at - 100
  }
  return (
    <div
      class={
        props.class === undefined
          ? styles.window
          : `${styles.window} ${props.class}`
      }
      style={{
        transform: `translateY(${shift()}%)`,
        opacity: props.opacity === undefined ? undefined : props.opacity(),
      }}
    >
      <div
        class={styles.windowInner}
        style={{ transform: `translateY(${-shift()}%)` }}
      >
        {props.children}
      </div>
    </div>
  )
}

let nextId = 0

/** The layer behind Merc: halo, liquid, the surface's band. */
export function LanternBack(props: LanternProps): JSX.Element {
  const id = `lantern-back-${nextId++}`
  const top = (): number => surfaceY(props.level())
  const rx = (): number => chimneyHalfWidth(top())
  /** How lit the lantern is: the glow, or its shine when that is more. */
  const brightness = (): number => Math.max(props.glow(), props.shine())
  return (
    <div class={styles.layer} data-testid="lantern-back">
      <div
        class={styles.floor}
        style={{ opacity: 0.75 + 0.25 * props.level() * brightness() }}
      />
      <div
        class={styles.haloSoft}
        style={{ opacity: haloShown(props.level()) * brightness() }}
      />
      <div
        class={styles.halo}
        data-testid="lantern-halo"
        style={{ opacity: props.shine() }}
      />
      <SurfaceWindow
        edge={top}
        keep="below"
        opacity={() => 0.8 + 0.2 * brightness()}
      >
        <PlateImage plate={LIQUID} />
      </SurfaceWindow>
      <svg class={styles.layer} viewBox={VIEW_BOX} aria-hidden="true">
        <defs>
          <clipPath id={`${id}-chimney`}>
            <path d={CHIMNEY_PATH} />
          </clipPath>
          {/* The liquid's depth: below a surface partway up, the storyboard's
              light is a deep blue, violet just under the surface and teal
              in the bowl (screen 2). Laid over the painted light on the
              liquid's own box, so it holds at any height, and gone once the
              lantern is full (screen 3 is the painting as it is). The middle
              stops carry no red, which would turn the deep blue milky. */}
          <linearGradient id={`${id}-depth`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="rgb(64, 44, 206)" stop-opacity="0.8" />
            <stop
              offset="0.37"
              stop-color="rgb(0, 68, 197)"
              stop-opacity="0.8"
            />
            <stop
              offset="0.51"
              stop-color="rgb(0, 72, 176)"
              stop-opacity="0.58"
            />
            <stop
              offset="0.65"
              stop-color="rgb(0, 100, 180)"
              stop-opacity="0.54"
            />
            <stop
              offset="0.79"
              stop-color="rgb(11, 179, 219)"
              stop-opacity="0.62"
            />
            <stop
              offset="0.9"
              stop-color="rgb(70, 236, 238)"
              stop-opacity="0.72"
            />
            <stop
              offset="1"
              stop-color="rgb(140, 250, 244)"
              stop-opacity="0.9"
            />
          </linearGradient>
          {/* Light gathered at the glass walls, half way down: storyboard 2
              is lighter by the walls than in the middle there. */}
          <radialGradient id={`${id}-wall-l`} cx="0.1" cy="0.55" r="0.6">
            <stop
              offset="0"
              stop-color="rgb(150, 230, 255)"
              stop-opacity="0.55"
            />
            <stop
              offset="0.5"
              stop-color="rgb(150, 230, 255)"
              stop-opacity="0.28"
            />
            <stop offset="1" stop-color="rgb(150, 230, 255)" stop-opacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-wall-r`} cx="0.9" cy="0.55" r="0.6">
            <stop
              offset="0"
              stop-color="rgb(150, 230, 255)"
              stop-opacity="0.55"
            />
            <stop
              offset="0.5"
              stop-color="rgb(150, 230, 255)"
              stop-opacity="0.28"
            />
            <stop offset="1" stop-color="rgb(150, 230, 255)" stop-opacity="0" />
          </radialGradient>
          {/* The light it throws up the empty glass above it. */}
          <linearGradient id={`${id}-above`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#a68cff" stop-opacity="0.75" />
            <stop offset="1" stop-color="#7f9cff" stop-opacity="0" />
          </linearGradient>
          {/* The surface, seen a little from above. */}
          <radialGradient id={`${id}-face`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#efe8ff" stop-opacity="0.5" />
            <stop offset="0.75" stop-color="#c3a8ff" stop-opacity="0.42" />
            <stop offset="1" stop-color="#dcccff" stop-opacity="0.8" />
          </radialGradient>
        </defs>
        <g
          clip-path={`url(#${id}-chimney)`}
          opacity={surfaceShown(props.level()) * (0.7 + 0.3 * brightness())}
        >
          <rect
            x="40"
            y={top() - ABOVE_REACH}
            width="120"
            height={ABOVE_REACH}
            fill={`url(#${id}-above)`}
          />
          <rect
            x="40"
            y={top()}
            width="120"
            height={Math.max(1, CHIMNEY_BOTTOM - top())}
            fill={`url(#${id}-depth)`}
            opacity={depthShown(props.level())}
          />
          <For each={['l', 'r'] as const}>
            {(side) => (
              <rect
                x={side === 'l' ? 40 : 100}
                y={top()}
                width="60"
                height={Math.max(1, CHIMNEY_BOTTOM - top())}
                fill={`url(#${id}-wall-${side})`}
                opacity={depthShown(props.level())}
              />
            )}
          </For>
          <ellipse
            cx="100"
            cy={top()}
            rx={rx()}
            ry={surfaceTilt(top()) * rx()}
            fill={`url(#${id}-face)`}
          />
        </g>
      </svg>
      {/* The liquid's stars, over the deep blue while it lasts. */}
      <SurfaceWindow
        edge={top}
        keep="below"
        opacity={() => depthShown(props.level())}
      >
        <PlateImage plate={STARS} />
      </SurfaceWindow>
    </div>
  )
}

/**
 * How round the surface looks: the eye is a little above the lantern, so a
 * surface low in the glass is seen more from above than one high up.
 */
function surfaceTilt(y: number): number {
  const down = (y - CHIMNEY_TOP) / (CHIMNEY_BOTTOM - CHIMNEY_TOP)
  return 0.07 + 0.07 * Math.min(1, Math.max(0, down))
}

/** The layer in front of Merc: veil, glass, frame, sparkles and dust. */
export function LanternFront(props: LanternProps): JSX.Element {
  const id = `lantern-front-${nextId++}`
  const top = (): number => surfaceY(props.level())
  /** How lit the lantern is: the glow, or its shine when that is more. */
  const brightness = (): number => Math.max(props.glow(), props.shine())
  const rx = (): number => chimneyHalfWidth(top())
  const ry = (): number => surfaceTilt(top()) * rx()
  // The lit frame shows from LIGHT_REACH above the surface down; once the
  // lantern is nearly full the light reaches all of it.
  const lightEdge = (): number =>
    top() - LIGHT_REACH - 120 * smoothstep(0.85, 1, props.level())
  const lit = (): number =>
    smoothstep(0, 0.1, props.level()) * (0.45 + 0.55 * brightness())
  return (
    <div class={styles.layer} data-testid="lantern-front">
      <svg class={styles.layer} viewBox={VIEW_BOX} aria-hidden="true">
        <defs>
          <clipPath id={`${id}-chimney`}>
            <path d={CHIMNEY_PATH} />
          </clipPath>
          <linearGradient id={`${id}-veil`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#a98cff" stop-opacity="0.5" />
            <stop offset="1" stop-color="#5f8cff" stop-opacity="0" />
          </linearGradient>
          {/* A sparkle's spikes, white at the core and fading to their tips
              (on each star's own box, so it reaches every tip). */}
          <radialGradient id={`${id}-spike`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#ffffff" stop-opacity="1" />
            <stop offset="0.3" stop-color="#eee8ff" stop-opacity="0.9" />
            <stop offset="0.65" stop-color="#c4b6ff" stop-opacity="0.45" />
            <stop offset="1" stop-color="#a898ff" stop-opacity="0" />
          </radialGradient>
        </defs>
        <g
          clip-path={`url(#${id}-chimney)`}
          opacity={surfaceShown(props.level())}
        >
          {/* The liquid in front of Merc's feet: he floats IN it. */}
          <rect
            x="40"
            y={top() + 1}
            width="120"
            height="20"
            fill={`url(#${id}-veil)`}
          />
          {/* The surface's front lip, a soft glow under a bright edge. */}
          <path
            d={`M${100 - rx()} ${top()} A${rx()} ${ry()} 0 0 0 ${100 + rx()} ${top()}`}
            fill="none"
            stroke="#c9b2ff"
            stroke-opacity="0.45"
            stroke-width="4"
            vector-effect="non-scaling-stroke"
          />
          <path
            d={`M${100 - rx()} ${top()} A${rx()} ${ry()} 0 0 0 ${100 + rx()} ${top()}`}
            fill="none"
            stroke="#f6f0ff"
            stroke-opacity="0.9"
            stroke-width="1.3"
            vector-effect="non-scaling-stroke"
          />
        </g>
      </svg>

      <SurfaceWindow edge={top} keep="above">
        <PlateImage plate={GLASS} />
      </SurfaceWindow>

      <PlateImage plate={FRAME} />

      <SurfaceWindow
        edge={lightEdge}
        keep="below"
        class={styles.litWindow}
        opacity={lit}
      >
        <PlateImage plate={FRAME_LIT} />
      </SurfaceWindow>

      <Show when={props.shine() >= 1 && props.still?.() !== true}>
        <For each={SPARKLES}>
          {(spark) => (
            <span
              class={styles.sparkle}
              data-glow={spark.azure ? 'azure' : 'violet'}
              style={{
                left: pct(spark.x, LANTERN_VIEW_W),
                top: pct(spark.y, LANTERN_VIEW_H),
                '--spark': spark.s,
                '--delay': `${spark.d}s`,
              }}
            >
              <svg viewBox="-12 -12 24 24" aria-hidden="true">
                <path d={STAR} fill={`url(#${id}-spike)`} />
              </svg>
            </span>
          )}
        </For>
        <For each={DUST}>
          {(mote) => (
            <span
              class={styles.dust}
              data-white={mote.white ? '' : undefined}
              style={{
                left: pct(mote.x, LANTERN_VIEW_W),
                top: pct(mote.y, LANTERN_VIEW_H),
                '--dust': mote.s,
                'animation-delay': `${mote.d}s`,
              }}
            />
          )}
        </For>
      </Show>
    </div>
  )
}
