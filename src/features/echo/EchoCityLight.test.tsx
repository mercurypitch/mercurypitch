// ============================================================
// EchoCityLight: the town's light per state, placed in the plate and crossfaded
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CityLightState } from './echo-art'
import { CITY_LIGHT } from './echo-geometry'
import { EchoCityLight } from './EchoCityLight'

const motion = vi.hoisted(() => ({ reduced: false }))
vi.mock('@/components/room-kit/reduced-motion', () => ({
  prefersReducedMotion: () => motion.reduced,
}))

const PLATE = { left: 0, top: -92, width: 390, height: 936 }

beforeEach(() => {
  motion.reduced = false
})

afterEach(cleanup)

function mount(initial: CityLightState | null, still = false) {
  const [state, setState] = createSignal(initial)
  render(() => <EchoCityLight state={state()} plate={PLATE} still={still} />)
  return setState
}

const layer = (state: CityLightState) =>
  screen.getByTestId(`echo-citylight-${state}`)
const px = (value: string) => Number.parseFloat(value)

describe("the town's city light", () => {
  it("places each state's layer at its offset in the plate's own box", () => {
    mount('intro')
    for (const state of ['intro', 'mid-take', 'demo-off'] as const) {
      const box = CITY_LIGHT.layers[state]
      const { style } = layer(state)

      expect(px(style.left)).toBeCloseTo(PLATE.left + box.left * PLATE.width, 2)
      expect(px(style.top)).toBeCloseTo(PLATE.top + box.top * PLATE.height, 2)
      expect(px(style.width)).toBeCloseTo(box.width * PLATE.width, 2)
      expect(px(style.height)).toBeCloseTo(box.height * PLATE.height, 2)
    }
  })

  it("shows the state's own layer at once, the others not at all", () => {
    mount('intro')

    expect(layer('intro').style.opacity).toBe(String(CITY_LIGHT.opacity.intro))
    expect(layer('mid-take').style.opacity).toBe('0')
    expect(layer('intro').style.transition).toBe('none')
    expect(screen.getByTestId('echo-citylight').dataset.state).toBe('intro')
  })

  it("crossfades to the take's light over the spec's fade", () => {
    const set = mount('intro')
    set('mid-take')
    const fade = `opacity ${CITY_LIGHT.crossMs}ms ${CITY_LIGHT.crossEase}`

    expect(layer('intro').style.opacity).toBe('0')
    expect(layer('mid-take').style.opacity).toBe('1')
    expect(layer('intro').style.transition).toBe(fade)
    expect(layer('mid-take').style.transition).toBe(fade)
  })

  it('goes out for the result, faster', () => {
    const set = mount('mid-take')
    set(null)

    expect(layer('intro').style.opacity).toBe('0')
    expect(layer('mid-take').style.opacity).toBe('0')
    expect(layer('mid-take').style.transition).toBe(
      `opacity ${CITY_LIGHT.outMs}ms ${CITY_LIGHT.outEase}`,
    )
    expect(screen.getByTestId('echo-citylight').dataset.state).toBe('none')
  })

  it('keeps its fades with reduced motion: opacity only, nothing moves', () => {
    motion.reduced = true
    const set = mount('intro')
    set('mid-take')

    expect(layer('mid-take').style.transition).toBe(
      `opacity ${CITY_LIGHT.crossMs}ms ${CITY_LIGHT.crossEase}`,
    )
    expect(layer('mid-take').style.transform).toBe('')
  })

  it('stands at its state in a fixture, with no fade', () => {
    const set = mount('mid-take', true)
    set('intro')

    expect(layer('intro').style.opacity).toBe('1')
    expect(layer('intro').style.transition).toBe('none')
  })
})
