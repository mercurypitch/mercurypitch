// ============================================================
// Shared glass control-bar glyphs — a 16px stroke/fill SVG set used by
// the bespoke per-tab control bars (Singing / Piano / Guitar / Compose).
// Extracted from SingingControlBar so every bar shares one icon set.
// ============================================================

import type { JSX } from 'solid-js'

/** 24x24 viewBox glyph at 16px; `fill` toggles filled vs stroked. */
export const Svg = (p: { children: JSX.Element; fill?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill={p.fill === true ? 'currentColor' : 'none'}
    stroke={p.fill === true ? 'none' : 'currentColor'}
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {p.children}
  </svg>
)

export const IconPlay = () => (
  <Svg fill>
    <path d="M8 5v14l11-7z" />
  </Svg>
)
export const IconPause = () => (
  <Svg fill>
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </Svg>
)
export const IconStop = () => (
  <Svg fill>
    <path d="M6 6h12v12H6z" />
  </Svg>
)
export const IconOnce = () => (
  <Svg>
    <circle cx="12" cy="12" r="10" />
    <path d="M10 9l2-2v10" />
  </Svg>
)
export const IconRepeat = () => (
  <Svg>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </Svg>
)
export const IconSession = () => (
  <Svg>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
)
export const IconFocus = () => (
  <Svg fill>
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
  </Svg>
)
export const IconAnchor = () => (
  <Svg fill>
    <path d="M12 3l-8 13h16L12 3zm0 3.5L17.5 13h-11L12 6.5z" />
    <circle cx="12" cy="14" r="1" />
  </Svg>
)
export const IconMetronome = () => (
  <Svg fill>
    <path d="M12 2L8 22h8L12 2zm0 5.5l2.5 10h-5L12 7.5z" />
  </Svg>
)
export const IconWave = () => (
  <Svg fill>
    <path d="M3 9h2v6H3zm4-3h2v12H7zm4 6h2v3h-2zm4-3h2v6h-2zm4-2h2v10h-2z" />
  </Svg>
)
export const IconClock = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 1.8" />
  </Svg>
)
export const IconVolume = () => (
  <Svg>
    <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
    <path d="M16 9a4 4 0 0 1 0 6" />
  </Svg>
)
export const IconSpeed = () => (
  <Svg fill>
    <path d="M4 5v14l8-7zM14 5v14l8-7z" />
  </Svg>
)
export const IconRest = () => (
  <Svg>
    <path d="M9 4v6M15 4v6M9 14v6M15 14v6" />
  </Svg>
)

// Instrument-tab glyphs (Piano / Guitar).
export const IconMidi = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="10" r="1" fill="currentColor" stroke="none" />
    <circle cx="9.5" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="14" r="1" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconLabels = () => (
  <Svg>
    <path d="M3 7h11l5 5-5 5H3z" />
    <circle cx="7.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconNotes = () => (
  <Svg>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" fill="currentColor" stroke="none" />
    <circle cx="18" cy="16" r="3" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconZoomIn = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
  </Svg>
)
export const IconZoomOut = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3M8 11h6" />
  </Svg>
)

// Editor (Compose) glyphs.
export const IconRecord = () => (
  <Svg fill>
    <circle cx="12" cy="12" r="6" />
  </Svg>
)
export const IconShare = () => (
  <Svg>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </Svg>
)

/** Tiny caret for the custom number stepper (native blue spinner is hidden). */
export const Caret = (p: { up?: boolean }) => (
  <svg
    viewBox="0 0 10 6"
    width="9"
    height="6"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d={p.up === true ? 'M1 5l4-4 4 4' : 'M1 1l4 4 4-4'} />
  </svg>
)

// ── A-B Loop icons ────────────────────────────────────────────────
// The loop toggle reuses IconRepeat (its lit/unlit state comes from the
// button's `.active` class, not a per-icon colour).

/**
 * A single loop-point badge — a ringed 'A' or 'B'. When `set`, the ring fills
 * with currentColor and the letter knocks out to the card background so it stays
 * legible on the filled disc; otherwise it's an outlined ring with the letter in
 * currentColor. No hardcoded colours — theming rides on currentColor.
 */
export const IconLoopPoint = (p: { label: 'A' | 'B'; set?: boolean }) => (
  <Svg fill={p.set === true}>
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke={p.set === true ? 'none' : 'currentColor'}
      fill={p.set === true ? 'currentColor' : 'none'}
    />
    <text
      x="12"
      y="17"
      font-size="13"
      font-family="sans-serif"
      text-anchor="middle"
      font-weight="bold"
      fill={p.set === true ? 'var(--bg-card)' : 'currentColor'}
      stroke="none"
    >
      {p.label}
    </text>
  </Svg>
)

/** Clear/reset icon (×). */
export const IconClear = () => (
  <Svg>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
)
