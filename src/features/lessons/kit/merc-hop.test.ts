// Merc's hop: one hop of the named Merc, HOP_MS long, and none while motion is held still.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as HopModule from './merc-hop'
import type * as MotionModule from './motion-switch'

/** The hop module, fresh, under a system setting that does or does not reduce motion. */
async function hopModules(reduce: boolean): Promise<{
  hop: typeof HopModule
  motion: typeof MotionModule
}> {
  vi.resetModules()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  const motion = await import('./motion-switch')
  const hop = await import('./merc-hop')
  return { hop, motion }
}

/** Merc and Tavi on the stage, each with a recorded `animate`. */
function stage(): {
  blue: ReturnType<typeof vi.fn>
  orange: ReturnType<typeof vi.fn>
} {
  document.body.innerHTML =
    '<div id="mercBlue"></div><div id="mercOrange"></div>'
  const blue = vi.fn()
  const orange = vi.fn()
  Object.assign(document.querySelector('#mercBlue') ?? {}, { animate: blue })
  Object.assign(document.querySelector('#mercOrange') ?? {}, {
    animate: orange,
  })
  return { blue, orange }
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('mercHop', () => {
  it('hops the named Merc once, for HOP_MS, crouching before it rises', async () => {
    // Arrange
    const { hop } = await hopModules(false)
    const { blue, orange } = stage()

    // Act
    hop.mercHop('blue')

    // Assert
    expect(hop.HOP_MS).toBe(530)
    expect(blue).toHaveBeenCalledTimes(1)
    expect(orange).not.toHaveBeenCalled()
    const [frames, options] = blue.mock.calls[0] as [
      Keyframe[],
      KeyframeAnimationOptions,
    ]
    expect(options).toEqual({ duration: 530 })
    expect(frames.map((f) => f.transform)).toEqual([
      'none',
      'translateY(3%) scaleY(0.94)',
      'translateY(-7%)',
      'none',
    ])
  })

  it('does not hop under reduced motion, or once animations are paused', async () => {
    // Arrange
    const still = await hopModules(true)
    const reduced = stage()

    // Act
    still.hop.mercHop('orange')

    // Assert
    expect(reduced.orange).not.toHaveBeenCalled()

    // Arrange
    const { hop, motion } = await hopModules(false)
    const paused = stage()
    motion.Motion.set(true)

    // Act
    hop.mercHop('blue')

    // Assert
    expect(paused.blue).not.toHaveBeenCalled()
  })
})
