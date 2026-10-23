// ============================================================
// Lesson 5 one hold on the page's frame loop — a steady note counts in full
// ============================================================
//
// A hold's seconds are the microphone's frames. The pitch stream polls its
// analyser on a requestAnimationFrame of its own (src/lib/pitch-f0-stream.ts)
// and stamps each frame on performance.now; the take ends on those frames'
// clock, ticking on its own frame or a 100 ms timer (kit/listen.ts,
// `takeFrames`); the reader counts the seconds in the band and decides an
// early stop from the same frames (kit/hold-take.ts, `readHold`). No
// figure's drawer paces any of it, so a hold whose page frame loop rests
// part way through (the ring scrolled out of view while it turns) still
// counts every second of a steady note and reports no stop. The detector is
// a double that hears A3 in every frame: what is tested is what paces the
// frames, not how a pitch is found in them.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { BandChart } from '@/features/lessons/kit/band-chart'
import { handLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import type { HoldReading } from '@/features/lessons/kit/hold-take'
import type { Listener } from '@/features/lessons/kit/listen'
import type { HoldPhase, SingView } from './sing-view'

vi.mock('@/lib/pitch-detector', () => ({
  PitchDetector: class {
    detect(): { frequency: number; clarity: number } {
      return { frequency: 220, clarity: 0.95 }
    }
    resetHistory(): void {
      // a steady note has no history to clear
    }
  },
}))

const STILLS = { blue: '/stills/blue.webp', orange: '/stills/orange.webp' }

/** The two Mercs and a ring on its own, in the page. */
function ringEl(): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div id="mercBlue"></div><div id="mercOrange"></div><div class="ring"><svg><circle class="ring-progress" r="182"></circle><circle class="ring-breath" r="150"></circle><g class="ring-ripples"></g></svg><img class="ring-merc" alt=""><p class="ring-note"></p><p class="ring-state"></p></div>`
  document.body.appendChild(root)
  const el = root.querySelector<HTMLElement>('.ring')
  if (el === null) throw new Error('no ring')
  return el
}

/** An audio graph that is only there: the detector double hears the note. */
function audioContext(): AudioContext {
  const node = (): object => ({
    connect: () => undefined,
    disconnect: () => undefined,
  })
  return {
    sampleRate: 48_000,
    destination: {},
    createMediaStreamSource: node,
    createAnalyser: () => ({
      ...node(),
      fftSize: 2048,
      getFloatTimeDomainData: () => undefined,
    }),
    createGain: () => ({ ...node(), gain: { value: 1 } }),
  } as unknown as AudioContext
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('a hold on the page frame loop', () => {
  it('counts all fifteen seconds of a steady A3, with no stop, though the loop rests from the fifth', async () => {
    // Arrange
    const h = await handLoop()
    // the loop's own frame, asked for as it starts
    const loopFrame = h.asked[0]
    const { mountRing } = await import('@/features/lessons/kit/sing')
    const mod = await import('@/features/lessons/kit/listen')
    const reader = await import('@/features/lessons/kit/hold-take')
    const { createF0Stream } = await import('@/lib/pitch-f0-stream')
    const { holdOne } = await import('./sing-hold')
    const el = ringEl()
    const ring = mountRing(el, { stills: STILLS })
    h.see(el)
    const stream = createF0Stream(audioContext(), {} as MediaStream)
    const listener = {
      holding: true,
      stream,
      latest: () => stream.latestSmoothed(),
      release: () => undefined,
      releaseNow: () => undefined,
    } as Listener
    const scene = { glow: 0, line: [], head: null, lit: false }
    const chart = {
      scene,
      setTarget: () => undefined,
      setWindow: () => undefined,
    } as unknown as BandChart
    const view = { chart, ring, now: () => undefined } as unknown as SingView
    const phases: HoldPhase[] = []
    let reading: HoldReading | null | undefined
    void holdOne({
      mod,
      reader,
      listener,
      view,
      which: 'blue',
      midi: 57,
      length: 15,
      label: 'A3 · 220 Hz',
      cancelled: () => false,
      onPhase: (p) => phases.push(p),
    }).then((r) => {
      reading = r
    })
    // one frame of the page, and the promises it settles
    const frame = async (): Promise<void> => {
      h.frame()
      for (let i = 0; i < 8; i++) await Promise.resolve()
    }

    // Act: Merc's note and the breath, until the voice is heard
    const start = performance.now()
    while (scene.head === null && performance.now() - start < 5000)
      await frame()
    const voiced = performance.now()
    // five seconds of the hold, the ring on screen and turning
    let loopAskedSeen = 0
    while (performance.now() - voiced < 5000) {
      await frame()
      if (h.asked.includes(loopFrame)) loopAskedSeen += 1
    }
    // the ring leaves the screen: nothing else draws, and the loop rests
    h.see(el, false)
    await frame()
    await frame()
    let loopAsked = 0
    while (reading === undefined && performance.now() - voiced < 20_000) {
      await frame()
      if (reading === undefined && h.asked.includes(loopFrame)) loopAsked += 1
    }
    const took = (performance.now() - voiced) / 1000
    stream.dispose()

    // Assert
    expect(voiced - start).toBeLessThan(5000)
    // the loop drew the turning ring every frame, then asked for none
    expect(loopAskedSeen).toBe(Math.ceil(5000 / 16))
    expect(loopAsked).toBe(0)
    expect(reading).toMatchObject({
      kind: 'read',
      inBand: 15,
      of: 15,
      stoppedAt: null,
      line: 'In the band for all 15 seconds.',
    })
    expect(took).toBeGreaterThanOrEqual(15)
    expect(took).toBeLessThan(15.2)
    expect(phases).toEqual(['listen', 'breathe', 'sing'])
  })
})
