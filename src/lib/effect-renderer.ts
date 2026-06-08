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

/** Default colors for vibrato shapes */
export const VIBRATO_FILL = 'rgba(255, 107, 107, 0.72)'
export const VIBRATO_STROKE = 'rgba(255, 140, 140, 0.8)'

/** Default colors for tremolo shapes */
export const TREMOLO_FILL = 'rgba(147, 112, 219, 0.65)'
export const TREMOLO_STROKE = 'rgba(180, 150, 240, 0.7)'

/** Default colors for trill shapes */
export const TRILL_FILL = 'rgba(255, 140, 0, 0.65)'
export const TRILL_STROKE = 'rgba(255, 180, 60, 0.7)'

/** Default colors for staccato shapes */
export const STACCATO_FILL = 'rgba(70, 130, 200, 0.65)'
export const STACCATO_STROKE = 'rgba(100, 160, 230, 0.7)'

/** Default colors for chord shapes */
export const CHORD_FILL = 'rgba(34, 197, 94, 0.72)'
export const CHORD_STROKE = 'rgba(74, 222, 128, 0.8)'

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
  ctx.bezierCurveTo(
    cp1x,
    srcCY - halfH,
    cp2x,
    tgtCY - halfH,
    x + w,
    tgtCY - halfH,
  )
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

export interface TrillProgressParams {
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
  /** Progress fraction 0..1 */
  progress: number
  /** Full canvas height for the clip region */
  clipHeight: number
  /** Override progress fill color */
  progressFill?: string
}

/** Draw a progress overlay on top of an already-drawn trill zigzag shape.
 *  Clips to the left portion (0..progress) and redraws the trill shape
 *  with a brighter fill. */
export function drawTrillProgress(params: TrillProgressParams): void {
  const {
    ctx,
    x,
    srcCY,
    tgtCY,
    w,
    halfH,
    progress,
    clipHeight,
    progressFill = 'rgba(255, 200, 100, 0.35)',
  } = params

  if (progress <= 0) return

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, 0, w * progress, clipHeight)
  ctx.clip()

  ctx.beginPath()
  trillShapePath(ctx, x, w, srcCY, tgtCY, halfH)
  ctx.fillStyle = progressFill
  ctx.fill()
  ctx.restore()
}

export interface VibratoShapeParams {
  ctx: CanvasRenderingContext2D
  /** Left edge X */
  x: number
  /** Center Y of the note */
  y: number
  /** Width in pixels */
  w: number
  /** Half-height of the ribbon */
  halfH: number
  /** Wave amplitude factor (default 0.65). Scaled by vibratoAmplitude from data model. */
  amplitudeFactor?: number
  /** Fill color */
  fillColor?: string
  /** Stroke color */
  strokeColor?: string
  /** Stroke width */
  strokeWidth?: number
}

/** Build a wavy sine-wave ribbon path for vibrato notes.
 *  Does NOT call ctx.beginPath() first so callers can combine paths. */
export function vibratoShapePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  halfH: number,
  amplitudeFactor = 0.65,
): void {
  if (w < 4) return
  const amplitude = halfH * amplitudeFactor
  const periods = Math.max(1, Math.floor(w / 22))
  const periodPx = w / periods

  // Top edge: sine wave
  for (let i = 0; i <= w; i++) {
    const wy = y - halfH + Math.sin((i / periodPx) * Math.PI * 2) * amplitude
    if (i === 0) ctx.moveTo(x + i, wy)
    else ctx.lineTo(x + i, wy)
  }
  // Bottom edge: sine wave (same phase as top)
  for (let i = w; i >= 0; i--) {
    const wy = y + halfH + Math.sin((i / periodPx) * Math.PI * 2) * amplitude
    ctx.lineTo(x + i, wy)
  }
  ctx.closePath()
}

/** Draw a filled and stroked vibrato sine-wave ribbon. */
export function drawVibratoShape(params: VibratoShapeParams): void {
  const {
    ctx,
    x,
    y,
    w,
    halfH,
    amplitudeFactor = 0.65,
    fillColor = VIBRATO_FILL,
    strokeColor = VIBRATO_STROKE,
    strokeWidth = 1.25,
  } = params

  if (w < 4) return

  ctx.beginPath()
  vibratoShapePath(ctx, x, y, w, halfH, amplitudeFactor)
  ctx.fillStyle = fillColor
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.stroke()
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

export interface TremoloShapeParams {
  ctx: CanvasRenderingContext2D
  /** Left edge X */
  x: number
  /** Center Y of the note */
  y: number
  /** Width in pixels */
  w: number
  /** Half-height of the ribbon */
  halfH: number
  /** Tremolo LFO rate in Hz (default 8) */
  rate?: number
  /** Tremolo depth 0-1 (default 0.5) */
  depth?: number
  /** Fill color */
  fillColor?: string
  /** Stroke color */
  strokeColor?: string
  /** Stroke width */
  strokeWidth?: number
}

/** Draw a tremolo note as a block with horizontal opacity bands
 *  that suggest amplitude pulsation. Band count scales with rate,
 *  opacity scales with depth. */
export function drawTremoloShape(params: TremoloShapeParams): void {
  const {
    ctx,
    x,
    y,
    w,
    halfH,
    rate = 8,
    depth = 0.5,
    fillColor = TREMOLO_FILL,
    strokeColor = TREMOLO_STROKE,
    strokeWidth = 1.25,
  } = params

  if (w < 4) return

  // Base rectangle with rounded corners
  const radius = Math.min(3, w / 3, halfH / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y - halfH)
  ctx.lineTo(x + w - radius, y - halfH)
  ctx.arcTo(x + w, y - halfH, x + w, y - halfH + radius, radius)
  ctx.lineTo(x + w, y + halfH - radius)
  ctx.arcTo(x + w, y + halfH, x + w - radius, y + halfH, radius)
  ctx.lineTo(x + radius, y + halfH)
  ctx.arcTo(x, y + halfH, x, y + halfH - radius, radius)
  ctx.lineTo(x, y - halfH + radius)
  ctx.arcTo(x, y - halfH, x + radius, y - halfH, radius)
  ctx.closePath()
  ctx.fillStyle = fillColor
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.stroke()

  // Horizontal bands suggesting tremolo pulsation
  const bandCount = Math.max(2, Math.round((w * rate) / 60))
  const bandW = w / bandCount
  const alpha = Math.max(0.05, Math.min(0.45, depth * 0.6))
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
  for (let i = 0; i < bandCount; i += 2) {
    ctx.fillRect(x + i * bandW, y - halfH + 2, bandW, halfH * 2 - 4)
  }
}

export interface TrillShapeParams {
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
  /** Fill color */
  fillColor?: string
  /** Stroke color */
  strokeColor?: string
  /** Stroke width */
  strokeWidth?: number
}

/** Build a sharp zigzag/square-wave ribbon path for trill notes.
 *  Alternates vertically between src and tgt pitch positions. */
export function trillShapePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  w: number,
  srcCY: number,
  tgtCY: number,
  halfH: number,
): void {
  const segments = Math.max(2, Math.floor(w / 8))
  const segW = w / segments

  // Top edge: square wave
  for (let i = 0; i <= segments; i++) {
    const wx = x + i * segW
    const wy = i % 2 === 0 ? srcCY - halfH : tgtCY - halfH
    if (i === 0) ctx.moveTo(wx, wy)
    else ctx.lineTo(wx, wy)
  }
  // Right edge down
  ctx.lineTo(x + w, (segments % 2 === 0 ? tgtCY : srcCY) + halfH)
  // Bottom edge: square wave (reverse)
  for (let i = segments; i >= 0; i--) {
    const wx = x + i * segW
    const wy = i % 2 === 0 ? srcCY + halfH : tgtCY + halfH
    ctx.lineTo(wx, wy)
  }
  ctx.closePath()
}

/** Draw a filled and stroked trill zigzag ribbon. */
export function drawTrillShape(params: TrillShapeParams): void {
  const {
    ctx,
    x,
    srcCY,
    tgtCY,
    w,
    halfH,
    fillColor = TRILL_FILL,
    strokeColor = TRILL_STROKE,
    strokeWidth = 1.25,
  } = params

  if (w < 4) return

  ctx.beginPath()
  trillShapePath(ctx, x, w, srcCY, tgtCY, halfH)
  ctx.fillStyle = fillColor
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.stroke()
}

export interface StaccatoShapeParams {
  ctx: CanvasRenderingContext2D
  /** Left edge X */
  x: number
  /** Center Y of the note */
  y: number
  /** Full width in pixels (will be shortened by ratio) */
  w: number
  /** Half-height of the ribbon */
  halfH: number
  /** Duration ratio (0.1-0.8), defaults to 0.4 */
  ratio?: number
  /** Fill color */
  fillColor?: string
  /** Stroke color */
  strokeColor?: string
  /** Stroke width */
  strokeWidth?: number
}

/** Draw a staccato note at reduced width with a sharp cutoff edge. */
export function drawStaccatoShape(params: StaccatoShapeParams): void {
  const {
    ctx,
    x,
    y,
    w,
    halfH,
    ratio = 0.4,
    fillColor = STACCATO_FILL,
    strokeColor = STACCATO_STROKE,
    strokeWidth = 1.25,
  } = params

  const shortW = Math.max(4, w * ratio)

  if (shortW < 2) return

  // Rounded left edge, sharp right edge for cutoff look
  const radius = Math.min(3, shortW / 3, halfH / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y - halfH)
  ctx.lineTo(x + shortW, y - halfH)
  ctx.lineTo(x + shortW, y + halfH)
  ctx.lineTo(x + radius, y + halfH)
  ctx.arcTo(x, y + halfH, x, y + halfH - radius, radius)
  ctx.lineTo(x, y - halfH + radius)
  ctx.arcTo(x, y - halfH, x + radius, y - halfH, radius)
  ctx.closePath()
  ctx.fillStyle = fillColor
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = strokeWidth
  ctx.stroke()

  // Draw a thin vertical line at the cutoff point to emphasize the staccato
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + shortW, y - halfH)
  ctx.lineTo(x + shortW, y + halfH)
  ctx.stroke()
}

export interface ChordShapeParams {
  ctx: CanvasRenderingContext2D
  /** Left edge X */
  x: number
  /** Center Y of the root note */
  y: number
  /** Width in pixels */
  w: number
  /** Half-height of the note block */
  halfH: number
  /** Chord semitone intervals above root (e.g. [0,4,7] for major) */
  intervals: number[]
  /** Root MIDI note number */
  rootMidi: number
  /** Function mapping a MIDI note to Y pixel position */
  midiToY: (midi: number) => number
}

/** Draw small filled circles indicating chord member pitches above the
 *  root note. The root note itself is drawn at full height, and additional
 *  chord members appear as dots at their respective pitch positions. */
export function drawChordShape(params: ChordShapeParams): void {
  const { ctx, x, w, halfH, intervals, rootMidi, midiToY } = params

  if (intervals.length === 0) return

  const radius = Math.min(3, w / 4, halfH / 2)
  const cx = x + w / 2

  for (const interval of intervals) {
    const memberY = midiToY(rootMidi + interval)
    ctx.beginPath()
    ctx.arc(cx, memberY, radius, 0, Math.PI * 2)
    ctx.fillStyle = CHORD_FILL
    ctx.fill()
    ctx.strokeStyle = CHORD_STROKE
    ctx.lineWidth = 1
    ctx.stroke()
  }
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
        : effectType === 'tremolo'
          ? '#9370db'
          : effectType === 'trill'
            ? '#ff8c00'
            : effectType === 'staccato'
              ? '#4682b4'
              : effectType === 'chord'
                ? '#22c55e'
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
