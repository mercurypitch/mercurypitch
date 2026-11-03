// ============================================================
// What each demo tooltip points at, in the First note room as drawn now
// ============================================================
//
// The lead-in's countdown under the song's name, the band of light around
// the note's line, Merc on the boards, the mic and the demo's own controls
// are measured off the screen as they stand, so a stage laid out for the
// round's line is aimed at where it is. The demo kit's layer
// (demo-kit/DemoLayer.tsx) asks `aimFirstNoteTip` where each tooltip goes.
// What every room's tooltips share (the room measured off the layer, the
// gaps, what none of them covers, the mic's target) is the kit's own
// (demo-kit/tip-target.ts).

import type { Rect } from '@/components/demo-kit/tip-place'
import type { TipAim, TipTarget } from '@/components/demo-kit/tip-target'
import { aimIn, ARROW_GAP, controlsClear, mercBody, micTarget, present, roomInside, roomRects, stretchTarget, } from '@/components/demo-kit/tip-target'
import type { DemoTarget } from './demo-cues'

/** The room's parts, px from the room's top left; null when not shown. */
export interface DemoScene {
  /** The room inside the shell's bars: a tooltip stays in it. */
  readonly room: Rect
  readonly merc: Rect | null
  /** The lead-in's countdown, while the band plays. */
  readonly countdown: Rect | null
  /** The band of light around the note's line. */
  readonly band: Rect | null
  /** The chip, the song's name and the words: the head. */
  readonly head: readonly Rect[]
  readonly mic: Rect | null
  /**
   * The demo's own controls and the room's: Skip, "?", the take's pill, and
   * the Songs pill over the mic at rest, where the mic's hint shows.
   */
  readonly controls: readonly Rect[]
}

/** What no tooltip covers: the controls, the mic's ring, the head. */
function keepClear(scene: DemoScene): Rect[] {
  return [...controlsClear(scene.controls, scene.mic), ...scene.head]
}

/** What a tooltip had better not cover: Merc. */
function softly(scene: DemoScene): Rect[] {
  return present([scene.merc === null ? null : mercBody(scene.merc)])
}

/** Under the countdown, as it runs. */
function countdownTarget(scene: DemoScene): TipTarget | null {
  const countdown = scene.countdown
  if (countdown === null) return null
  return {
    anchors: {
      below: {
        x: countdown.x + countdown.w / 2,
        y: countdown.y + countdown.h + ARROW_GAP,
      },
    },
    sides: ['below'],
    avoid: [countdown, ...keepClear(scene)],
    prefer: softly(scene),
    glow: null,
  }
}

/** Above Merc on the boards, or beside him. */
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

export function tipTarget(
  target: DemoTarget,
  scene: DemoScene,
): TipTarget | null {
  switch (target) {
    case 'countdown':
      return countdownTarget(scene)
    case 'line':
      return stretchTarget(scene.band, null, [
        ...keepClear(scene),
        ...softly(scene),
      ])
    case 'merc':
      return mercTarget(scene)
    case 'mic':
      // Beside the mic, clear of its ring and of the pill over it.
      return micTarget(scene.mic, {
        avoid: scene.controls,
        prefer: softly(scene),
      })
  }
}

/** The room's parts, measured from the layer (which covers the room). */
export function measureFirstNoteScene(layer: HTMLElement): DemoScene | null {
  const rects = roomRects(layer)
  if (rects === null) return null
  const id = rects.byTestId
  return {
    room: roomInside(rects),
    merc: id('first-note-merc'),
    countdown: id('first-note-countdown'),
    band: id('first-note-band'),
    head: present([
      id('first-note-chip'),
      id('first-note-song'),
      id('first-note-words'),
    ]),
    mic: id('first-note-mic'),
    controls: present([
      id('first-note-demo-skip'),
      id('first-note-ask'),
      id('first-note-help'),
      id('first-note-demo-take'),
      id('first-note-songs'),
    ]),
  }
}

/** Where a tooltip points in the room as it is drawn now; null hides it. */
export function aimFirstNoteTip(
  target: DemoTarget,
  layer: HTMLElement,
): TipAim | null {
  return aimIn(measureFirstNoteScene(layer), (scene) =>
    tipTarget(target, scene),
  )
}
