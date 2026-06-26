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
