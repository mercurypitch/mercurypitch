// ============================================================
// signal-quality — the seam and the classifier
// ============================================================
//
// The classifier is the whole feature: if it fires on speech or silence the
// advisor is a nag, and if it misses a noisy room it is dead weight. Each
// stream below is a caricature of one real situation, built frame by frame.

import { beforeEach, describe, expect, it } from 'vitest'
import type { AudioEngine } from '@/lib/audio-engine'
import { YINDetector } from '@/lib/pitch-algorithms/yin-detector'
import { PitchDetector } from '@/lib/pitch-detector'
import { PracticeEngine } from '@/lib/practice-engine'
import type { DetectionFrameStats } from '@/lib/signal-quality'
import { classifySignalQuality, publishDetectionFrame, readSignalQuality, resetSignalQuality, } from '@/lib/signal-quality'

const GATE = 0.005 // the quiet preset's RMS gate
const FLOOR = 0.3

let t = 0

const frame = (over: Partial<DetectionFrameStats>): DetectionFrameStats => {
  t += 33 // ~30 fps, the practice loop's real cadence
  return {
    rms: 0.0005,
    clarity: 0,
    accepted: false,
    frequency: 0,
    gateRms: GATE,
    confidenceFloor: FLOOR,
    atMs: t,
    ...over,
  }
}

/** Ambient noise slipping the gates: 2-frame accepted stutters between
 *  energetic frames the confidence gate throws out. */
const feedNoisyRoom = (ms: number): void => {
  const until = t + ms
  while (t < until) {
    for (let i = 0; i < 2; i++)
      publishDetectionFrame(
        frame({
          rms: 0.012,
          clarity: FLOOR + 0.03,
          accepted: true,
          frequency: 233,
        }),
      )
    for (let i = 0; i < 4; i++)
      publishDetectionFrame(frame({ rms: 0.012, clarity: 0.15 }))
  }
}

/** Sustained singing in a quiet room: long confident runs, silent gaps. */
const feedCleanSinging = (ms: number): void => {
  const until = t + ms
  while (t < until) {
    for (let i = 0; i < 60; i++)
      publishDetectionFrame(
        frame({ rms: 0.05, clarity: 0.9, accepted: true, frequency: 220 }),
      )
    for (let i = 0; i < 10; i++) publishDetectionFrame(frame({ rms: 0.0005 }))
  }
}

/** Talking near the mic in a quiet room: plosives make short accepted runs,
 *  but the frames between words carry almost no energy. */
const feedSpeech = (ms: number): void => {
  const until = t + ms
  while (t < until) {
    for (let i = 0; i < 2; i++)
      publishDetectionFrame(
        frame({ rms: 0.02, clarity: 0.5, accepted: true, frequency: 180 }),
      )
    for (let i = 0; i < 12; i++) publishDetectionFrame(frame({ rms: 0.0008 }))
  }
}

beforeEach(() => {
  resetSignalQuality()
  t = 1_000_000
})

describe('classifySignalQuality', () => {
  it('calls a noisy room a noisy room', () => {
    feedNoisyRoom(8_000)
    const s = readSignalQuality()
    expect(s.blipRuns).toBeGreaterThanOrEqual(6)
    expect(s.ambientFloorRms).toBeGreaterThan(1.5 * GATE)
    expect(classifySignalQuality(s, { presetIsQuiet: true })).toBe(
      'noisy-environment',
    )
    // The stream's accepted frames barely clear the floor, so the verdict
    // holds even off the quiet preset.
    expect(classifySignalQuality(s, { presetIsQuiet: false })).toBe(
      'noisy-environment',
    )
  })

  it('never interrupts clean singing', () => {
    feedCleanSinging(8_000)
    const s = readSignalQuality()
    expect(s.blipRuns).toBe(0)
    expect(classifySignalQuality(s, { presetIsQuiet: true })).toBe('ok')
  })

  it('says nothing about silence', () => {
    for (let i = 0; i < 240; i++) publishDetectionFrame(frame({}))
    expect(
      classifySignalQuality(readSignalQuality(), { presetIsQuiet: true }),
    ).toBe('ok')
  })

  it('does not mistake speech for noise — blips alone are not enough', () => {
    feedSpeech(8_000)
    const s = readSignalQuality()
    // Speech DOES produce blip runs; what saves it is the near-silent floor
    // between words. Removing the floor condition must turn this test red.
    expect(s.blipRuns).toBeGreaterThanOrEqual(6)
    expect(s.ambientFloorRms).toBeLessThan(1.5 * GATE)
    expect(classifySignalQuality(s, { presetIsQuiet: true })).toBe('ok')
  })

  it('three seconds of real silence forgets the disturbance', () => {
    feedNoisyRoom(6_000)
    for (let i = 0; i < Math.ceil(3_500 / 33); i++)
      publishDetectionFrame(frame({ rms: 0.0005 }))
    const s = readSignalQuality()
    expect(s.blipRuns).toBe(0)
    expect(classifySignalQuality(s, { presetIsQuiet: true })).toBe('ok')
  })

  it('the ten-second window ages a disturbance out on its own', () => {
    feedNoisyRoom(5_000)
    feedCleanSinging(11_000)
    const s = readSignalQuality()
    expect(s.blipRuns).toBe(0)
    expect(classifySignalQuality(s, { presetIsQuiet: true })).toBe('ok')
  })
})

describe('PitchDetector telemetry', () => {
  const sine = (freq: number, amp = 0.5, length = 2048): Float32Array => {
    const buf = new Float32Array(length)
    for (let i = 0; i < buf.length; i++)
      buf[i] = amp * Math.sin((2 * Math.PI * freq * i) / 44100)
    return buf
  }

  it("a live detector's frames land in the seam, gates and all", () => {
    const detector = new PitchDetector({ telemetry: 'live' })
    detector.detect(sine(440))
    detector.detect(new Float32Array(2048)) // silence: RMS-gate rejection
    const s = readSignalQuality()
    expect(s.acceptedFrames).toBe(1)
    expect(s.rejectedFrames).toBe(1)
    expect(s.gateRms).toBeCloseTo(0.02) // DEFAULT_OPTIONS.minAmplitude
    expect(s.lastFrameAtMs).toBeGreaterThan(0)
  })

  it('a default detector publishes nothing — offline loops stay silent', () => {
    const detector = new PitchDetector()
    detector.detect(sine(440))
    detector.detect(new Float32Array(2048))
    const s = readSignalQuality()
    expect(s.acceptedFrames).toBe(0)
    expect(s.rejectedFrames).toBe(0)
    expect(s.lastFrameAtMs).toBe(0)
  })

  it('a frame the confidence gate rejects publishes its pre-gate clarity', () => {
    // Loud unpitched noise: passes the RMS gate at full energy, fails the
    // periodicity check — the published RMS is exactly the loud-but-unpitched
    // energy the classifier's ambient-floor signal is built on. Deterministic
    // LCG noise, so the frame rejects the same way every run.
    const noise = (amp: number): Float32Array => {
      const buf = new Float32Array(2048)
      let seed = 1234567
      for (let i = 0; i < buf.length; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        buf[i] = amp * ((seed / 0x7fffffff) * 2 - 1)
      }
      return buf
    }
    const detector = new PitchDetector({ telemetry: 'live' })
    const out = detector.detect(noise(0.3))
    expect(out.frequency).toBe(0)
    const s = readSignalQuality()
    expect(s.rejectedFrames).toBe(1)
    expect(s.ambientFloorRms).toBeGreaterThan(0.02)
  })

  it('the swift fallback path publishes too', () => {
    const detector = new PitchDetector({
      telemetry: 'live',
      algorithm: 'swift',
    })
    detector.detect(sine(440))
    const s = readSignalQuality()
    expect(s.acceptedFrames + s.rejectedFrames).toBe(1)
  })

  it('the YINDetector analysis wrapper stays off the seam too', () => {
    // It is driven by offline analysis paths; its normalized settings pin
    // telemetry off so a lab batch can never flood the advisor's window.
    const wrapper = new YINDetector({})
    wrapper.detect(sine(440))
    const s = readSignalQuality()
    expect(s.acceptedFrames).toBe(0)
    expect(s.lastFrameAtMs).toBe(0)
  })

  // The engine rebuilds its detector in two places (real sample rate on mic
  // start, buffer-size setting change); a rebuild that forgets telemetry
  // silently kills the advisor on exactly the devices it matters for.
  it('the detector the engine rebuilds on mic start still publishes', async () => {
    const engine = new PracticeEngine({
      init: () => Promise.resolve(),
      resume: () => Promise.resolve(),
      getSampleRate: () => 48000,
      getBufferSize: () => 2048,
      startMic: () => Promise.resolve(true),
      stopMic: () => {},
      isMicActive: () => true,
      onMicLost: () => () => {},
      getTimeData: () => new Float32Array(2048),
    } as unknown as AudioEngine)
    await engine.startMic()
    resetSignalQuality()
    const detector = (engine as unknown as { detector: PitchDetector }).detector
    detector.detect(sine(440))
    expect(readSignalQuality().acceptedFrames).toBe(1)
  })

  it('the detector rebuilt for a new buffer size still publishes', () => {
    const engine = new PracticeEngine({
      onMicLost: () => () => {},
    } as unknown as AudioEngine)
    engine.syncSettings({ bufferSize: 4096 })
    resetSignalQuality()
    const detector = (engine as unknown as { detector: PitchDetector }).detector
    detector.detect(sine(440, 0.5, 4096))
    expect(readSignalQuality().acceptedFrames).toBe(1)
  })
})
