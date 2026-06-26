// Shared Canvas2D colour helpers for the 3D tab view.

/** `#rrggbb` + alpha → `rgba(...)`. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Per-string lane colour (cycles if more strings than colours). */
export function colorForString(
  colors: readonly string[],
  stringIndex: number,
): string {
  return colors[stringIndex % colors.length] ?? '#ffffff'
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

/** Perceived brightness 0–255 of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Move a colour toward white by `amt` (0–1); returns rgb(...). */
export function lighten(hex: string, amt: number): string {
  const [r, g, b] = parseHex(hex)
  const k = Math.min(1, Math.max(0, amt))
  return `rgb(${Math.round(r + (255 - r) * k)}, ${Math.round(g + (255 - g) * k)}, ${Math.round(b + (255 - b) * k)})`
}

/** Readable label colour for text drawn on top of `bg`. */
export function labelInk(bg: string): string {
  return luminance(bg) > 140 ? '#0a0a12' : '#ffffff'
}
