// ============================================================
// Ear Lab icons — bench instruments and the room's controls.
//
// Line icons on a 24-grid, drawn in the workshop's own vocabulary:
// a loupe for Hairline, a tuning fork for Home, an escapement
// lattice for The Grid, a dividing arc for Leap, a gear train for
// Stack, a stylus trace for Contour, a wax seal for Calibration.
// ============================================================

import type { JSX } from 'solid-js'

interface IconProps {
  size?: number
  class?: string
}

function frame(size: number | undefined): {
  width: number
  height: number
  viewBox: string
  fill: string
  stroke: string
  'stroke-width': string
  'stroke-linecap': 'round'
  'stroke-linejoin': 'round'
  'aria-hidden': 'true'
} {
  const px = size ?? 24
  return {
    width: px,
    height: px,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.6',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }
}

export function IconLoupe(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
      <path d="M8.5 8v5M12.5 8v5" />
    </svg>
  )
}

export function IconFork(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M8 3v7a4 4 0 0 0 8 0V3" />
      <path d="M12 14v7" />
      <path d="M9 21h6" />
    </svg>
  )
}

export function IconLattice(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M3 12h18" />
      <path d="M5 8v8M9 8v8M13 8v8M17 6v12M21 8v8" />
    </svg>
  )
}

export function IconArc(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M4 19a9 9 0 0 1 16 0" />
      <path d="M12 19V10" />
      <path d="M12 19l6-6" />
      <circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconGears(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <circle cx="9" cy="10" r="4.5" />
      <circle cx="9" cy="10" r="1.2" />
      <circle cx="16.5" cy="15.5" r="3.2" />
      <path d="M9 3v2M9 15v2M2 10h2M14 10h2M4.3 5.3l1.4 1.4M12.3 13.3l1.4 1.4M4.3 14.7l1.4-1.4" />
    </svg>
  )
}

export function IconStylus(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M3 15c3-8 5 4 8-2s4 6 7-1" />
      <path d="M18 5l3 3-6 6h-3v-3z" />
    </svg>
  )
}

export function IconSeal(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
    </svg>
  )
}

/** A fingertip meeting the beat: the tap pad. */
export function IconTap(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 10.5a1.5 1.5 0 0 1 3 0V13" />
      <path d="M15 12a1.5 1.5 0 0 1 3 0v4a5 5 0 0 1-5 5h-1.5a5 5 0 0 1-4.3-2.4L4.6 14a1.4 1.4 0 0 1 2.2-1.7L9 14.5V11" />
      <path d="M6 5.5a4.5 4.5 0 0 1 3-3.9M14 1.6a4.5 4.5 0 0 1 3 3.9" />
    </svg>
  )
}

export function IconChain(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M3 16.5 8 11l4 3.5 4.5-6L21 12" />
      <circle cx="3" cy="16.5" r="1.6" />
      <circle cx="8" cy="11" r="1.6" />
      <circle cx="12" cy="14.5" r="1.6" />
      <circle cx="16.5" cy="8.5" r="1.6" />
      <circle cx="21" cy="12" r="1.6" />
    </svg>
  )
}

export function IconSpan(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M3 12h4.5l3-4 3 8 3-4H21" />
      <path d="M17.5 8.5 21 12l-3.5 3.5" />
      <circle cx="3" cy="12" r="1.6" />
      <circle cx="7.5" cy="12" r="1.6" />
      <circle cx="10.5" cy="8" r="1.6" />
      <circle cx="13.5" cy="16" r="1.6" />
    </svg>
  )
}

export function IconReport(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M3 17l5-6 4 3 5-7 4 5" />
      <path d="M3 21h18" />
    </svg>
  )
}

export function IconRoom(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M3 20V9l9-5 9 5v11" />
      <path d="M3 20h18" />
      <path d="M9 20v-6h6v6" />
    </svg>
  )
}

export function IconInfo(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconToday(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M8.5 15.5l2.5 2.5 4.5-5" />
    </svg>
  )
}

export function IconRack(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M4 9h16M4 15h16" />
      <circle cx="8" cy="6" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IconMic(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M9 21h6" />
    </svg>
  )
}

export function IconClose(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function IconCheck(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M4 12.5l5 5L20 7" />
    </svg>
  )
}

export function IconBack(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function IconStop(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  )
}

export function IconPlay(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M8 5.5v13l10-6.5z" />
    </svg>
  )
}

export function IconEar(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 3-2 3.5-2.5 5.5S13.5 20 11.5 20" />
      <path d="M9.5 10.5a2.5 2.5 0 0 1 5 0c0 1.5-1 2-1.5 3" />
    </svg>
  )
}
