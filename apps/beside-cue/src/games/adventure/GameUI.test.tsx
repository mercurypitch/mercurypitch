// Shared settings interaction — preferences, keyboard tabs and close events preserve the active owner.
import { fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal, onCleanup } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GlassGameHost } from '../../../../../packages/glass-game/src/host'
import { GAME_APPEARANCE_KEY, GAME_MATERIAL_KEY, } from '../../../../../packages/glass-game/src/ui/game-appearance'
import { GameAppearanceControls, GameMaterialControls, GameSettingsDialog, GameSurface, GameUIProvider, } from '../../../../../packages/glass-game/src/ui/GameUI'

beforeEach(() => {
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
      this.dispatchEvent(new Event('close'))
    },
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('data-theme')
})

function mount() {
  const store = new Map<string, string>()
  const writePreference = vi.fn((key: string, value: string) =>
    store.set(key, value),
  )
  const host = {
    readPreference: (key: string) => store.get(key) ?? null,
    writePreference,
  } as Pick<
    GlassGameHost,
    'readPreference' | 'writePreference'
  > as GlassGameHost
  const close = vi.fn()
  const closed = vi.fn()
  const exit = vi.fn()
  const mounted = vi.fn()
  const retired = vi.fn()

  function SceneOwner() {
    mounted()
    onCleanup(retired)
    return <div data-testid="live-scene" />
  }
  const [open, setOpen] = createSignal(true)
  const view = render(() => (
    <GameUIProvider host={host}>
      <SceneOwner />
      <GameSettingsDialog
        open={open()}
        onClose={() => {
          close()
          setOpen(false)
        }}
        onClosed={closed}
        onExit={exit}
        sections={[
          {
            id: 'sound',
            label: 'Sound',
            content: () => <p>Existing sound owner</p>,
          },
          {
            id: 'display',
            label: 'Display',
            content: () => <GameAppearanceControls />,
          },
          {
            id: 'advanced',
            label: 'Advanced',
            content: () => <GameMaterialControls />,
          },
        ]}
      />
    </GameUIProvider>
  ))
  return {
    ...view,
    close,
    closed,
    exit,
    writePreference,
    mounted,
    retired,
    setOpen,
  }
}

it('keeps tabs on one keyboard stop, supports arrows and leaves game ownership intact', () => {
  const view = mount()
  const sound = screen.getByRole('tab', { name: 'Sound' })
  const display = screen.getByRole('tab', { name: 'Display' })
  expect(sound.tabIndex).toBe(0)
  expect(display.tabIndex).toBe(-1)
  fireEvent.keyDown(sound, { key: 'ArrowRight' })
  expect(display).toHaveFocus()
  expect(display).toHaveAttribute('aria-selected', 'true')
  expect(sound.tabIndex).toBe(-1)
  fireEvent.click(screen.getByRole('button', { name: 'Celadon' }))
  fireEvent.click(screen.getByLabelText('Reduced transparency'))
  expect(view.container.querySelector('[data-game-theme]')).toHaveAttribute(
    'data-game-theme',
    'dark',
  )
  expect(
    view.writePreference.mock.calls.every(
      ([key]) => key === GAME_APPEARANCE_KEY,
    ),
  ).toBe(true)
  expect(view.mounted).toHaveBeenCalledOnce()
  expect(view.retired).not.toHaveBeenCalled()
  expect(view.close).not.toHaveBeenCalled()
})

it('bounds developer controls and restores only material defaults', () => {
  const view = mount()
  fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
  const opacity = screen.getByRole('slider', { name: 'Glass backing' })
  fireEvent.input(opacity, { target: { value: '.72' } })
  expect(JSON.parse(view.writePreference.mock.calls.at(-1)![1]).opacity).toBe(
    0.72,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Reset materials' }))
  expect(JSON.parse(view.writePreference.mock.calls.at(-1)![1]).opacity).toBe(
    0.88,
  )
  expect(
    view.writePreference.mock.calls.every(([key]) => key === GAME_MATERIAL_KEY),
  ).toBe(true)
})

it.each(['Close settings', 'Resume'])(
  'closes from %s exactly once and calls native-close handoff',
  (label) => {
    const view = mount()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(view.close).toHaveBeenCalledOnce()
    expect(view.closed).toHaveBeenCalledOnce()
  },
)

it('does not resume or hand focus away during navigation/unmount', () => {
  const view = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Museum' }))
  expect(view.exit).toHaveBeenCalledOnce()
  view.unmount()
  expect(view.close).not.toHaveBeenCalled()
  expect(view.closed).not.toHaveBeenCalled()
  expect(view.retired).toHaveBeenCalledOnce()
})

it('follows the app preset without rebuilding its scene or touching sound preferences', async () => {
  const view = mount()
  fireEvent.click(screen.getByRole('tab', { name: 'Display' }))
  fireEvent.click(screen.getByRole('button', { name: 'Follow app' }))
  document.documentElement.setAttribute('data-theme', 'forest')
  await Promise.resolve()
  expect(view.container.querySelector('[data-game-theme]')).toHaveAttribute(
    'data-game-theme',
    'dark',
  )
  document.documentElement.setAttribute('data-theme', 'light')
  await Promise.resolve()
  expect(view.container.querySelector('[data-game-theme]')).toHaveAttribute(
    'data-game-theme',
    'light',
  )
  expect(view.mounted).toHaveBeenCalledOnce()
  expect(view.retired).not.toHaveBeenCalled()
})

it('ignores a queued close event after the same dialog reopens for a tutorial return', () => {
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = false
  })
  const view = mount()
  const dialog = screen.getByRole('dialog', {
    name: 'Settings',
  }) as HTMLDialogElement
  view.setOpen(false)
  view.setOpen(true)
  dialog.dispatchEvent(new Event('close'))
  expect(dialog.open).toBe(true)
  expect(view.close).not.toHaveBeenCalled()
  expect(view.closed).not.toHaveBeenCalled()
})

it('resizes the decorative frame without remounting its navigation owner and disconnects on cleanup', () => {
  let width = 150
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({
      width,
      height: 48,
      x: 0,
      y: 0,
      top: 0,
      right: width,
      bottom: 48,
      left: 0,
      toJSON: () => ({}),
    }),
  )
  let resized = (): void => {}
  const disconnect = vi.fn()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback
      }
      observe(): void {}
      disconnect = disconnect
    },
  )
  const retired = vi.fn()

  function Navigation() {
    onCleanup(retired)
    return <button type="button">Museum frame owner</button>
  }
  const view = render(() => (
    <GameSurface kind="plaque">
      <Navigation />
    </GameSurface>
  ))
  try {
    const button = screen.getByRole('button', { name: 'Museum frame owner' })
    const frame = view.container.querySelector('[data-game-frame]')!
    expect(frame).toHaveAttribute('viewBox', '0 0 150 48')
    expect(frame).toHaveAttribute('data-game-frame', 'plaque')
    width = 48
    resized()
    expect(frame).toHaveAttribute('viewBox', '0 0 48 48')
    expect(frame).toHaveAttribute('data-game-frame', 'tile')
    expect(screen.getByRole('button', { name: 'Museum frame owner' })).toBe(
      button,
    )
    expect(retired).not.toHaveBeenCalled()
    view.unmount()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(retired).toHaveBeenCalledOnce()
  } finally {
    vi.unstubAllGlobals()
  }
})

it.each(['Crystal', 'Celadon'])(
  'keeps %s material opacity and corner preferences live on its existing frame',
  (theme) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 365,
      height: 300,
      x: 0,
      y: 0,
      top: 0,
      right: 365,
      bottom: 300,
      left: 0,
      toJSON: () => ({}),
    })
    const view = mount()
    fireEvent.click(screen.getByRole('tab', { name: 'Display' }))
    fireEvent.click(screen.getByRole('button', { name: theme }))
    fireEvent.click(screen.getByLabelText('Reduced transparency'))
    const root = view.container.querySelector<HTMLElement>('[data-game-theme]')!
    expect(root.style.getPropertyValue('--game-opacity')).toBe('1')
    expect(root.style.getPropertyValue('--game-settings-opacity')).toBe('1')
    fireEvent.click(screen.getByLabelText('Reduced transparency'))
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    const frame = view.container.querySelector('[data-game-frame]')!
    const outline = frame.querySelector('clipPath path')!
    const before = outline.getAttribute('d')
    fireEvent.input(screen.getByRole('slider', { name: 'Corner size' }), {
      target: { value: '32' },
    })
    expect(outline.getAttribute('d')).not.toBe(before)
    fireEvent.input(screen.getByRole('slider', { name: 'Glass backing' }), {
      target: { value: '.72' },
    })
    expect(root.style.getPropertyValue('--game-opacity')).toBe('0.72')
    expect(root.style.getPropertyValue('--game-settings-opacity')).toBe('0.72')
    expect(view.container.querySelector('[data-game-frame]')).toBe(frame)
    expect(view.mounted).toHaveBeenCalledOnce()
    expect(view.retired).not.toHaveBeenCalled()
  },
)
