// ============================================================
// EchoClouds: the take's layer, loaded with the run and faded by its state
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLOUD_LAYER } from './echo-geometry'
import type { CloudState } from './EchoClouds'
import { EchoClouds } from './EchoClouds'

const motion = vi.hoisted(() => ({ reduced: false }))
vi.mock('@/components/room-kit/reduced-motion', () => ({
  prefersReducedMotion: () => motion.reduced,
}))

const BOX = { left: '0px', top: '-92px', width: '390px', height: '936px' }

beforeEach(() => {
  motion.reduced = false
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function mount(initial: CloudState, still = false) {
  const [state, setState] = createSignal(initial)
  render(() => <EchoClouds state={state()} box={BOX} still={still} />)
  return setState
}

const layer = () => screen.queryByTestId('echo-clouds')

describe("the take's clouds", () => {
  it("load unseen with the run, in the plate's own box", () => {
    mount({ present: true, on: false })

    expect(layer()?.style.opacity).toBe('0')
    expect(screen.getByTestId('echo-clouds-plate').style.top).toBe('-92px')
  })

  it("rise over the spec's fade when the take begins", () => {
    const set = mount({ present: true, on: false })
    set({ present: true, on: true })

    expect(layer()?.style.opacity).toBe('1')
    expect(layer()?.style.transition).toBe(
      `opacity ${CLOUD_LAYER.inMs}ms ease-out`,
    )
  })

  it('fade out for the result, then let their plate go', () => {
    const set = mount({ present: true, on: true })
    set({ present: false, on: false })

    expect(layer()?.style.opacity).toBe('0')
    expect(layer()?.style.transition).toBe(
      `opacity ${CLOUD_LAYER.outMs}ms ease-in`,
    )
    vi.advanceTimersByTime(CLOUD_LAYER.outMs - 1)
    expect(layer()).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(layer()).toBeNull()
  })

  it('stay if the take comes back before they have gone', () => {
    const set = mount({ present: true, on: true })
    set({ present: false, on: false })
    vi.advanceTimersByTime(CLOUD_LAYER.outMs / 2)
    set({ present: true, on: true })
    vi.advanceTimersByTime(CLOUD_LAYER.outMs)

    expect(layer()?.style.opacity).toBe('1')
  })

  it('show at once in a fixture, with no fade', () => {
    mount({ present: true, on: true }, true)

    expect(layer()?.style.opacity).toBe('1')
    expect(layer()?.style.transition).toBe('none')
  })

  it("show the demo's own layer through its first take, and only it", () => {
    mount({ present: true, on: true, look: 'demo-off' })

    expect(screen.getByTestId('echo-clouds-demo').style.opacity).toBe('1')
    expect(screen.getByTestId('echo-clouds-demo-plate').style.top).toBe('-92px')
    expect(layer()).toBeNull()
  })

  it("cross from the demo's layer to the take's over the spec's cross, then let it go", () => {
    const set = mount({ present: true, on: true, look: 'demo-off' })
    set({ present: true, on: true, look: 'mid-take' })
    const demo = () => screen.queryByTestId('echo-clouds-demo')

    expect(layer()?.style.opacity).toBe('1')
    expect(layer()?.style.transition).toBe(
      `opacity ${CLOUD_LAYER.crossMs}ms ease-in-out`,
    )
    expect(demo()?.style.opacity).toBe('0')
    expect(demo()?.style.transition).toBe(
      `opacity ${CLOUD_LAYER.crossMs}ms ease-in-out`,
    )
    vi.advanceTimersByTime(CLOUD_LAYER.crossMs - 1)
    expect(demo()).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(demo()).toBeNull()
  })

  it('come and go without a fade with reduced motion', () => {
    motion.reduced = true
    const set = mount({ present: true, on: true })
    set({ present: false, on: false })

    expect(layer()).toBeNull()
  })
})
