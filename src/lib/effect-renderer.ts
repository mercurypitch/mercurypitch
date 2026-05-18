// ============================================================
// Shared Effect Renderer
// Pure canvas drawing functions for slide, ease, and vibrato
// effects. Used by both PianoRoll and PitchCanvas so effect
// visuals are consistent everywhere.
//
// All functions take pixel coordinates — callers compute
// positions using their own coordinate systems before calling.
// ============================================================

export interface SlideShapeParams {
  ctx: CanvasRenderingContext2D
  /** Left edge X */
  x: number
  /** Source pitch center Y */
  srcCY: number
  /** Target pitch center Y */
  tgtCY: number
  /** Width in pixels */
  w: number
  /** Half-height of the ribbon */
  halfH: number
  /** Fill color (defaults to amber for slides) */
  fillColor?: string
  /** Stroke color */
  strokeColor?: string
  /** Stroke width */
  strokeWidth?: number
}

/** Default colors for slide shapes */
export const SLIDE_FILL = 'rgba(255, 170, 40, 0.88)'
export const SLIDE_STROKE = 'rgba(255, 200, 80, 0.75)'
export const SLIDE_PROGRESS_FILL = 'rgba(63, 185, 80, 0.45)'

/** Build the S-shape bezier path. Does NOT call ctx.beginPath() first
 *  so callers can optionally clip or combine with other paths. */
export function slideShapePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  w: number,
  srcCY: number,
  tgtCY: number,
  halfH: number,
): void {
  const cp1x = x + w * 0.3
  const cp2x = x + w * 0.7
  ctx.moveTo(x, srcCY - halfH)
  ctx.bezierCurveTo(cp1x, srcCY - halfH, cp2x, tgtCY - halfH, x + w, tgtCY - halfH)
  ctx.lineTo(x + w, tgtCY + halfH)
  ctx.bezierCurveTo(cp2x, tgtCY + halfH, cp1x, srcCY + halfH, x, srcCY + halfH)
  ctx.closePath()
}

/** Draw a filled and stroked S-shape slide ribbon. */
export function drawSlideShape(params: SlideShapeParams): void {
  const {
    ctx,
    x,
    srcCY,
    tgtCY,
    w,
    halfH,
    fillColor = SLIDE_FILL,
    strokeColor = SLIDE_STROKE,
    strokeWidth = 1.25,
  } = params

  ctx.beginPath()
  slideShapePath(ctx, x, w, srcCY, tgtCY, halfH)
  ctx.fillStyle = fillColor
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.stroke()
}

export interface SlideProgressParams extends SlideShapeParams {
  /** Progress fraction 0..1 */
  progress: number
  /** Full canvas height for the clip region */
  clipHeight: number
  /** Override progress fill color */
  progressFill?: string
}

/** Draw a progress overlay on top of an already-drawn slide shape.
 *  Clips to the left portion (0..progress) and redraws the shape
 *  with a brighter fill. */
export function drawSlideProgress(params: SlideProgressParams): void {
  const {
    ctx,
    x,
    srcCY,
    tgtCY,
    w,
    halfH,
    progress,
    clipHeight,
    progressFill = SLIDE_PROGRESS_FILL,
  } = params

  if (progress <= 0) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, 0, w * progress, clipHeight)
  ctx.clip()

  ctx.beginPath()
  slideShapePath(ctx, x, w, srcCY, tgtCY, halfH)
  ctx.fillStyle = progressFill
  ctx.fill()
  ctx.restore()
}

export interface VibratoWaveParams {
  ctx: CanvasRenderingContext2D
  /** Left edge X */
  x: number
  /** Top edge Y for the note block */
  y: number
  /** Width in pixels */
  w: number
  /** Wave amplitude (default 2.5) */
  amplitude?: number
  /** Wave color */
  color?: string
  /** Line width */
  lineWidth?: number
}

/** Draw a wavy line along the top edge of a vibrato note. */
export function drawVibratoWave(params: VibratoWaveParams): void {
  const {
    ctx,
    x,
    y,
    w,
    amplitude = 2.5,
    color = 'rgba(255, 255, 255, 0.6)',
    lineWidth = 1.5,
  } = params

  if (w < 14) return

  const wavePeriod = w / 3
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  for (let wx = 0; wx <= w; wx++) {
    const wy = y + 2 + Math.sin((wx / wavePeriod) * Math.PI * 2) * amplitude
    if (wx === 0) ctx.moveTo(x + wx, wy)
    else ctx.lineTo(x + wx, wy)
  }
  ctx.stroke()
}

export interface EffectBadgeParams {
  ctx: CanvasRenderingContext2D
  /** Right edge X of the note block */
  x: number
  /** Top edge Y of the note block */
  y: number
  /** Effect type */
  effectType: string
  /** Signed semitone interval (for slides/ease) */
  slideInterval?: number
}

/** Draw a small colored circle badge indicating the effect type,
 *  plus the slide interval text if applicable. */
export function drawEffectBadge(params: EffectBadgeParams): void {
  const { ctx, x, y, effectType, slideInterval } = params

  const badgeColor =
    effectType === 'vibrato'
      ? '#ff6b6b'
      : effectType === 'slide-up' || effectType === 'slide-down'
        ? '#4ecdc4'
        : '#ffe66d'

  ctx.fillStyle = badgeColor
  ctx.beginPath()
  ctx.arc(x - 5, y + 5, 3, 0, Math.PI * 2)
  ctx.fill()

  if (slideInterval !== undefined) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = 'bold 7px sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    const sign = slideInterval > 0 ? '+' : ''
    ctx.fillText(sign + slideInterval, x - 9, y + 2)
  }
}
