// ============================================================
// MercurySingWheel — the radial picker, four close matches
// ============================================================
//
// A weapon-wheel for songs: the closest matches sit in quadrants around a
// Mercury core, so choosing is one glance and one gesture rather than a
// list scan. Purely presentational — candidates in, a pick out — which is
// what lets the preview harness render it from fixtures and the stage
// render it from the live engine.
//
// Titles follow the arc of their wedge, and the wedges sit on the
// DIAGONALS rather than at twelve/three/six/nine. That pairing is the
// whole trick: text on a circle stands upright only where the tangent is
// horizontal, so a wedge centred at three o'clock reads vertically — which
// is what the first pass did to two of the four songs. Rotating the
// lattice 45° puts every title on a gentle diagonal instead: curved along
// the ring, and readable without turning your head.
//
// Geometry is fixed in a 400x400 viewBox and scaled by CSS, so wedges never
// reflow: slot 1 is upper-left, then clockwise — reading order, matching
// how "sing number one" counts.

import { Show } from 'solid-js'
import styles from './MercurySingWheel.module.css'

export interface WheelCandidate {
  sessionId: string
  name: string
  /** 0-100 display confidence. */
  confidence: number
}

interface MercurySingWheelProps {
  candidates: WheelCandidate[]
  /** Session currently arming, if any — its wedge lights up. */
  leaderId: string | null
  /** Arming progress 0..1, drawn as the outer ring filling. */
  armedFraction: number
  /** True while the mic is live (drives the sonar pulse). */
  listening: boolean
  onPick: (index: number) => void
}

const CENTER = 200
const R_OUTER = 172
const R_INNER = 92
const RING_R = 184
const GAP_DEG = 6
const LABEL_R = 152
const CONFIDENCE_R = 114
const CORE_R = 54

/** Mercury itself — cut from the backdrop art, 19KB, loaded once. */
const PLANET_SRC = '/mercury-sing/planet.webp'

/**
 * One arc per slot, each drawn in the direction that keeps its glyphs
 * upright: clockwise across the top half, counter-clockwise across the
 * bottom. Drawn the other way, the lower two titles hang upside down.
 */
const SLOT_ARCS = [
  { center: -135, from: -178, to: -92, sweep: 1 },
  { center: -45, from: -88, to: -2, sweep: 1 },
  { center: 45, from: 88, to: 2, sweep: 0 },
  { center: 135, from: 178, to: 92, sweep: 0 },
] as const

const polar = (angleDeg: number, radius: number): [number, number] => {
  const rad = (angleDeg * Math.PI) / 180
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)]
}

/** Annulus sector — the wedge shape, hollowed for the hub. */
function wedgePath(centerDeg: number): string {
  const half = 45 - GAP_DEG / 2
  const [ox1, oy1] = polar(centerDeg - half, R_OUTER)
  const [ox2, oy2] = polar(centerDeg + half, R_OUTER)
  const [ix2, iy2] = polar(centerDeg + half, R_INNER)
  const [ix1, iy1] = polar(centerDeg - half, R_INNER)
  return [
    `M ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `A ${R_OUTER} ${R_OUTER} 0 0 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
    `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    `A ${R_INNER} ${R_INNER} 0 0 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    'Z',
  ].join(' ')
}

/** The invisible baseline a wedge's title is set along. */
function labelArc(arc: (typeof SLOT_ARCS)[number]): string {
  const [x1, y1] = polar(arc.from, LABEL_R)
  const [x2, y2] = polar(arc.to, LABEL_R)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${LABEL_R} ${LABEL_R} 0 0 ${String(arc.sweep)} ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

/** An arc is finite: a very long title still has to stop somewhere. */
const MAX_TITLE_CHARS = 24

export function truncateTitle(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (clean === '') return 'Your song'
  return clean.length <= MAX_TITLE_CHARS
    ? clean
    : `${clean.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…`
}

/**
 * Type scales to the title, because a textPath does not wrap: text longer
 * than its arc is silently clipped at BOTH ends. Shrinking a long title is
 * the graceful failure; clipping "Hallowed Be Thy Name" to "allowed Be Thy
 * Nam" is not.
 */
export function titleFontSize(title: string): number {
  if (title.length <= 14) return 17
  if (title.length <= 19) return 15
  return 13
}

export function MercurySingWheel(props: MercurySingWheelProps) {
  const ringCircumference = 2 * Math.PI * RING_R

  return (
    <div class={styles.wrap}>
      <svg
        class={styles.wheel}
        viewBox="0 0 400 400"
        role="group"
        aria-label="Closest matches"
      >
        <defs>
          <radialGradient id="ms-core" cx="38%" cy="34%" r="72%">
            <stop offset="0%" stop-color="#ffe6bd" />
            <stop offset="46%" stop-color="#e09a4e" />
            <stop offset="100%" stop-color="#5a3418" />
          </radialGradient>
          <radialGradient id="ms-halo" cx="50%" cy="50%" r="50%">
            <stop offset="42%" stop-color="rgb(240 165 80 / 34%)" />
            <stop offset="100%" stop-color="rgb(240 165 80 / 0%)" />
          </radialGradient>
          {/* Static geometry — a plain map, not <For>: these four arcs are
              fixed for the component's life and never reorder. */}
          {/* eslint-disable-next-line solid/prefer-for */}
          {SLOT_ARCS.map((arc, slot) => (
            <path id={`ms-label-${String(slot)}`} d={labelArc(arc)} />
          ))}
        </defs>

        {/* Sonar — rings travel outward past the wheel, so the whole panel
            feels like it is hearing you. */}
        <Show when={props.listening}>
          <g class={styles.sonar} aria-hidden="true">
            <circle cx={CENTER} cy={CENTER} r={R_INNER} />
            <circle cx={CENTER} cy={CENTER} r={R_INNER} />
            <circle cx={CENTER} cy={CENTER} r={R_INNER} />
          </g>
        </Show>

        <circle
          class={styles.ringTrack}
          cx={CENTER}
          cy={CENTER}
          r={RING_R}
          aria-hidden="true"
        />
        <Show when={props.leaderId !== null && props.armedFraction > 0}>
          <circle
            class={styles.ringFill}
            cx={CENTER}
            cy={CENTER}
            r={RING_R}
            stroke-dasharray={String(ringCircumference)}
            stroke-dashoffset={String(
              ringCircumference * (1 - Math.min(props.armedFraction, 1)),
            )}
            transform={`rotate(-90 ${String(CENTER)} ${String(CENTER)})`}
            aria-hidden="true"
          />
        </Show>

        {/* Four fixed slots, never reordered — the CANDIDATES inside them
            change, and those are read through accessors, so the wedges stay
            reactive without <For> rebuilding the geometry. */}
        {/* eslint-disable-next-line solid/prefer-for */}
        {SLOT_ARCS.map((arc, slot) => {
          const candidate = () => props.candidates[slot]
          const isLeader = () =>
            candidate() !== undefined &&
            candidate().sessionId === props.leaderId
          const [confX, confY] = polar(arc.center, CONFIDENCE_R)
          return (
            <g
              class={styles.wedgeGroup}
              classList={{
                [styles.filled]: candidate() !== undefined,
                [styles.leader]: isLeader(),
              }}
              role={candidate() !== undefined ? 'button' : undefined}
              tabindex={candidate() !== undefined ? 0 : undefined}
              aria-label={
                candidate() !== undefined
                  ? `${candidate().name}, ${String(candidate().confidence)} percent — say sing number ${String(slot + 1)}`
                  : undefined
              }
              onClick={() => {
                if (candidate() !== undefined) props.onPick(slot)
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === 'Enter' || e.key === ' ') &&
                  candidate() !== undefined
                ) {
                  e.preventDefault()
                  props.onPick(slot)
                }
              }}
            >
              <path class={styles.wedge} d={wedgePath(arc.center)} />
              <Show when={candidate()}>
                {(entry) => (
                  <>
                    <text
                      class={styles.wedgeName}
                      font-size={String(
                        titleFontSize(truncateTitle(entry().name)),
                      )}
                    >
                      <textPath
                        href={`#ms-label-${String(slot)}`}
                        startOffset="50%"
                        text-anchor="middle"
                      >
                        {truncateTitle(entry().name)}
                      </textPath>
                    </text>
                    {/* Number and score share one centred line so they can
                        never land on top of each other, and they stay
                        straight even though the title curves — a
                        percentage read at an angle is read twice. */}
                    <text
                      class={styles.wedgeConfidence}
                      x={confX}
                      y={confY + 6}
                      text-anchor="middle"
                    >
                      <tspan class={styles.slotNumber}>
                        {String(slot + 1)}
                      </tspan>
                      <tspan dx="7">{String(entry().confidence)}%</tspan>
                    </text>
                  </>
                )}
              </Show>
            </g>
          )
        })}

        {/* The core: Mercury itself. */}
        <circle
          class={styles.halo}
          cx={CENTER}
          cy={CENTER}
          r={R_INNER}
          fill="url(#ms-halo)"
          aria-hidden="true"
        />
        {/* The real planet, clipped to the core. The drawn gradient stays
            underneath as the fallback: if the image has not loaded (or
            cannot), the wheel still has a Mercury at its centre rather
            than a hole. */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={CORE_R}
          fill="url(#ms-core)"
          aria-hidden="true"
        />
        <clipPath id="ms-core-clip">
          <circle cx={CENTER} cy={CENTER} r={CORE_R} />
        </clipPath>
        <image
          class={styles.corePhoto}
          href={PLANET_SRC}
          x={CENTER - CORE_R}
          y={CENTER - CORE_R}
          width={CORE_R * 2}
          height={CORE_R * 2}
          clip-path="url(#ms-core-clip)"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        />
        <circle
          class={styles.coreEdge}
          cx={CENTER}
          cy={CENTER}
          r={CORE_R}
          aria-hidden="true"
        />
        <text
          class={styles.coreLabel}
          x={CENTER}
          y={CENTER + 76}
          text-anchor="middle"
        >
          MERCURY
        </text>
      </svg>
    </div>
  )
}
