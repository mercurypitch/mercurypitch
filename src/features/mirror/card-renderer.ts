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
  /** Raw glide takes — the card plots the singer's actual trace. */
  glides: F0Frame[][]
  /** Optional returning-visit delta line, e.g. "▲ +2 semitones since 12 May". */
  deltaLine?: string | null
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
  drawVoiceTrace(ctx, input, width, traceTop, traceBottom)
  drawStats(ctx, input, width, height, traceBottom, isStory)
  drawFooter(ctx, width, height)

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

/** Returning-visit delta as a badge at the top of the card. */
function drawDeltaBadge(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  width: number,
): void {
  const line = input.deltaLine ?? ''
  if (line === '') return
  ctx.textAlign = 'center'
  // Shrink-to-fit: a three-part delta line can outgrow the card width.
  let fontSize = 40
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`
  const maxWidth = width - 120
  const measured = ctx.measureText(line).width
  if (measured > maxWidth) {
    fontSize = Math.max(24, Math.floor((fontSize * maxWidth) / measured))
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`
  }
  ctx.fillStyle = '#8be9b8'
  ctx.fillText(line, width / 2, 96)
}

function drawStats(
  ctx: CanvasRenderingContext2D,
  input: CardInput,
  width: number,
  height: number,
  traceBottom: number,
  isStory: boolean,
): void {
  const { range, accuracy, steadiness } = input.result
  const centerX = width / 2
  // The square format has less vertical room between the trace and the
  // footer, so it uses a tighter scale to avoid colliding with the wordmark.
  const s = isStory ? 1 : 0.82
  let y = traceBottom + height * (isStory ? 0.09 : 0.075)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f4f0ff'

  if (range) {
    ctx.font = `700 ${Math.round(84 * s)}px system-ui, sans-serif`
    ctx.fillText(`${range.lowNote} – ${range.highNote}`, centerX, y)
    y += 74 * s
    ctx.font = `600 ${Math.round(44 * s)}px system-ui, sans-serif`
    ctx.fillStyle = '#b9b3d6'
    ctx.fillText(`RANGE · ${range.semitones} SEMITONES`, centerX, y)
    y += 92 * s
  }

  const subStats: string[] = []
  if (accuracy) subStats.push(`ACCURACY ${accuracy.score}`)
  if (steadiness) subStats.push(`STEADINESS ${steadiness.score}`)
  if (subStats.length > 0) {
    ctx.font = `600 ${Math.round(48 * s)}px system-ui, sans-serif`
    ctx.fillStyle = '#ddd7f2'
    ctx.fillText(subStats.join('   ·   '), centerX, y)
    y += 96 * s
  }

  const voiceHint = range?.voiceHint ?? null
  if (voiceHint !== null) {
    const chip = `overlaps most with: ${voiceHint}`
    ctx.font = `500 ${Math.round(36 * s)}px system-ui, sans-serif`
    const chipWidth = ctx.measureText(chip).width + 72 * s
    ctx.fillStyle = 'rgba(143, 163, 255, 0.16)'
    ctx.strokeStyle = 'rgba(143, 163, 255, 0.55)'
    ctx.lineWidth = 2
    ctx.beginPath()
    // roundRect is missing on older Safari (< 16.4) — the chip degrades to a
    // plain rectangle there rather than throwing away the whole card.
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(
        centerX - chipWidth / 2,
        y - 46 * s,
        chipWidth,
        68 * s,
        34 * s,
      )
    } else {
      ctx.rect(centerX - chipWidth / 2, y - 46 * s, chipWidth, 68 * s)
    }
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#cfd6ff'
    ctx.fillText(chip, centerX, y)
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.textAlign = 'center'
  ctx.font = '700 46px system-ui, sans-serif'
  // Brand wordmark gradient — the app header's accent→purple (dark theme).
  // Keep in sync with --mirror-brand-a/-b in mirror.css.
  const wordmark = 'MercuryPitch'
  const wordmarkWidth = ctx.measureText(wordmark).width
  const y = height - 108
  const gradient = ctx.createLinearGradient(
    width / 2 - wordmarkWidth / 2,
    y - 40,
    width / 2 + wordmarkWidth / 2,
    y,
  )
  gradient.addColorStop(0, '#58a6ff')
  gradient.addColorStop(1, '#bc8cff')
  ctx.fillStyle = gradient
  ctx.fillText(wordmark, width / 2, y)
  ctx.font = '500 34px system-ui, sans-serif'
  ctx.fillStyle = '#9b93c0'
  ctx.fillText('mercurypitch.com/mirror', width / 2, height - 56)
}

export function cardToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Card export failed'))
    }, 'image/png')
  })
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
