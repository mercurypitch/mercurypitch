// Studio MIDI time tests — frames become ticks to the nearest and ticks frames exactly, at the sequence's tempo; a tick turned to frames comes back the same tick; a sequence's length covers its audio; a clip's window takes the ticks from its first source frame up to its last; a tick of a clip's sequence finds its song frame and back; a window ends on the frame that ends it on a tick exactly; and the song's beats fall on the sequence's ticks.
import { describe, expect, it } from 'vitest'
import { studioClipTickWindow, studioFramesToTicks, studioSongBeats, studioSongFrameToTick, studioTickAtOrBefore, studioTicksCovering, studioTicksToFrames, studioTickToSongFrame, studioWindowEndFrame, } from './time'

describe('studioFramesToTicks and studioTicksToFrames', () => {
  it('counts 960 ticks a beat at the tempo given', () => {
    expect(studioFramesToTicks(48_000, 120)).toBe(1920)
    expect(studioFramesToTicks(48_000, 90)).toBe(1440)
    expect(studioTicksToFrames(1920, 120)).toBe(48_000)
    expect(studioTicksToFrames(1, 100)).toBe(30)
  })

  it('rounds a frame to the nearest tick, and leaves a tick in frames unrounded', () => {
    // At 120 bpm a tick is 25 frames.
    expect(studioFramesToTicks(12, 120)).toBe(0)
    expect(studioFramesToTicks(13, 120)).toBe(1)
    expect(studioTicksToFrames(1, 130)).toBeCloseTo(48_000 / 2080, 9)
  })

  it.each([60, 97.3, 120, 133, 300])(
    'brings a tick turned to frames back to the same tick at %s bpm',
    (tempo) => {
      for (const tick of [0, 1, 7, 959, 960, 123_457, 9_999_999])
        expect(
          studioFramesToTicks(studioTicksToFrames(tick, tempo), tempo),
        ).toBe(tick)
    },
  )
})

describe('studioTicksCovering', () => {
  it('gives the fewest whole ticks whose render holds the frames, and at least one', () => {
    expect(studioTicksCovering(96_000, 120)).toBe(3840)
    expect(studioTicksCovering(96_001, 120)).toBe(3841)
    expect(studioTicksCovering(0, 120)).toBe(1)
    expect(
      studioTicksToFrames(studioTicksCovering(77_777, 97.3), 97.3),
    ).toBeGreaterThanOrEqual(77_777)
  })
})

describe('studioClipTickWindow', () => {
  it("takes the ticks from the clip's first source frame up to its last", () => {
    expect(
      studioClipTickWindow(
        { sourceInFrame: 24_000, sourceOutFrame: 96_000 },
        { tempoBpm: 120 },
      ),
    ).toEqual({ startTick: 960, endTick: 3840 })
  })

  it('leaves out a tick that sounds before the window, and keeps one on its first frame', () => {
    // Frame 24001 is a 25th of a tick past tick 960; frame 95999 the same short of 3840.
    expect(
      studioClipTickWindow(
        { sourceInFrame: 24_001, sourceOutFrame: 95_999 },
        { tempoBpm: 120 },
      ),
    ).toEqual({ startTick: 961, endTick: 3840 })
  })

  it('keeps a tick that sounds on the first frame at a tempo whose ticks fall between frames', () => {
    // Arrange: tick 1000 at 97.3 bpm sounds part way through a frame.
    const frame = studioTicksToFrames(1000, 97.3)

    // Act
    const window = studioClipTickWindow(
      { sourceInFrame: frame, sourceOutFrame: frame + 48_000 },
      { tempoBpm: 97.3 },
    )

    // Assert
    expect(window.startTick).toBe(1000)
  })
})

describe('a window ending on a tick', () => {
  it('ends on the frame whose window ends on that tick exactly, at tempos whose ticks fall on frames and between them', () => {
    // Act, Assert: every tick of a bar, at 120 bpm and at 97.3 and 300 bpm.
    for (const tempoBpm of [120, 97.3, 300])
      for (let tick = 1; tick <= 3840; tick += 7) {
        const frame = studioWindowEndFrame(tick, tempoBpm)
        expect(Number.isInteger(frame)).toBe(true)
        expect(
          studioClipTickWindow(
            { sourceInFrame: 0, sourceOutFrame: frame },
            { tempoBpm },
          ).endTick,
        ).toBe(tick)
      }
  })

  it('reaches the last whole tick at or before a frame', () => {
    // Act, Assert: at 120 bpm a tick is 25 frames.
    expect(studioTickAtOrBefore(96_000, 120)).toBe(3840)
    expect(studioTickAtOrBefore(96_024, 120)).toBe(3840)
    expect(studioTickAtOrBefore(96_025, 120)).toBe(3841)
  })
})

describe('a tick on the song', () => {
  const clip = { startFrame: 48_000, sourceInFrame: 24_000 }
  const sequence = { tempoBpm: 120 }

  it("finds the song frame a tick of the clip's sequence sounds on, and back", () => {
    expect(studioTickToSongFrame(clip, sequence, 960)).toBe(48_000)
    expect(studioTickToSongFrame(clip, sequence, 0)).toBe(24_000)
    expect(studioSongFrameToTick(clip, sequence, 48_000)).toBe(960)
    expect(studioSongFrameToTick(clip, sequence, 48_012.5)).toBe(960.5)
  })
})

describe('studioSongBeats', () => {
  it("lays the song's bar 1 on the sequence's tick at the song's first frame, a beat 960 ticks while the tempos agree", () => {
    // The sequence's tick 0 sounds at song frame 24000, half a second in.
    const beats = studioSongBeats(
      { startFrame: 48_000, sourceInFrame: 24_000 },
      { tempoBpm: 120 },
      120,
    )

    expect(beats).toEqual({ beatTicks: 960, originTick: -960 })
  })

  it('counts a beat of a slower song in more of the faster sequence’s ticks', () => {
    // A song at 90 bpm over notes laid at 120: a song beat is 4/3 of theirs.
    const beats = studioSongBeats(
      { startFrame: 0, sourceInFrame: 0 },
      { tempoBpm: 120 },
      90,
    )

    expect(beats.beatTicks).toBeCloseTo(1280, 9)
    expect(beats.originTick).toBe(0)
  })
})
