// Studio strip meter tests — a lane's level beside its fader, its gain reduction, the floor when stopped, and no screen-reader noise.
import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioLaneLevel } from '@/lib/studio/playback/transport'
import { STUDIO_FADER_MIN_DB } from '../timeline/StudioTrackControls'
import { STRIP_FLOOR_DB } from './strip-meter'
import { StudioStripMeter } from './StudioStripMeter'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A strip with a fader 34 px wide and 200 px tall, its cap 14 px. */
function mount(initial?: StudioLaneLevel) {
  const observed: Element[] = []
  const notify: (() => void)[] = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(measure: () => void) {
        notify.push(measure)
      }
      observe(element: Element) {
        observed.push(element)
      }
      disconnect() {}
    },
  )
  const [level, setLevel] = createSignal<StudioLaneLevel | undefined>(initial)
  const { container } = render(() => (
    <div data-strip>
      <input data-studio-fader type="range" style={{ '--cap': '14px' }} />
      <StudioStripMeter name="Bass" level={level()} />
    </div>
  ))
  const strip = container.querySelector<HTMLElement>('[data-strip]')!
  const fader = container.querySelector<HTMLElement>('[data-studio-fader]')!
  strip.getBoundingClientRect = () => new DOMRect(100, 50, 116, 400)
  fader.getBoundingClientRect = () => new DOMRect(141, 120, 34, 200)
  for (const measure of notify) measure()
  const meter = container.querySelector<HTMLElement>(
    '[data-studio-strip-meter]',
  )!
  return { meter, setLevel, observed, strip, fader }
}

describe('Studio strip meter', () => {
  it('stands beside the fader from its 0 dB mark to its -60 mark, out of the accessibility tree', () => {
    const { meter, observed, strip, fader } = mount()
    expect(meter).toHaveAttribute('aria-hidden', 'true')
    expect(observed).toEqual([strip, fader])
    // The cap's 186 px of travel spans the fader's +12 to -60 dB: the meter
    // starts 12 dB (31 px) down it, 70 px below the strip's top plus half
    // the cap, and runs the 60 dB (155 px) to the floor; 6 px right of it.
    expect(meter.style.top).toBe('108px')
    expect(meter.style.left).toBe('81px')
    expect(meter.style.height).toBe('155px')
    // Its floor is the fader's lowest mark.
    expect(STRIP_FLOOR_DB).toBe(STUDIO_FADER_MIN_DB)
  })

  it('draws the level after the fader and the gain reduction while the song plays, and the floor once it stops', () => {
    const { meter, setLevel } = mount()
    const level = () => meter.querySelector<HTMLElement>('i')!
    expect(meter).toHaveAttribute('title', 'Bass: press Play to see its level')
    expect(level().style.clipPath).toBe('inset(100% 0 0 0)')

    setLevel({ trackId: 'bass', peak: 0.125, reductionDb: -6, measurement: 1 })
    expect(meter).toHaveAttribute('data-level-db', '-18.1')
    expect(meter).toHaveAttribute('data-reduction-db', '-6.0')
    expect(level().style.clipPath).toMatch(/^inset\(30\.\d+% 0 0 0\)$/)
    const reduction = meter.querySelectorAll<HTMLElement>('i')[1]
    expect(reduction.style.transform).toBe('scaleY(0.25)')
    expect(meter.title).toBe(
      'Bass: peak -18.1 dB after the fader, 6.0 dB of gain reduction',
    )

    setLevel(undefined)
    expect(meter).not.toHaveAttribute('data-level-db')
    expect(level().style.clipPath).toBe('inset(100% 0 0 0)')
    expect(meter.querySelectorAll('i')).toHaveLength(1)
  })

  it('holds the highest peak while one measurement of the lane lasts', () => {
    const { meter, setLevel } = mount()
    setLevel({ trackId: 'bass', peak: 0.5, reductionDb: null, measurement: 1 })
    setLevel({
      trackId: 'bass',
      peak: 0.125,
      reductionDb: null,
      measurement: 1,
    })
    expect(meter.title).toBe('Bass: peak -6.0 dB after the fader')
  })

  it("starts the hold again from a seek's first reading: a quiet place after a loud one holds the quiet one", () => {
    const { meter, setLevel } = mount()
    // A chorus near -3 dB, then a press on a quiet intro: the lane meter
    // starts its next measurement from the frame the seek is heard.
    setLevel({ trackId: 'bass', peak: 0.7, reductionDb: null, measurement: 1 })
    expect(meter.title).toBe('Bass: peak -3.1 dB after the fader')
    setLevel({ trackId: 'bass', peak: 0.03, reductionDb: null, measurement: 2 })
    expect(meter.title).toBe('Bass: peak -30.5 dB after the fader')
    setLevel({ trackId: 'bass', peak: 0.02, reductionDb: null, measurement: 2 })
    expect(meter.title).toBe('Bass: peak -30.5 dB after the fader')
  })

  it('shows no gain reduction rail for a lane without a compressor or limiter', () => {
    const { meter } = mount({
      trackId: 'bass',
      peak: 0.5,
      reductionDb: null,
      measurement: 1,
    })
    expect(meter.querySelectorAll('i')).toHaveLength(1)
    expect(meter).not.toHaveAttribute('data-reduction-db')
    expect(meter.title).toBe('Bass: peak -6.0 dB after the fader')
  })
})
