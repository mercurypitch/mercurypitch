// ============================================================
// What each demo tooltip points at, in the Echo room as it is drawn now
// ============================================================
//
// The sky's rings and stars carry their own centres and radii (EchoSky's
// data-cx, data-cy, data-radius and data-r, in the sky's px), so a ring
// still fading in or a star still popping is aimed at where it will
// settle, not at its size mid-animation. Merc, the result, the mic and the
// demo's own controls are measured off the screen as they stand. The demo
// kit's layer (demo-kit/DemoLayer.tsx) asks `aimEchoTip` where each
// tooltip goes.

import type { Point, Rect, Side } from '@/components/demo-kit/tip-place'
import { inflate } from '@/components/demo-kit/tip-place'
import type { TipAim, TipTarget } from '@/components/demo-kit/tip-target'
import { roomRects } from '@/components/demo-kit/tip-target'
import type { DemoTarget } from './demo-cues'

/** A ring or a star of the sky: its centre and radius, px from the room. */
export interface SkyMark {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly r: number
}

/** The room's parts, px from the room's top left; null when not shown. */
export interface DemoScene {
  /** The room inside the shell's bars: a tooltip stays in it. */
  readonly room: Rect
  readonly rings: readonly SkyMark[]
  readonly stars: readonly SkyMark[]
  readonly merc: Rect | null
  readonly chip: Rect | null
  /** The result's numbers, and the score among them. */
  readonly result: Rect | null
  readonly score: Rect | null
  readonly mic: Rect | null
  /** The demo's own controls and the room's corners: Skip, "?", the pill. */
  readonly controls: readonly Rect[]
}

/** The phrase being sung: the demo's one phrase is the run's first. */
const LIVE = 'p0'
/** A ring's glow reaches this far past its radius. */
const RING_GLOW = 6
/** A star's sprite reaches this far past its tips. */
const STAR_GLOW = 4
/** The arrow keeps this far off what it points at. */
const ARROW_GAP = 4
/** The mic's pulse ring reaches this far past the disc. */
const MIC_RING = 14
/** A tooltip keeps this far from the demo's own controls. */
const CONTROL_GAP = 8

const present = (rects: readonly (Rect | null)[]): Rect[] =>
  rects.filter((rect): rect is Rect => rect !== null)

const markRect = (mark: SkyMark, pad: number): Rect => ({
  x: mark.x - mark.r - pad,
  y: mark.y - mark.r - pad,
  w: 2 * (mark.r + pad),
  h: 2 * (mark.r + pad),
})

/** The smallest rect holding all of `rects`; null for none. */
export function union(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null
  const x = Math.min(...rects.map((r) => r.x))
  const y = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.w))
  const bottom = Math.max(...rects.map((r) => r.y + r.h))
  return { x, y, w: right - x, h: bottom - y }
}

/** Merc's body inside his canvas, which is mostly clear around him. */
function mercBody(canvas: Rect): Rect {
  return {
    x: canvas.x + canvas.w * 0.26,
    y: canvas.y + canvas.h * 0.3,
    w: canvas.w * 0.48,
    h: canvas.h * 0.58,
  }
}

const liveRings = (scene: DemoScene): SkyMark[] =>
  scene.rings.filter((ring) => ring.key.startsWith(`${LIVE}-r`))
const liveStars = (scene: DemoScene): SkyMark[] =>
  scene.stars.filter((star) => star.key.startsWith(`${LIVE}-`))

/**
 * What no tooltip covers: the room's controls and the demo's own (with a
 * gap), the mic's ring, the chip, and every ring and star in the sky.
 */
function keepClear(scene: DemoScene): Rect[] {
  return present([
    ...scene.controls.map((rect) => inflate(rect, CONTROL_GAP)),
    scene.mic === null ? null : inflate(scene.mic, MIC_RING),
    scene.chip,
    ...scene.rings.map((ring) => markRect(ring, RING_GLOW)),
    ...scene.stars.map((star) => markRect(star, STAR_GLOW)),
  ])
}

function softly(scene: DemoScene): Rect[] {
  return present([scene.merc === null ? null : mercBody(scene.merc)])
}

/** Around a box: the point on each side the arrow touches. */
function around(box: Rect, gap: number): Partial<Record<Side, Point>> {
  const midX = box.x + box.w / 2
  const midY = box.y + box.h / 2
  return {
    above: { x: midX, y: box.y - gap },
    below: { x: midX, y: box.y + box.h + gap },
    left: { x: box.x - gap, y: midY },
    right: { x: box.x + box.w + gap, y: midY },
  }
}

/** One ring or star: beside it, covering nothing in the sky. */
function markTarget(
  scene: DemoScene,
  mark: SkyMark | undefined,
  pad: number,
): TipTarget | null {
  if (mark === undefined) return null
  const box = markRect(mark, pad)
  return {
    anchors: around(box, ARROW_GAP),
    sides: ['above', 'right', 'left', 'below'],
    avoid: [box, ...keepClear(scene)],
    prefer: softly(scene),
    glow: { kind: 'light', rect: inflate(box, 6) },
  }
}

/**
 * A group of rings or stars: above or under the group. The rings of the
 * call come in one by one with their own glow, so they get none of the
 * tooltip's: across the three it reads as a cloud.
 */
function groupTarget(
  scene: DemoScene,
  boxes: readonly Rect[],
  glow: boolean,
): TipTarget | null {
  const group = union(boxes)
  if (group === null) return null
  return {
    anchors: around(group, ARROW_GAP),
    sides: ['below', 'above'],
    avoid: [...boxes, ...keepClear(scene)],
    prefer: softly(scene),
    glow: glow ? { kind: 'light', rect: inflate(group, 8) } : null,
  }
}

/** Above Merc on the ridge, or beside him. */
function mercTarget(scene: DemoScene): TipTarget | null {
  if (scene.merc === null) return null
  const body = mercBody(scene.merc)
  return {
    anchors: {
      above: { x: body.x + body.w / 2, y: body.y - ARROW_GAP },
      right: { x: body.x + body.w + ARROW_GAP, y: body.y + body.h * 0.4 },
    },
    sides: ['above', 'right'],
    avoid: [body, ...keepClear(scene)],
    prefer: [],
    glow: null,
  }
}

/** Under the score, or beside it, on the side away from Skip. */
function scoreTarget(scene: DemoScene): TipTarget | null {
  const score = scene.score
  if (score === null) return null
  const midY = score.y + score.h / 2
  return {
    anchors: {
      below: {
        x: score.x + score.w / 2,
        y: (scene.result ?? score).y + (scene.result ?? score).h,
      },
      left: { x: score.x, y: midY },
      right: { x: score.x + score.w, y: midY },
    },
    sides: ['below', 'left', 'right'],
    avoid: present([score, scene.result, ...keepClear(scene)]),
    prefer: softly(scene),
    glow: { kind: 'text', rect: inflate(score, 8) },
  }
}

/** Beside the mic, clear of its ring and of the pill over it. */
function micTarget(scene: DemoScene): TipTarget | null {
  const mic = scene.mic
  if (mic === null) return null
  const ring = inflate(mic, MIC_RING)
  const midY = mic.y + mic.h / 2
  return {
    anchors: {
      above: { x: mic.x + mic.w / 2, y: ring.y },
      right: { x: ring.x + ring.w, y: midY },
      left: { x: ring.x, y: midY },
    },
    sides: ['above', 'right', 'left'],
    avoid: present([ring, ...scene.controls]),
    prefer: softly(scene),
    glow: null,
  }
}

export function tipTarget(
  target: DemoTarget,
  scene: DemoScene,
): TipTarget | null {
  switch (target) {
    case 'rings':
      return groupTarget(
        scene,
        liveRings(scene).map((ring) => markRect(ring, RING_GLOW)),
        false,
      )
    case 'merc':
      return mercTarget(scene)
    case 'ring:1':
    case 'ring:2': {
      const key = `${LIVE}-r${target.slice(5)}`
      return markTarget(
        scene,
        scene.rings.find((ring) => ring.key === key),
        RING_GLOW,
      )
    }
    case 'star:0':
      return markTarget(
        scene,
        scene.stars.find((star) => star.key === `${LIVE}-0`),
        STAR_GLOW,
      )
    case 'phrase':
      return groupTarget(
        scene,
        liveStars(scene).map((star) => markRect(star, STAR_GLOW)),
        true,
      )
    case 'score':
      return scoreTarget(scene)
    case 'mic':
      return micTarget(scene)
  }
}

/** The sky's rings or stars, as their data place them, px from the layer. */
function skyMarks(
  root: Element,
  testId: 'echo-ring' | 'echo-star',
  origin: Point,
): SkyMark[] {
  const sky = root.querySelector('[data-testid="echo-sky"]')
  if (sky === null) return []
  const at = sky.getBoundingClientRect()
  const radius = testId === 'echo-ring' ? 'radius' : 'r'
  return [
    ...sky.querySelectorAll<HTMLElement | SVGElement>(
      `[data-testid="${testId}"]`,
    ),
  ]
    .map((el) => ({
      key: el.dataset.key ?? '',
      x: at.left - origin.x + Number(el.dataset.cx),
      y: at.top - origin.y + Number(el.dataset.cy),
      r: Number(el.dataset[radius]),
    }))
    .filter((mark) => [mark.x, mark.y, mark.r].every(Number.isFinite))
}

/** The room's parts, measured from the layer (which covers the room). */
export function measureEchoScene(layer: HTMLElement): DemoScene | null {
  const rects = roomRects(layer)
  const root = layer.parentElement
  if (rects === null || root === null) return null
  const box = layer.getBoundingClientRect()
  const origin = { x: box.left, y: box.top }
  const id = rects.byTestId
  // Drawn full-bleed, the room runs under the status bar and the floating
  // bar; its padding keeps its controls clear of them, and the tooltips.
  const style = window.getComputedStyle(root)
  const top = Number.parseFloat(style.paddingTop) || 0
  const bottom = Number.parseFloat(style.paddingBottom) || 0
  return {
    room: {
      ...rects.room,
      y: top,
      h: Math.max(0, rects.room.h - top - bottom),
    },
    rings: skyMarks(root, 'echo-ring', origin),
    stars: skyMarks(root, 'echo-star', origin),
    merc: id('echo-merc'),
    chip: id('echo-chip'),
    result: union(present([id('echo-result'), id('echo-result-detail')])),
    score: id('echo-result'),
    mic: id('echo-mic'),
    controls: present([
      id('echo-demo-skip'),
      id('echo-ask'),
      id('echo-demo-take'),
      id('echo-demo-fast'),
    ]),
  }
}

/** Where a tooltip points in the room as it is drawn now; null hides it. */
export function aimEchoTip(
  target: DemoTarget,
  layer: HTMLElement,
): TipAim | null {
  const scene = measureEchoScene(layer)
  const aim = scene === null ? null : tipTarget(target, scene)
  if (scene === null || aim === null) return null
  return { target: aim, bounds: scene.room }
}
