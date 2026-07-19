// ============================================================
// PathOrb — one celestial node of The Ascent
// ============================================================
// A hi-res painterly pearl (per-state art, black background pre-converted to
// transparency) wrapped by seven glowing ring segments that count practice
// days. The ring, crown, fraction and per-week icon stay crisp SVG ON TOP of
// the art (progress can't be baked into an image). If the art fails to load,
// the state-tinted glow base keeps the orb from being a blank hole.

import type { Component, JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import type { WeekTheme } from '@/features/path/path-content'
import { DAYS_PER_WEEK } from '@/features/path/path-content'
import type { WeekState } from '@/features/path/path-progress'
import { WeekIcon } from '@/features/path/WeekIcon'
import styles from './PathOrb.module.css'

export interface PathOrbProps {
  /** Lit ring segments, 0..7. */
  fill: number
  state: WeekState
  /** Outer diameter in px (ring included). */
  size?: number
  /** Show the n/7 fraction / check inside the orb. */
  showFraction?: boolean
  /** When set, render the week's theme icon (active/complete always-on,
   *  others hover-reveal). Omit for the compact Home orb. */
  theme?: WeekTheme
}

// ── Ring geometry (precomputed once) ───────────────────────────
const VIEW = 120
const CX = 60
const CY = 60
const RING_R = 54
const SEG_COUNT = DAYS_PER_WEEK
const SEG_ANGLE = 360 / SEG_COUNT
const GAP_DEG = 14

function polar(angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + RING_R * Math.cos(rad), y: CY + RING_R * Math.sin(rad) }
}

/** Seven arc path strings, clockwise from 12 o'clock. */
const SEGMENTS: string[] = Array.from({ length: SEG_COUNT }, (_, i) => {
  const a0 = i * SEG_ANGLE + GAP_DEG / 2
  const a1 = (i + 1) * SEG_ANGLE - GAP_DEG / 2
  const p0 = polar(a0)
  const p1 = polar(a1)
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${RING_R} ${RING_R} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
})

const ORB_SRC: Record<WeekState, string> = {
  locked: '/ascent/orb-locked.webp',
  available: '/ascent/orb-available.webp',
  active: '/ascent/orb-active.webp',
  complete: '/ascent/orb-complete.webp',
}

interface RingColors {
  lit: string
  glow: string
}

const RING: Record<WeekState, RingColors> = {
  complete: { lit: '#f6d489', glow: 'rgba(240, 198, 116, 0.85)' },
  active: { lit: '#bdf3ff', glow: 'rgba(105, 220, 240, 0.9)' },
  available: { lit: '#b6a9ff', glow: 'rgba(129, 110, 250, 0.7)' },
  locked: { lit: '#9aa0c8', glow: 'rgba(0, 0, 0, 0)' },
}

export const PathOrb: Component<PathOrbProps> = (props) => {
  const size = () => props.size ?? 104
  const colors = () => RING[props.state]
  const lit = () =>
    props.state === 'complete'
      ? SEG_COUNT
      : Math.min(SEG_COUNT, Math.max(0, props.fill))

  const stateClass = () =>
    props.state === 'complete'
      ? styles.done
      : props.state === 'active'
        ? styles.active
        : props.state === 'available'
          ? styles.avail
          : styles.locked

  const ring = (): JSX.Element => (
    <svg class={styles.ring} viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
      <defs>
        <filter id="orbRingBlur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      {/* Bloom under the lit segments. */}
      <Show when={lit() > 0 && props.state !== 'locked'}>
        <g
          filter="url(#orbRingBlur)"
          stroke={colors().glow}
          stroke-width="9"
          stroke-linecap="round"
          fill="none"
          opacity="0.85"
        >
          <For each={SEGMENTS.slice(0, lit())}>{(d) => <path d={d} />}</For>
        </g>
      </Show>

      {/* Unlit segments. */}
      <g
        stroke="rgba(220, 224, 255, 0.18)"
        stroke-width="5.5"
        stroke-linecap="round"
        fill="none"
      >
        <For each={SEGMENTS.slice(lit())}>{(d) => <path d={d} />}</For>
      </g>

      {/* Lit segments. */}
      <g
        stroke={colors().lit}
        stroke-width="5.5"
        stroke-linecap="round"
        fill="none"
      >
        <For each={SEGMENTS.slice(0, lit())}>{(d) => <path d={d} />}</For>
      </g>
    </svg>
  )

  return (
    <div
      class={`${styles.wrap} ${stateClass()} ${props.theme !== undefined ? styles.hasIcon : ''}`}
      style={{ width: `${size()}px`, height: `${size()}px` }}
      role="img"
      aria-label={`Week ${props.state === 'complete' ? 'complete' : `${props.fill} of ${DAYS_PER_WEEK} days`}`}
    >
      <div
        class={styles.orbImg}
        style={{ 'background-image': `url(${ORB_SRC[props.state]})` }}
      />
      {ring()}

      <Show when={props.showFraction !== false}>
        <div class={styles.frac}>
          {props.state === 'complete' ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4.5 12.5l5 5 10-11" />
            </svg>
          ) : (
            `${props.fill}/${DAYS_PER_WEEK}`
          )}
        </div>
      </Show>

      <Show when={props.theme}>
        {(theme) => (
          <div class={styles.icon}>
            <WeekIcon theme={theme()} size={Math.round(size() * 0.34)} />
          </div>
        )}
      </Show>

      <Show when={props.state === 'complete'}>
        <svg
          class={styles.crown}
          width="20"
          height="14"
          viewBox="0 0 20 14"
          aria-hidden="true"
        >
          <path fill="currentColor" d="M2 12h16l1-8-5 4-4-7-4 7-5-4z" />
        </svg>
      </Show>
    </div>
  )
}
