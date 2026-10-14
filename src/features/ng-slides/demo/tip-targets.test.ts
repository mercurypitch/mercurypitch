import { describe, expect, it } from 'vitest'
import type { Rect } from '@/components/demo-kit/tip-place'
import { inflate, overlapArea, placeTip } from '@/components/demo-kit/tip-place'
import type { DemoTarget } from './demo-cues'
import { DEMO_CUES, demoCueText } from './demo-cues'
import type { ArchMark, DemoScene } from './tip-targets'
import { tipTarget } from './tip-targets'

// The room as the demo measured it in the built app at 390 x 844, as each
// tooltip showed (px from the room's top left; ng-demo walk, 14 Oct 2026):
// the controls stand still, the bridge and Merc move.
const ROOM_390: Rect = { x: 0, y: 56, w: 390, h: 788 }
const CONTROLS_390: readonly Rect[] = [
  { x: 314, y: 62, w: 64, h: 44 },
  { x: 122.5, y: 680, w: 145, h: 36 },
]
const MIC_390: Rect = { x: 153, y: 732, w: 84, h: 84 }

const archAt = (apexX: number): ArchMark => ({
  apexX,
  halfWidth: 154.3,
  top: 309.2,
  deck: 462.6,
})

const mercAt = (y: number): Rect => ({ x: 66.3, y, w: 140.4, h: 140.4 })

/** Each tooltip's moment: where the arch's apex and Merc were. */
const MOMENTS_390: Record<
  Exclude<DemoTarget, 'mic'>,
  { arch: ArchMark; merc: Rect }
> = {
  // Take 1's first jump: the arch's left half sung, Merc on the third.
  sung: { arch: archAt(154.6), merc: mercAt(261.8) },
  // The break: on the way down, the hum stopped at Merc's feet.
  playhead: { arch: archAt(-5.6), merc: mercAt(338.9) },
  // Take 2 at the top note, Merc standing on it.
  top: { arch: archAt(85.5), merc: mercAt(201.9) },
  // Take 2's arch lit, its end under the playhead.
  arch: { arch: archAt(-39.8), merc: mercAt(349.4) },
}

function scene(moment: { arch: ArchMark; merc: Rect }): DemoScene {
  return {
    room: ROOM_390,
    arch: moment.arch,
    playheadX: 0.35 * 390,
    merc: moment.merc,
    chip: null,
    mic: MIC_390,
    controls: CONTROLS_390,
  }
}

/**
 * A tooltip's text at 13 px as the phone set it: 7.1 px a character,
 * wrapped at word breaks, 17.55 px a line inside an 18 px frame.
 */
function textOf(text: string) {
  return (maxWidth: number): { w: number; h: number } => {
    const room = Math.floor((maxWidth - 18) / 7.1)
    const lines: string[] = []
    for (const word of text.split(' ')) {
      const last = lines[lines.length - 1]
      if (last !== undefined && last.length + 1 + word.length <= room) {
        lines[lines.length - 1] = `${last} ${word}`
      } else lines.push(word)
    }
    const widest = Math.max(...lines.map((line) => line.length))
    return {
      w: Math.min(maxWidth, 18 + 7.1 * widest),
      h: 18 + 17.55 * lines.length,
    }
  }
}

/** Merc's body inside his canvas (tip-targets.ts mercBody). */
const body = (canvas: Rect): Rect => ({
  x: canvas.x + canvas.w * 0.26,
  y: canvas.y + canvas.h * 0.3,
  w: canvas.w * 0.48,
  h: canvas.h * 0.58,
})

describe("where the demo's tooltips go, on the bridge as it was drawn", () => {
  for (const cue of DEMO_CUES) {
    if (cue.target === 'mic') continue
    const target = cue.target
    it(`"${demoCueText(cue.id)}" sits clear of the controls, Merc and the glass it explains`, () => {
      const s = scene(MOMENTS_390[target])
      const aim = tipTarget(target, s)
      expect(aim).not.toBeNull()
      if (aim === null) return
      const place = placeTip({
        ...aim,
        bounds: s.room,
        maxWidth: 240,
        maxHeight: 3 * 17.55 + 19,
        size: textOf(demoCueText(cue.id)),
      })
      expect(place).not.toBeNull()
      if (place === null) return
      expect(place.clear).toBe(true)
      const explained = aim.avoid[0]
      expect(overlapArea(place.box, explained)).toBe(0)
      expect(overlapArea(place.box, body(s.merc ?? mercAt(0)))).toBe(0)
      expect(overlapArea(place.box, inflate(MIC_390, 14))).toBe(0)
      for (const control of CONTROLS_390) {
        expect(overlapArea(place.box, control)).toBe(0)
      }
      // The arrow touches the glass it explains, from above or below.
      const anchor = place.anchor
      expect(anchor.x).toBeGreaterThanOrEqual(explained.x - 0.5)
      expect(anchor.x).toBeLessThanOrEqual(explained.x + explained.w + 0.5)
    })
  }

  it('points at the glass sung so far: from the arch foot, or the screen edge, to the playhead', () => {
    const s = scene(MOMENTS_390.sung)
    const band = tipTarget('sung', s)?.avoid[0]
    expect(band?.x).toBeCloseTo(154.6 - 154.3, 6)
    expect(band?.y).toBe(309.2)
    expect((band?.x ?? 0) + (band?.w ?? 0)).toBeCloseTo(0.35 * 390, 6)
    expect(band?.h).toBeCloseTo(462.6 - 309.2, 6)
    // The arch's foot scrolled off the screen: the band starts at its edge.
    const later = tipTarget('sung', scene(MOMENTS_390.playhead))?.avoid[0]
    expect(later?.x).toBe(0)
  })

  it('goes under the arch when Merc stands on the top note it explains', () => {
    const s = scene(MOMENTS_390.top)
    const aim = tipTarget('top', s)
    if (aim === null) throw new Error('no aim')
    const place = placeTip({
      ...aim,
      bounds: s.room,
      maxWidth: 240,
      size: textOf(demoCueText('turn')),
    })
    expect(place?.side).toBe('below')
    expect(place?.box.y).toBeGreaterThan(462.6)
  })

  it('offers no tooltip on glass that has scrolled off the screen', () => {
    const gone = scene({ arch: archAt(-400), merc: mercAt(300) })
    expect(tipTarget('arch', gone)).toBeNull()
    expect(tipTarget('sung', { ...gone, arch: null })).toBeNull()
  })

  it('puts the mic hint over the mic, clear of its ring', () => {
    // After Try it: the room at its start, its "?" in the corner, no pill.
    const s = {
      ...scene(MOMENTS_390.arch),
      controls: [{ x: 334, y: 62, w: 44, h: 44 }],
    }
    const aim = tipTarget('mic', s)
    if (aim === null) throw new Error('no aim')
    const place = placeTip({
      ...aim,
      bounds: s.room,
      maxWidth: 240,
      size: textOf('Tap the mic to start.'),
    })
    expect(place?.side).toBe('above')
    expect(overlapArea(place?.box ?? MIC_390, inflate(MIC_390, 14))).toBe(0)
  })
})
