import { describe, expect, it } from 'vitest'
import { appendLiveVoicePoint, createLiveVoicePoint, pitchToMidi, } from './LiveVoiceCapture'

describe('live voice capture visual data', () => {
  it('maps detected pitch to MIDI while leaving uncertain frames unvoiced', () => {
    expect(pitchToMidi(440)).toBeCloseTo(69)
    expect(
      createLiveVoicePoint({ t: 0, f0: 440, conf: 0.8, rms: 0.04 }),
    ).toEqual({ level: expect.any(Number), pitch: 69 })
    expect(
      createLiveVoicePoint({ t: 0, f0: 440, conf: 0.2, rms: 0.04 }),
    ).toMatchObject({ pitch: null })
  })

  it('keeps a fixed recent window without mutating the previous history', () => {
    const previous = [
      { level: 0.1, pitch: 60 },
      { level: 0.2, pitch: 62 },
    ]

    const next = appendLiveVoicePoint(previous, { level: 0.3, pitch: 64 }, 2)

    expect(next).toEqual([
      { level: 0.2, pitch: 62 },
      { level: 0.3, pitch: 64 },
    ])
    expect(previous).toHaveLength(2)
  })
})
