// Where the voice sits in its own range, as a column of mercury.
// ============================================================
//
// The Sorting Line has no target pitch, so it cannot draw a ladder of
// notes the way a chamber does. What it can draw is the one number it
// runs on: `t`, where the voice sits between the bottom and the top of
// the player's own range. This is that number as a glass tube -- brass
// caps, a column of mercury, a bright meniscus where it stops, and a
// turquoise band for the stretch of the tube the current gate admits.
// The look is the ChatGPT states sheet maff picked on 2026-09-04
// (agent-out/.../range-indicator/codex_lab_states.png).
//
// It is not what teaches a room; the ghost beside the gate is. It is
// what stops the later rooms being twitchy, and it follows ModeLadder's
// pattern: default-on, toggleable, persisted by the stage that mounts it.
//
// TWO THINGS IT MUST DO, from the first device test of slice 1 (§6):
// the column is greyed and never hidden when the mic loses the voice,
// so a lost mic can never look like a held note -- and any voiced frame
// moves it, so singing the wrong note can never look like a dead mic.
//
// The column moves by `transform`, not by `height`. SVG geometry
// animates through CSS on desktop Chrome and on nothing older, and the
// one place this has to be smooth is an iOS WebView. The mercury is
// drawn once at full height, clipped to the glass, and slid.

import { For, Show } from 'solid-js'

export interface ShapeGaugeProps {
  /** Where the voice is in the range, 0..1, already smoothed. */
  t: number
  /** Whether a voice is being heard right now. */
  heard: boolean
  /** The band of `t` the current gate admits, or null when there is
   * nothing to aim for. */
  band: { lo: number; hi: number } | null
  /** Whether the shape is inside that band. */
  inBand: boolean
  /** The working range's span in semitones, for the tick marks. */
  semis: number
}

/** The drawing, in its own units. Everything else is derived. */
export const GAUGE = {
  width: 60,
  height: 300,
  /** The glass, top to bottom. */
  tubeTop: 34,
  tubeBottom: 266,
  tubeLeft: 14,
  tubeRight: 46,
} as const

/** The tube's inner height: what `t` is scaled by. */
export const TUBE_HEIGHT = GAUGE.tubeBottom - GAUGE.tubeTop

const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0

/** Y of a given t, in drawing units: the bottom of the glass at 0. */
export const yFor = (t: number): number =>
  GAUGE.tubeBottom - clamp01(t) * TUBE_HEIGHT

const cx = (GAUGE.tubeLeft + GAUGE.tubeRight) / 2

/** A brass cap: two knurled rings and a collar meeting the glass. Drawn
 * once for the top and mirrored for the bottom. */
const Cap = (props: { at: 'top' | 'bottom' }) => {
  const ty = (): string =>
    props.at === 'bottom' ? `translate(0 ${GAUGE.height}) scale(1 -1)` : ''
  return (
    <g class="shape-gauge__cap" transform={ty()}>
      <rect x="8" y="8" width="44" height="10" rx="2" fill="url(#sg-brass)" />
      <rect x="10" y="18" width="40" height="10" fill="url(#sg-brass-knurl)" />
      <rect x="12" y="28" width="36" height="6" fill="url(#sg-brass)" />
      <rect x="8" y="17" width="44" height="1.2" fill="#3a2a10" opacity="0.6" />
      <rect
        x="10"
        y="27.4"
        width="40"
        height="1.2"
        fill="#3a2a10"
        opacity="0.6"
      />
    </g>
  )
}

export const ShapeGauge = (props: ShapeGaugeProps) => {
  /** How far the column slides up, in drawing units. */
  const lift = (): number => clamp01(props.t) * TUBE_HEIGHT
  const ticks = (): number[] =>
    Array.from(
      { length: Math.max(1, Math.round(props.semis)) + 1 },
      (_, i) => i,
    )
  const tickY = (i: number): number =>
    GAUGE.tubeBottom - (i / Math.max(1, Math.round(props.semis))) * TUBE_HEIGHT

  return (
    <div
      class="shape-gauge"
      classList={{ 'is-lost': !props.heard, 'is-lit': props.inBand }}
      aria-label="Where your voice sits in your range"
      role="img"
    >
      <svg
        viewBox={`0 0 ${GAUGE.width} ${GAUGE.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="sg-brass" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#7a5a1e" />
            <stop offset="0.22" stop-color="#d9b25a" />
            <stop offset="0.42" stop-color="#f5dc8a" />
            <stop offset="0.6" stop-color="#c99b3e" />
            <stop offset="1" stop-color="#6e4f18" />
          </linearGradient>
          <linearGradient id="sg-brass-knurl" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#6e4f18" />
            <stop offset="0.3" stop-color="#e2be66" />
            <stop offset="0.5" stop-color="#8f6c24" />
            <stop offset="0.7" stop-color="#e2be66" />
            <stop offset="1" stop-color="#5e4212" />
          </linearGradient>
          <linearGradient id="sg-mercury" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#5c6166" />
            <stop offset="0.18" stop-color="#c9ced2" />
            <stop offset="0.34" stop-color="#f6f8f9" />
            <stop offset="0.55" stop-color="#aeb4b9" />
            <stop offset="0.8" stop-color="#6b7176" />
            <stop offset="1" stop-color="#3c4145" />
          </linearGradient>
          <linearGradient id="sg-glass" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stop-color="#ffffff" stop-opacity="0.04" />
            <stop offset="0.12" stop-color="#ffffff" stop-opacity="0.36" />
            <stop offset="0.28" stop-color="#ffffff" stop-opacity="0.08" />
            <stop offset="0.72" stop-color="#ffffff" stop-opacity="0.02" />
            <stop offset="0.9" stop-color="#ffffff" stop-opacity="0.14" />
            <stop offset="1" stop-color="#000000" stop-opacity="0.35" />
          </linearGradient>
          <filter id="sg-glow" x="-50%" y="-300%" width="200%" height="700%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
          <clipPath id="sg-clip">
            <rect
              x={GAUGE.tubeLeft + 2}
              y={GAUGE.tubeTop}
              width={GAUGE.tubeRight - GAUGE.tubeLeft - 4}
              height={TUBE_HEIGHT}
              rx="3"
            />
          </clipPath>
        </defs>

        {/* The bore: dark glass over the void. */}
        <rect
          x={GAUGE.tubeLeft}
          y={GAUGE.tubeTop}
          width={GAUGE.tubeRight - GAUGE.tubeLeft}
          height={TUBE_HEIGHT}
          rx="4"
          fill="#0a0f10"
          stroke="rgb(255 255 255 / 18%)"
          stroke-width="0.8"
        />

        {/* Etched ticks, on the back wall so the mercury reads through
            them: one per semitone, longer at each octave. */}
        <g class="shape-gauge__ticks">
          <For each={ticks()}>
            {(i) => (
              <line
                x1={cx - (i % 12 === 0 ? 9 : i % 6 === 0 ? 6 : 3.5)}
                x2={cx + (i % 12 === 0 ? 9 : i % 6 === 0 ? 6 : 3.5)}
                y1={tickY(i)}
                y2={tickY(i)}
                classList={{ 'is-octave': i % 12 === 0 }}
              />
            )}
          </For>
        </g>

        {/* The mercury: drawn once at full height below the glass and slid
            up by t. Clipped to the bore, so what shows is the column. */}
        <g clip-path="url(#sg-clip)">
          <g
            class="shape-gauge__column"
            style={{ transform: `translateY(${-lift()}px)` }}
          >
            <rect
              x={GAUGE.tubeLeft + 2}
              y={GAUGE.tubeBottom}
              width={GAUGE.tubeRight - GAUGE.tubeLeft - 4}
              height={TUBE_HEIGHT + 4}
              fill="url(#sg-mercury)"
            />
            <ellipse
              class="shape-gauge__meniscus-glow"
              cx={cx}
              cy={GAUGE.tubeBottom}
              rx="15"
              ry="3.2"
              filter="url(#sg-glow)"
            />
            <ellipse
              class="shape-gauge__meniscus"
              cx={cx}
              cy={GAUGE.tubeBottom}
              rx="13"
              ry="2.1"
            />
          </g>
        </g>

        {/* The glass in front: one bright highlight left of centre, a
            darker right edge. */}
        <rect
          x={GAUGE.tubeLeft}
          y={GAUGE.tubeTop}
          width={GAUGE.tubeRight - GAUGE.tubeLeft}
          height={TUBE_HEIGHT}
          rx="4"
          fill="url(#sg-glass)"
          pointer-events="none"
        />

        {/* The band: the stretch of the tube the gate admits, drawn ON the
            glass the way the enamel ring sits on the sheet's tubes -- a
            faint zone for the whole stretch and a solid ring at each edge,
            so it reads as furniture rather than as a second fill. Turquoise,
            the app's "this is the target" colour; it warms when he is
            inside it. */}
        <Show when={props.band}>
          {(band) => (
            <g class="shape-gauge__band-group">
              <rect
                class="shape-gauge__band"
                x={GAUGE.tubeLeft - 2}
                y={yFor(band().hi)}
                width={GAUGE.tubeRight - GAUGE.tubeLeft + 4}
                height={Math.max(1.5, yFor(band().lo) - yFor(band().hi))}
                rx="1.5"
              />
              <For each={[band().lo, band().hi]}>
                {(edge) => (
                  <rect
                    class="shape-gauge__band-ring"
                    x={GAUGE.tubeLeft - 2.5}
                    y={yFor(edge) - 1.4}
                    width={GAUGE.tubeRight - GAUGE.tubeLeft + 5}
                    height="2.8"
                    rx="1.2"
                  />
                )}
              </For>
            </g>
          )}
        </Show>

        <Cap at="top" />
        <Cap at="bottom" />
      </svg>
    </div>
  )
}
