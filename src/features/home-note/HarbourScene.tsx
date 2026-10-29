// ============================================================
// HarbourScene — the night harbour, its lighthouse and home's beam
// ============================================================
//
// Home note's world. The lighthouse stands on the rocks at the right, and
// its beam crosses the sea at home's height: that line is the note the
// band calls home. While the band plays, the lamp pulses on each chord.
// In the singer's turn the beam brightens and the voice draws a trail of
// light over the water, up for higher, down for lower (voice-trail.ts);
// the band of light around the beam is the level's tolerance, so a voice
// inside it is a voice the engine will land. A landed round lights the
// lamp.
//
// THE PAINTING. The harbour at dusk is painted (docs/plans/ear-rooms.md has
// how): an upright plate and its landscape twin in ./art/, which fold away
// with the room in a build without it (vite.config.ts, PREMIUM_IMAGES). It
// shows once it has loaded, and the drawing below stays as its stand-in
// until then. Either way the beam, the band of light, the trail and the lamp are drawn over
// it: they are the exercise. The painting is pinned at the lamp, which the
// plate puts at the layout's own place (84% across, 44% down), so however
// a screen crops it, its lighthouse stands under the drawn lamp.
//
// The drawing: every shape a stand-in, drawn from the layout in flat
// colour, as Ng slides' plates were before their paintings. Placed from one
// measurement (harbour-layout.ts).
//
// The trail is drawn every frame of the turn, so it is not a signal: the
// room hands its path and head to the controller's sink, which writes
// them directly.

import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, onMount, Show } from 'solid-js'
import harbourLandscape from './art/harbour-landscape.webp'
import harbourPortrait from './art/harbour-portrait.webp'
import type { HarbourLayout } from './harbour-layout'
import { LANDSCAPE_PLATE_MEDIA } from './harbour-layout'
import styles from './HarbourScene.module.css'

/** The harbour's painting, upright and on its side. */
export interface HarbourArt {
  readonly portrait: string
  readonly landscape: string
}

/** The painting the room ships with. */
export const HARBOUR_ART: HarbourArt = {
  portrait: harbourPortrait,
  landscape: harbourLandscape,
}

export interface HarbourSceneProps {
  layout: HarbourLayout
  /** The tolerance band's half-height, px. */
  bandHalf: number
  /** The band's chord count in this intro: the lamp pulses on each. */
  beat: number
  /** The singer's turn: the beam brightens and the trail shows. */
  turn: boolean
  /** The voice is in home's band, or a round has landed: the lamp is lit. */
  lit: boolean
  /** The trail's path and head, for the controller's sink to write. */
  trailRef: (path: SVGPathElement, head: SVGCircleElement) => void
  /** Nothing moves (reduced motion, the fixtures). */
  still?: boolean
  /** The painting; HARBOUR_ART by default, null for the drawing alone. */
  art?: HarbourArt | null
}

/** A seeded spread of stars over the sky, the same on every visit. */
function stars(
  width: number,
  height: number,
): { x: number; y: number; r: number }[] {
  let seed = 7
  const next = (): number => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  return Array.from({ length: 46 }, () => ({
    x: next() * width,
    y: next() * height * 0.5,
    r: 0.5 + next() * 1.1,
  }))
}

export function HarbourScene(props: HarbourSceneProps): JSX.Element {
  let trailEl: SVGPathElement | undefined
  let headEl: SVGCircleElement | undefined
  let paintingEl: HTMLImageElement | undefined
  /** The painting has loaded: it is the backdrop, and the drawing rests. */
  const [painted, setPainted] = createSignal(false)
  onMount(() => {
    if (trailEl !== undefined && headEl !== undefined) {
      props.trailRef(trailEl, headEl)
    }
    // A painting the page already held has loaded before its handler could
    // hear it.
    if (paintingEl?.complete === true && paintingEl.naturalWidth > 0) {
      setPainted(true)
    }
  })
  const art = (): HarbourArt | null =>
    props.art === undefined ? HARBOUR_ART : props.art
  const sky = createMemo(() => stars(props.layout.width, props.layout.height))
  const L = () => props.layout
  /** The painting pinned at the lamp, as the layout places it. */
  const pinnedAt = (): string =>
    `${((L().lampX / L().width) * 100).toFixed(2)}% ${((L().beamY / L().height) * 100).toFixed(2)}%`
  /** The lighthouse: its tower, two bands, the gallery, the lantern room and its roof. */
  const lighthouse = () => {
    const { lampX, beamY, seaY, width } = L()
    const half = Math.max(10, width * 0.035)
    const top = beamY + 20
    const foot = seaY + 6
    const at = (share: number): number => top + (foot - top) * share
    const halfAt = (share: number): number => half * (0.72 + 0.28 * share)
    const band = (from: number, to: number): string =>
      `M${lampX - halfAt(from)} ${at(from)} L${lampX + halfAt(from)} ${at(from)} L${lampX + halfAt(to)} ${at(to)} L${lampX - halfAt(to)} ${at(to)} Z`
    const room = half * 0.62
    return {
      tower: band(0, 1),
      stripes: [band(0.2, 0.36), band(0.56, 0.72)],
      gallery: `M${lampX - half * 1.05} ${top - 3} h${half * 2.1} v4 h${-half * 2.1} Z`,
      lantern: `M${lampX - room} ${beamY - 15} h${room * 2} v${top - 3 - (beamY - 15)} h${-room * 2} Z`,
      roof: `M${lampX - room * 1.25} ${beamY - 15} L${lampX} ${beamY - 15 - room * 1.5} L${lampX + room * 1.25} ${beamY - 15} Z`,
    }
  }
  const rocks = () => {
    const { lampX, seaY, width } = L()
    const w = width * 0.2
    return `M${lampX - w * 0.6} ${seaY + 18} Q${lampX - w * 0.3} ${seaY - 4} ${lampX} ${seaY} Q${lampX + w * 0.35} ${seaY - 6} ${width + 4} ${seaY + 4} L${width + 4} ${seaY + 26} Z`
  }
  const pier = () => {
    const { height, seaY } = L()
    const { deckY, end } = L().pier
    return {
      deck: `M-4 ${deckY} L${end} ${deckY} L${end} ${deckY + 7} L-4 ${deckY + 7} Z`,
      posts: [0.12, 0.41, 0.7, 0.94].map((share) => ({
        x: end * share,
        y: deckY + 7,
        h: Math.max(8, seaY + (height - seaY) * 0.62 - deckY),
      })),
    }
  }
  const hills = () => {
    const { width, seaY } = L()
    return `M-4 ${seaY} C${width * 0.18} ${seaY - 30} ${width * 0.32} ${seaY - 12} ${width * 0.48} ${seaY - 22} C${width * 0.6} ${seaY - 30} ${width * 0.7} ${seaY - 8} ${width * 0.8} ${seaY - 4} L${width * 0.8} ${seaY} Z`
  }

  return (
    <div
      class={styles.scene}
      classList={{
        [styles.turn]: props.turn,
        [styles.lit]: props.lit,
        [styles.still]: props.still === true,
        [styles.painted]: painted(),
      }}
      data-testid="home-note-scene"
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
          <linearGradient id="home-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#050818" />
            <stop offset="0.55" stop-color="#0d1538" />
            <stop offset="1" stop-color="#232659" />
          </linearGradient>
          <linearGradient id="home-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#121c46" />
            <stop offset="1" stop-color="#04060f" />
          </linearGradient>
          <radialGradient id="home-moon-glow">
            <stop offset="0" stop-color="#fdf3d2" stop-opacity="0.5" />
            <stop offset="1" stop-color="#fdf3d2" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect width={L().width} height={L().seaY} fill="url(#home-sky)" />
        <For each={sky()}>
          {(star) => (
            <circle cx={star.x} cy={star.y} r={star.r} class={styles.star} />
          )}
        </For>
        <circle
          cx={L().width * 0.16}
          cy={L().height * 0.12}
          r={L().width * 0.12}
          fill="url(#home-moon-glow)"
        />
        <circle
          cx={L().width * 0.16}
          cy={L().height * 0.12}
          r={L().width * 0.04}
          class={styles.moon}
        />
        <path d={hills()} class={styles.hills} />
        <rect
          y={L().seaY}
          width={L().width}
          height={L().height - L().seaY}
          fill="url(#home-sea)"
        />
        <g class={styles.swell}>
          <For each={[0.08, 0.2, 0.34, 0.5]}>
            {(share, i) => (
              <path
                class={styles.wave}
                style={{ 'animation-delay': `${-i() * 1.7}s` }}
                d={`M0 ${L().seaY + (L().height - L().seaY) * share} q${L().width * 0.25} -5 ${L().width * 0.5} 0 t${L().width * 0.5} 0`}
              />
            )}
          </For>
        </g>
        <path d={rocks()} class={styles.rocks} />
        <path d={lighthouse().tower} class={styles.tower} />
        <For each={lighthouse().stripes}>
          {(stripe) => <path d={stripe} class={styles.stripe} />}
        </For>
        <path d={lighthouse().gallery} class={styles.gallery} />
        <path d={lighthouse().lantern} class={styles.lantern} />
        <path d={lighthouse().roof} class={styles.roof} />
        <path d={pier().deck} class={styles.pier} />
        <For each={pier().posts}>
          {(post) => (
            <rect
              x={post.x - 2}
              y={post.y}
              width={4}
              height={post.h}
              class={styles.pier}
            />
          )}
        </For>
      </svg>

      <Show when={art()}>
        {(plate) => (
          <picture class={styles.painting}>
            <source media={LANDSCAPE_PLATE_MEDIA} srcset={plate().landscape} />
            <img
              ref={paintingEl}
              class={styles.paintingImage}
              src={plate().portrait}
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{ 'object-position': pinnedAt() }}
              onLoad={() => setPainted(true)}
              onError={() => setPainted(false)}
              data-testid="home-note-painting"
            />
          </picture>
        )}
      </Show>
      <div class={styles.paintingShade} aria-hidden="true" />

      {/* The exercise: home's band and beam, the trail, the lamp. */}
      <svg
        class={styles.overlay}
        width={L().width}
        height={L().height}
        viewBox={`0 0 ${L().width} ${L().height}`}
        aria-hidden="true"
      >
        <defs>
          {/* In user space: a level line has no height, and a gradient on
              its bounding box would paint nothing. */}
          <linearGradient
            id="home-beam"
            gradientUnits="userSpaceOnUse"
            x1={L().lampX}
            y1={0}
            x2={0}
            y2={0}
          >
            <stop offset="0" stop-color="#ffe29a" stop-opacity="0.95" />
            <stop offset="1" stop-color="#ffe29a" stop-opacity="0.08" />
          </linearGradient>
          <linearGradient id="home-band" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stop-color="#ffd678" stop-opacity="1" />
            <stop offset="1" stop-color="#ffd678" stop-opacity="0.25" />
          </linearGradient>
          <radialGradient id="home-lamp">
            <stop offset="0" stop-color="#fff6d8" />
            <stop offset="0.45" stop-color="#ffd36b" stop-opacity="0.7" />
            <stop offset="1" stop-color="#ffd36b" stop-opacity="0" />
          </radialGradient>
        </defs>
        <rect
          x={0}
          y={L().beamY - props.bandHalf}
          width={L().lampX}
          height={props.bandHalf * 2}
          class={styles.band}
          fill="url(#home-band)"
          data-testid="home-note-band"
        />
        <line
          x1={0}
          y1={L().beamY}
          x2={L().lampX}
          y2={L().beamY}
          class={styles.beam}
          stroke="url(#home-beam)"
          data-testid="home-note-beam"
        />
        <path ref={trailEl} class={styles.trail} d="" />
        <circle ref={headEl} class={styles.head} r={6} cx={-20} cy={-20} />
        <Show when={props.beat} keyed>
          {(beat) => (
            <circle
              class={styles.pulse}
              data-beat={beat}
              cx={L().lampX}
              cy={L().beamY}
              r={Math.max(22, L().width * 0.08)}
            />
          )}
        </Show>
        <circle
          class={styles.lamp}
          cx={L().lampX}
          cy={L().beamY}
          r={Math.max(26, L().width * 0.09)}
          fill="url(#home-lamp)"
          data-testid="home-note-lamp"
        />
      </svg>
    </div>
  )
}
