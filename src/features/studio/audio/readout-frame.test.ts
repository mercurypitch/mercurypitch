// Studio readout frame tests — a playing song's readouts move ten times a second, a seek, a loop or a stop shows at once.
import { createRoot } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { createStudioReadoutFrame } from './readout-frame'

const RATE = 48_000
const playing = (playheadFrame: number) => ({
  playing: true,
  pending: false,
  playheadFrame,
})

describe('Studio readout frame', () => {
  it('follows a playing song ten times a second instead of on every 33 ms tick', () => {
    createRoot((dispose) => {
      const readout = createStudioReadoutFrame(RATE)
      readout.follow(playing(0), 0)
      let changes = 0
      let last = readout.frame()
      // One second of ticks.
      for (let tick = 1; tick <= 30; tick++) {
        const at = tick * 33.3
        readout.follow(playing(Math.round((at / 1000) * RATE)), at)
        if (readout.frame() !== last) changes++
        last = readout.frame()
      }
      expect(changes).toBeLessThanOrEqual(10)
      expect(changes).toBeGreaterThanOrEqual(8)
      // Never more than a tenth of a second behind.
      expect(RATE - readout.frame()).toBeLessThanOrEqual(0.1 * RATE)
      dispose()
    })
  })

  it('shows a seek, a loop and a stop at once', () => {
    createRoot((dispose) => {
      const readout = createStudioReadoutFrame(RATE)
      readout.follow(playing(0), 0)
      readout.follow(playing(1600), 33)
      // A seek forward by ten seconds, 33 ms later.
      readout.follow(playing(10 * RATE), 66)
      expect(readout.frame()).toBe(10 * RATE)
      // The loop wraps to the top.
      readout.follow(playing(100), 99)
      expect(readout.frame()).toBe(100)
      readout.follow(playing(1700), 132)
      readout.follow(
        { playing: false, pending: false, playheadFrame: 1750 },
        140,
      )
      expect(readout.frame()).toBe(1750)
      dispose()
    })
  })
})
