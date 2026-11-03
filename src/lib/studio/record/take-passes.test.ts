// Studio take pass tests — a punch keeps exactly its range, and a loop take's passes meet frame to frame with none lost or doubled.
import { describe, expect, it } from 'vitest'
import { STUDIO_MAX_CLIP_PASSES } from '../model/clip-passes'
import { STUDIO_PUNCH_FADE_FRAMES, studioHeardPass, studioLoopPasses, studioMinPartialPass, studioPassSamples, studioPunchCut, } from './take-passes'
import { planStudioTake, studioPunchPreroll } from './take-plan'

const RANGE = { startFrame: 96000, endFrame: 192000 }

describe('Studio punch cut', () => {
  it('keeps the take frames heard inside the range, and nothing either side', () => {
    // The first sample lands on 40000: the range starts 56000 frames in.
    const cut = studioPunchCut(40000, RANGE, 200000)
    expect(cut).toEqual({
      startFrame: 96000,
      sourceInFrame: 56000,
      sourceOutFrame: 152000,
      fadeFrames: STUDIO_PUNCH_FADE_FRAMES,
    })
    // Its first kept sample lands on the in point, its last before the out point.
    expect(40000 + cut!.sourceInFrame).toBe(RANGE.startFrame)
    expect(40000 + cut!.sourceOutFrame).toBe(RANGE.endFrame)
    expect(cut!.sourceOutFrame - cut!.sourceInFrame).toBe(96000)
  })

  it('ends where the capture ends when Stop came before the out point', () => {
    expect(studioPunchCut(40000, RANGE, 100000)).toMatchObject({
      startFrame: 96000,
      sourceInFrame: 56000,
      sourceOutFrame: 100000,
    })
  })

  it('keeps nothing when the capture stops before a tenth of a second of the range', () => {
    expect(studioPunchCut(40000, RANGE, 56000 + 4799)).toBeNull()
    expect(studioPunchCut(40000, RANGE, 56000 + 4800)).not.toBeNull()
    expect(studioPunchCut(40000, RANGE, 1000)).toBeNull()
  })
})

describe('Studio loop passes', () => {
  it('cuts every pass on its own frames: they meet with none lost and none doubled', () => {
    const heardFirst = 96000 - 1234
    // Three whole passes and two seconds of a fourth.
    const captured = 1234 + 3 * 96000 + 96000
    const passes = studioLoopPasses(heardFirst, RANGE, captured, 48000)
    expect(passes).toEqual([
      { firstFrame: 1234, endFrame: 97234, complete: true },
      { firstFrame: 97234, endFrame: 193234, complete: true },
      { firstFrame: 193234, endFrame: 289234, complete: true },
      { firstFrame: 289234, endFrame: 385234, complete: true },
    ])
    for (let index = 1; index < passes.length; index++)
      expect(passes[index].firstFrame).toBe(passes[index - 1].endFrame)
    // Each pass's first sample lands on the range's start.
    passes.forEach((pass, index) =>
      expect(heardFirst + pass.firstFrame - index * 96000).toBe(96000),
    )
    expect(studioHeardPass(passes)).toBe(3)
  })

  it('keeps a pass cut short when it holds a second, padded to the range, and plays the newest whole one', () => {
    const heardFirst = 96000 - 1234
    const captured = 1234 + 96000 + 48000
    const passes = studioLoopPasses(heardFirst, RANGE, captured, 48000)
    expect(passes).toEqual([
      { firstFrame: 1234, endFrame: 97234, complete: true },
      { firstFrame: 97234, endFrame: 193234, complete: false },
    ])
    expect(studioHeardPass(passes)).toBe(0)
    const samples = Float32Array.from({ length: captured }, (_, i) => i + 1)
    const last = studioPassSamples(samples, passes[1])
    expect(last).toHaveLength(96000)
    expect(last[0]).toBe(97235)
    expect(last[47999]).toBe(captured)
    expect(last[48000]).toBe(0)
    // A complete pass is a view of the capture, not a copy.
    expect(studioPassSamples(samples, passes[0]).buffer).toBe(samples.buffer)
  })

  it('lets a pass barely begun go', () => {
    const heardFirst = 96000 - 1234
    const minimum = studioMinPartialPass(96000)
    expect(minimum).toBe(48000)
    const short = studioLoopPasses(
      heardFirst,
      RANGE,
      1234 + 96000 + minimum - 1,
      48000,
    )
    expect(short).toHaveLength(1)
    // Half the range for a range shorter than two seconds.
    expect(studioMinPartialPass(36000)).toBe(18000)
  })

  it('keeps a first pass cut short as the only one, and plays it', () => {
    const passes = studioLoopPasses(96000 - 1234, RANGE, 1234 + 60000, 48000)
    expect(passes).toEqual([
      { firstFrame: 1234, endFrame: 97234, complete: false },
    ])
    expect(studioHeardPass(passes)).toBe(0)
  })

  it('cuts a 44.1 kHz capture on the nearest frames of its own clock, still meeting end to start', () => {
    const heardFirst = 96000 - 1000
    const captured = Math.round(((1000 + 3 * 96000) * 44100) / 48000)
    const passes = studioLoopPasses(heardFirst, RANGE, captured, 44100)
    expect(passes).toHaveLength(3)
    expect(passes[0].firstFrame).toBe(Math.round((1000 * 44100) / 48000))
    for (let index = 1; index < passes.length; index++)
      expect(passes[index].firstFrame).toBe(passes[index - 1].endFrame)
    for (const pass of passes)
      expect(
        Math.abs(pass.endFrame - pass.firstFrame - 88200),
      ).toBeLessThanOrEqual(1)
  })

  it('keeps at most the passes a clip holds', () => {
    const short = { startFrame: 0, endFrame: 12000 }
    const passes = studioLoopPasses(0, short, 12000 * 40, 48000)
    expect(passes).toHaveLength(STUDIO_MAX_CLIP_PASSES)
  })
})

describe('Studio take plan', () => {
  it('starts a punch a bar early with no count-in, and the count-in long with one', () => {
    const cut = { mode: 'punch' as const, range: RANGE }
    const bar = studioPunchPreroll(120, 0)
    expect(bar).toBe(96000)
    expect(
      planStudioTake({
        cut,
        playing: false,
        playheadFrame: 5,
        countInBars: 0,
        tempoBpm: 120,
      }),
    ).toEqual({
      cut,
      songFrom: 0,
      fromFrame: 96000,
      countInSeconds: 0,
      stopAt: 192000,
    })
    const later = {
      mode: 'punch' as const,
      range: { startFrame: 400000, endFrame: 500000 },
    }
    expect(
      planStudioTake({
        cut: later,
        playing: true,
        playheadFrame: 5,
        countInBars: 2,
        tempoBpm: 120,
      }),
    ).toMatchObject({ songFrom: 400000 - 192000, countInSeconds: 0 })
  })

  it('counts in what the song start leaves short of a punch pre-roll', () => {
    const cut = {
      mode: 'punch' as const,
      range: { startFrame: 24000, endFrame: 96000 },
    }
    const plan = planStudioTake({
      cut,
      playing: false,
      playheadFrame: 0,
      countInBars: 0,
      tempoBpm: 120,
    })
    expect(plan.songFrom).toBe(0)
    expect(plan.countInSeconds).toBe(1.5)
  })

  it('loops from the range start after the count-in, stopping after the last pass a clip keeps', () => {
    const cut = { mode: 'loop' as const, range: RANGE }
    expect(
      planStudioTake({
        cut,
        playing: true,
        playheadFrame: 5,
        countInBars: 1,
        tempoBpm: 120,
      }),
    ).toEqual({
      cut,
      songFrom: 96000,
      fromFrame: 96000,
      countInSeconds: 2,
      stopAt: 96000 + STUDIO_MAX_CLIP_PASSES * 96000,
    })
  })

  it('records a plain take from the playhead, or along with a song that plays', () => {
    const request = {
      cut: null,
      playheadFrame: 4800,
      countInBars: 1,
      tempoBpm: 120,
    }
    expect(planStudioTake({ ...request, playing: false })).toEqual({
      cut: null,
      songFrom: 4800,
      fromFrame: 4800,
      countInSeconds: 2,
      stopAt: null,
    })
    expect(planStudioTake({ ...request, playing: true })).toMatchObject({
      songFrom: null,
      fromFrame: null,
      countInSeconds: 0,
    })
  })
})
