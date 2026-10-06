// Runner notation ink — glyph-local outlines preserve contrast without covering the glass aperture.

export function drawRunnerNotationText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void {
  context.save()
  context.strokeStyle = '#143b3d'
  context.lineWidth = 4
  context.lineJoin = 'round'
  context.strokeText(text, x, y)
  context.restore()
  context.fillText(text, x, y)
}
