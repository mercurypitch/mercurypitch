// ============================================================
// What each demo tooltip points at, in the Home note room as drawn now
// ============================================================
//
// The intro's chord lamps under the chip, the band of light around the
// lighthouse's beam (home's line), Merc on the pier, the lamp, the mic and
// the demo's own controls are measured off the screen as they stand, so a
// harbour laid out for the demo's key is aimed at where it is. The demo
// kit's layer (demo-kit/DemoLayer.tsx) asks `aimHomeNoteTip` where each
// tooltip goes. What every room's tooltips share (the room measured off
// the layer, the gaps, what none of them covers, the mic's target) is the
// kit's own (demo-kit/tip-target.ts).

import type { Rect } from '@/components/demo-kit/tip-place'
import { inflate } from '@/components/demo-kit/tip-place'
import type { TipAim, TipTarget } from '@/components/demo-kit/tip-target'
import { aimIn, ARROW_GAP, controlsClear, mercBody, micTarget, present, roomInside, roomRects, stretchTarget, } from '@/components/demo-kit/tip-target'
import type { DemoTarget } from './demo-cues'

/** The lamp's light reaches this far past its drawn glow, px. */
const LAMP_GLOW = 6

/** The room's parts, px from the room's top left; null when not shown. */
export interface DemoScene {
  /** The room inside the shell's bars: a tooltip stays in it. */
  readonly room: Rect
  readonly merc: Rect | null
  /** The intro's chord lamps under the chip, while the band plays. */
  readonly chords: Rect | null
  /** The band of light around the beam, home's line. */
  readonly band: Rect | null
  /** The lighthouse's lamp and its glow. */
  readonly lamp: Rect | null
  /** The chip and the chord lamps under it. */
  readonly head: readonly Rect[]
  readonly mic: Rect | null
  /** The demo's own controls and the room's corners: Skip, "?", the pill. */
  readonly controls: readonly Rect[]
}

/** What no tooltip covers: the controls, the mic's ring, the head. */
function keepClear(scene: DemoScene): Rect[] {
  return [...controlsClear(scene.controls, scene.mic), ...scene.head]
}

/** What a tooltip had better not cover: Merc, and the lamp's light. */
function softly(scene: DemoScene): Rect[] {
  return present([
    scene.merc === null ? null : mercBody(scene.merc),
    scene.lamp === null ? null : inflate(scene.lamp, LAMP_GLOW),
  ])
}

/** Under the chord lamps, as they light. */
function chordsTarget(scene: DemoScene): TipTarget | null {
  const chords = scene.chords
  if (chords === null) return null
  return {
    anchors: {
      below: { x: chords.x + chords.w / 2, y: chords.y + chords.h + ARROW_GAP },
    },
    sides: ['below'],
    avoid: keepClear(scene),
    prefer: softly(scene),
    glow: null,
  }
}

/** Above Merc on the pier, or beside him. */
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
    prefer: present([scene.band]),
    glow: null,
  }
}

/** Beside the lamp, on the room's side of it, or under or over it. */
function lampTarget(scene: DemoScene): TipTarget | null {
  const glow = scene.lamp
  if (glow === null) return null
  const light = inflate(glow, LAMP_GLOW)
  const midY = glow.y + glow.h / 2
  return {
    anchors: {
      left: { x: light.x - ARROW_GAP, y: midY },
      above: { x: glow.x + glow.w / 2, y: light.y - ARROW_GAP },
      below: { x: glow.x + glow.w / 2, y: light.y + light.h + ARROW_GAP },
    },
    sides: ['left', 'above', 'below'],
    avoid: present([light, ...keepClear(scene)]),
    prefer: present([
      scene.merc === null ? null : mercBody(scene.merc),
      scene.band,
    ]),
    glow: { kind: 'light', rect: light },
  }
}

export function tipTarget(
  target: DemoTarget,
  scene: DemoScene,
): TipTarget | null {
  switch (target) {
    case 'chords':
      return chordsTarget(scene)
    case 'beam':
      return stretchTarget(scene.band, null, [
        ...keepClear(scene),
        ...softly(scene),
      ])
    case 'merc':
      return mercTarget(scene)
    case 'lamp':
      return lampTarget(scene)
    case 'mic':
      // Beside the mic, clear of its ring and of the pill over it.
      return micTarget(scene.mic, {
        avoid: scene.controls,
        prefer: softly(scene),
      })
  }
}

/** The room's parts, measured from the layer (which covers the room). */
export function measureHomeNoteScene(layer: HTMLElement): DemoScene | null {
  const rects = roomRects(layer)
  if (rects === null) return null
  const id = rects.byTestId
  const chords = id('home-note-chords')
  return {
    room: roomInside(rects),
    merc: id('home-note-merc'),
    chords,
    band: id('home-note-band'),
    lamp: id('home-note-lamp'),
    head: present([id('home-note-chip'), chords]),
    mic: id('home-note-mic'),
    controls: present([
      id('home-note-demo-skip'),
      id('home-note-ask'),
      id('home-note-demo-take'),
    ]),
  }
}

/** Where a tooltip points in the room as it is drawn now; null hides it. */
export function aimHomeNoteTip(
  target: DemoTarget,
  layer: HTMLElement,
): TipAim | null {
  return aimIn(measureHomeNoteScene(layer), (scene) => tipTarget(target, scene))
}
