// Loading preview ownership — errors and stale callbacks never acquire another graphics context.
import { render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { beforeEach, expect, it, vi } from 'vitest'
import type { LoadingMercOptions } from '../../../../../packages/glass-game/src/render/loading-merc'
import { LoadingMerc } from '../../../../../packages/glass-game/src/ui/LoadingMerc'

const state = vi.hoisted(() => ({
  create: vi.fn(),
  attempts: [] as {
    canvas: HTMLCanvasElement
    options: LoadingMercOptions
    dispose: ReturnType<typeof vi.fn>
  }[],
}))
vi.mock('../../../../../packages/glass-game/src/render/loading-merc', () => ({
  createLoadingMerc: (
    canvas: HTMLCanvasElement,
    options: LoadingMercOptions,
  ) => {
    state.create()
    const attempt = { canvas, options, dispose: vi.fn() }
    state.attempts.push(attempt)
    return {
      dispose: attempt.dispose,
      setState: vi.fn(),
      setReducedMotion: vi.fn(),
    }
  },
}))

beforeEach(() => {
  state.create.mockClear()
  state.attempts.length = 0
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
})

it('mounts artwork directly when the recovery panel opens in error', () => {
  const { container } = render(() => (
    <LoadingMerc
      modelUrl="merc.glb"
      artUrl="merc.webp"
      generation={1}
      phase="error"
      completedUnits={0}
      totalUnits={1}
    />
  ))
  expect(state.create).not.toHaveBeenCalled()
  expect(container.querySelector('canvas')).toBeNull()
  expect(container.querySelector('img')).toHaveAttribute('src', 'merc.webp')
})

it('retires a pending preview on error and isolates retry from late callbacks and unmount', () => {
  const [phase, setPhase] = createSignal<'loading-assets' | 'error'>(
    'loading-assets',
  )
  const [generation, setGeneration] = createSignal(1)
  const { container, unmount } = render(() => (
    <LoadingMerc
      modelUrl="merc.glb"
      artUrl="merc.webp"
      generation={generation()}
      phase={phase()}
      completedUnits={0}
      totalUnits={1}
    />
  ))
  const first = state.attempts[0]!
  setPhase('error')
  expect(first.dispose).toHaveBeenCalledOnce()
  expect(container.querySelector('canvas')).toBeNull()
  first.options.onFirstFrame()
  first.options.onError(new Error('late failure'))
  expect(container.querySelector('canvas')).toBeNull()
  expect(state.create).toHaveBeenCalledOnce()

  setGeneration(2)
  setPhase('loading-assets')
  expect(state.create).toHaveBeenCalledTimes(2)
  const second = state.attempts[1]!
  expect(second.canvas).not.toBe(first.canvas)
  second.options.onFirstFrame()
  expect(screen.getByTestId('glass-loading-merc')).toHaveAttribute(
    'data-ready',
    'true',
  )
  first.options.onError(new Error('stale failure after retry'))
  expect(screen.getByTestId('glass-loading-merc')).toHaveAttribute(
    'data-ready',
    'true',
  )
  unmount()
  expect(second.dispose).toHaveBeenCalledOnce()
  second.options.onFirstFrame()
  expect(container.querySelector('canvas')).toBeNull()
})
