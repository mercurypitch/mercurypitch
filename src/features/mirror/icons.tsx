// ============================================================
// Voice Mirror — inline SVG icons (starry / cosmic set).
//
// Hand-drawn 24-grid strokes with tiny four-point sparkles so the
// buttons read as part of the star theme. Mirror-local on purpose:
// the mirror keeps its own set so its standalone bundle never grows
// app imports, and so every glyph carries the sparkle styling.
// ============================================================

import type { Component, JSX } from 'solid-js'

interface IconProps {
  size?: number
}

const svgProps = (p: IconProps): JSX.SvgSVGAttributes<SVGSVGElement> => ({
  width: p.size ?? 18,
  height: p.size ?? 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.8,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
  class: 'mirror-icon',
})

/** Four-point star — the ✦ of the theme, as a crisp vector. */
export const IconSpark: Component<IconProps> = (p) => (
  <svg {...svgProps(p)}>
    <path
      d="M12 3.2 13.8 10.2 20.8 12 13.8 13.8 12 20.8 10.2 13.8 3.2 12 10.2 10.2 Z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
)

/** Copy: two sheets + a sparkle. */
export const IconCopy: Component<IconProps> = (p) => (
  <svg {...svgProps(p)}>
    <rect x="4.2" y="8.2" width="10.6" height="11.6" rx="2.2" />
    <path d="M8.6 4.6h8a2.6 2.6 0 0 1 2.6 2.6v8.4" />
    <path
      d="m19.1 1.6.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5Z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
)

/** Ringed planet + stars — Sing the Universe. */
export const IconGalaxy: Component<IconProps> = (p) => (
  <svg {...svgProps(p)}>
    <circle cx="11.4" cy="13" r="4.6" />
    <ellipse
      cx="11.4"
      cy="13"
      rx="8.8"
      ry="3.1"
      transform="rotate(-20 11.4 13)"
    />
    <path
      d="m19.4 2.8.62 1.78 1.78.62-1.78.62-.62 1.78-.62-1.78-1.78-.62 1.78-.62Z"
      fill="currentColor"
      stroke="none"
    />
    <circle cx="4.4" cy="5.6" r="0.95" fill="currentColor" stroke="none" />
  </svg>
)

/** Rocket lifting off — Open MercuryPitch. */
export const IconRocket: Component<IconProps> = (p) => (
  <svg {...svgProps(p)}>
    <path d="M20.3 3.7c.3 3-1 5.9-3.4 8.3l-3.2 3.2-4.9-4.9 3.2-3.2c2.4-2.4 5.3-3.7 8.3-3.4Z" />
    <circle cx="14.9" cy="9.1" r="1.6" />
    <path d="m8.9 10.2-3.6 1.1 2.5 1.6" />
    <path d="m13.8 15.1-1.1 3.6-1.6-2.5" />
    <path d="M7.2 16.8 4 20" />
    <circle cx="19.6" cy="17.6" r="0.95" fill="currentColor" stroke="none" />
  </svg>
)

/** Chevron pointing right — the reveal nudge arrows (mirrored via CSS). */
export const IconChevron: Component<IconProps> = (p) => (
  <svg {...svgProps(p)}>
    <path d="m9 4.5 7.5 7.5L9 19.5" />
  </svg>
)

/** Share: arrow rising from a tray, with a sparkle. */
export const IconShare: Component<IconProps> = (p) => (
  <svg {...svgProps(p)}>
    <path d="M12 14.6V4.4" />
    <path d="M8.3 7.7 12 4l3.7 3.7" />
    <path d="M5.6 12.6v5.2a2.4 2.4 0 0 0 2.4 2.4h8a2.4 2.4 0 0 0 2.4-2.4v-5.2" />
    <circle cx="19.9" cy="4.4" r="0.95" fill="currentColor" stroke="none" />
  </svg>
)
