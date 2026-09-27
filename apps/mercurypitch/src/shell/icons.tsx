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

// ── Settings (S6) ────────────────────────────────────────────

/** The row that pushes a screen of its own. */
export const ChevronIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)

/** Appearance: half the disc filled, dark against light. */
export const ContrastIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
  </svg>
)

/** The choice that is in force. */
export const CheckIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

/** An account's history: the clock face with its hand swept back. */
export const HistoryIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 8.9" />
    <path d="M4.5 4.5v4.4h4.4" />
    <path d="M12 8v4.4l3 1.8" />
  </svg>
)

/** This phone, and the next one. */
export const PhoneIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18h2" />
  </svg>
)

/** Something needs attention, and nothing is lost. */
export const WarnIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M12 4l9 16H3z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
)

/** Close a sheet. */
export const CloseIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

/** A code by email. */
export const MailIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M4 7l8 6 8-6" />
  </svg>
)

/** The account's name. */
export const PersonIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20c.9-3.7 3.9-5.8 7.5-5.8s6.6 2.1 7.5 5.8" />
  </svg>
)

/** Two-step sign-in: the shield with its check. */
export const ShieldIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M12 3.5l7 2.6v5.2c0 4.4-2.9 7.8-7 9.2-4.1-1.4-7-4.8-7-9.2V6.1z" />
    <path d="M9 12.2l2.2 2.2 3.8-4" />
  </svg>
)

/** Copy: two sheets, one over the other. */
export const CopyIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </svg>
)

/** Sign out: the door, and the arrow leaving through it. */
export const SignOutIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
    <path d="M14.5 8l4 4-4 4M18.5 12H9.5" />
  </svg>
)

/** Delete: the bin. */
export const TrashIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7" />
    <path d="M6.5 7l.8 12a1.8 1.8 0 0 0 1.8 1.5h5.8a1.8 1.8 0 0 0 1.8-1.5l.8-12" />
    <path d="M10 11v6M14 11v6" />
  </svg>
)

/** Leaderboards: the cup. */
export const TrophyIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M8 4.5h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6.5H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6.5h2.5a2.5 2.5 0 0 1-2.6 3.4" />
    <path d="M12 13.5v3.5M8.5 20h7M9.5 17h5v3h-5z" />
  </svg>
)

/** A take: the waveform. */
export const WaveIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M3.5 12h2M7.5 8v8M11 5v14M14.5 9v6M18 7v10M20.5 12h0" />
  </svg>
)

/** Storage: the stacked disc of a drive. */
export const StorageIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <ellipse cx="12" cy="6" rx="7.5" ry="2.5" />
    <path d="M4.5 6v12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V6" />
    <path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" />
  </svg>
)

/** Start fresh: the arrow coming round. */
export const RefreshIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4.4h-4.4" />
  </svg>
)

/** Latency: a stopwatch, for the gap the wizard measures. */
export const TimerIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 13.5V9.5M10 2.5h4M18.5 6l1.5-1.5" />
  </svg>
)

/** Auto-calibrate: two sliders, set by listening. */
export const TuneIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
    <circle cx="15" cy="8" r="2" />
    <circle cx="9" cy="16" r="2" />
  </svg>
)

/** Leaves the app: the phone's own Settings. */
export const ExternalIcon: Component<ShellIconProps> = (props) => (
  <svg {...base(props)}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </svg>
)
