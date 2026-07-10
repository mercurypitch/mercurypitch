// ============================================================
// Voice Mirror — share card renderer ("your voice, mapped").
//
// Draws the singer's actual glide trace as an arc of stars on a
// deep-space gradient (x = time, y = pitch), qualifying sustained
// notes as brighter stars and the held note as a pulsar whose
// ring tightness reflects steadiness. Two formats: 1080×1920
// (stories) and 1080×1080. Shared via the Web Share API with a
// download fallback.
// ============================================================

import type { F0Frame, MirrorDelta, MirrorResult } from '@/lib/mirror/metrics'
import { centsToMidi, preprocess } from '@/lib/mirror/metrics'

export type CardFormat = 'story' | 'square'

export interface CardInput {
  result: MirrorResult
  /** Raw takes — the card plots the singer's actual trace. */
  glides: F0Frame[][]
  /** Optional returning-visit delta line, e.g. "▲ +2 semitones since 12 May". */
  deltaLine?: string | null
  /** Optional headline, e.g. a cosmic melody name. Drawn above the trace. */
  title?: string | null
  /** Famous-singer match. Left off the default (front) card so the reveal is a
   *  surprise; once revealed it appears as a "like <legend>" name pill. */
  legend?: string | null
  /** Pre-decoded twin portrait, drawn as the circular medallion beside the
   *  pills. An element (not a URL) so card building stays synchronous —
   *  Safari only honours clipboard writes that begin inside the tap. */
  legendImage?: CanvasImageSource | null
  /** Card option: draw the glide trace + pulsar (default true). */
  showTrace?: boolean
}

const FORMATS: Record<CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
}

/** Deterministic pseudo-random for the background starfield. */
function starRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32
    return state / 2 ** 32
  }
}

export function formatDeltaLine(delta: MirrorDelta, since: Date): string {
  const parts: string[] = []
  const arrow = (value: number): string => (value >= 0 ? '▲ +' : '▼ ')
  if (delta.semitones !== null && delta.semitones !== 0) {
    parts.push(`${arrow(delta.semitones)}${delta.semitones} semitones`)
  }
  if (delta.accuracy !== null && delta.accuracy !== 0) {
    parts.push(`accuracy ${delta.accuracy > 0 ? '+' : ''}${delta.accuracy}`)
  }
  if (delta.steadiness !== null && delta.steadiness !== 0) {
    parts.push(
      `steadiness ${delta.steadiness > 0 ? '+' : ''}${delta.steadiness}`,
    )
  }
  if (parts.length === 0) return ''
  const day = since.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
  return `${parts.join(' · ')} since ${day}`
}

export function renderCard(
  input: CardInput,
  format: CardFormat,
): HTMLCanvasElement {
  const { width, height } = FORMATS[format]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  drawBackground(ctx, width, height)

  const isStory = format === 'story'
  const traceTop = isStory ? height * 0.16 : height * 0.17
  const traceBottom = isStory ? height * 0.62 : height * 0.55
  drawDeltaBadge(ctx, input, width)
  if (input.showTrace !== false) {
    drawVoiceTrace(ctx, input, width, traceTop, traceBottom)
  }
  // The medallion layout shifts the stats column right — the footer follows
  // it so the whole bottom block reads as one centred unit.
  const statsCenterX = drawStats(
    ctx,
    input,
    width,
    height,
    traceBottom,
    isStory,
  )
  drawFooter(ctx, width, height, statsCenterX)

  return canvas
}

/** A four-point star (the theme's spark), drawn as a vector. */
function drawSpark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.save()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x + r * 0.14, y - r * 0.14, x + r, y)
  ctx.quadraticCurveTo(x + r * 0.14, y + r * 0.14, x, y + r)
  ctx.quadraticCurveTo(x - r * 0.14, y + r * 0.14, x - r, y)
  ctx.quadraticCurveTo(x - r * 0.14, y - r * 0.14, x, y - r)
  ctx.fill()
  ctx.restore()
}

/**
 * The revealed back face as a downloadable card — a pixel-faithful replica
 * of the on-screen reveal (mirror.css .mirror-card-back.has-image): the
 * portrait full-bleed at full opacity with a face-biased crop, the bottom
 * scrim, and the "your voice twin" caption. Square, like the card itself.
 * The glide trace is optional and OFF by default so the twin's face stays
 * clean; the small brand footer is the one addition (shares need a home).
 */
export function renderTwinFaceCard(input: {
  legend: string
  epithet: string
  voiceType: string | null
  legendImage: CanvasImageSource
  /** Draw the golden glide trace over the portrait (card option). */
  showTrace?: boolean
  /** Swap the "your voice twin" caption for the run's data block —
   *  range, accuracy · steadiness and the pills (card option). */
  showData?: boolean
  result?: MirrorResult
  glides?: F0Frame[][]
}): HTMLCanvasElement {
  const width = 1080
  const height = 1080
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  drawBackground(ctx, width, height)

  // Portrait: cover-fit, crop biased upward (object-position: center 18%).
  const portrait = input.legendImage
  const srcW =
    portrait instanceof HTMLImageElement
      ? portrait.naturalWidth
      : (portrait as HTMLCanvasElement).width
  const srcH =
    portrait instanceof HTMLImageElement
      ? portrait.naturalHeight
      : (portrait as HTMLCanvasElement).height
  if (srcW > 0 && srcH > 0) {
    const scale = Math.max(width / srcW, height / srcH)
    const dw = srcW * scale
    const dh = srcH * scale
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(portrait, (width - dw) / 2, -(dh - height) * 0.18, dw, dh)
  }

  // Bottom scrim — same stops as .mirror-back-scrim.
  const scrim = ctx.createLinearGradient(0, 0, 0, height)
  scrim.addColorStop(0, 'rgba(9, 7, 20, 0.14)')
  scrim.addColorStop(0.26, 'rgba(9, 7, 20, 0)')
  scrim.addColorStop(0.52, 'rgba(9, 7, 20, 0)')
  scrim.addColorStop(0.78, 'rgba(9, 7, 20, 0.62)')
  scrim.addColorStop(1, 'rgba(9, 7, 20, 0.92)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, width, height)

  // Optional glide trace over the portrait (default off — clean face).
  if (
    input.showTrace === true &&
    input.result !== undefined &&
    input.glides !== undefined
  ) {
    drawVoiceTrace(
      ctx,
      { result: input.result, glides: input.glides },
      width,
      height * 0.08,
      height * 0.52,
    )
  }

  ctx.textAlign = 'center'
  if (input.showData === true && input.result !== undefined) {
    // Data block instead of the caption: the run's numbers over the twin.
    const { range, accuracy, steadiness } = input.result
    let y = height - 322
    if (range !== null) {
      ctx.font = '700 72px system-ui, sans-serif'
      ctx.fillStyle = '#f4f0ff'
      ctx.fillText(`${range.lowNote} – ${range.highNote}`, width / 2, y)
      y += 58
      ctx.font = '600 38px system-ui, sans-serif'
      ctx.fillStyle = '#b9b3d6'
      ctx.fillText(`RANGE · ${range.semitones} SEMITONES`, width / 2, y)
      y += 62
    }
    const subStats: string[] = []
    if (accuracy !== null) subStats.push(`ACCURACY ${accuracy.score}`)
    if (steadiness !== null) subStats.push(`STEADINESS ${steadiness.score}`)
    if (subStats.length > 0) {
      ctx.font = '600 42px system-ui, sans-serif'
      ctx.fillStyle = '#ddd7f2'
      ctx.fillText(subStats.join('   ·   '), width / 2, y)
      y += 62
    }
    const voiceHint = range?.voiceHint ?? null
    if (voiceHint !== null) {
      drawPillRow(
        ctx,
        [voiceHint, `like ${input.legend}`],
        width / 2,
        y,
        32,
        0.9,
      )
    }
  } else {
    // Caption — the on-screen sizes scaled from the 500px card to 1080px.
    const kickerY = height - 296
    ctx.font = '600 24px system-ui, sans-serif'
    ctx.fillStyle = '#8fa3ff'
    const kicker = 'Y O U R   V O I C E   T W I N'
    ctx.fillText(kicker, width / 2, kickerY)
    const kickerHalf = ctx.measureText(kicker).width / 2 + 34
    drawSpark(ctx, width / 2 - kickerHalf, kickerY - 8, 11, '#8fa3ff')
    drawSpark(ctx, width / 2 + kickerHalf, kickerY - 8, 11, '#8fa3ff')

    ctx.font = '700 62px system-ui, sans-serif'
    ctx.fillStyle = '#ffe9a8'
    ctx.fillText(input.legend, width / 2, kickerY + 74)

    ctx.font = 'italic 500 33px system-ui, sans-serif'
    ctx.fillStyle = '#b9b3d6'
    ctx.fillText(input.epithet, width / 2, kickerY + 124)

    if (input.voiceType !== null) {
      ctx.font = '600 26px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(143, 163, 255, 0.8)'
      ctx.fillText(
        `${input.voiceType.toUpperCase()}   R A N G E`,
        width / 2,
        kickerY + 172,
      )
    }
  }

  // Small brand footer over the scrim — the one addition vs. the screen.
  ctx.font = '700 38px system-ui, sans-serif'
  const wordmark = 'MercuryPitch'
  const wmWidth = ctx.measureText(wordmark).width
  const wmY = height - 62
  const brand = ctx.createLinearGradient(
    width / 2 - wmWidth / 2,
    wmY - 32,
    width / 2 + wmWidth / 2,
    wmY,
  )
  brand.addColorStop(0, '#58a6ff')
  brand.addColorStop(1, '#bc8cff')
  ctx.fillStyle = brand
  ctx.fillText(wordmark, width / 2, wmY)
  ctx.font = '500 27px system-ui, sans-serif'
  ctx.fillStyle = '#9b93c0'
  ctx.fillText('mercurypitch.com/mirror', width / 2, height - 24)

  return canvas
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, '#0b1026')
  gradient.addColorStop(0.55, '#141033')
  gradient.addColorStop(1, '#090714')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const random = starRandom(9)
  for (let i = 0; i < 140; i++) {
    const x = random() * width
    const y = random() * height
    const r = 0.6 + random() * 1.4
    ctx.globalAlpha = 0.15 + random() * 0.4
    ctx.fillStyle = '#cdd6ff'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** The glide trace as an arc of stars; the held note as a pulsar. */
function drawVoiceTrace(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  width: number,
  top: number,
  bottom: number,
): void {
  const frames = input.glides.flatMap((glide, i) =>
    preprocess(glide).map((f) => ({ ...f, glideIndex: i })),
  )
  if (frames.length === 0) return

  const centsValues = frames.map((f) => f.cents)
  const minCents = Math.min(...centsValues) - 100
  const maxCents = Math.max(...centsValues) + 100
  const qualifying = new Set(input.result.range?.qualifyingMidis ?? [])
  const margin = width * 0.09

  // Glides are drawn sequentially left→right: up-glide then down-glide.
  const glideDurations = input.glides.map((g) =>
    g.length > 0 ? g[g.length - 1].t : 0,
  )
  const totalDuration = glideDurations.reduce((a, b) => a + b, 0) || 1

  const xFor = (frame: { t: number; glideIndex: number }): number => {
    const before = glideDurations
      .slice(0, frame.glideIndex)
      .reduce((a, b) => a + b, 0)
    return margin + ((before + frame.t) / totalDuration) * (width - 2 * margin)
  }
  const yFor = (cents: number): number =>
    bottom - ((cents - minCents) / (maxCents - minCents)) * (bottom - top)

  // Sample every few frames so the arc reads as stars, not a solid line.
  for (let i = 0; i < frames.length; i += 3) {
    const frame = frames[i]
    const isQualifying = qualifying.has(centsToMidi(frame.cents))
    ctx.globalAlpha = isQualifying ? 0.95 : 0.45
    ctx.fillStyle = isQualifying ? '#ffe9a8' : '#8fa3ff'
    ctx.shadowColor = isQualifying ? '#ffd24d' : '#5f79ff'
    ctx.shadowBlur = isQualifying ? 14 : 6
    ctx.beginPath()
    ctx.arc(
      xFor(frame),
      yFor(frame.cents),
      isQualifying ? 4.5 : 2.8,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.shadowBlur = 0
  ctx.globalAlpha = 1

  drawPulsar(ctx, input, width, top, bottom, yFor)
}

/** The held note: a pulsar whose ring tightness = steadiness. */
function drawPulsar(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  width: number,
  top: number,
  bottom: number,
  yFor: (cents: number) => number,
): void {
  const steadiness = input.result.steadiness
  if (!steadiness) return

  const x = width * 0.5
  const rawY = yFor(steadiness.referenceCents)
  const y = Math.min(bottom - 30, Math.max(top + 30, rawY))

  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = '#b9c6ff'
  ctx.shadowBlur = 26
  ctx.beginPath()
  ctx.arc(x, y, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // Tighter rings = steadier hold: ring spacing grows with wobble.
  const spread = 10 + Math.min(40, steadiness.wobbleSdCents)
  ctx.strokeStyle = '#a8b6ff'
  for (let ring = 1; ring <= 3; ring++) {
    ctx.globalAlpha = 0.5 / ring
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(x, y, 9 + ring * spread, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** Shrink-to-fit centered text line. */
function drawFittedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  y: number,
  baseFontSize: number,
  color: string,
): void {
  ctx.textAlign = 'center'
  fillFitted(ctx, text, 600, baseFontSize, color, width / 2, y, width - 120)
}

/** Headline (cosmic melody name) and/or returning-visit delta at the top. */
function drawDeltaBadge(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  width: number,
): void {
  const title = input.title ?? ''
  const delta = input.deltaLine ?? ''
  if (title !== '') {
    drawFittedLine(ctx, title, width, 96, 46, '#ffe9a8')
    if (delta !== '') drawFittedLine(ctx, delta, width, 152, 34, '#8be9b8')
    return
  }
  if (delta !== '') drawFittedLine(ctx, delta, width, 96, 40, '#8be9b8')
}

/** Fill a centred text line, shrinking the font if it exceeds maxWidth. */
function fillFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  px: number,
  color: string,
  cx: number,
  y: number,
  maxWidth: number,
): void {
  ctx.font = `${weight} ${Math.round(px)}px system-ui, sans-serif`
  const measured = ctx.measureText(text).width
  if (measured > maxWidth) {
    ctx.font = `${weight} ${Math.max(22, Math.floor((px * maxWidth) / measured))}px system-ui, sans-serif`
  }
  ctx.fillStyle = color
  ctx.fillText(text, cx, y)
}

/** Draws the stats block; returns the x the block is centred on (shifted
 *  right when the twin medallion occupies the bottom-left corner). */
function drawStats(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  width: number,
  height: number,
  traceBottom: number,
  isStory: boolean,
): number {
  const { range, accuracy, steadiness } = input.result
  // The square format has less vertical room between the trace and the
  // footer, so it uses a tighter scale to avoid colliding with the wordmark.
  const s = isStory ? 1 : 0.82
  const yStart = traceBottom + height * (isStory ? 0.09 : 0.075)

  const legend = input.legend ?? null
  const portrait = input.legendImage ?? null
  const voiceHint = range?.voiceHint ?? null
  const subStats: string[] = []
  if (accuracy) subStats.push(`ACCURACY ${accuracy.score}`)
  if (steadiness) subStats.push(`STEADINESS ${steadiness.score}`)

  // Pre-walk the rows so the medallion can be sized to span the whole block.
  let yEnd = yStart
  if (range) yEnd += (74 + 92) * s
  if (subStats.length > 0) yEnd += 96 * s
  const yPills = voiceHint !== null ? yEnd : null

  // Revealed twin: a large medallion anchored at the bottom left, spanning
  // the stat rows; the text re-centres on the remaining width. Big enough
  // that the face actually reads (the old inline circle was ~75 px).
  let centerX = width / 2
  let maxWidth = width - 120
  if (legend !== null && portrait !== null) {
    const marginX = 72
    const blockTop = yStart - 62 * s // cap height of the range line
    const blockBottom = (yPills ?? yEnd) + 34 * s // pill row half-height
    const radius = Math.min(
      150 * s,
      Math.max(96 * s, (blockBottom - blockTop) / 2),
    )
    drawMedallion(
      ctx,
      portrait,
      marginX + radius,
      (blockTop + blockBottom) / 2,
      radius,
    )
    const columnLeft = marginX + radius * 2 + 44 * s
    centerX = (columnLeft + (width - marginX)) / 2
    maxWidth = width - marginX - columnLeft
  }

  ctx.textAlign = 'center'
  let y = yStart
  if (range) {
    fillFitted(
      ctx,
      `${range.lowNote} – ${range.highNote}`,
      700,
      84 * s,
      '#f4f0ff',
      centerX,
      y,
      maxWidth,
    )
    y += 74 * s
    fillFitted(
      ctx,
      `RANGE · ${range.semitones} SEMITONES`,
      600,
      44 * s,
      '#b9b3d6',
      centerX,
      y,
      maxWidth,
    )
    y += 92 * s
  }

  if (subStats.length > 0) {
    fillFitted(
      ctx,
      subStats.join('   ·   '),
      600,
      48 * s,
      '#ddd7f2',
      centerX,
      y,
      maxWidth,
    )
    y += 96 * s
  }

  if (voiceHint !== null) {
    // The voice type stays on the card; the legend match is intentionally a
    // reveal (§ card declutter), so its name pill only appears when `legend`
    // is set. The backdrop variant (twin face card) already IS the portrait,
    // so it keeps the plain pill row.
    const pills = legend !== null ? [voiceHint, `like ${legend}`] : [voiceHint]
    drawPillRow(ctx, pills, centerX, y, Math.round(36 * s), s, maxWidth)
  }

  return centerX
}

/** Face-biased square crops of a portrait, progressively halved so the
 *  medallion never downscales more than 2× in one drawImage step (a single
 *  giant step — the 928px sources land at ~250px — goes muddy/aliased,
 *  especially outside Chromium). Keyed by portrait, bucketed by size. */
const medallionCache = new WeakMap<object, Map<number, HTMLCanvasElement>>()

function medallionBitmap(
  portrait: CanvasImageSource,
  diameter: number,
): CanvasImageSource {
  const srcW =
    portrait instanceof HTMLImageElement
      ? portrait.naturalWidth
      : (portrait as HTMLCanvasElement).width
  const srcH =
    portrait instanceof HTMLImageElement
      ? portrait.naturalHeight
      : (portrait as HTMLCanvasElement).height
  const side = Math.min(srcW, srcH)
  if (side <= 0) return portrait

  let targetW = side
  while (targetW / 2 >= diameter) targetW = Math.round(targetW / 2)

  let buckets = medallionCache.get(portrait as object)
  if (buckets === undefined) {
    buckets = new Map()
    medallionCache.set(portrait as object, buckets)
  }
  const hit = buckets.get(targetW)
  if (hit !== undefined) return hit

  // Square crop biased toward the top of the (4:5) portrait — the face.
  let scaled = document.createElement('canvas')
  scaled.width = side
  scaled.height = side
  scaled
    .getContext('2d')
    ?.drawImage(
      portrait,
      (srcW - side) / 2,
      Math.max(0, (srcH - side) / 4),
      side,
      side,
      0,
      0,
      side,
      side,
    )
  let w = side
  while (w > targetW) {
    const next = Math.max(targetW, Math.round(w / 2))
    const half = document.createElement('canvas')
    half.width = next
    half.height = next
    const hctx = half.getContext('2d')
    if (hctx === null) break
    hctx.imageSmoothingQuality = 'high'
    hctx.drawImage(scaled, 0, 0, w, w, 0, 0, next, next)
    scaled = half
    w = next
  }
  buckets.set(targetW, scaled)
  return scaled
}

/** Circular twin portrait with the card's gold ring, centred on (cx, cy). */
function drawMedallion(
  ctx: CanvasRenderingContext2D,
  portrait: CanvasImageSource,
  cx: number,
  cy: number,
  radius: number,
): void {
  const bitmap = medallionBitmap(portrait, radius * 2)
  const side =
    bitmap instanceof HTMLCanvasElement
      ? bitmap.width
      : Math.min(
          (bitmap as HTMLImageElement).naturalWidth,
          (bitmap as HTMLImageElement).naturalHeight,
        )
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    bitmap,
    0,
    0,
    side,
    side,
    cx - radius,
    cy - radius,
    radius * 2,
    radius * 2,
  )
  ctx.restore()

  // Gold ring with a soft glow, matching the card's star language.
  ctx.strokeStyle = 'rgba(255, 233, 168, 0.85)'
  ctx.lineWidth = 4
  ctx.shadowColor = 'rgba(255, 210, 120, 0.55)'
  ctx.shadowBlur = 18
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.shadowBlur = 0
}

/** Draw one or more rounded pills as a horizontal row centred on (cx, y),
 *  shrinking the font when the row would overflow maxWidth (the narrowed
 *  column beside the twin medallion — long legend names must fit). */
function drawPillRow(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  cx: number,
  y: number,
  fontSize: number,
  s: number,
  maxWidth = Infinity,
): void {
  ctx.textAlign = 'center'
  const padX = 34 * s
  const gap = 18 * s
  const h = 68 * s
  const measure = (px: number): number[] => {
    ctx.font = `500 ${px}px system-ui, sans-serif`
    return labels.map((t) => ctx.measureText(t).width + padX * 2)
  }
  const rowTotal = (w: number[]): number =>
    w.reduce((a, b) => a + b, 0) + gap * Math.max(0, labels.length - 1)
  let widths = measure(fontSize)
  if (rowTotal(widths) > maxWidth) {
    fontSize = Math.max(
      20,
      Math.floor((fontSize * maxWidth) / rowTotal(widths)),
    )
    widths = measure(fontSize)
  }
  const total = rowTotal(widths)
  let x = cx - total / 2
  for (let i = 0; i < labels.length; i++) {
    const w = widths[i]
    ctx.fillStyle = 'rgba(143, 163, 255, 0.16)'
    ctx.strokeStyle = 'rgba(143, 163, 255, 0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    // roundRect is missing on older Safari (< 16.4) — degrade to a rectangle
    // rather than throwing away the whole card.
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y - 46 * s, w, h, 34 * s)
    } else {
      ctx.rect(x, y - 46 * s, w, h)
    }
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#cfd6ff'
    ctx.fillText(labels[i], x + w / 2, y)
    x += w + gap
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cx: number = width / 2,
): void {
  ctx.textAlign = 'center'
  ctx.font = '700 46px system-ui, sans-serif'
  // Brand wordmark gradient — the app header's accent→purple (dark theme).
  // Keep in sync with --mirror-brand-a/-b in mirror.css.
  const wordmark = 'MercuryPitch'
  const wordmarkWidth = ctx.measureText(wordmark).width
  const y = height - 108
  const gradient = ctx.createLinearGradient(
    cx - wordmarkWidth / 2,
    y - 40,
    cx + wordmarkWidth / 2,
    y,
  )
  gradient.addColorStop(0, '#58a6ff')
  gradient.addColorStop(1, '#bc8cff')
  ctx.fillStyle = gradient
  ctx.fillText(wordmark, cx, y)
  ctx.font = '500 34px system-ui, sans-serif'
  ctx.fillStyle = '#9b93c0'
  ctx.fillText('mercurypitch.com/mirror', cx, height - 56)
}

export function cardToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Card export failed'))
    }, 'image/png')
  })
}

/** Append the local date (ISO, sortable) to a download name so a folder of
 *  voiceprints tracks progress chronologically — e.g. "voiceprint-2026-07-07.png". */
export function datedFilename(base: string): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${base}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.png`
}

/**
 * Share the card via the Web Share API (Level 2, files) when available,
 * otherwise trigger a plain download. Returns how it was delivered.
 */
export async function shareCard(
  blob: Blob,
  filename = 'voiceprint.png',
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const shareData: ShareData = {
    files: [file],
    title: 'My voiceprint',
    text: 'My voice, mapped — mercurypitch.com/mirror',
  }
  if (
    typeof navigator.canShare === 'function' &&
    navigator.canShare(shareData) &&
    typeof navigator.share === 'function'
  ) {
    try {
      await navigator.share(shareData)
      return 'shared'
    } catch {
      // User cancelled or share failed — fall through to download.
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

export type CopyOutcome = 'copied' | 'unsupported' | 'failed'

/** Whether the card can be copied here — the async Clipboard API with image
 *  write support (desktop Chrome / Edge / Safari, and Firefox 127+). Used to
 *  hide the copy button where it could only ever fail. */
export function supportsImageClipboard(): boolean {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  )
}

/**
 * Copy the card PNG to the clipboard. Pass the toBlob() promise straight in
 * (not an awaited Blob): Safari only honours a clipboard write that begins
 * synchronously inside the click gesture, and ClipboardItem accepts a
 * Promise<Blob> so the encode can still finish asynchronously.
 */
export async function copyCardToClipboard(
  blob: Blob | Promise<Blob>,
): Promise<CopyOutcome> {
  if (!supportsImageClipboard()) return 'unsupported'
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** User-facing status line for a copy attempt — shared across surfaces. */
export function copyOutcomeMessage(outcome: CopyOutcome): string {
  switch (outcome) {
    case 'copied':
      return 'Copied to clipboard!'
    case 'unsupported':
      return 'Copy not supported here — use Share.'
    default:
      return 'Copy failed — use Share instead.'
  }
}
