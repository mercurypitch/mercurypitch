// Gallery settings interruption — the real adventure owner requires a fresh resume after backgrounding.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GLASSWORKS } from '../../../../../packages/glass-game/src/content/glassworks'
import type { GlassGameHost } from '../../../../../packages/glass-game/src/host'
import { AdventureSettings } from '../../../../../packages/glass-game/src/ui/AdventureSettings'
import { GameUIProvider } from '../../../../../packages/glass-game/src/ui/GameUI'
import { useAdventure } from '../../../../../packages/glass-game/src/ui/useAdventure'

const renderer = vi.hoisted(() => ({
  ready: Promise.resolve(true),
  getRenderQuality: () => ({ profile: 'high' }),
  getChallengeCameraMetrics: () => null,
  getMovementYaw: () => 0,
  nearbyArtwork: () => null,
  render: () => true,
  setMovementActive: vi.fn(),
  setOrbitActive: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('../../../../../packages/glass-game/src/render/glass-renderer', () => ({
  createGlassRenderer: () => renderer,
}))

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false
      setTimeout(() => this.dispatchEvent(new Event('close')), 0)
    },
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function mountAdventure() {
  const foregroundListeners = new Set<(foreground: boolean) => void>()
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  const prepare = vi.fn(() => ({ ready: Promise.resolve(true), release: vi.fn() }))
  const createVoice = vi.fn()
  const host: GlassGameHost = {
    assetUrl: (id) => id,
    prepareVoiceGesture: prepare,
    createVoice,
    createSound: vi.fn(),
    loadProgress: () => null,
    saveProgress: vi.fn(),
    readPreference: (key) => (key.startsWith('tutorial') ? 'seen' : null),
    writePreference: vi.fn(),
    subscribeForeground: (listener) => {
      foregroundListeners.add(listener)
      return () => foregroundListeners.delete(listener)
    },
    onExit: vi.fn(),
  }
  let adventure!: ReturnType<typeof useAdventure>
  let viewport!: HTMLDivElement

  function Visit() {
    adventure = useAdventure(host, GLASSWORKS, () => viewport)
    return (
      <GameUIProvider host={host}>
        <div ref={viewport} tabIndex={-1} />
        <button type="button" onClick={adventure.pause}>
          Open settings
        </button>
        <AdventureSettings
          host={host}
          adventure={adventure}
          onPreviewCamera={vi.fn()}
          onClosed={vi.fn()}
        />
      </GameUIProvider>
    )
  }
  const view = render(Visit)
  await Promise.resolve()
  now = 2_100
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((callback) => callback(now))
  expect(adventure.ready()).toBe(true)
  const foreground = (value: boolean) =>
    foregroundListeners.forEach((listener) => listener(value))
  return {
    ...view,
    adventure,
    prepare,
    createVoice,
    foreground,
    foregroundListeners,
  }
}

it.each(['close', 'resume', 'escape'] as const)(
  'keeps background interruption paused after settings %s, then accepts a fresh Resume',
  async (gesture) => {
    const view = await mountAdventure()
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    view.foreground(false)
    view.foreground(true)
    // A later manual pause must not erase the interruption for this visit.
    view.adventure.pause()
    if (gesture === 'escape')
      fireEvent(
        screen.getByRole('dialog', { name: 'Settings' }),
        new Event('cancel', { cancelable: true }),
      )
    else
      fireEvent.click(
        screen.getByRole('button', {
          name: gesture === 'close' ? 'Close settings' : /^Resume$/,
        }),
      )
    expect(view.adventure.paused()).toBe(true)
    expect(view.adventure.snapshot().paused).toBe(true)
    expect(view.prepare).not.toHaveBeenCalled()
    expect(view.createVoice).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()
    const paused = screen.getByRole('dialog', { name: 'Museum paused' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(paused.querySelector('button')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: /^Resume$/ }))
    expect(view.adventure.paused()).toBe(false)
    expect(view.adventure.snapshot().paused).toBe(false)
    expect(view.prepare).toHaveBeenCalledOnce()
    expect(view.createVoice).not.toHaveBeenCalled()
    view.unmount()
    expect(view.foregroundListeners.size).toBe(0)
  },
)

it('resumes ordinary settings close without a second pause surface', async () => {
  const view = await mountAdventure()
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
  expect(view.adventure.paused()).toBe(false)
  expect(view.prepare).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog', { name: 'Museum paused' })).toBeNull()
  view.unmount()
})

it('keeps the existing one-gesture resume when backgrounding began during play', async () => {
  const view = await mountAdventure()
  view.foreground(false)
  view.foreground(false)
  view.foreground(true)
  fireEvent.click(screen.getByRole('button', { name: /^Resume$/ }))
  expect(view.adventure.paused()).toBe(false)
  expect(view.prepare).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog', { name: 'Museum paused' })).toBeNull()
  view.unmount()
})

it('preserves interruption while revisiting tabs and rejects resume while still backgrounded', async () => {
  const view = await mountAdventure()
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
  view.foreground(false)
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
  fireEvent.click(screen.getByRole('button', { name: /^Resume$/ }))
  expect(view.adventure.paused()).toBe(true)
  expect(view.prepare).not.toHaveBeenCalled()
  view.foreground(true)
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
  expect(screen.queryByRole('dialog', { name: 'Museum paused' })).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'Display' }))
  fireEvent.click(screen.getByRole('button', { name: 'Celadon' }))
  fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
  expect(view.adventure.paused()).toBe(true)
  expect(screen.getByRole('dialog', { name: 'Museum paused' })).toBeVisible()
  expect(view.prepare).not.toHaveBeenCalled()
  fireEvent(
    screen.getByRole('dialog', { name: 'Museum paused' }),
    new Event('cancel', { cancelable: true }),
  )
  expect(view.adventure.paused()).toBe(false)
  expect(view.prepare).toHaveBeenCalledOnce()
  view.unmount()
})
