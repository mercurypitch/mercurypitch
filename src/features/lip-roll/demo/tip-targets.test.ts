import { describe, expect, it } from 'vitest'
import type { Rect } from '@/components/demo-kit/tip-place'
import { inflate, overlapArea, placeTip } from '@/components/demo-kit/tip-place'
import type { DemoTarget } from './demo-cues'
import { DEMO_CUES, demoCueText } from './demo-cues'
import type { DemoScene, WaveMark } from './tip-targets'
import { mercBody, tipTarget } from './tip-targets'

// The room as the demo measured it in the built app at 390 x 844, safe
// areas 47 / 34, as each tooltip was up (px from the layer's top left;
// lip-demo walk, 15 Oct 2026): the controls stand still, the wave and
// Merc move.
const ROOM_390: Rect = { x: 0, y: 103, w: 390, h: 707 }
const SKIP_390: Rect = { x: 314, y: 111, w: 64, h: 44 }
const BAR_390: Rect = { x: 0, y: 103, w: 390, h: 3 }
const PILL_OFF_390: Rect = { x: 122.5, y: 646, w: 145, h: 36 }
const PILL_ON_390: Rect = { x: 135.5, y: 646, w: 119, h: 36 }
const MIC_390: Rect = { x: 153, y: 698, w: 84, h: 84 }

const waveAt = (crestX: number): WaveMark => ({
  crestX,
  halfWidth: 160.89,
  top: 390.1,
  root: 534.71,
})

const MERC = 187.2
const mercAt = (x: number, y: number): Rect => ({ x, y, w: MERC, h: MERC })

interface Moment {
  readonly wave: WaveMark
  readonly merc: Rect
  /** Merc measured a moment later, while the tooltip was still up. */
  readonly lane: readonly Rect[]
  readonly pill: Rect
}

/** Each tooltip's moment: where the wave's crest and Merc were. */
const MOMENTS_390: Record<Exclude<DemoTarget, 'mic'>, Moment> & {
  ride: Moment
  turn: Moment
} = {
  // Take 1, stopped short: the crest has left him, the top still dark.
  top: {
    wave: waveAt(164.9),
    merc: mercAt(48.3, 381.4),
    lane: [mercAt(56.1, 381.2)],
    pill: PILL_OFF_390,
  },
  // Take 1's break, on the way down, the camera standing.
  voice: {
    wave: waveAt(152.0),
    merc: mercAt(219, 439.2),
    lane: [],
    pill: PILL_OFF_390,
  },
  // Take 2 starting, the camera following: Merc at the playhead, the top
  // ahead of him; he climbs to the top while the tooltip is up.
  ride: {
    wave: waveAt(258.6),
    merc: mercAt(42.9, 427.3),
    lane: [mercAt(84.8, 297.7)],
    pill: PILL_ON_390,
  },
  // Take 2 at the top, the voice turning.
  turn: {
    wave: waveAt(152.0),
    merc: mercAt(84.8, 297.7),
    lane: [],
    pill: PILL_ON_390,
  },
  // Take 2's wave lit, Merc at its far foot.
  wave: {
    wave: waveAt(152.0),
    merc: mercAt(231.6, 441.6),
    lane: [],
    pill: PILL_ON_390,
  },
}

function scene(moment: Moment): DemoScene {
  return {
    room: ROOM_390,
    wave: moment.wave,
    merc: moment.merc,
    lane: moment.lane,
    bubble: null,
    chip: null,
    mic: MIC_390,
    controls: [SKIP_390, moment.pill, BAR_390],
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

function place(target: DemoTarget, s: DemoScene, text: string) {
  const aim = tipTarget(target, s)
  if (aim === null) throw new Error('no aim')
  const placed = placeTip({
    ...aim,
    bounds: s.room,
    maxWidth: 240,
    maxHeight: 3 * 17.55 + 19,
    size: textOf(text),
  })
  if (placed === null) throw new Error('no place')
  return { aim, placed }
}

describe("where the demo's tooltips go, on the bay as it was drawn", () => {
  for (const cue of DEMO_CUES) {
    if (cue.target === 'mic') continue
    const moment =
      cue.id === 'turn' || cue.id === 'ride'
        ? MOMENTS_390[cue.id]
        : MOMENTS_390[cue.target]
    it(`"${demoCueText(cue.id)}" sits clear of the controls, Merc and the water it explains`, () => {
      const s = scene(moment)
      const { aim, placed } = place(cue.target, s, demoCueText(cue.id))
      expect(placed.clear).toBe(true)
      const explained = aim.avoid[0]
      expect(overlapArea(placed.box, explained)).toBe(0)
      expect(overlapArea(placed.box, mercBody(moment.merc))).toBe(0)
      for (const later of moment.lane) {
        expect(overlapArea(placed.box, mercBody(later))).toBe(0)
      }
      expect(overlapArea(placed.box, inflate(MIC_390, 14))).toBe(0)
      for (const control of [SKIP_390, moment.pill, BAR_390]) {
        expect(overlapArea(placed.box, control)).toBe(0)
      }
      // The arrow touches the water it explains, from above or below.
      expect(placed.anchor.x).toBeGreaterThanOrEqual(explained.x - 0.5)
      expect(placed.anchor.x).toBeLessThanOrEqual(
        explained.x + explained.w + 0.5,
      )
    })
  }

  it('points at the top: the flat top and a little either side, crest line to root', () => {
    const band = tipTarget('top', scene(MOMENTS_390.top))?.avoid[0]
    // a (160.89) times f + 0.12 (0.0769 + 0.12) either side of the crest.
    expect(band?.x).toBeCloseTo(164.9 - 0.1969 * 160.89, 1)
    expect(band?.w).toBeCloseTo(2 * 0.1969 * 160.89, 1)
    expect(band?.y).toBe(390.1)
    expect(band?.h).toBeCloseTo(534.71 - 390.1, 6)
  })

  it('points at the water just behind the voice for the break', () => {
    const band = tipTarget('voice', scene(MOMENTS_390.voice))?.avoid[0]
    const voice = 219 + MERC / 2
    expect(band?.x).toBeCloseTo(voice - 0.12 * 390, 6)
    expect((band?.x ?? 0) + (band?.w ?? 0)).toBeCloseTo(voice + 0.02 * 390, 6)
  })

  it('goes under the wave when Merc stands on the top it explains', () => {
    const { placed } = place(
      'top',
      scene(MOMENTS_390.turn),
      demoCueText('turn'),
    )
    expect(placed.side).toBe('below')
    expect(placed.box.y).toBeGreaterThan(534.71)
  })

  it('keeps clear of where Merc will be, not only of where he is', () => {
    const s = scene(MOMENTS_390.top)
    const first = place('top', s, demoCueText('short')).placed
    // Merc's lane runs across the left of the spot it took: it moves over.
    const lane = [
      mercAt(first.box.x + 25 - 0.87 * MERC, first.box.y + 10 - 0.19 * MERC),
    ]
    expect(overlapArea(first.box, mercBody(lane[0]))).toBeGreaterThan(0)
    const moved = place('top', { ...s, lane }, demoCueText('short')).placed
    expect(moved.clear).toBe(true)
    expect(overlapArea(moved.box, mercBody(lane[0]))).toBe(0)
  })

  it('offers no tooltip on water that has scrolled off the screen', () => {
    const gone = scene({ ...MOMENTS_390.wave, wave: waveAt(-400) })
    expect(tipTarget('wave', gone)).toBeNull()
    expect(tipTarget('top', { ...gone, wave: null })).toBeNull()
  })

  it('puts the mic hint over the mic, clear of its ring', () => {
    // After Try it: the room at its start, its "?" in the corner, no pill.
    const s = {
      ...scene(MOMENTS_390.wave),
      controls: [{ x: 334, y: 111, w: 44, h: 44 }],
    }
    const { placed } = place('mic', s, 'Tap the mic to start.')
    expect(placed.side).toBe('above')
    expect(overlapArea(placed.box, inflate(MIC_390, 14))).toBe(0)
  })
})
