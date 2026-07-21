// ============================================================
// Mobile-kit icons — stroke SVGs, SF-Symbols feel.
// ============================================================
//
// The kit's icon set (mobile-kit.md convention #9): inline SVG only, no
// emoji anywhere in product UI. Stroke icons use a 24 viewBox, 1.8–2.4px
// stroke, round caps/joins; transport glyphs are solid fills (they read
// better small). Everything inherits `currentColor`. Extends the pattern
// of src/components/shared/control-bar/icons.tsx.

import type { Component } from 'solid-js'

interface IconProps {
  size?: number
  class?: string
}

export const ChevronLeftIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 18}
    height={props.size ?? 18}
    class={props.class}
    fill="none"
    stroke="currentColor"
    stroke-width="2.4"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

/** Song list / library — list rows with a beamed note. */
export const SongListIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 17}
    height={props.size ?? 17}
    class={props.class}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <path d="M4 6h11M4 12h11M4 18h7" />
    <path d="M19 6v8.55A2.5 2.5 0 1 0 20.5 17V9h2.5" stroke-width="1.8" />
  </svg>
)

/** Guide-vocal mic with sparkles (the karaoke "sing" pill). */
export const MicSparkleIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 17}
    height={props.size ?? 17}
    class={props.class}
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5V21" />
    <path
      d="M19.5 3.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"
      fill="currentColor"
      stroke="none"
    />
    <path
      d="M3.4 15.6l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
)

export const PlayIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 28}
    height={props.size ?? 28}
    class={props.class}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
)

export const PauseIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 28}
    height={props.size ?? 28}
    class={props.class}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
)

/** Restart / previous — bar + left-pointing triangle. */
export const PrevIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 22}
    height={props.size ?? 22}
    class={props.class}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M6 6h2v12H6zM18 6l-8.5 6L18 18z" />
  </svg>
)

/** Next song — right-pointing triangle + bar. */
export const NextIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 22}
    height={props.size ?? 22}
    class={props.class}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M6 6l8.5 6L6 18zM16 6h2v12h-2z" />
  </svg>
)

/** Autoplay — an infinity loop (keep playing, song after song). */
export const AutoplayIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 18}
    height={props.size ?? 18}
    class={props.class}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M7 9a3 3 0 0 0 0 6c1.7 0 2.8-1.4 5-3s3.3-3 5-3a3 3 0 0 1 0 6c-1.7 0-2.8-1.4-5-3S8.7 9 7 9z" />
  </svg>
)

/** More / overflow — three dots. */
export const EllipsisIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 19}
    height={props.size ?? 19}
    class={props.class}
    fill="none"
    stroke="currentColor"
    stroke-width="1.9"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <circle cx="5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="19" cy="12" r="1.4" />
  </svg>
)

/** Small solid play glyph for list rows. */
export const PlayGlyphIcon: Component<IconProps> = (props) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 12}
    height={props.size ?? 12}
    class={props.class}
    aria-hidden="true"
  >
    <path fill="currentColor" d="M8 5v14l11-7z" />
  </svg>
)
