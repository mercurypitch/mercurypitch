// ============================================================
// The room's own glyphs, drawn like the bench's (ear-icons.tsx): a
// 24 box, a 1.6 stroke, round caps, hidden from screen readers.
// ============================================================

import type { JSX } from 'solid-js'

interface IconProps {
  size?: number
  class?: string
}

function frame(size: number | undefined) {
  const px = size ?? 24
  return {
    width: px,
    height: px,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round' as const,
    'stroke-linejoin': 'round' as const,
    'aria-hidden': 'true' as const,
  }
}

/** Hear it again: an arrow come round. */
export function IconReplay(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v3.8h3.8" />
    </svg>
  )
}

/** The "?" in the header. */
/** "?" in a ring, the shell's monoline help glyph. */
export function IconQuestion(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class} stroke-width="1.8">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.6" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export function IconHeadphones(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M4 15v-2a8 8 0 0 1 16 0v2" />
      <rect x="3.5" y="14" width="4" height="6" rx="1.5" />
      <rect x="16.5" y="14" width="4" height="6" rx="1.5" />
    </svg>
  )
}

/** Three shuffled tracks. */
export function IconTracks(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M4 7h10M4 12h16M4 17h7" />
    </svg>
  )
}

/** The glass with its mark. */
export function IconGlass(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <rect x="3" y="9" width="18" height="6" rx="3" />
      <path d="M12 6v12" />
    </svg>
  )
}

/** Stop whenever: a door left open. */
export function IconDoor(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M6 20V4h9v16" />
      <path d="M15 4l3 2v14l-3-1" />
      <path d="M12.5 12h.1" />
    </svg>
  )
}

/** No replay before the answer: the arrow, struck through. */
export function IconOnce(p: IconProps): JSX.Element {
  return (
    <svg {...frame(p.size)} class={p.class}>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v3.8h3.8" />
      <path d="M5 19L19 5" />
    </svg>
  )
}
