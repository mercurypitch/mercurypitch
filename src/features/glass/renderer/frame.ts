// ============================================================
// The glass's chrome bevel frame — shared by both backends so the
// pane edge looks identical everywhere. Three layers give it real
// depth: a soft outer shadow, the quicksilver bevel gradient, and
// a thin inner specular highlight (a polished glass edge, not a
// flat outline).
// ============================================================

/** Paths a rounded rect into `c` (beginPath…closePath, no stroke/fill). */
export type RoundRectPath = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => void

export function drawGlassFrame(
  c: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
  roundRect: RoundRectPath,
): void {
  // Soft outer shadow — lifts the pane off the cosmos.
  roundRect(1, 1, width - 2, height - 2, radius + 1)
  c.strokeStyle = 'rgba(4, 6, 14, 0.55)'
  c.lineWidth = 6
  c.stroke()

  // Quicksilver bevel: light catches the top-left, shadow pools bottom-right.
  const bevel = c.createLinearGradient(0, 0, width, height)
  bevel.addColorStop(0, '#dbe3ec')
  bevel.addColorStop(0.34, '#8a97a6')
  bevel.addColorStop(0.6, '#c3ccd6')
  bevel.addColorStop(1, '#2a3542')
  roundRect(2.5, 2.5, width - 5, height - 5, radius)
  c.strokeStyle = bevel
  c.lineWidth = 3.5
  c.stroke()

  // Inner specular highlight — the thin bright edge of real glass.
  roundRect(4.6, 4.6, width - 9.2, height - 9.2, Math.max(2, radius - 2))
  c.strokeStyle = 'rgba(244, 248, 253, 0.22)'
  c.lineWidth = 1
  c.stroke()
}
