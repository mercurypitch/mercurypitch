// ============================================================
// Colour maps for spectrogram display
// ============================================================

export type ColourMapId =
  | 'viridis'
  | 'thermal'
  | 'ice'
  | 'banded'
  | 'highlight'
  | 'phase'

export interface ColourMapEntry {
  id: ColourMapId
  label: string
  fn: (norm: number) => [number, number, number]
}

// ── Viridis-like (blue → cyan → green → yellow → red) ─────────

function viridis(norm: number): [number, number, number] {
  if (norm < 0.25) {
    const t = norm / 0.25
    return [0, Math.floor(t * 128), Math.floor(128 + t * 127)]
  } else if (norm < 0.5) {
    const t = (norm - 0.25) / 0.25
    return [0, Math.floor(128 + t * 127), Math.floor(255 - t * 127)]
  } else if (norm < 0.75) {
    const t = (norm - 0.5) / 0.25
    return [Math.floor(t * 255), 255, 0]
  } else {
    const t = (norm - 0.75) / 0.25
    return [255, Math.floor(255 - t * 255), 0]
  }
}

// ── Thermal (black → red → yellow → white) ────────────────────

function thermal(norm: number): [number, number, number] {
  if (norm < 0.33) {
    const t = norm / 0.33
    return [Math.floor(t * 255), 0, 0]
  } else if (norm < 0.66) {
    const t = (norm - 0.33) / 0.33
    return [255, Math.floor(t * 255), 0]
  } else {
    const t = (norm - 0.66) / 0.34
    return [255, 255, Math.floor(t * 255)]
  }
}

// ── Ice (dark blue → light blue → white) ──────────────────────

function ice(norm: number): [number, number, number] {
  if (norm < 0.5) {
    const t = norm / 0.5
    return [Math.floor(t * 60), Math.floor(t * 120), Math.floor(128 + t * 127)]
  } else {
    const t = (norm - 0.5) / 0.5
    return [
      Math.floor(60 + t * 195),
      Math.floor(120 + t * 135),
      Math.floor(255),
    ]
  }
}

// ── Banded (Viridis quantized to 8 discrete levels) ────────────

function banded(norm: number): [number, number, number] {
  const band = Math.floor(norm * 8) / 8
  return viridis(band)
}

// ── Highlight (dark → bright transition at 0.5 threshold) ─────

function highlight(norm: number): [number, number, number] {
  if (norm < 0.45) return [10, 10, 20]
  if (norm < 0.55) return [255, 200, 50]
  return [
    Math.floor(200 + norm * 55),
    Math.floor(200 + norm * 55),
    Math.floor(200 + norm * 55),
  ]
}

// ── Registry ───────────────────────────────────────────────────

export const COLOUR_MAPS: ColourMapEntry[] = [
  { id: 'viridis', label: 'Viridis', fn: viridis },
  { id: 'thermal', label: 'Thermal', fn: thermal },
  { id: 'ice', label: 'Ice', fn: ice },
  { id: 'banded', label: 'Banded', fn: banded },
  { id: 'highlight', label: 'Highlight', fn: highlight },
  { id: 'phase', label: 'Phase', fn: viridis }, // phase handled specially in canvas
]

const MAP_BY_ID: Record<
  ColourMapId,
  (norm: number) => [number, number, number]
> = {
  viridis,
  thermal,
  ice,
  banded,
  highlight,
  phase: viridis, // phase handled specially in canvas, fallback to viridis
}

/** Get a colour map function by id. Falls back to viridis. */
export function getColourMap(
  id: ColourMapId | string,
): (norm: number) => [number, number, number] {
  const map = MAP_BY_ID[id as ColourMapId] ?? viridis
  // Clamp the input to [0,1] so out-of-range values can't produce
  // out-of-[0,255] channels (e.g. viridis(1.5)).
  return (norm: number) => map(norm < 0 ? 0 : norm > 1 ? 1 : norm)
}

/** Cycle to the next colour map. */
export function nextColourMap(current: ColourMapId): ColourMapId {
  const idx = COLOUR_MAPS.findIndex((m) => m.id === current)
  return COLOUR_MAPS[(idx + 1) % COLOUR_MAPS.length].id
}
