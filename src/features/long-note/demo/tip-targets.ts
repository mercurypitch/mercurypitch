// ============================================================
// What each demo tooltip points at, in the room as it is drawn now
// ============================================================
//
// The scene is measured off the screen when a tooltip shows (the note tag,
// the lantern's box, the timer, the mic, Merc), so every anchor follows
// the room's real layout. Inside the lantern's box, the chimney's outline
// (lantern-geometry.ts) says where the light is: the one part of the
// lantern a tooltip may never cover.

import { CHIMNEY_BOTTOM, CHIMNEY_TOP, chimneyHalfWidth, LANTERN_VIEW_H, LANTERN_VIEW_W, surfaceY, } from '../lantern-geometry'
import type { DemoTarget } from './demo-cues'
import type { Point, Rect, Side } from './tip-place'
import { inflate } from './tip-place'

/** The room's parts, px from the room's top left; null when not shown. */
export interface DemoScene {
  readonly room: Rect
  readonly stage: Rect | null
  readonly lantern: Rect | null
  readonly note: Rect | null
  readonly timer: Rect | null
  readonly chip: Rect | null
  /** The result's numbers, and the steadiness line among them. */
  readonly result: Rect | null
  readonly score: Rect | null
  readonly mic: Rect | null
  /** The note picker over the mic, at the room's start. */
  readonly picker: Rect | null
  readonly merc: Rect | null
  /** The demo's own controls: Skip, "?", the take pill, the 4x badge. */
  readonly controls: readonly Rect[]
  /** The light's fill as the lantern shows it now, 0..1. */
  readonly level: number
}

export type GlowKind = 'line' | 'light' | 'text'

export interface TipTarget {
  readonly anchors: Partial<Record<Side, Point>>
  readonly sides: readonly Side[]
  readonly avoid: readonly Rect[]
  readonly prefer: readonly Rect[]
  /** The soft glow on what the tooltip explains; null for none. */
  readonly glow: { readonly kind: GlowKind; readonly rect: Rect } | null
}

/** The chimney at its widest, view-box units either side of the middle. */
const WIDEST = Math.max(
  ...Array.from({ length: 29 }, (_, i) =>
    chimneyHalfWidth(CHIMNEY_TOP + i * 7),
  ),
)
/** How far above the chimney's top the "full" tooltip points. */
const BRIM_BELOW_TOP = 30
/** The mic's pulse ring reaches this far past the disc. */
const MIC_RING = 14

/** Where the light can be: the chimney's bounding box, px. */
export function lightRect(lantern: Rect): Rect {
  const sx = lantern.w / LANTERN_VIEW_W
  const sy = lantern.h / LANTERN_VIEW_H
  return {
    x: lantern.x + (LANTERN_VIEW_W / 2 - WIDEST) * sx,
    y: lantern.y + CHIMNEY_TOP * sy,
    w: 2 * WIDEST * sx,
    h: (CHIMNEY_BOTTOM - CHIMNEY_TOP) * sy,
  }
}

/** Merc's body inside his canvas, which is mostly clear around him. */
function mercBody(canvas: Rect): Rect {
  return {
    x: canvas.x + canvas.w * 0.28,
    y: canvas.y + canvas.h * 0.26,
    w: canvas.w * 0.44,
    h: canvas.h * 0.58,
  }
}

/** A strip across the stage around the target line. */
function band(scene: DemoScene, y: number, half: number): Rect | null {
  const stage = scene.stage ?? scene.room
  return { x: stage.x, y: y - half, w: stage.w, h: 2 * half }
}

/** The target line's height: the note tag sits on it. */
function lineY(scene: DemoScene): number | null {
  return scene.note === null ? null : scene.note.y + scene.note.h
}

const present = (rects: readonly (Rect | null)[]): Rect[] =>
  rects.filter((rect): rect is Rect => rect !== null)

/** What no tooltip covers: the room's controls and the demo's own. */
function controls(scene: DemoScene): Rect[] {
  return present([
    ...scene.controls,
    scene.mic === null ? null : inflate(scene.mic, MIC_RING),
    scene.note,
  ])
}

function softly(scene: DemoScene): Rect[] {
  const y = lineY(scene)
  return present([
    scene.lantern,
    scene.merc === null ? null : mercBody(scene.merc),
    y === null ? null : band(scene, y, 26),
  ])
}

function lineTarget(scene: DemoScene): TipTarget | null {
  const y = lineY(scene)
  const stage = scene.stage
  if (y === null || stage === null || scene.lantern === null) return null
  // The middle of the stretch of line left of the lantern.
  const x = Math.max(stage.x + 32, (stage.x + scene.lantern.x) / 2)
  return {
    anchors: { above: { x, y }, below: { x, y } },
    sides: ['above', 'below'],
    avoid: present([band(scene, y, 5), ...controls(scene)]),
    prefer: present([
      lightRect(scene.lantern),
      scene.merc === null ? null : mercBody(scene.merc),
    ]),
    glow: { kind: 'line', rect: { x: stage.x, y: y - 5, w: stage.w, h: 10 } },
  }
}

function lanternTarget(scene: DemoScene, brim: boolean): TipTarget | null {
  if (scene.lantern === null) return null
  const light = lightRect(scene.lantern)
  const units = brim
    ? CHIMNEY_TOP + BRIM_BELOW_TOP
    : Math.min(
        CHIMNEY_BOTTOM - 14,
        Math.max(CHIMNEY_TOP + 24, surfaceY(scene.level)),
      )
  const y = scene.lantern.y + (units / LANTERN_VIEW_H) * scene.lantern.h
  return {
    anchors: {
      left: { x: light.x, y },
      right: { x: light.x + light.w, y },
    },
    sides: ['left', 'right'],
    avoid: present([light, scene.timer, scene.chip, ...controls(scene)]),
    prefer: softly(scene),
    glow: { kind: 'light', rect: inflate(light, 12) },
  }
}

/** Beside or under a line of text: the timer or the steadiness. */
function textTarget(
  scene: DemoScene,
  text: Rect | null,
  keep: readonly (Rect | null)[],
): TipTarget | null {
  if (text === null) return null
  const midY = text.y + text.h / 2
  return {
    anchors: {
      below: { x: text.x + text.w / 2, y: text.y + text.h },
      right: { x: text.x + text.w, y: midY },
      left: { x: text.x, y: midY },
    },
    sides: ['below', 'right', 'left'],
    avoid: present([text, ...keep, ...controls(scene)]),
    prefer: softly(scene),
    glow: { kind: 'text', rect: inflate(text, 8) },
  }
}

/** Beside the mic, clear of its ring and of the note picker over it. */
function micTarget(scene: DemoScene): TipTarget | null {
  const mic = scene.mic
  if (mic === null) return null
  const ring = inflate(mic, MIC_RING)
  const midY = mic.y + mic.h / 2
  return {
    anchors: {
      right: { x: ring.x + ring.w, y: midY },
      left: { x: ring.x, y: midY },
      above: { x: mic.x + mic.w / 2, y: ring.y },
    },
    sides: ['right', 'left', 'above'],
    avoid: present([ring, scene.picker, ...scene.controls]),
    prefer: softly(scene),
    glow: null,
  }
}

export function tipTarget(
  target: DemoTarget,
  scene: DemoScene,
): TipTarget | null {
  switch (target) {
    case 'line':
      return lineTarget(scene)
    case 'lantern':
    case 'brim':
      return lanternTarget(scene, target === 'brim')
    case 'timer':
      return textTarget(scene, scene.timer, [scene.chip])
    case 'score':
      return textTarget(scene, scene.score, [scene.result])
    case 'mic':
      return micTarget(scene)
  }
}
