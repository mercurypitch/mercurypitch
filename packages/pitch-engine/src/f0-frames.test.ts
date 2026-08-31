import { describe, expect, it } from 'vitest'
import { BRIDGE_MS, createFrameAssembler } from './f0-frames'

const WORKLET_HOP = 1024 / 48000 // ~21 ms
const FRAME_HOP = 1 / 60 // ~17 ms

const voiced = (t: number, f0: number, rms = 0.2) => ({ t, f0, conf: 0.9, rms })
const silent = (t: number, rms = 0.01) => ({ t, f0: 0, conf: 0, rms })

describe('the frame assembler', () => {
  it('records nothing until a take starts', () => {
    const a = createFrameAssembler(FRAME_HOP)
    a.ingest(voiced(0, 220))
    expect(a.latest()).toBeNull()
    expect(a.takeFrames()).toEqual([])
  })

  it('keeps the recorded take raw, and smooths only the live view', () => {
    const a = createFrameAssembler(FRAME_HOP)
    a.startTake()
    // A run of 220 Hz with one wild octave flicker in the middle.
    for (const f0 of [220, 220, 440, 220, 220]) a.ingest(voiced(0, f0))

    // The median kills the flicker for the view the game reads...
    expect(a.latestSmoothed()?.f0).toBe(220)
    // ...but the take keeps every reading, because metrics must be honest.
    expect(a.takeFrames().map((f) => f.f0)).toEqual([220, 220, 440, 220, 220])
  })

  it('bridges a gap for the same duration whatever the hop is', () => {
    // The bridge is 130 ms of held pitch. It used to be eight frames,
    // which only meant 130 ms while the hop happened to be a rendered
    // frame — the whole point of moving to the audio clock.
    const bridgedFrames = (hop: number): number => {
      const a = createFrameAssembler(hop)
      a.startTake()
      a.ingest(voiced(0, 220))
      let held = 0
      for (let i = 1; a.latestSmoothed()?.f0 === 220 && i < 100; i++) {
        a.ingest(silent(i * hop))
        if (a.latestSmoothed()?.f0 === 220) held++
      }
      return held
    }

    const workletHeld = bridgedFrames(WORKLET_HOP)
    const frameHeld = bridgedFrames(FRAME_HOP)

    // Different frame counts...
    expect(workletHeld).toBeLessThan(frameHeld)
    // ...for the same stretch of wall-clock time.
    expect(workletHeld * WORKLET_HOP * 1000).toBeCloseTo(BRIDGE_MS, -1)
    expect(frameHeld * FRAME_HOP * 1000).toBeCloseTo(BRIDGE_MS, -1)
  })

  it('drops the held pitch once the bridge runs out', () => {
    const a = createFrameAssembler(FRAME_HOP)
    a.startTake()
    a.ingest(voiced(0, 220))
    for (let i = 1; i < 40; i++) a.ingest(silent(i * FRAME_HOP))
    expect(a.latestSmoothed()?.f0).toBe(0)
  })

  it('re-derives the bridge when the stream learns its real hop', () => {
    const a = createFrameAssembler(FRAME_HOP)
    a.setHopSeconds(WORKLET_HOP)
    a.startTake()
    a.ingest(voiced(0, 220))
    let held = 0
    for (let i = 1; a.latestSmoothed()?.f0 === 220 && i < 100; i++) {
      a.ingest(silent(i * WORKLET_HOP))
      if (a.latestSmoothed()?.f0 === 220) held++
    }
    expect(held * WORKLET_HOP * 1000).toBeCloseTo(BRIDGE_MS, -1)
  })

  it('remembers the loudest moment of the take, not the latest', () => {
    const a = createFrameAssembler(FRAME_HOP)
    a.startTake()
    a.ingest(voiced(0, 220, 0.3))
    a.ingest(voiced(0.02, 220, 0.7))
    a.ingest(voiced(0.04, 220, 0.1))
    expect(a.maxLevel()).toBeCloseTo(0.7)
    expect(a.latestLevel()).toBeCloseTo(0.1)
  })

  it('starts each take clean', () => {
    const a = createFrameAssembler(FRAME_HOP)
    a.startTake()
    a.ingest(voiced(0, 220, 0.8))
    a.takeFrames()
    a.startTake()
    expect(a.latest()).toBeNull()
    expect(a.latestSmoothed()).toBeNull()
    expect(a.maxLevel()).toBe(0)
  })

  it('stops recording when the frames are taken', () => {
    const a = createFrameAssembler(FRAME_HOP)
    a.startTake()
    expect(a.isRecording()).toBe(true)
    a.takeFrames()
    expect(a.isRecording()).toBe(false)
    a.ingest(voiced(0, 220))
    expect(a.takeFrames()).toEqual([])
  })
})
