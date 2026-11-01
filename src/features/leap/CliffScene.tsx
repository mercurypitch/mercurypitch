// ============================================================
// CliffScene — two cliffs at night, a ledge for each note, a lantern
// ============================================================
//
// Leap's world. Merc stands on the near ledge at his note's height; the
// target is the far ledge at its own, a lantern at its end, unlit. Each
// note's line crosses the room at its ledge: his in teal, the target's a
// faint gold dash until the singer's turn, when it turns solid and the band
// of light around it is the level's tolerance, so a voice inside it is a
// voice the engine will land. The lantern warms while the voice holds
// there, and a landed leap lights it: its beam becomes the line. After a
// miss, Merc's own line draws as he sings both notes.
//
// THE DRAWING. Every shape a stand-in in flat colour, drawn from one
// measurement (cliff-layout.ts), as Home note's harbour was before its
// painting. The painting comes after the owner approved the room
// (docs/plans/ear-rooms.md), and the lines, the band, the trail and the
// lantern stay drawn over it: they are the exercise.
//
// The ledges move with each leap: each cliff is drawn once from its top
// and moved there, so a new leap slides them to their heights. The trail
// is drawn every frame of the turn, so it is not a signal: the room hands
// its path, head and hold ring to the controller's sink, which writes them.

import type { JSX } from 'solid-js'
import { createMemo, For, onMount, Show } from 'solid-js'
import type { CliffLayout } from './cliff-layout'
import styles from './CliffScene.module.css'

export interface CliffSceneProps {
  layout: CliffLayout
  /** The tolerance band's half-height around the target's line, px. */
  bandHalf: number
  /** Merc's note's name ("G3"), or null at rest. */
  fromName: string | null
  /** The target's name once it shows, else null ("?" stands for it). */
  toName: string | null
  /** A round is on: the lines show. */
  live: boolean
  /** The singer's turn: the target's line turns solid, the trail shows. */
  turn: boolean
  /** The voice sits on Merc's note: his line brightens. */
  onFrom: boolean
  /** The voice is in the target's band: the lantern warms. */
  warm: boolean
  /** The leap landed: the lantern is lit and its beam is the line. */
  lit: boolean
  /** Merc sings both notes after a miss: his line draws. */
  answering: boolean
  /** The trail's path, head and hold ring, for the controller's sink. */
  trailRef: (
    path: SVGPathElement,
    head: SVGCircleElement,
    ring: SVGCircleElement,
  ) => void
  /** Nothing moves (reduced motion, the fixtures). */
  still?: boolean
}

/** A seeded spread of stars over the sky, the same on every visit. */
function stars(
  width: number,
  height: number,
): { x: number; y: number; r: number }[] {
  let seed = 11
  const next = (): number => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  return Array.from({ length: 42 }, () => ({
    x: next() * width,
    y: next() * height * 0.45,
    r: 0.5 + next() * 1.1,
  }))
}

export function CliffScene(props: CliffSceneProps): JSX.Element {
  let trailEl: SVGPathElement | undefined
  let headEl: SVGCircleElement | undefined
  let ringEl: SVGCircleElement | undefined
  onMount(() => {
    if (trailEl !== undefined && headEl !== undefined && ringEl !== undefined) {
      props.trailRef(trailEl, headEl, ringEl)
    }
  })
  const L = () => props.layout
  const sky = createMemo(() => stars(L().width, L().height))
  /** The moon, sized to the room's shorter side: a phone's, on a tablet too. */
  const moon = () => ({
    x: L().width * 0.77,
    y: L().height * 0.19,
    r: Math.min(26, Math.max(12, Math.min(L().width, L().height) * 0.05)),
  })

  /** The far ridges, across the room behind the cliffs. */
  const ridges = () => {
    const { width: w, height: h } = L()
    const far = [
      [0, 0.535],
      [0.1, 0.5],
      [0.2, 0.52],
      [0.31, 0.47],
      [0.43, 0.51],
      [0.55, 0.455],
      [0.67, 0.495],
      [0.77, 0.465],
      [0.88, 0.49],
      [1, 0.47],
    ]
    const near = [
      [0, 0.6],
      [0.14, 0.565],
      [0.29, 0.59],
      [0.45, 0.55],
      [0.61, 0.58],
      [0.77, 0.555],
      [1, 0.575],
    ]
    const line = (points: number[][]): string =>
      points
        .map(
          ([x, y], i) =>
            `${i === 0 ? 'M' : 'L'}${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`,
        )
        .join('')
    return {
      farTop: line(far),
      far: `${line(far)}L${w} ${h * 0.75}L0 ${h * 0.75}Z`,
      near: `${line(near)}L${w} ${h * 0.8}L0 ${h * 0.8}Z`,
    }
  }
  /** The near cliff, its top at 0: moved to Merc's ledge. */
  const nearCliff = () => {
    const { nearEdge: e, height: h } = L()
    return `M-4 0H${e}L${e + 8} ${h * 0.06}L${e - 4} ${h * 0.13}L${e + 10} ${h * 0.2}L${e - 2} ${h * 0.3}L${e + 6} ${h * 0.42}L${e - 6} ${h * 0.6}L${e + 4} ${h}H-4Z`
  }
  /** The far cliff, its top at 0: moved to the target's ledge. */
  const farCliff = () => {
    const { farEdge: e, width: w, height: h } = L()
    return `M${e} 0H${w + 4}V${h}H${e - 12}L${e - 2} ${h * 0.6}L${e - 14} ${h * 0.45}L${e - 2} ${h * 0.32}L${e - 12} ${h * 0.2}L${e + 2} ${h * 0.1}L${e - 8} ${h * 0.04}Z`
  }
  const cracks = (edge: number, sign: number) => {
    const { height: h } = L()
    return [0.05, 0.12, 0.2, 0.29]
      .map((share, i) => {
        const x = edge + sign * (18 + ((i * 37) % 60))
        const y = h * share
        return `M${x.toFixed(1)} ${y.toFixed(1)}l${(sign * (8 + i * 3)).toFixed(1)} ${(14 + i * 4).toFixed(1)}`
      })
      .join('')
  }
  const moved = (y: number): JSX.CSSProperties => ({
    transform: `translateY(${y.toFixed(1)}px)`,
  })

  return (
    <div
      class={styles.scene}
      classList={{
        [styles.live]: props.live,
        [styles.turn]: props.turn,
        [styles.onFrom]: props.onFrom,
        [styles.warm]: props.warm,
        [styles.lit]: props.lit,
        [styles.answering]: props.answering,
        [styles.still]: props.still === true,
      }}
      data-testid="leap-scene"
      data-art="drawing"
    >
      <svg
        class={styles.backdrop}
        width={L().width}
        height={L().height}
        viewBox={`0 0 ${L().width} ${L().height}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="leap-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#050816" />
            <stop offset="0.36" stop-color="#121842" />
            <stop offset="0.58" stop-color="#2a2459" />
            <stop offset="0.7" stop-color="#3a2b5f" />
            <stop offset="1" stop-color="#0c0a20" />
          </linearGradient>
          <radialGradient id="leap-moon-glow">
            <stop offset="0" stop-color="#e9e4ff" stop-opacity="0.34" />
            <stop offset="1" stop-color="#e9e4ff" stop-opacity="0" />
          </radialGradient>
          {/* The crescent: the moon with a disc taken out of it, so the
              sky shows through, whatever its shade there. */}
          <mask id="leap-crescent">
            <circle cx={moon().x} cy={moon().y} r={moon().r} fill="#fff" />
            <circle
              cx={moon().x + moon().r * 0.45}
              cy={moon().y - moon().r * 0.32}
              r={moon().r * 0.92}
              fill="#000"
            />
          </mask>
          <linearGradient id="leap-mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#c9c3ff" stop-opacity="0" />
            <stop offset="0.5" stop-color="#c9c3ff" stop-opacity="0.14" />
            <stop offset="1" stop-color="#c9c3ff" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="leap-rock-near" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#282c5c" />
            <stop offset="0.5" stop-color="#14163a" />
            <stop offset="1" stop-color="#07081a" />
          </linearGradient>
          <linearGradient id="leap-rock-far" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#2c3062" />
            <stop offset="0.55" stop-color="#16183e" />
            <stop offset="1" stop-color="#07081a" />
          </linearGradient>
        </defs>
        <rect width={L().width} height={L().height} fill="url(#leap-sky)" />
        <For each={sky()}>
          {(star) => (
            <circle cx={star.x} cy={star.y} r={star.r} class={styles.star} />
          )}
        </For>
        <circle
          cx={moon().x}
          cy={moon().y}
          r={moon().r * 3.6}
          fill="url(#leap-moon-glow)"
        />
        <circle
          cx={moon().x}
          cy={moon().y}
          r={moon().r}
          class={styles.moon}
          mask="url(#leap-crescent)"
        />
        <path d={ridges().far} class={styles.ridgeFar} />
        <path d={ridges().farTop} class={styles.ridgeRim} />
        <path d={ridges().near} class={styles.ridgeNear} />
        <rect
          y={L().height * 0.52}
          width={L().width}
          height={L().height * 0.2}
          fill="url(#leap-mist)"
        />
        <g class={styles.mover} style={moved(L().toY)}>
          <path d={farCliff()} fill="url(#leap-rock-far)" />
          <path d={cracks(L().farEdge, 1)} class={styles.crack} />
          <path
            d={`M${L().farEdge} 0H${L().width}`}
            class={`${styles.ledge} ${styles.farLedge}`}
          />
          <rect
            x={L().lantern.x - 2}
            y={-32}
            width={4}
            height={32}
            class={styles.post}
          />
          <path
            d={`M${L().lantern.x - 8} -48h16l-2 16h-12Z`}
            class={styles.lanternGlass}
            data-testid="leap-lantern"
          />
          <path
            d={`M${L().lantern.x - 10} -48h20l-10 -8Z`}
            class={styles.post}
          />
        </g>
        <g class={styles.mover} style={moved(L().fromY)}>
          <path d={nearCliff()} fill="url(#leap-rock-near)" />
          <path d={cracks(L().nearEdge, -1)} class={styles.crack} />
          <path d={`M-4 0H${L().nearEdge}`} class={styles.ledge} />
        </g>
      </svg>

      {/* The exercise: both lines, the target's band, the lantern's light,
          the trail and Merc's answer. */}
      <svg
        class={styles.overlay}
        width={L().width}
        height={L().height}
        viewBox={`0 0 ${L().width} ${L().height}`}
        aria-hidden="true"
      >
        <defs>
          {/* In user space, from Merc's ledge to the target's: the trail is
              teal on his note, violet between, gold at the target. */}
          <linearGradient
            id="leap-trail"
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={L().fromY}
            x2={0}
            y2={L().toY}
          >
            <stop offset="0" stop-color="#5ee9da" />
            <stop offset="0.5" stop-color="#a78bfa" />
            <stop offset="1" stop-color="#f0c75e" />
          </linearGradient>
          <linearGradient
            id="leap-beam"
            gradientUnits="userSpaceOnUse"
            x1={L().lantern.x}
            y1={0}
            x2={0}
            y2={0}
          >
            <stop offset="0" stop-color="#ffe7a3" stop-opacity="0.95" />
            <stop offset="1" stop-color="#ffe7a3" stop-opacity="0.08" />
          </linearGradient>
          <radialGradient id="leap-lamp">
            <stop offset="0" stop-color="#fff6d8" />
            <stop offset="0.45" stop-color="#ffd36b" stop-opacity="0.7" />
            <stop offset="1" stop-color="#ffd36b" stop-opacity="0" />
          </radialGradient>
        </defs>
        <circle
          class={styles.glow}
          cx={L().lantern.x}
          cy={L().toY - 40}
          r={Math.max(26, L().width * 0.08)}
          fill="url(#leap-lamp)"
          data-testid="leap-glow"
        />
        <Show when={props.live}>
          <rect
            x={0}
            y={L().toY - props.bandHalf}
            width={L().lantern.x}
            height={props.bandHalf * 2}
            class={styles.band}
            data-testid="leap-band"
          />
          <line
            x1={0}
            y1={L().toY}
            x2={L().lantern.x - 10}
            y2={L().toY}
            class={styles.target}
            stroke="url(#leap-beam)"
            data-testid="leap-target-line"
          />
          <line
            x1={0}
            y1={L().fromY}
            x2={L().width}
            y2={L().fromY}
            class={styles.from}
            data-testid="leap-from-line"
          />
          <text
            x={L().nearEdge + 10}
            y={L().fromY + 22}
            class={styles.fromName}
            data-testid="leap-from-name"
          >
            {props.fromName ?? ''}
          </text>
          <text
            x={16}
            y={L().toY - 12}
            class={styles.toName}
            data-testid="leap-to-name"
          >
            {props.toName ?? '?'}
          </text>
        </Show>
        <path
          class={styles.answer}
          pathLength={100}
          d={`M${L().merc.left + L().merc.size * 0.8} ${L().fromY - 4}H${L().nearEdge * 0.95}C${L().nearEdge + 18} ${L().fromY - 4} ${L().nearEdge + 22} ${L().toY - 4} ${L().farEdge * 0.98} ${L().toY - 4}H${L().lantern.x - 26}`}
          data-testid="leap-answer"
        />
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
