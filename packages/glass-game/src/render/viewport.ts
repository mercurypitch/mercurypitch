// Renderable viewport — half-resolution glass targets need two physical pixels on each axis.

export function canRenderViewport(
  width: number,
  height: number,
  pixelRatio: number,
): boolean {
  // Three r185 sizes its transmission target from the drawing-buffer viewport.
  // A 1px axis at our 0.5 transmission scale truncates to a zero-size attachment.
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    Number.isFinite(pixelRatio) &&
    pixelRatio > 0 &&
    Math.floor(width * pixelRatio) >= 2 &&
    Math.floor(height * pixelRatio) >= 2
  )
}
