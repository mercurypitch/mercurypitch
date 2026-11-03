// Studio lane curve tests — the knots a lane's stage ramps through stay on its lines, and a lane without lines gets none.
import { describe, expect, it } from 'vitest'
import { dbToGain } from '@/lib/studio-fx/dsp'
import { studioPanGains } from '../model/arrangement-plan'
import { withStudioAutomation } from '../model/automation'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioAutomationPoint, StudioTrack } from '../model/types'
import { automatedPanBase, studioKnotGainsAt, studioLaneAutomationKey, studioLaneKnots, } from './lane-automation'

const lane = (changes: Partial<StudioTrack> = {}): StudioTrack => ({
  ...studioFixture().project.tracks[0],
  ...changes,
})

const db = (gain: number) => 20 * Math.log10(gain)

/** The worst gap, in dB, between the knots' ramps and `exact`, frame by frame over [from, to). */
function worstGapDb(
  track: StudioTrack,
  exact: (frame: number) => readonly [number, number],
  from: number,
  to: number,
): number {
  const knots = studioLaneKnots(track)!
  let worst = 0
  for (let frame = from; frame < to; frame += 7) {
    const ramped = studioKnotGainsAt(knots, frame)
    const wanted = exact(frame)
    for (const side of [0, 1])
      if (wanted[side] > 1e-6)
        worst = Math.max(worst, Math.abs(db(ramped[side] / wanted[side])))
  }
  return worst
}

describe('Studio lane curves', () => {
  it('gives a lane without lines no knots, so its stage stays at unity', () => {
    // Act
    const knots = studioLaneKnots(lane({ gainDb: -6, pan: 0.5 }))

    // Assert
    expect(knots).toBeNull()
  })

  it('ramps a volume sweep across the whole fader within 0.02 dB of its line', () => {
    // Arrange
    const sweep: StudioAutomationPoint[] = [
      { frame: 0, value: -60 },
      { frame: 48000, value: 12 },
    ]
    const track = withStudioAutomation(lane({ gainDb: -6 }), 'volume', sweep)
    const exact = (frame: number) => {
      const gain = dbToGain(-60 + (72 * frame) / 48000 + 6)
      return [gain, gain] as const
    }

    // Act
    const gap = worstGapDb(track, exact, 0, 48000)

    // Assert
    expect(gap).toBeLessThan(0.02)
    expect(studioLaneKnots(track)!.length).toBeLessThanOrEqual(73)
  })

  it('ramps a pan sweep from full left to full right within 0.02 dB of the pan law on both sides', () => {
    // Arrange
    const sweep: StudioAutomationPoint[] = [
      { frame: 0, value: -1 },
      { frame: 96000, value: 1 },
    ]
    const track = withStudioAutomation(lane({ pan: 0.3 }), 'pan', sweep)
    const base = studioPanGains(automatedPanBase(track))
    const exact = (frame: number) => {
      const [left, right] = studioPanGains(-1 + (2 * frame) / 96000)
      return [left / base[0], right / base[1]] as const
    }

    // Act
    const gap = worstGapDb(track, exact, 0, 96000)

    // Assert
    expect(gap).toBeLessThan(0.02)
  })

  it('plays the line over the fader, so the faders and the stage together give the line', () => {
    // Arrange
    const track = withStudioAutomation(
      withStudioAutomation(lane({ gainDb: -6, pan: 0.25 }), 'volume', [
        { frame: 0, value: 0 },
      ]),
      'pan',
      [{ frame: 0, value: -0.5 }],
    )
    const faders = studioPanGains(automatedPanBase(track)).map(
      (side) => side * dbToGain(track.gainDb),
    )

    // Act
    const stage = studioKnotGainsAt(studioLaneKnots(track)!, 24000)

    // Assert
    const heard = faders.map((side, index) => side * stage[index])
    const wanted = studioPanGains(-0.5)
    expect(heard[0]).toBeCloseTo(wanted[0], 9)
    expect(heard[1]).toBeCloseTo(wanted[1], 9)
  })

  it('holds a hard-panned lane off zero on its far side while a pan line moves it', () => {
    // Arrange
    const panned = lane({ pan: -1 })

    // Act
    const bases = [
      automatedPanBase(panned),
      automatedPanBase(
        withStudioAutomation(panned, 'pan', [{ frame: 0, value: 1 }]),
      ),
    ]

    // Assert
    expect(bases[0]).toBe(-1)
    expect(bases[1]).toBeGreaterThan(-1)
    expect(studioPanGains(bases[1])[1]).toBeGreaterThan(0)
  })

  it('changes its key for a new line or the control under it, and not for balance or the other control', () => {
    // Arrange
    const line = [{ frame: 0, value: -3 }]
    const drawn = withStudioAutomation(lane(), 'volume', line)

    // Act
    const keys = [
      studioLaneAutomationKey(drawn),
      studioLaneAutomationKey({ ...drawn, balanceGainDb: 4, pan: 0.5 }),
      studioLaneAutomationKey({ ...drawn, gainDb: -10 }),
      studioLaneAutomationKey(
        withStudioAutomation(drawn, 'volume', [{ frame: 0, value: -4 }]),
      ),
      studioLaneAutomationKey(lane()),
    ]

    // Assert
    expect(keys[1]).toBe(keys[0])
    expect(keys[2]).not.toBe(keys[0])
    expect(keys[3]).not.toBe(keys[0])
    expect(keys[4]).toBeNull()
  })
})
