// ============================================================
// TV stage lane paint — the lane's glass, as sprites
// ============================================================
//
// What the lane is made of, painted once per screen size (sprites.ts): the
// glass panel the notes run across, after the phone's ribbon (a softly lit
// violet glass with a fine edge and a shadow under it), the notes in yellow
// glass (a gradient body, a specular highlight along the top, light caught
// in the bottom edge, a rim, a gentle shadow and a warm glow) and the same
// note lit while it is sung on pitch, the singer's glowing dot in each of
// the ribbon's colours, the now marker's beam, the chip that names the note
// under it, and a soft light behind the panel.
//
// Sizes are in units of 1080 lines, so a 4K screen gets the same glass at
// twice the pixels. A note is painted as a short capsule and stretched to
// any length in three slices: its two rounded ends as they are, and its
// middle, which is the same all along, stretched between them.
//
// Tests: src/lib/tv-stage/lane.test.ts draws through these on a recording
// context.

import type { Verdict } from './lane-judge'
import type { CapsuleSprite, Sprite, SpriteCache } from './sprites'
import { horizontalGradient, roundedPath, verticalGradient } from './sprites'

/** The ribbon's colours for the singer: on the note, off it, and free. */
export const VERDICT_COLORS: Record<
  Verdict,
  { readonly glow: string; readonly core: string }
> = {
  hit: { glow: '110, 231, 183', core: '220, 252, 236' },
  off: { glow: '251, 113, 133', core: '255, 222, 228' },
  free: { glow: '196, 181, 253', core: '240, 235, 255' },
}

/** The panel's corner, in units of 1080 lines. */
const PANEL_RADIUS = 30

/**
 * The panel's glass, top to bottom: deep violet, lighter where the light
 * falls. Opaque, so the fog at its ends (fogSprite) can match it exactly.
 */
const PANEL_GLASS: readonly (readonly [number, string])[] = [
  [0, 'rgb(38, 29, 62)'],
  [0.4, 'rgb(24, 18, 42)'],
  [1, 'rgb(13, 10, 24)'],
]

/** How far the panel's shadow reaches below it, in units. */
const PANEL_SHADOW = 84

/** A note's height and the room its glow takes around it, in units. */
const NOTE_HEIGHT = 30
const NOTE_PAD = 24

/** The width of a note sprite's middle, the slice that stretches, in pixels. */
const NOTE_MIDDLE = 6

/**
 * The looks of a note: yellow glass ahead of the marker; lit, where it was
 * sung on pitch; and once it has gone by unsung, an empty tube of glass.
 */
export type NoteLook = 'glass' | 'lit' | 'past'

const NOTE_LOOKS: Record<
  NoteLook,
  {
    readonly body: readonly (readonly [number, string])[]
    readonly glow: string
    readonly glowBlur: number
    readonly shine: number
  }
> = {
  glass: {
    body: [
      [0, '#fff3c4'],
      [0.16, '#ffdc72'],
      [0.55, '#ffbd2c'],
      [0.82, '#f0a114'],
      [1, '#c97806'],
    ],
    glow: 'rgba(255, 176, 36, 0.38)',
    glowBlur: 16,
    shine: 0.9,
  },
  lit: {
    body: [
      [0, '#ffffff'],
      [0.22, '#fff6cf'],
      [0.6, '#ffdc66'],
      [1, '#ffae16'],
    ],
    glow: 'rgba(255, 210, 84, 1)',
    glowBlur: 26,
    shine: 1,
  },
  past: {
    body: [
      [0, 'rgba(255, 236, 190, 0.1)'],
      [1, 'rgba(255, 214, 140, 0.05)'],
    ],
    glow: 'rgba(0, 0, 0, 0)',
    glowBlur: 0,
    shine: 0.22,
  },
}

/** Whole pixels for `units` at `unit` pixels per unit, at least `least`. */
const px = (units: number, unit: number, least = 1): number =>
  Math.max(least, Math.round(units * unit))

/** The glass panel the lane runs across, `w` by `h` pixels, with its shadow below. */
export function panelSprite(
  sprites: SpriteCache,
  size: { readonly w: number; readonly h: number; readonly unit: number },
  nowRatio: number,
): Sprite | null {
  const w = Math.round(size.w)
  const h = Math.round(size.h)
  const shadow = px(PANEL_SHADOW, size.unit)
  return sprites.get(
    `panel:${String(w)}x${String(h)}`,
    { width: w, height: h + shadow },
    (ctx) => {
      paintPanel(ctx, { w, h, unit: size.unit }, nowRatio)
    },
  )
}

function paintPanel(
  ctx: CanvasRenderingContext2D,
  size: { readonly w: number; readonly h: number; readonly unit: number },
  nowRatio: number,
): void {
  const { w, h, unit } = size
  const radius = px(PANEL_RADIUS, unit)
  const box = { x: 0, y: 0, w, h }
  // The shadow, cast by a shape narrower than the panel so that none of it
  // reaches past the panel's sides, which are the overscan margin's.
  const inset = px(56, unit)
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
  ctx.shadowBlur = px(40, unit)
  ctx.shadowOffsetY = px(26, unit)
  roundedPath(
    ctx,
    { x: inset, y: h * 0.3, w: w - inset * 2, h: h * 0.7 },
    radius,
  )
  ctx.fillStyle = 'rgba(0, 0, 0, 1)'
  ctx.fill()
  ctx.restore()
  // The shape that cast it goes, and so does the shadow under the glass:
  // the glass lets a little through, and must not show a shadow inside.
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  roundedPath(ctx, box, radius)
  ctx.fill()
  ctx.restore()
  // The glass: deep violet, lighter at the top where the light falls.
  roundedPath(ctx, box, radius)
  ctx.fillStyle = verticalGradient(ctx, 0, h, PANEL_GLASS)
  ctx.fill()
  paintPanelLight(ctx, size, nowRatio)
}

/** The panel's light: the sheen, the past's shade, the edge and its catchlight. */
function paintPanelLight(
  ctx: CanvasRenderingContext2D,
  size: { readonly w: number; readonly h: number; readonly unit: number },
  nowRatio: number,
): void {
  const { w, h, unit } = size
  const radius = px(PANEL_RADIUS, unit)
  const box = { x: 0, y: 0, w, h }
  ctx.save()
  roundedPath(ctx, box, radius)
  ctx.clip()
  ctx.fillStyle = verticalGradient(ctx, 0, h * 0.3, [
    [0, 'rgba(255, 255, 255, 0.06)'],
    [1, 'rgba(255, 255, 255, 0)'],
  ])
  ctx.fillRect(0, 0, w, h * 0.3)
  // What has been sung sits a shade back, behind the now marker.
  const now = w * nowRatio
  ctx.fillStyle = horizontalGradient(ctx, 0, now, [
    [0, 'rgba(4, 2, 10, 0.34)'],
    [1, 'rgba(4, 2, 10, 0)'],
  ])
  ctx.fillRect(0, 0, now, h)
  ctx.restore()
  // A fine edge all round, and the light catching its top.
  const line = Math.max(1, 1.5 * unit)
  roundedPath(
    ctx,
    { x: line / 2, y: line / 2, w: w - line, h: h - line },
    radius - line / 2,
  )
  ctx.lineWidth = line
  ctx.strokeStyle = 'rgba(238, 228, 255, 0.13)'
  ctx.stroke()
  ctx.fillStyle = horizontalGradient(ctx, radius, w - radius, [
    [0, 'rgba(255, 255, 255, 0)'],
    [0.35, 'rgba(255, 255, 255, 0.28)'],
    [0.65, 'rgba(255, 255, 255, 0.28)'],
    [1, 'rgba(255, 255, 255, 0)'],
  ])
  ctx.fillRect(radius, 0, w - radius * 2, line)
}

/** A note in this look, `height` pixels tall: a short capsule to stretch. */
export function noteSprite(
  sprites: SpriteCache,
  look: NoteLook,
  unit: number,
): CapsuleSprite | null {
  // Even, so each rounded end is a whole number of pixels wide.
  const height = 2 * px(NOTE_HEIGHT / 2, unit)
  const pad = px(NOTE_PAD, unit)
  const sprite = sprites.get(
    `note:${look}:${String(height)}`,
    { width: pad * 2 + height + NOTE_MIDDLE, height: pad * 2 + height },
    (ctx) => {
      paintNote(ctx, { height, pad, unit }, NOTE_LOOKS[look])
    },
  )
  return sprite === null ? null : { sprite, height, pad }
}

function paintNote(
  ctx: CanvasRenderingContext2D,
  size: {
    readonly height: number
    readonly pad: number
    readonly unit: number
  },
  look: (typeof NOTE_LOOKS)[NoteLook],
): void {
  const { height, pad, unit } = size
  const box = { x: pad, y: pad, w: height + NOTE_MIDDLE, h: height }
  const radius = height / 2
  const body = verticalGradient(ctx, pad, pad + height, look.body)
  if (look.glowBlur === 0) {
    // An empty tube casts no shadow and gives no light: its glass alone.
    roundedPath(ctx, box, radius)
    ctx.fillStyle = body
    ctx.fill()
    paintNoteGlass(ctx, { box, radius, unit }, look.shine)
    return
  }
  // A gentle shadow under it, then the warm glow of lit glass around it.
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
  ctx.shadowBlur = px(9, unit)
  ctx.shadowOffsetY = px(4, unit)
  roundedPath(ctx, box, radius)
  ctx.fillStyle = body
  ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.shadowColor = look.glow
  ctx.shadowBlur = px(look.glowBlur, unit)
  roundedPath(ctx, box, radius)
  ctx.fillStyle = body
  ctx.fill()
  ctx.restore()
  paintNoteGlass(ctx, { box, radius, unit }, look.shine)
}

/** Inside the capsule: light caught in the bottom edge, the top's highlight, the rim. */
function paintNoteGlass(
  ctx: CanvasRenderingContext2D,
  at: {
    readonly box: {
      readonly x: number
      readonly y: number
      readonly w: number
      readonly h: number
    }
    readonly radius: number
    readonly unit: number
  },
  shine: number,
): void {
  const { box, radius, unit } = at
  ctx.save()
  roundedPath(ctx, box, radius)
  ctx.clip()
  ctx.fillStyle = verticalGradient(ctx, box.y + box.h * 0.55, box.y + box.h, [
    [0, 'rgba(255, 244, 200, 0)'],
    [1, 'rgba(255, 244, 200, 0.5)'],
  ])
  ctx.fillRect(box.x, box.y + box.h * 0.55, box.w, box.h * 0.45)
  const shineBox = {
    x: box.x + box.h * 0.28,
    y: box.y + box.h * 0.1,
    w: box.w - box.h * 0.56,
    h: box.h * 0.36,
  }
  roundedPath(ctx, shineBox, shineBox.h / 2)
  ctx.fillStyle = verticalGradient(ctx, shineBox.y, shineBox.y + shineBox.h, [
    [0, `rgba(255, 255, 255, ${String(shine)})`],
    [1, 'rgba(255, 255, 255, 0)'],
  ])
  ctx.fill()
  ctx.restore()
  const line = Math.max(1, 1.2 * unit)
  roundedPath(
    ctx,
    {
      x: box.x + line / 2,
      y: box.y + line / 2,
      w: box.w - line,
      h: box.h - line,
    },
    radius - line / 2,
  )
  ctx.lineWidth = line
  ctx.strokeStyle = verticalGradient(ctx, box.y, box.y + box.h, [
    [0, 'rgba(255, 250, 232, 0.95)'],
    [0.5, 'rgba(255, 214, 120, 0.4)'],
    [1, 'rgba(168, 92, 0, 0.7)'],
  ])
  ctx.stroke()
}

/**
 * The glass at one end of the panel, fading from solid at the end to clear
 * `width` pixels in: stamped over the notes and the singer's curve there,
 * so they rise out of the glass and sink back into it rather than being cut.
 * Taken from the panel's own pixels, so it matches the glass it lies on.
 */
export function fogSprite(
  sprites: SpriteCache,
  panel: Sprite,
  at: {
    readonly side: 'left' | 'right'
    readonly width: number
    readonly height: number
  },
): Sprite | null {
  const width = Math.round(at.width)
  const height = Math.round(at.height)
  return sprites.get(
    `fog:${at.side}:${String(panel.width)}x${String(height)}:${String(width)}`,
    { width, height },
    (ctx) => {
      const from = at.side === 'left' ? 0 : panel.width - width
      ctx.drawImage(panel.image, from, 0, width, height, 0, 0, width, height)
      ctx.globalCompositeOperation = 'destination-in'
      const solid = 'rgba(0, 0, 0, 1)'
      const clear = 'rgba(0, 0, 0, 0)'
      ctx.fillStyle = horizontalGradient(
        ctx,
        0,
        width,
        at.side === 'left'
          ? [
              [0, solid],
              [0.2, solid],
              [0.45, 'rgba(0, 0, 0, 0.8)'],
              [1, clear],
            ]
          : [
              [0, clear],
              [0.55, 'rgba(0, 0, 0, 0.8)'],
              [0.8, solid],
              [1, solid],
            ],
      )
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'source-over'
    },
  )
}

/** The singer's dot in a verdict's colour, its glow round it. */
export function dotSprite(
  sprites: SpriteCache,
  verdict: Verdict,
  unit: number,
): Sprite | null {
  const halo = px(40, unit)
  return sprites.get(
    `dot:${verdict}:${String(halo)}`,
    { width: halo * 2, height: halo * 2 },
    (ctx) => {
      paintDot(ctx, { halo, unit }, VERDICT_COLORS[verdict])
    },
  )
}

function paintDot(
  ctx: CanvasRenderingContext2D,
  size: { readonly halo: number; readonly unit: number },
  color: (typeof VERDICT_COLORS)[Verdict],
): void {
  const { halo, unit } = size
  const glow = ctx.createRadialGradient(halo, halo, 0, halo, halo, halo)
  glow.addColorStop(0, `rgba(${color.glow}, 0.6)`)
  glow.addColorStop(0.3, `rgba(${color.glow}, 0.28)`)
  glow.addColorStop(1, `rgba(${color.glow}, 0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, halo * 2, halo * 2)
  const radius = 11 * unit
  const core = ctx.createRadialGradient(
    halo - radius * 0.35,
    halo - radius * 0.35,
    radius * 0.1,
    halo,
    halo,
    radius,
  )
  core.addColorStop(0, '#ffffff')
  core.addColorStop(0.45, `rgb(${color.core})`)
  core.addColorStop(1, `rgb(${color.glow})`)
  ctx.beginPath()
  ctx.arc(halo, halo, radius, 0, Math.PI * 2)
  ctx.fillStyle = core
  ctx.fill()
  ctx.lineWidth = Math.max(1, 1.5 * unit)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.stroke()
}

/** The warm flare where the singer meets the note they are on. */
export function flareSprite(sprites: SpriteCache, unit: number): Sprite | null {
  const reach = px(72, unit)
  return sprites.get(
    `flare:${String(reach)}`,
    { width: reach * 2, height: reach * 2 },
    (ctx) => {
      const flare = ctx.createRadialGradient(
        reach,
        reach,
        0,
        reach,
        reach,
        reach,
      )
      flare.addColorStop(0, 'rgba(255, 236, 170, 0.55)')
      flare.addColorStop(0.25, 'rgba(255, 200, 80, 0.26)')
      flare.addColorStop(1, 'rgba(255, 170, 40, 0)')
      ctx.fillStyle = flare
      ctx.fillRect(0, 0, reach * 2, reach * 2)
    },
  )
}

/** The now marker: a beam of light down the lane, `height` pixels tall. */
export function markerSprite(
  sprites: SpriteCache,
  height: number,
  unit: number,
): Sprite | null {
  const tall = Math.round(height)
  const wide = px(64, unit)
  return sprites.get(
    `marker:${String(tall)}x${String(wide)}`,
    { width: wide, height: tall },
    (ctx) => {
      paintMarker(ctx, { wide, tall, unit })
    },
  )
}

function paintMarker(
  ctx: CanvasRenderingContext2D,
  size: { readonly wide: number; readonly tall: number; readonly unit: number },
): void {
  const { wide, tall, unit } = size
  ctx.fillStyle = horizontalGradient(ctx, 0, wide, [
    [0, 'rgba(167, 139, 250, 0)'],
    [0.5, 'rgba(196, 181, 253, 0.2)'],
    [1, 'rgba(167, 139, 250, 0)'],
  ])
  ctx.fillRect(0, 0, wide, tall)
  const core = Math.max(1, 2.5 * unit)
  ctx.fillStyle = verticalGradient(ctx, 0, tall, [
    [0, 'rgba(255, 255, 255, 0.15)'],
    [0.2, 'rgba(240, 235, 255, 0.75)'],
    [0.8, 'rgba(240, 235, 255, 0.75)'],
    [1, 'rgba(255, 255, 255, 0.15)'],
  ])
  ctx.fillRect(wide / 2 - core / 2, 0, core, tall)
  // Fade the beam out at both ends, so it rises out of the glass.
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = verticalGradient(ctx, 0, tall, [
    [0, 'rgba(0, 0, 0, 0)'],
    [0.12, 'rgba(0, 0, 0, 1)'],
    [0.88, 'rgba(0, 0, 0, 1)'],
    [1, 'rgba(0, 0, 0, 0)'],
  ])
  ctx.fillRect(0, 0, wide, tall)
  ctx.globalCompositeOperation = 'source-over'
}

/** The chip on the now marker that names the note under it. */
export function chipSprite(sprites: SpriteCache, unit: number): Sprite | null {
  const w = px(96, unit)
  const h = px(48, unit)
  const pad = px(12, unit)
  return sprites.get(
    `chip:${String(w)}x${String(h)}`,
    { width: w + pad * 2, height: h + pad * 2 },
    (ctx) => {
      const box = { x: pad, y: pad, w, h }
      ctx.save()
      ctx.shadowColor = 'rgba(255, 190, 60, 0.35)'
      ctx.shadowBlur = px(14, unit)
      roundedPath(ctx, box, h / 2)
      ctx.fillStyle = verticalGradient(ctx, pad, pad + h, [
        [0, 'rgba(58, 44, 86, 0.96)'],
        [1, 'rgba(30, 22, 48, 0.96)'],
      ])
      ctx.fill()
      ctx.restore()
      const line = Math.max(1, 1.5 * unit)
      roundedPath(
        ctx,
        { x: pad + line / 2, y: pad + line / 2, w: w - line, h: h - line },
        h / 2 - line / 2,
      )
      ctx.lineWidth = line
      ctx.strokeStyle = verticalGradient(ctx, pad, pad + h, [
        [0, 'rgba(255, 226, 150, 0.85)'],
        [1, 'rgba(255, 190, 70, 0.35)'],
      ])
      ctx.stroke()
    },
  )
}

/** The soft light behind the panel, the size of the screen's safe area. */
export function glowSprite(
  sprites: SpriteCache,
  size: { readonly w: number; readonly h: number },
  centre: { readonly x: number; readonly y: number },
): Sprite | null {
  const w = Math.round(size.w)
  const h = Math.round(size.h)
  return sprites.get(
    `glow:${String(w)}x${String(h)}:${String(Math.round(centre.x))}`,
    { width: w, height: h },
    (ctx) => {
      // Elliptical pools of light that reach nothing at the sprite's edges,
      // so the overscan margin stays the plain background.
      pool(ctx, { x: w * 0.5, y: centre.y, rx: w * 0.48, ry: h * 0.46 }, [
        [0, 'rgba(104, 74, 210, 0.26)'],
        [0.55, 'rgba(74, 50, 160, 0.1)'],
        [1, 'rgba(60, 40, 130, 0)'],
      ])
      pool(ctx, { x: centre.x, y: centre.y, rx: w * 0.22, ry: h * 0.32 }, [
        [0, 'rgba(255, 176, 64, 0.11)'],
        [1, 'rgba(255, 176, 64, 0)'],
      ])
    },
  )
}

function pool(
  ctx: CanvasRenderingContext2D,
  at: {
    readonly x: number
    readonly y: number
    readonly rx: number
    readonly ry: number
  },
  stops: readonly (readonly [number, string])[],
): void {
  ctx.save()
  ctx.translate(at.x, at.y)
  ctx.scale(1, at.ry / at.rx)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, at.rx)
  for (const [stop, color] of stops) gradient.addColorStop(stop, color)
  ctx.fillStyle = gradient
  ctx.fillRect(-at.rx, -at.rx, at.rx * 2, at.rx * 2)
  ctx.restore()
}
