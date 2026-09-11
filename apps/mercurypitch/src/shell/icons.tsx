// ============================================================
// Shell icons — the kit sprite, as components
// ============================================================
//
// The native-app kit draws its symbols from one SVG sprite; a Solid app has
// no sprite, so each one becomes a component with the same path data. Monoline
// house style throughout: 24 x 24 box, 1.8 stroke, round caps and joins, no
// fill — filled parts (the transport glyphs, the selected marks) carry
// `fill="currentColor" stroke="none"` on their own element.
//
// Everything inherits `currentColor`, so a selected rail item tints by setting
// colour on the button. No emoji, ever — these exist so there is never a
// reason to reach for one.

import type { Component, JSX } from 'solid-js'

export interface ShellIconProps {
  size?: number
  class?: string
}

// Getters, not values: a spread copies what it is given, and reading
// `props.size` eagerly here would freeze it at the first render.
const base = (props: ShellIconProps): JSX.SvgSVGAttributes<SVGSVGElement> => ({
  viewBox: '0 0 24 24',
  get width() {
    return props.size ?? 24
  },
  get height() {
    return props.size ?? 24
  },
  get class() {
    return props.class
  },
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.8',
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  'aria-hidden': true,
})

/** Rooms — the monoline meniscus. Never a house: the kit has no Home. */
export const RoomsIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.5 12c3-3.6 5.5-3.6 8.5 0s5.5 3.6 8.5 0" />
  </svg>
)

export const RoomsFillIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path
      d="M3.2 12.6c3-3.4 5.8-3.4 8.8 0s5.8 3.4 8.8 0A9 9 0 0 1 3.2 12.6z"
      fill="currentColor"
      stroke="none"
    />
  </svg>
)

export const MicIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
  </svg>
)

export const MicFillIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect
      x="9"
      y="3"
      width="6"
      height="11"
      rx="3"
      fill="currentColor"
      stroke="none"
    />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
  </svg>
)

export const EarIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M6 10a6 6 0 0 1 12 0c0 2.5-1.5 3.5-2.5 5s-.5 4-3 4a2.5 2.5 0 0 1-2.5-2.5" />
    <path d="M9.5 10a2.5 2.5 0 0 1 5 0c0 1.2-.8 1.6-1.4 2.4" />
  </svg>
)

export const EarFillIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path
      d="M6.5 10a5.5 5.5 0 0 1 11 0c0 2.3-1.4 3.2-2.3 4.6s-.5 4.4-3.2 4.4a3 3 0 0 1-3-3"
      fill="currentColor"
      stroke="currentColor"
      stroke-width="2.2"
    />
  </svg>
)

export const ProgressIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M4 20h16" />
    <path d="M6.5 16v-4M11.5 16V7M16.5 16v-6" />
  </svg>
)

export const ProgressFillIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M4 20h16" />
    <rect
      x="5"
      y="11"
      width="3.2"
      height="6"
      rx="0.8"
      fill="currentColor"
      stroke="none"
    />
    <rect
      x="10.4"
      y="6"
      width="3.2"
      height="11"
      rx="0.8"
      fill="currentColor"
      stroke="none"
    />
    <rect
      x="15.8"
      y="9"
      width="3.2"
      height="8"
      rx="0.8"
      fill="currentColor"
      stroke="none"
    />
  </svg>
)

export const MoreIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="6" cy="12" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
    <circle cx="18" cy="12" r="1.7" fill="currentColor" stroke="none" />
  </svg>
)

export const BackIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)

export const GearIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)

export const PlayIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
  </svg>
)

export const PauseIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect
      x="7"
      y="5"
      width="4"
      height="14"
      rx="1.2"
      fill="currentColor"
      stroke="none"
    />
    <rect
      x="13"
      y="5"
      width="4"
      height="14"
      rx="1.2"
      fill="currentColor"
      stroke="none"
    />
  </svg>
)

export const StopIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect
      x="6.5"
      y="6.5"
      width="11"
      height="11"
      rx="2"
      fill="currentColor"
      stroke="none"
    />
  </svg>
)

export const LockIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
)

export const PianoIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M8 4.5v9M12 4.5v9M16 4.5v9" />
  </svg>
)

export const GuitarIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M20 4l-6.5 6.5" />
    <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0 3 3 0 0 1-3.5 3.5A3.5 3.5 0 0 0 4 20a3.5 3.5 0 0 0 6-1 3 3 0 0 1 3.5-3.5 3.5 3.5 0 0 0 0-5z" />
  </svg>
)

export const KaraokeIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="7" r="4" />
    <path d="M12 11v8M8 21h8M9.5 7h5" />
  </svg>
)

/** Sign in / account. Drawn in the kit's style; the sprite has no person. */
export const AccountIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </svg>
)

/** The in-app console, on test builds only. */
export const ConsoleIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="M8 10l2.5 2.5L8 15M13 15h3.5" />
  </svg>
)
