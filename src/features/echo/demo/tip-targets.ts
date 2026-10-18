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
// tooltip goes. What every room's tooltips share (the room measured off
// the layer, the gaps, what none of them covers, the mic's target) is the
// kit's own (demo-kit/tip-target.ts).

import type { Point, Rect } from '@/components/demo-kit/tip-place'
import { inflate } from '@/components/demo-kit/tip-place'
import type { TipAim, TipTarget } from '@/components/demo-kit/tip-target'
import { aimIn, around, ARROW_GAP, controlsClear, mercBody, micTarget, present, roomInside, roomRects, } from '@/components/demo-kit/tip-target'
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

const liveRings = (scene: DemoScene): SkyMark[] =>
  scene.rings.filter((ring) => ring.key.startsWith(`${LIVE}-r`))
const liveStars = (scene: DemoScene): SkyMark[] =>
  scene.stars.filter((star) => star.key.startsWith(`${LIVE}-`))

/**
 * What no tooltip covers: the room's controls and the demo's own (with a
 * gap), the mic's ring, the chip, and every ring and star in the sky.
 */
function keepClear(scene: DemoScene): Rect[] {
  return [
    ...controlsClear(scene.controls, scene.mic),
    ...present([scene.chip]),
    ...scene.rings.map((ring) => markRect(ring, RING_GLOW)),
    ...scene.stars.map((star) => markRect(star, STAR_GLOW)),
  ]
}

function softly(scene: DemoScene): Rect[] {
  return present([scene.merc === null ? null : mercBody(scene.merc)])
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
      // Beside the mic, clear of its ring and of the pill over it.
      return micTarget(scene.mic, {
        avoid: scene.controls,
        prefer: softly(scene),
      })
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
  if (rects === null) return null
  const id = rects.byTestId
  return {
    room: roomInside(rects),
    rings: skyMarks(rects.root, 'echo-ring', rects.origin),
    stars: skyMarks(rects.root, 'echo-star', rects.origin),
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
  return aimIn(measureEchoScene(layer), (scene) => tipTarget(target, scene))
}
