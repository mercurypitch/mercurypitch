// ============================================================
// TV stage paused screen paint — the paused screen, drawn over the stage
// ============================================================
//
// Draws what pause-screen.ts works out, in the lane's glass: a scrim of the
// stage's own background, so the overscan margin stays as it is; the label
// in the lyrics' gold, the title large and white, the next line under it;
// a bar of dark glass with the place in gold glass and a glass knob; and a
// pause mark in a ring of glass beside the time sung, or a play mark while
// the song stands ready at its start, since pressing play is what comes
// next. The scrim, the bar, the knob and the mark are sprites painted once
// per size (sprites.ts); a frame stamps them, writes the text and fades it
// all together.
//
// Tests: src/lib/tv-stage/pause-screen.test.ts.

import type { TvStageLayout } from './layout'
import { fitText, stageFont } from './layout'
import type { TvStageState } from './model'
import type { PauseLayout, PauseScreen } from './pause-screen'
import { knobX, pauseLayout, pauseScreenOf, pauseTimes } from './pause-screen'
import type { CapsuleSprite, Sprite, SpriteCache } from './sprites'
import { roundedPath, stampCapsule, verticalGradient } from './sprites'

/** The words, in the app's plain voice. */
export const PAUSE_WORDS = {
  paused: 'Paused',
  ready: 'Ready to sing',
  next: 'Next line',
  press: 'Press play on your phone to start',
} as const

const COLORS = {
  label: '#ffc15a',
  title: 'rgba(250, 247, 255, 0.97)',
  line: 'rgba(237, 245, 255, 0.9)',
  quiet: 'rgba(237, 245, 255, 0.58)',
  sung: 'rgba(250, 247, 255, 0.95)',
  left: 'rgba(237, 245, 255, 0.7)',
} as const

/**
 * The scrim's colour: the stage's background (TV_STAGE_COLORS.background),
 * so where it lies over the plain background it changes nothing.
 */
const SCRIM_RGB = '11, 13, 18'

/**
 * The scrim over the safe area: a dim over the stage, so it stays in sight
 * behind, then from the foot of the lane down solid, so the words stand on
 * the lyrics' place without a ghost of the lyrics showing through.
 */
function scrimSprite(sprites: SpriteCache, place: PauseLayout): Sprite | null {
  const { scrim, label } = place
  const w = Math.round(scrim.w)
  const h = Math.round(scrim.h)
  // Solid from just above the label, rising out of the dim over the label's
  // own height and as much again.
  const solid = Math.max(0, label.y - label.px - scrim.y)
  const from = Math.max(0, solid - label.px * 3)
  return sprites.get(
    `pause-scrim:${String(w)}x${String(h)}:${String(Math.round(solid))}`,
    { width: w, height: h },
    (ctx) => {
      ctx.fillStyle = `rgba(${SCRIM_RGB}, 0.45)`
      ctx.fillRect(0, 0, w, from)
      ctx.fillStyle = verticalGradient(ctx, from, solid, [
        [0, `rgba(${SCRIM_RGB}, 0.45)`],
        [1, `rgb(${SCRIM_RGB})`],
      ])
      ctx.fillRect(0, from, w, solid - from)
      ctx.fillStyle = `rgb(${SCRIM_RGB})`
      ctx.fillRect(0, solid, w, h - solid)
    },
  )
}

/** The bar's track: a long capsule of dark glass, as long as the bar. */
function trackSprite(
  sprites: SpriteCache,
  bar: PauseLayout['bar'],
  unit: number,
): Sprite | null {
  const pad = Math.ceil(4 * unit)
  const w = Math.round(bar.x1 - bar.x0)
  const h = Math.round(bar.height)
  return sprites.get(
    `pause-track:${String(w)}x${String(h)}`,
    { width: w + pad * 2, height: h + pad * 2 },
    (ctx) => {
      const box = { x: pad, y: pad, w, h }
      roundedPath(ctx, box, h / 2)
      ctx.fillStyle = verticalGradient(ctx, pad, pad + h, [
        [0, 'rgba(255, 255, 255, 0.1)'],
        [1, 'rgba(255, 255, 255, 0.2)'],
      ])
      ctx.fill()
      ctx.lineWidth = Math.max(1, 1.2 * unit)
      ctx.strokeStyle = 'rgba(238, 228, 255, 0.28)'
      ctx.stroke()
    },
  )
}

/** The place, in gold glass: a capsule to stretch along the bar. */
function fillSprite(
  sprites: SpriteCache,
  bar: PauseLayout['bar'],
  unit: number,
): CapsuleSprite | null {
  const height = 2 * Math.max(1, Math.round(bar.height / 2))
  const pad = Math.ceil(12 * unit)
  const sprite = sprites.get(
    `pause-fill:${String(height)}`,
    { width: pad * 2 + height + 6, height: pad * 2 + height },
    (ctx) => {
      const box = { x: pad, y: pad, w: height + 6, h: height }
      ctx.save()
      ctx.shadowColor = 'rgba(255, 190, 70, 0.75)'
      ctx.shadowBlur = Math.round(10 * unit)
      roundedPath(ctx, box, height / 2)
      ctx.fillStyle = verticalGradient(ctx, pad, pad + height, [
        [0, '#fff3c4'],
        [0.45, '#ffcf4f'],
        [1, '#e99b12'],
      ])
      ctx.fill()
      ctx.restore()
    },
  )
  return sprite === null ? null : { sprite, height, pad }
}

/** The knob at the place: an orb of glass, lit warm. */
function knobSprite(
  sprites: SpriteCache,
  knob: PauseLayout['knob'],
): Sprite | null {
  const reach = Math.ceil(knob.reach)
  return sprites.get(
    `pause-knob:${String(reach)}`,
    { width: reach * 2, height: reach * 2 },
    (ctx) => {
      const glow = ctx.createRadialGradient(
        reach,
        reach,
        0,
        reach,
        reach,
        reach,
      )
      glow.addColorStop(0, 'rgba(255, 214, 120, 0.55)')
      glow.addColorStop(0.5, 'rgba(255, 190, 70, 0.22)')
      glow.addColorStop(1, 'rgba(255, 190, 70, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, reach * 2, reach * 2)
      const r = knob.radius
      const body = ctx.createRadialGradient(
        reach - r * 0.35,
        reach - r * 0.4,
        r * 0.1,
        reach,
        reach,
        r,
      )
      body.addColorStop(0, '#ffffff')
      body.addColorStop(0.55, '#fff1c9')
      body.addColorStop(1, '#ffc24a')
      ctx.beginPath()
      ctx.arc(reach, reach, r, 0, Math.PI * 2)
      ctx.fillStyle = body
      ctx.fill()
      ctx.lineWidth = Math.max(1, r / 10)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.stroke()
    },
  )
}

/**
 * The play mark's triangle in a ring of radius `r` centred on `c`: as tall
 * as the pause mark's bars, pointing right, its centroid on the ring's
 * centre, so it does not sit to the left of the ring as a box-centred
 * triangle would.
 */
export function playMarkPoints(
  c: number,
  r: number,
): readonly (readonly [number, number])[] {
  const h = r * 0.72
  const w = (h * Math.sqrt(3)) / 2
  return [
    [c - w / 3, c - h / 2],
    [c + (w * 2) / 3, c],
    [c - w / 3, c + h / 2],
  ]
}

/** The pause mark's two bars, rounded at their ends. */
function paintPauseBars(
  ctx: CanvasRenderingContext2D,
  at: { readonly c: number; readonly r: number; readonly unit: number },
): void {
  const barW = 5 * at.unit
  const barH = at.r * 0.72
  for (const x of [at.c - barW * 1.3, at.c + barW * 0.3]) {
    roundedPath(ctx, { x, y: at.c - barH / 2, w: barW, h: barH }, barW / 2)
    ctx.fill()
  }
}

/** The play mark's triangle, its corners rounded by a stroke of its own colour. */
function paintPlayTriangle(
  ctx: CanvasRenderingContext2D,
  at: { readonly c: number; readonly r: number; readonly unit: number },
): void {
  const [first, ...rest] = playMarkPoints(at.c, at.r)
  ctx.beginPath()
  ctx.moveTo(first[0], first[1])
  for (const [x, y] of rest) ctx.lineTo(x, y)
  ctx.closePath()
  ctx.lineJoin = 'round'
  ctx.lineWidth = 2 * at.unit
  ctx.strokeStyle = ctx.fillStyle
  ctx.fill()
  ctx.stroke()
}

/**
 * The mark beside the time sung, in a ring of glass: two bars while the
 * song is paused, and a play triangle while it stands ready at its start,
 * where the next thing to do is press play.
 */
function markSprite(
  sprites: SpriteCache,
  at: { readonly mark: PauseLayout['mark']; readonly unit: number },
  kind: PauseScreen['kind'],
): Sprite | null {
  const { unit } = at
  const r = Math.ceil(at.mark.radius)
  const side = r * 2 + 2
  return sprites.get(
    `${kind === 'ready' ? 'play-mark' : 'pause-mark'}:${String(r)}`,
    { width: side, height: side },
    (ctx) => {
      const c = side / 2
      ctx.beginPath()
      ctx.arc(c, c, r - unit, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fill()
      ctx.lineWidth = Math.max(1, 2 * unit)
      ctx.strokeStyle = 'rgba(250, 247, 255, 0.78)'
      ctx.stroke()
      ctx.fillStyle = 'rgba(250, 247, 255, 0.95)'
      if (kind === 'ready') paintPlayTriangle(ctx, { c, r, unit })
      else paintPauseBars(ctx, { c, r, unit })
    },
  )
}

/** The bar, its place in gold, and the knob. */
function drawBar(
  ctx: CanvasRenderingContext2D,
  at: {
    readonly place: PauseLayout
    readonly unit: number
    readonly share: number
  },
  sprites: SpriteCache,
): void {
  const { bar, knob } = at.place
  const track = trackSprite(sprites, bar, at.unit)
  if (track !== null) {
    const pad = (track.width - Math.round(bar.x1 - bar.x0)) / 2
    ctx.drawImage(
      track.image,
      Math.round(bar.x0 - pad),
      Math.round(bar.y - track.height / 2),
    )
  }
  const x = knobX(bar, at.share)
  const fill = fillSprite(sprites, bar, at.unit)
  if (fill !== null && x > bar.x0) {
    stampCapsule(ctx, fill, { x0: bar.x0, x1: x, y: bar.y })
  }
  const orb = knobSprite(sprites, knob)
  if (orb !== null) {
    ctx.drawImage(
      orb.image,
      Math.round(x - orb.width / 2),
      Math.round(bar.y - orb.height / 2),
    )
  }
}

/** The label, the title and the line under it. */
function drawWords(
  ctx: CanvasRenderingContext2D,
  place: PauseLayout,
  screen: PauseScreen,
): void {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = stageFont(700, place.label.px)
  ctx.fillStyle = COLORS.label
  ctx.fillText(
    screen.kind === 'ready' ? PAUSE_WORDS.ready : PAUSE_WORDS.paused,
    place.label.x,
    place.label.y,
  )
  ctx.font = stageFont(700, place.title.px)
  ctx.fillStyle = COLORS.title
  ctx.fillText(
    fitText(ctx, screen.title, place.title.width),
    place.title.x,
    place.title.y,
  )
  const line = place.line
  ctx.font = stageFont(600, line.px)
  if (screen.kind === 'ready') {
    ctx.fillStyle = COLORS.line
    ctx.fillText(PAUSE_WORDS.press, line.x, line.y)
    return
  }
  if (screen.next === null) return
  ctx.fillStyle = COLORS.quiet
  ctx.fillText(PAUSE_WORDS.next, line.x, line.y)
  const indent = ctx.measureText(PAUSE_WORDS.next).width + line.px * 0.6
  ctx.fillStyle = COLORS.line
  ctx.fillText(
    fitText(ctx, screen.next, line.width - indent),
    line.x + indent,
    line.y,
  )
}

/** The mark, the time sung beside it, and the time left. */
function drawTimes(
  ctx: CanvasRenderingContext2D,
  at: { readonly place: PauseLayout; readonly layout: TvStageLayout },
  screen: PauseScreen,
  sprites: SpriteCache,
): void {
  const { mark, times } = at.place
  const ring = markSprite(sprites, { mark, unit: at.layout.unit }, screen.kind)
  if (ring !== null) {
    ctx.drawImage(
      ring.image,
      Math.round(mark.x - ring.width / 2),
      Math.round(mark.y - ring.height / 2),
    )
  }
  const { sung, left } = pauseTimes(screen.elapsed, screen.duration)
  ctx.font = stageFont(600, times.px)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = COLORS.sung
  ctx.fillText(sung, mark.x + mark.radius + times.px * 0.45, times.y)
  if (left === null) return
  ctx.textAlign = 'right'
  ctx.fillStyle = COLORS.left
  const safe = at.layout.safe
  ctx.fillText(left, safe.x + safe.w, times.y)
}

/**
 * The paused screen over the stage at `nowMs`, if the song stands still or
 * has only just started: faded in or out by its quarter second, risen a
 * little as it comes.
 */
export function drawPauseScreen(
  ctx: CanvasRenderingContext2D,
  layout: TvStageLayout,
  state: TvStageState,
  at: { readonly nowMs: number; readonly sprites: SpriteCache },
): void {
  const screen = pauseScreenOf(state, at.nowMs)
  if (screen === null) return
  const place = pauseLayout(layout)
  const { sprites } = at
  const safe = layout.safe
  ctx.save()
  // Kept to the inset, risen into place or not: the margin is never drawn on.
  ctx.beginPath()
  ctx.rect(safe.x, safe.y, safe.w, safe.h)
  ctx.clip()
  // The scrim comes in ahead of the words and goes after them, so the
  // lyrics under it are gone before the words over it arrive.
  ctx.globalAlpha = Math.min(1, screen.shown * 2.5)
  const scrim = scrimSprite(sprites, place)
  if (scrim !== null) {
    ctx.drawImage(
      scrim.image,
      Math.round(place.scrim.x),
      Math.round(place.scrim.y),
    )
  }
  ctx.globalAlpha = screen.shown ** 1.5
  ctx.translate(0, Math.round((1 - screen.shown) * place.rise))
  drawWords(ctx, place, screen)
  if (screen.duration > 0) {
    drawBar(
      ctx,
      { place, unit: layout.unit, share: screen.elapsed / screen.duration },
      sprites,
    )
  }
  drawTimes(ctx, { place, layout }, screen, sprites)
  ctx.restore()
}
