import { cardToPngBlob, datedFilename, shareCard, } from '@/features/mirror/card-renderer'

export type ProgressShareFormat = 'square' | 'feed' | 'story'

export interface ProgressShareFact {
  /** Short measured value, for example `4 weeks` or `91%`. */
  value: string
  /** Plain-language meaning, for example `in a row` or `accuracy`. */
  label: string
}

export interface ProgressPitchPoint {
  /** Elapsed seconds (or another consistent real time unit). */
  time: number
  /** Measured MIDI pitch. `null` marks an unvoiced gap. */
  pitch: number | null
}

export interface ProgressPitchTrace {
  /**
   * A real recorded trace. The renderer samples this to a bounded number of
   * canvas segments; it never synthesizes a replacement trace.
   */
  points: readonly ProgressPitchPoint[]
  /** Plain-language equivalent for the visual trace. */
  description: string
}

/**
 * Semantic share payload. Callers own the evidence and wording: this module
 * deliberately does not import private badge, grant, or aggregate engines.
 */
export interface ProgressShareMoment {
  claim: string
  facts: readonly ProgressShareFact[]
  context?: string | null
  period?: string | null
  /** Privacy-safe by omission. A handle is rendered only when supplied. */
  handle?: string | null
  /** Omit when there is no real saved trace; no placeholder graph is drawn. */
  trace?: ProgressPitchTrace | null
}

export interface ProgressShareAppearance {
  /** Optional same-origin production plate. The procedural fallback is safe. */
  backgroundUrl?: string | null
  /** Independent plate brightness control. `1` preserves source exposure. */
  backgroundExposure?: number
  /** Independent dark field behind live data. Range `0` to `1`. */
  dataScrimOpacity?: number
}

export type ProgressSharePlateLoader = (
  url: string,
) => Promise<HTMLImageElement | null>

export interface ProgressShareRenderOptions extends ProgressShareAppearance {
  /** Test/preview seam; production normally uses the built-in image loader. */
  loadPlate?: ProgressSharePlateLoader
}

export type ProgressShareOutcome =
  | 'shared'
  | 'downloaded'
  | 'dismissed'
  | 'failed'

/** Ready to bind to a role=status/alert live region in the share composer. */
export interface ProgressShareExportStatus {
  outcome: ProgressShareOutcome
  delivered: boolean
  isError: boolean
  role: 'status' | 'alert'
  live: 'polite' | 'assertive'
  message: string
}

export interface ProgressShareExportOptions {
  filename?: string
  title?: string
  text?: string
  /** Final privacy/lifecycle check immediately before native delivery. */
  shouldDeliver?: () => boolean
}

export const PROGRESS_SHARE_SIZES: Readonly<
  Record<ProgressShareFormat, { width: number; height: number }>
> = {
  square: { width: 1080, height: 1080 },
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
}

/** Current lead Pressing plate, optimized and published with the Progress route. */
export const MERCURY_PRESSING_PLATE_URL = '/progress/mercury-pressing.webp'

export const MERCURY_PRESSING_PLATE_URLS: Readonly<
  Record<ProgressShareFormat, string>
> = {
  square: MERCURY_PRESSING_PLATE_URL,
  feed: MERCURY_PRESSING_PLATE_URL,
  story: MERCURY_PRESSING_PLATE_URL,
}

export const DEFAULT_PROGRESS_SHARE_APPEARANCE = {
  backgroundExposure: 1.12,
  dataScrimOpacity: 0.62,
} as const

/** Canvas path work stays below this bound, irrespective of raw trace length. */
export const MAX_PROGRESS_SHARE_TRACE_POINTS = 360

interface Layout {
  width: number
  height: number
  side: number
  brandY: number
  kickerY: number
  titleY: number
  titleSize: number
  titleLineHeight: number
  titleLines: number
  trace: { x: number; y: number; width: number; height: number }
  factsY: number
  footerY: number
}

const LAYOUTS: Record<ProgressShareFormat, Layout> = {
  square: {
    width: 1080,
    height: 1080,
    side: 76,
    brandY: 74,
    kickerY: 142,
    titleY: 220,
    titleSize: 68,
    titleLineHeight: 76,
    titleLines: 3,
    trace: { x: 76, y: 500, width: 928, height: 190 },
    factsY: 754,
    footerY: 988,
  },
  feed: {
    width: 1080,
    height: 1350,
    side: 82,
    brandY: 88,
    kickerY: 172,
    titleY: 264,
    titleSize: 76,
    titleLineHeight: 84,
    titleLines: 3,
    trace: { x: 82, y: 620, width: 916, height: 248 },
    factsY: 970,
    footerY: 1250,
  },
  story: {
    width: 1080,
    height: 1920,
    side: 88,
    brandY: 152,
    kickerY: 252,
    titleY: 360,
    titleSize: 84,
    titleLineHeight: 94,
    titleLines: 4,
    trace: { x: 88, y: 850, width: 904, height: 340 },
    factsY: 1372,
    footerY: 1770,
  },
}

const COLOR = {
  ink: '#05070f',
  starlight: '#f4f2fb',
  chrome: '#a8afc4',
  quiet: '#7f879f',
  aqua: '#67e5da',
  blue: '#72a7ff',
  violet: '#b497ff',
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function cleanText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function loadPlate(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
}

function drawFallbackPlate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const ground = ctx.createLinearGradient(0, 0, width, height)
  ground.addColorStop(0, '#080a13')
  ground.addColorStop(0.46, '#0b1020')
  ground.addColorStop(1, '#03050b')
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, width, height)

  const edge = ctx.createLinearGradient(0, 0, width, 0)
  edge.addColorStop(0, 'rgba(78, 118, 191, 0.2)')
  edge.addColorStop(0.22, 'rgba(0, 0, 0, 0)')
  edge.addColorStop(0.8, 'rgba(0, 0, 0, 0)')
  edge.addColorStop(1, 'rgba(131, 91, 189, 0.16)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, width, height)

  // Neutral substrate grooves: fixed material marks, never user evidence.
  ctx.save()
  ctx.strokeStyle = 'rgba(222, 231, 255, 0.045)'
  ctx.lineWidth = 2
  const cx = width * 0.52
  const cy = height * 0.74
  const gap = Math.min(width, height) * 0.037
  for (let index = 0; index < 13; index += 1) {
    ctx.beginPath()
    ctx.arc(cx, cy, gap * (index + 2), Math.PI * 1.04, Math.PI * 1.95)
    ctx.stroke()
  }
  ctx.restore()
}

function drawPlateImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  layout: Layout,
  exposure: number,
): void {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (sourceWidth <= 0 || sourceHeight <= 0) return

  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = layout.width / layout.height
  let sx = 0
  let sy = 0
  let sw = sourceWidth
  let sh = sourceHeight
  if (sourceRatio > targetRatio) {
    sw = sourceHeight * targetRatio
    sx = (sourceWidth - sw) / 2
  } else {
    sh = sourceWidth / targetRatio
    sy = (sourceHeight - sh) / 2
  }

  ctx.save()
  ctx.filter = `brightness(${exposure})`
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, layout.width, layout.height)
  ctx.restore()
}

function drawDataScrim(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  opacity: number,
): void {
  const scrim = ctx.createLinearGradient(0, 0, 0, layout.height)
  scrim.addColorStop(0, `rgba(3, 5, 12, ${opacity * 0.84})`)
  scrim.addColorStop(0.34, `rgba(3, 5, 12, ${opacity * 0.68})`)
  scrim.addColorStop(0.68, `rgba(3, 5, 12, ${opacity * 0.38})`)
  scrim.addColorStop(1, `rgba(3, 5, 12, ${opacity * 0.78})`)
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, layout.width, layout.height)
}

function drawBrand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `650 ${size}px Outfit, Inter, system-ui, sans-serif`
  ctx.fillStyle = COLOR.starlight
  ctx.fillText('Mercury', x, y)
  const mercuryWidth = ctx.measureText('Mercury').width
  const pitchWidth = ctx.measureText('Pitch').width
  const gradient = ctx.createLinearGradient(
    x + mercuryWidth,
    y - size,
    x + mercuryWidth + pitchWidth,
    y,
  )
  gradient.addColorStop(0, COLOR.blue)
  gradient.addColorStop(0.52, COLOR.aqua)
  gradient.addColorStop(1, COLOR.violet)
  ctx.fillStyle = gradient
  ctx.fillText('Pitch', x + mercuryWidth, y)
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = cleanText(value).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let line = words[0]
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${line} ${words[index]}`
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
      continue
    }
    lines.push(line)
    line = words[index]
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines) lines.push(line)
  if (lines.length > maxLines) lines.length = maxLines

  const representedWords = lines.join(' ').split(/\s+/).length
  if (representedWords < words.length && lines.length > 0) {
    const lastIndex = lines.length - 1
    let last = lines[lastIndex]
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd()
    }
    lines[lastIndex] = `${last}…`
  }
  return lines
}

function fitTextSize(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  desired: number,
  minimum: number,
  weight = 650,
): number {
  let size = desired
  while (size > minimum) {
    ctx.font = `${weight} ${size}px Outfit, Inter, system-ui, sans-serif`
    if (ctx.measureText(value).width <= maxWidth) return size
    size -= 2
  }
  return minimum
}

function drawClaim(
  ctx: CanvasRenderingContext2D,
  moment: ProgressShareMoment,
  layout: Layout,
): void {
  ctx.textAlign = 'left'
  ctx.fillStyle = COLOR.blue
  ctx.font = '650 24px Inter, system-ui, sans-serif'
  ctx.fillText('O N E   M O M E N T', layout.side, layout.kickerY)

  ctx.fillStyle = COLOR.starlight
  ctx.font = `650 ${layout.titleSize}px Outfit, Inter, system-ui, sans-serif`
  const lines = wrapLines(
    ctx,
    moment.claim,
    layout.width - layout.side * 2,
    layout.titleLines,
  )
  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      layout.side,
      layout.titleY + index * layout.titleLineHeight,
    )
  })

  const context = cleanText(moment.context)
  if (context !== '') {
    const contextY =
      layout.titleY +
      Math.max(1, lines.length) * layout.titleLineHeight +
      (layout.height > 1400 ? 30 : 20)
    ctx.font = '500 28px Inter, system-ui, sans-serif'
    ctx.fillStyle = COLOR.chrome
    wrapLines(ctx, context, layout.width - layout.side * 2, 2).forEach(
      (line, index) => {
        ctx.fillText(line, layout.side, contextY + index * 36)
      },
    )
  }
}

interface SampledTracePoint {
  time: number
  pitch: number | null
}

/** Selects at most MAX_PROGRESS_SHARE_TRACE_POINTS without walking every raw frame. */
export function sampleProgressPitchTrace(
  points: readonly ProgressPitchPoint[],
): SampledTracePoint[] {
  const outputLength = Math.min(points.length, MAX_PROGRESS_SHARE_TRACE_POINTS)
  if (outputLength === 0) return []
  if (outputLength === 1) {
    const point = points[0]
    return Number.isFinite(point.time) &&
      (point.pitch === null || Number.isFinite(point.pitch))
      ? [point]
      : []
  }

  const sampled: SampledTracePoint[] = []
  let previousIndex = -1
  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = Math.round(
      (index * (points.length - 1)) / (outputLength - 1),
    )
    if (sourceIndex === previousIndex) continue
    previousIndex = sourceIndex
    const point = points[sourceIndex]
    if (!Number.isFinite(point.time)) continue
    if (point.pitch !== null && !Number.isFinite(point.pitch)) continue
    sampled.push(point)
  }
  return sampled
}

function drawableTrace(
  trace: ProgressPitchTrace | null | undefined,
): SampledTracePoint[] | null {
  if (trace === null || trace === undefined) return null
  const points = sampleProgressPitchTrace(trace.points)
  const voiced = points.filter(
    (point): point is { time: number; pitch: number } => point.pitch !== null,
  )
  if (voiced.length < 2) return null
  const timeMin = Math.min(...voiced.map((point) => point.time))
  const timeMax = Math.max(...voiced.map((point) => point.time))
  return timeMax > timeMin ? points : null
}

function drawPitchTrace(
  ctx: CanvasRenderingContext2D,
  trace: ProgressPitchTrace | null | undefined,
  layout: Layout,
): boolean {
  const points = drawableTrace(trace)
  if (points === null || trace === null || trace === undefined) return false

  const voiced = points.filter(
    (point): point is { time: number; pitch: number } => point.pitch !== null,
  )
  const timeMin = Math.min(...voiced.map((point) => point.time))
  const timeMax = Math.max(...voiced.map((point) => point.time))
  const rawPitchMin = Math.min(...voiced.map((point) => point.pitch))
  const rawPitchMax = Math.max(...voiced.map((point) => point.pitch))
  const pitchPadding = Math.max(0.75, (rawPitchMax - rawPitchMin) * 0.12)
  const pitchMin = rawPitchMin - pitchPadding
  const pitchMax = rawPitchMax + pitchPadding
  const { x, y, width, height } = layout.trace

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, width, height)
  ctx.clip()

  const makePath = (): void => {
    ctx.beginPath()
    let pathOpen = false
    for (const point of points) {
      if (point.pitch === null) {
        pathOpen = false
        continue
      }
      const px = x + ((point.time - timeMin) / (timeMax - timeMin)) * width
      const py =
        y + height - ((point.pitch - pitchMin) / (pitchMax - pitchMin)) * height
      if (pathOpen) ctx.lineTo(px, py)
      else {
        ctx.moveTo(px, py)
        pathOpen = true
      }
    }
  }

  makePath()
  ctx.strokeStyle = 'rgba(103, 229, 218, 0.28)'
  ctx.lineWidth = 14
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = COLOR.aqua
  ctx.shadowBlur = 26
  ctx.stroke()

  makePath()
  const traceGradient = ctx.createLinearGradient(x, y, x + width, y)
  traceGradient.addColorStop(0, COLOR.blue)
  traceGradient.addColorStop(0.5, COLOR.aqua)
  traceGradient.addColorStop(1, COLOR.violet)
  ctx.strokeStyle = traceGradient
  ctx.lineWidth = 4
  ctx.shadowBlur = 8
  ctx.stroke()
  ctx.restore()

  ctx.textAlign = 'left'
  ctx.font = '550 24px Inter, system-ui, sans-serif'
  ctx.fillStyle = COLOR.chrome
  const traceDescription = cleanText(trace.description)
  if (traceDescription !== '') {
    ctx.fillText(traceDescription, x, y - 24)
  }
  return true
}

function drawFacts(
  ctx: CanvasRenderingContext2D,
  facts: readonly ProgressShareFact[],
  layout: Layout,
): void {
  const visibleFacts = facts
    .filter(
      (fact) => cleanText(fact.value) !== '' && cleanText(fact.label) !== '',
    )
    .slice(0, 3)
  if (visibleFacts.length === 0) return

  const availableWidth = layout.width - layout.side * 2
  const gap = visibleFacts.length === 1 ? 0 : 34
  const columnWidth =
    (availableWidth - gap * (visibleFacts.length - 1)) / visibleFacts.length

  visibleFacts.forEach((fact, index) => {
    const x = layout.side + index * (columnWidth + gap)
    const value = cleanText(fact.value)
    const label = cleanText(fact.label)
    ctx.textAlign = 'left'
    const valueSize = fitTextSize(
      ctx,
      value,
      columnWidth,
      layout.height > 1400 ? 60 : 54,
      34,
      650,
    )
    ctx.font = `650 ${valueSize}px Outfit, Inter, system-ui, sans-serif`
    ctx.fillStyle = COLOR.starlight
    ctx.fillText(value, x, layout.factsY)
    ctx.font = '500 23px Inter, system-ui, sans-serif'
    ctx.fillStyle = COLOR.chrome
    wrapLines(ctx, label, columnWidth, 2).forEach((line, lineIndex) => {
      ctx.fillText(line, x, layout.factsY + 38 + lineIndex * 29)
    })
  })
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  moment: ProgressShareMoment,
  layout: Layout,
): void {
  const period = cleanText(moment.period)
  const handle = cleanText(moment.handle)
  const identityLine = [period, handle].filter(Boolean).join('  ·  ')
  if (identityLine !== '') {
    ctx.textAlign = 'left'
    ctx.font = '500 24px Inter, system-ui, sans-serif'
    ctx.fillStyle = COLOR.chrome
    ctx.fillText(identityLine, layout.side, layout.footerY - 48)
  }

  ctx.textAlign = 'left'
  ctx.font = '550 25px Inter, system-ui, sans-serif'
  ctx.fillStyle = COLOR.quiet
  ctx.fillText('mercurypitch.com/progress', layout.side, layout.footerY)
}

/**
 * Renders a format-specific card at export resolution. Missing/failed plate
 * artwork falls back to a deterministic dark pressing rather than failing the
 * share. No identity or pitch geometry is inferred.
 */
export async function renderProgressShareCard(
  moment: ProgressShareMoment,
  format: ProgressShareFormat,
  options: ProgressShareRenderOptions = {},
): Promise<HTMLCanvasElement> {
  const layout = LAYOUTS[format]
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', describeProgressShareMoment(moment))
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const exposure = clamp(
    options.backgroundExposure ??
      DEFAULT_PROGRESS_SHARE_APPEARANCE.backgroundExposure,
    0.4,
    1.8,
  )
  const scrimOpacity = clamp(
    options.dataScrimOpacity ??
      DEFAULT_PROGRESS_SHARE_APPEARANCE.dataScrimOpacity,
    0,
    1,
  )
  const backgroundUrl =
    options.backgroundUrl === undefined
      ? MERCURY_PRESSING_PLATE_URLS[format]
      : cleanText(options.backgroundUrl)
  const plate =
    backgroundUrl === ''
      ? null
      : await (options.loadPlate ?? loadPlate)(backgroundUrl).catch(() => null)

  drawFallbackPlate(ctx, layout.width, layout.height)
  if (plate !== null) drawPlateImage(ctx, plate, layout, exposure)
  drawDataScrim(ctx, layout, scrimOpacity)
  drawBrand(ctx, layout.side, layout.brandY, format === 'story' ? 38 : 34)
  drawClaim(ctx, moment, layout)
  drawPitchTrace(ctx, moment.trace, layout)
  drawFacts(ctx, moment.facts, layout)
  drawFooter(ctx, moment, layout)
  return canvas
}

/** Text counterpart for preview aria-labels and posting-copy affordances. */
export function describeProgressShareMoment(
  moment: ProgressShareMoment,
): string {
  const sections: string[] = []
  const claim = cleanText(moment.claim)
  if (claim !== '') sections.push(claim)
  const context = cleanText(moment.context)
  if (context !== '') sections.push(context)
  const facts = moment.facts
    .filter(
      (fact) => cleanText(fact.value) !== '' && cleanText(fact.label) !== '',
    )
    .slice(0, 3)
    .map((fact) => `${cleanText(fact.value)} ${cleanText(fact.label)}`)
  if (facts.length > 0) sections.push(facts.join(', '))
  if (drawableTrace(moment.trace) !== null) {
    const traceDescription = cleanText(moment.trace?.description)
    if (traceDescription !== '') sections.push(traceDescription)
  }
  const period = cleanText(moment.period)
  if (period !== '') sections.push(period)
  const handle = cleanText(moment.handle)
  if (handle !== '') sections.push(`Shared as ${handle}`)
  sections.push('MercuryPitch Progress')
  return sections.join('. ')
}

function statusFor(
  outcome: Exclude<ProgressShareOutcome, 'failed'>,
): ProgressShareExportStatus {
  if (outcome === 'shared') {
    return {
      outcome,
      delivered: true,
      isError: false,
      role: 'status',
      live: 'polite',
      message: 'Progress card shared.',
    }
  }
  if (outcome === 'downloaded') {
    return {
      outcome,
      delivered: true,
      isError: false,
      role: 'status',
      live: 'polite',
      message: 'Progress card downloaded.',
    }
  }
  return {
    outcome,
    delivered: false,
    isError: false,
    role: 'status',
    live: 'polite',
    message: 'Share sheet closed. Nothing was shared or downloaded.',
  }
}

const FAILED_STATUS: ProgressShareExportStatus = {
  outcome: 'failed',
  delivered: false,
  isError: true,
  role: 'alert',
  live: 'assertive',
  message: 'The progress card could not be exported. Please try again.',
}

export async function shareProgressCardBlob(
  blob: Blob,
  options: ProgressShareExportOptions = {},
): Promise<ProgressShareExportStatus> {
  if (options.shouldDeliver?.() === false) {
    return {
      ...statusFor('dismissed'),
      message: 'Progress card export cancelled.',
    }
  }
  try {
    const outcome = await shareCard(
      blob,
      options.filename ?? datedFilename('mercurypitch-progress'),
      {
        title: options.title ?? 'My MercuryPitch progress',
        text:
          options.text ??
          'One moment from my practice — mercurypitch.com/progress',
      },
    )
    return statusFor(outcome)
  } catch {
    return { ...FAILED_STATUS }
  }
}

/** Encodes and delivers a rendered card, preserving a non-error cancellation. */
export async function exportProgressShareCard(
  canvas: HTMLCanvasElement,
  options: ProgressShareExportOptions = {},
): Promise<ProgressShareExportStatus> {
  try {
    const blob = await cardToPngBlob(canvas)
    return await shareProgressCardBlob(blob, options)
  } catch {
    return { ...FAILED_STATUS }
  }
}
