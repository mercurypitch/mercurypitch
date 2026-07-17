// ============================================================
// Glass — inline SVG icons (no emoji, per the global style rule).
// Small geometric marks for the landing's three-step preview.
// ============================================================

import type { Component } from 'solid-js'

interface IconProps {
  size?: number
}

/** Calibration: a rising siren glide. */
export const IconGlide: Component<IconProps> = (props) => (
  <svg
    width={props.size ?? 22}
    height={props.size ?? 22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M3 18c3.5 0 3.5-5 7-5s3.5-6 7-6" />
    <circle cx="20" cy="5" r="1.6" fill="currentColor" stroke="none" />
  </svg>
)

/** Listen back: a play wedge inside the mirror pane. */
export const IconReplay: Component<IconProps> = (props) => (
  <svg
    width={props.size ?? 22}
    height={props.size ?? 22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="3" width="16" height="18" rx="2.5" />
    <path d="M10 8.5v7l6-3.5z" fill="currentColor" stroke="none" />
  </svg>
)

/** Shatter: a starburst of shards. */
export const IconShatter: Component<IconProps> = (props) => (
  <svg
    width={props.size ?? 22}
    height={props.size ?? 22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.5 5.5l3.2 3.2M15.3 15.3l3.2 3.2M18.5 5.5l-3.2 3.2M8.7 15.3l-3.2 3.2" />
  </svg>
)
