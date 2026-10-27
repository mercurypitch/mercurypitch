// Studio icons — the arranger's own marks, kept in its lazy chunk rather than the app's first paint.
import type { Component } from 'solid-js'

// Rotate clockwise — Redo, the mirror of RotateCcw's Undo.
export const RotateCw: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
)

// Magnet — snapping to an edge, a grid line or the playhead.
export const Magnet: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <path d="M6 3v8a6 6 0 0 0 12 0V3" />
    <path d="M6 3h4v8a2 2 0 0 0 4 0V3h4" />
    <path d="M6 7h4" />
    <path d="M14 7h4" />
  </svg>
)

// Zoom in and out — a magnifier with a plus or a minus.
export const ZoomIn: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
)

export const ZoomOut: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
    <path d="M8 11h6" />
  </svg>
)

// Fit to width — two arrows meeting a pair of bounds.
export const FitWidth: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <path d="M3 5v14" />
    <path d="M21 5v14" />
    <path d="M7 12h10" />
    <path d="m10 9-3 3 3 3" />
    <path d="m14 9 3 3-3 3" />
  </svg>
)

// Filled play and pause — the transport's main button reads at a glance.
export const PlayFilled: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.66-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
  </svg>
)

export const PauseFilled: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <rect x="6" y="4.5" width="4.5" height="15" rx="1.2" />
    <rect x="13.5" y="4.5" width="4.5" height="15" rx="1.2" />
  </svg>
)

// Info in a circle — the way to a clip's exact numbers.
export const InfoCircle: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </svg>
)

export const SkipBackFilled: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <rect x="5" y="5" width="2.6" height="14" rx="1.1" />
    <path d="M19 6.08v11.84a1 1 0 0 1-1.54.84l-8.9-5.92a1 1 0 0 1 0-1.68l8.9-5.92A1 1 0 0 1 19 6.08Z" />
  </svg>
)

// Archive — a lidded box with an arrow into it: the song's backup file.
export const ArchiveDown: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
    <path d="M12 11v6" />
    <path d="m9 14 3 3 3-3" />
  </svg>
)

// Mixing desk — three fader caps in a console's frame, unlike Sound's open sliders.
export const MixingDesk: Component<{ size?: number }> = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    width={p.size ?? 24}
    height={p.size ?? 24}
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M8 7v10" />
    <path d="M12 7v10" />
    <path d="M16 7v10" />
    <path d="M6.5 14h3" />
    <path d="M10.5 9.5h3" />
    <path d="M14.5 12h3" />
  </svg>
)
