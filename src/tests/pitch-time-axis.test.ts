import { describe, expect, it } from 'vitest'
import { chooseLabelStep, formatSecondsAgo, noteAxisSemitoneStep, timeAxisTicks, } from '@/components/pitch-time-axis'

// The pitch tracker squeezes its timeline into ~45% of the canvas width and
// insets both axes by a 32px MARGIN, so the usable time axis is roughly
// `canvasWidth * 0.45 - 32` px. Model that so the cases below reflect how the
// labels actually land on real devices.
const timeAxisWidth = (canvasW: number) => canvasW * 0.45 - 32

describe('chooseLabelStep', () => {
  it('keeps the finest step when there is room', () => {
    expect(chooseLabelStep(40, 34, [1, 2, 5])).toBe(1)
  })

  it('coarsens the step when labels would collide', () => {
    // 10px per unit: 1× and 2× are under the 34px gap, 5× = 50px clears it.
    expect(chooseLabelStep(10, 34, [1, 2, 5])).toBe(5)
  })

  it('falls back to the coarsest step when everything is too tight', () => {
    expect(chooseLabelStep(1, 34, [1, 2, 5])).toBe(5)
  })
})

describe('formatSecondsAgo', () => {
  it('labels the newest edge as "now"', () => {
    expect(formatSecondsAgo(0)).toBe('now')
  })

  it('keeps other labels short instead of a growing absolute clock', () => {
    expect(formatSecondsAgo(2)).toBe('2s')
    expect(formatSecondsAgo(10)).toBe('10s')
  })
})

describe('timeAxisTicks (mobile small screens)', () => {
  it('never places two second-labels closer than the min gap on a phone', () => {
    const window = 10
    const width = timeAxisWidth(330) // ~117px on a ~330px mobile canvas
    const minGap = 34
    const ticks = timeAxisTicks(width, window, minGap)
    const pxPerSec = width / window

    expect(ticks.length).toBeGreaterThan(1)
    for (let i = 1; i < ticks.length; i++) {
      const dxPx = (ticks[i]!.secondsAgo - ticks[i - 1]!.secondsAgo) * pxPerSec
      expect(dxPx).toBeGreaterThanOrEqual(minGap)
    }
  })

  it('keeps every label short (<= 3 chars) no matter how long the run is', () => {
    for (const canvasW of [200, 330, 390, 768, 1280]) {
      for (const window of [6, 10, 30]) {
        for (const t of timeAxisTicks(timeAxisWidth(canvasW), window)) {
          expect(t.label.length).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it('pins the newest tick as "now"', () => {
    const ticks = timeAxisTicks(timeAxisWidth(390), 10)
    expect(ticks[0]).toEqual({ secondsAgo: 0, label: 'now' })
  })

  it('never runs a tick past the end of the window', () => {
    const window = 10
    for (const canvasW of [200, 330, 390, 768]) {
      for (const t of timeAxisTicks(timeAxisWidth(canvasW), window)) {
        expect(t.secondsAgo).toBeGreaterThanOrEqual(0)
        expect(t.secondsAgo).toBeLessThanOrEqual(window)
      }
    }
  })

  it('packs more ticks on a wide desktop canvas than on a phone', () => {
    const phone = timeAxisTicks(timeAxisWidth(360), 10).length
    const desktop = timeAxisTicks(timeAxisWidth(1280), 10).length
    expect(desktop).toBeGreaterThan(phone)
  })

  it('degrades to a single "now" tick when there is no width', () => {
    expect(timeAxisTicks(0, 10)).toEqual([{ secondsAgo: 0, label: 'now' }])
  })
})

describe('noteAxisSemitoneStep (manual-zoom note legend)', () => {
  it('labels every semitone when the tracker is tall', () => {
    // ~336px plot over 1.4 octaves ≈ 20px per semitone — room for all.
    expect(noteAxisSemitoneStep(336, 1.4, 14)).toBe(1)
  })

  it('skips semitones on a short mobile tracker so the notes do not jam', () => {
    // A 148px mobile tracker leaves ~84px of plot; ~5px per semitone.
    const height = 84
    const octaves = 1.4
    const step = noteAxisSemitoneStep(height, octaves, 14)
    expect(step).toBeGreaterThan(1)
    const pxPerSemitone = height / (octaves * 12)
    expect(step * pxPerSemitone).toBeGreaterThanOrEqual(14)
  })
})
